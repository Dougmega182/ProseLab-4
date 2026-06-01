"""
Top-level pipeline — ties retrieve → extract → detect → merge.

Public API:
    analyze_chapter(manuscript_path, chapter_num, ...) -> AnalysisResult
    apply_delta(delta, report, store_entries, store_path) -> MergeResult

Author UX:
    - Clean chapters auto-merge silently
    - Dirty chapters produce a `pending/` markdown file for review
    - Each pass writes both the delta JSON and the rendered conflict report
    - Idempotent: re-running with the same pass_id is a no-op

Idempotency contract:
    A canon entry's `extracted_at_pass` field carries the pass that wrote it.
    If a pass_id already has entries in the store, the merge is treated as
    already-applied (no-op). To re-apply: drop the existing entries first
    (out of scope; happens via supersession, not delete).
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Callable, Optional

from .manuscript import Manuscript
from .schemas import CanonEntry, ConflictReport, StateDelta
from .conflicts import detect_conflicts, render_report_markdown
from .extractor import extract_delta
from .store import (
    OPEN_LOOP_PREFIX,
    RESOLVED_LOOP_PREFIX,
    DEFAULT_STORE_PATH,
    append_many,
    load,
    save,
    supersede,
)


log = logging.getLogger(__name__)

PENDING_DIR = Path(__file__).parents[2] / "data" / "pending"
DEFAULT_PASS_ID_FORMAT = "%Y%m%dT%H%M%SZ"


# ---------------------------------------------------------------------------
# Result types
# ---------------------------------------------------------------------------

class AnalysisStatus(str, Enum):
    MERGED = "merged"                # clean → applied to canon
    PENDING_REVIEW = "pending_review"  # HIGH conflicts → human required
    SKIPPED_IDEMPOTENT = "skipped_idempotent"  # pass already applied
    FAILED = "failed"                # extractor failure, etc.


@dataclass
class MergeResult:
    """Outcome of applying a delta to the store."""
    new_entries_added: int
    loops_resolved: int
    loops_opened: int
    entries_superseded: int
    versioned_ids: dict[str, str]    # {original_id: versioned_id} for retcons


@dataclass
class AnalysisResult:
    status: AnalysisStatus
    chapter: float
    pass_id: str
    delta: Optional[StateDelta]
    report: Optional[ConflictReport]
    merge: Optional[MergeResult] = None
    pending_path: Optional[Path] = None
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# Idempotency check
# ---------------------------------------------------------------------------

def _pass_already_applied(pass_id: str, entries: list[CanonEntry]) -> bool:
    """True if any active entry in the store was written by this pass."""
    return any(
        e.extracted_at_pass == pass_id and e.is_active()
        for e in entries
    )


# ---------------------------------------------------------------------------
# Merge — apply a clean delta to the store
# ---------------------------------------------------------------------------

def _versioned_id(original_id: str, existing_ids: set[str]) -> str:
    """Generate a unique versioned slug: original.v2, original.v3, …"""
    n = 2
    while True:
        candidate = f"{original_id}.v{n}"
        if candidate not in existing_ids:
            return candidate
        n += 1
        if n > 999:
            raise RuntimeError(f"Refusing to version id past v999: {original_id}")


def apply_delta(
    delta: StateDelta,
    report: ConflictReport,
    *,
    store_path: Optional[Path | str] = None,
) -> MergeResult:
    """
    Apply a delta to the canon store.

    REQUIRES report.clean_to_merge == True. Caller is responsible for routing
    HIGH-conflict deltas to pending review instead.

    Behavior:
        - new_entries with no id collision → appended as-is
        - new_entries with LOW retcon conflict → versioned id + supersede old
        - resolved_loops → create RESOLVED marker entry + supersede old loop
        - new_loops → appended as-is (Pydantic + conflicts enforce shape)
    """
    if not report.clean_to_merge:
        raise ValueError(
            "Refusing to merge a delta with HIGH conflicts. "
            "Route to pending review instead."
        )

    path = Path(store_path) if store_path else DEFAULT_STORE_PATH
    entries = load(path)
    existing_ids: set[str] = {e.id for e in entries}
    by_id: dict[str, CanonEntry] = {e.id: e for e in entries}

    added: list[CanonEntry] = []
    supersessions: list[tuple[str, str]] = []   # (old_id, new_id)
    versioned: dict[str, str] = {}
    loops_resolved = 0
    loops_opened = 0

    # 1. new_entries
    for incoming in delta.new_entries:
        if incoming.id in existing_ids:
            existing = by_id[incoming.id]
            if not existing.is_active():
                # Writing to a superseded id — auto-version and add
                new_id = _versioned_id(incoming.id, existing_ids)
                versioned[incoming.id] = new_id
                added.append(incoming.model_copy(update={"id": new_id}))
                existing_ids.add(new_id)
                continue

            # Same active id — same value (silent) or LOW/MEDIUM retcon
            from .conflicts import values_differ_substantively
            if not values_differ_substantively(existing.value, incoming.value):
                # No-op; identical
                continue

            # LOW/MEDIUM → version + supersede
            new_id = _versioned_id(incoming.id, existing_ids)
            versioned[incoming.id] = new_id
            added.append(incoming.model_copy(update={"id": new_id}))
            existing_ids.add(new_id)
            supersessions.append((incoming.id, new_id))
            continue

        # Clean addition
        added.append(incoming)
        existing_ids.add(incoming.id)

    # 2. new_loops
    for loop in delta.new_loops:
        if loop.id in existing_ids:
            # Auto-version to avoid id collision; rare edge case
            new_id = _versioned_id(loop.id, existing_ids)
            versioned[loop.id] = new_id
            added.append(loop.model_copy(update={"id": new_id}))
            existing_ids.add(new_id)
        else:
            added.append(loop)
            existing_ids.add(loop.id)
        loops_opened += 1

    # 3. Persist new_entries + new_loops in one atomic save
    if added:
        append_many(added, path)

    # 4. resolved_loops — create RESOLVED markers + supersede
    for loop_id in delta.resolved_loops:
        loop = next(
            (e for e in load(path) if e.id == loop_id and e.is_active()),
            None,
        )
        if loop is None:
            # Shouldn't happen — clean_to_merge implies validated above.
            # Defensive skip rather than crash.
            log.warning("resolved_loops references missing %r; skipping", loop_id)
            continue

        resolved_id = f"{loop_id}.resolved_ch{int(delta.chapter * 10):04d}"
        marker = CanonEntry(
            id=resolved_id,
            namespace="plot",
            value=(
                f"{RESOLVED_LOOP_PREFIX} Resolved in Chapter {delta.chapter}. "
                f"Original: {loop.value[len(OPEN_LOOP_PREFIX):].strip()}"
            ),
            confidence="event",
            source_chapter=int(delta.chapter) if delta.chapter == int(delta.chapter)
                                              else int(delta.chapter),
            extracted_at_pass=delta.pass_id,
        )
        append_many([marker], path)
        supersede(loop_id, resolved_id, path)
        loops_resolved += 1

    # 5. Apply value-supersessions from step 1
    for old_id, new_id in supersessions:
        supersede(old_id, new_id, path)

    return MergeResult(
        new_entries_added=len([e for e in added if not e.value.startswith(OPEN_LOOP_PREFIX)]),
        loops_resolved=loops_resolved,
        loops_opened=loops_opened,
        entries_superseded=len(supersessions) + loops_resolved,
        versioned_ids=versioned,
    )


# ---------------------------------------------------------------------------
# Pending review writer
# ---------------------------------------------------------------------------

def _write_pending(
    delta: StateDelta,
    report: ConflictReport,
    pending_dir: Path,
) -> Path:
    pending_dir.mkdir(parents=True, exist_ok=True)
    safe_pass = delta.pass_id.replace(":", "-").replace("/", "-")
    chapter_label = (
        f"{int(delta.chapter)}" if delta.chapter == int(delta.chapter)
        else f"{delta.chapter}"
    )
    base = f"ch{chapter_label}__{safe_pass}"

    md_path = pending_dir / f"{base}.md"
    md_path.write_text(
        render_report_markdown(report, delta=delta),
        encoding="utf-8",
    )

    json_path = pending_dir / f"{base}.delta.json"
    json_path.write_text(
        json.dumps(json.loads(delta.model_dump_json()), indent=2),
        encoding="utf-8",
    )

    report_path = pending_dir / f"{base}.report.json"
    report_path.write_text(
        json.dumps(json.loads(report.model_dump_json()), indent=2),
        encoding="utf-8",
    )

    return md_path


# ---------------------------------------------------------------------------
# Pipeline entry point
# ---------------------------------------------------------------------------

# Type alias for an extractor function (so tests can inject mocks)
ExtractorFn = Callable[..., StateDelta]


def analyze_chapter(
    *,
    manuscript: Manuscript,
    chapter_num: float | int | str,
    canon_store_path: Optional[Path | str] = None,
    pass_id: Optional[str] = None,
    pending_dir: Optional[Path | str] = None,
    extractor_fn: Optional[ExtractorFn] = None,
    auto_merge_clean: bool = True,
    **extractor_kwargs,
) -> AnalysisResult:
    """
    Run the full pipeline for one chapter.

    Args:
        manuscript: loaded Manuscript
        chapter_num: 1, 7.5, "PROLOGUE", etc.
        canon_store_path: store file (None = package default)
        pass_id: tag for this run; auto-generated if None
        pending_dir: where to write pending review markdown (None = default)
        extractor_fn: override the extractor (for tests; default = extract_delta)
        auto_merge_clean: if False, returns the report but skips merge
                          (useful for "dry run" inspection)
        **extractor_kwargs: passed through to the extractor

    Returns:
        AnalysisResult with status and all artifacts.
    """
    pass_id = pass_id or datetime.now(timezone.utc).strftime(DEFAULT_PASS_ID_FORMAT)
    pending_dir = Path(pending_dir) if pending_dir else PENDING_DIR
    store_path = Path(canon_store_path) if canon_store_path else DEFAULT_STORE_PATH

    chapter = manuscript.chapter_by_number(chapter_num)
    if chapter is None:
        return AnalysisResult(
            status=AnalysisStatus.FAILED,
            chapter=float(chapter_num) if isinstance(chapter_num, (int, float)) else -1,
            pass_id=pass_id,
            delta=None,
            report=None,
            error=f"Chapter {chapter_num!r} not found in manuscript.",
        )

    # Idempotency: if this pass already wrote entries, treat as already-applied
    store_entries = load(store_path)
    if _pass_already_applied(pass_id, store_entries):
        return AnalysisResult(
            status=AnalysisStatus.SKIPPED_IDEMPOTENT,
            chapter=chapter.number,
            pass_id=pass_id,
            delta=None,
            report=None,
        )

    # 1. Extract
    fn = extractor_fn or extract_delta
    try:
        delta = fn(
            manuscript=manuscript,
            chapter_num=chapter_num,
            canon_store_path=store_path,
            pass_id=pass_id,
            **extractor_kwargs,
        )
    except Exception as e:
        log.exception("Extraction failed for chapter %s", chapter.display_number)
        return AnalysisResult(
            status=AnalysisStatus.FAILED,
            chapter=chapter.number,
            pass_id=pass_id,
            delta=None,
            report=None,
            error=f"Extraction failed: {e}",
        )

    # 2. Detect
    store_entries = load(store_path)   # reload in case extractor touched it
    report = detect_conflicts(delta, store_entries)

    # 2.5 Inevitability Engine (Logical & Character Axiom Continuity Check)
    from .inevitability import detect_inevitability_conflicts
    inevitability_conflicts = detect_inevitability_conflicts(
        chapter_num=chapter.number,
        chapter_text=chapter.text,
        store_entries=store_entries,
    )
    if inevitability_conflicts:
        report.conflicts.extend(inevitability_conflicts)
        # Update clean_to_merge if any HIGH conflict was found
        report.clean_to_merge = not any(c.severity == "HIGH" for c in report.conflicts)

    # 3. Decide: merge or pend
    if report.clean_to_merge and auto_merge_clean:
        merge = apply_delta(delta, report, store_path=store_path)
        return AnalysisResult(
            status=AnalysisStatus.MERGED,
            chapter=chapter.number,
            pass_id=pass_id,
            delta=delta,
            report=report,
            merge=merge,
        )

    pending_path = _write_pending(delta, report, pending_dir)
    return AnalysisResult(
        status=AnalysisStatus.PENDING_REVIEW,
        chapter=chapter.number,
        pass_id=pass_id,
        delta=delta,
        report=report,
        pending_path=pending_path,
    )
