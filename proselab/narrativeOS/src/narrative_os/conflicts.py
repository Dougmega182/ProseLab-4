"""
Conflict detection — the system's actual product.

Compares a StateDelta against the existing canon store and produces a
ConflictReport. The detector is deterministic, tier-aware, and explicit
about WHY each conflict was flagged so the author can act on it.

Detection rules (v1, deterministic):

  Same-ID match in store + value differs:
    - existing.confidence == "hard_canon"  → HIGH, CANON_VIOLATION, block
    - existing.confidence == "event"       → MEDIUM, TIMELINE, flag
    - existing.confidence == "inferred"    → LOW, CHARACTER_STATE, retcon

  resolved_loops references:
    - Entry not found in store              → HIGH, LOOP_DOUBLE_RESOLVE, flag
    - Entry already superseded              → MEDIUM, LOOP_DOUBLE_RESOLVE, flag
    - Entry is not actually an OPEN loop    → MEDIUM, LOOP_DOUBLE_RESOLVE, flag

  Identical values (after normalization)    → no conflict, silent skip

What v1 does NOT detect:
  - Cross-ID semantic contradictions
    (existing 'world.ics_ceiling' = "3" vs new 'world.ics_top' = "5")
    The convention is: reuse the existing ID when updating. The extractor
    prompt instructs accordingly. v2 may add LLM-assisted semantic compare.
  - Orphan entity references (new entry for entity not in store)
  - Timeline ordering across multiple events

Public API:
    detect_conflicts(delta, store_entries) -> ConflictReport
    render_report_markdown(report, store_entries) -> str
"""

from __future__ import annotations

import re
from typing import Optional

from .schemas import (
    CanonEntry,
    Conflict,
    ConflictReport,
    StateDelta,
)
from .store import OPEN_LOOP_PREFIX


# ---------------------------------------------------------------------------
# Normalization for value comparison
# ---------------------------------------------------------------------------

_WHITESPACE = re.compile(r"\s+")
_PUNCT = re.compile(r"[\"',;:!?.\(\)\-—–]")


def _normalize_value(s: str) -> str:
    """
    Normalize a value string for comparison.

    Strips case, collapses whitespace, removes light punctuation.
    Intentionally simple — false negatives (missed conflicts) are recoverable;
    false positives (spurious flags) erode author trust faster.
    """
    if not s:
        return ""
    out = s.strip().lower()
    out = _PUNCT.sub(" ", out)
    out = _WHITESPACE.sub(" ", out)
    return out.strip()


def values_differ_substantively(existing: str, incoming: str) -> bool:
    """True iff the normalized values are not equal."""
    return _normalize_value(existing) != _normalize_value(incoming)


# ---------------------------------------------------------------------------
# Conflict classification
# ---------------------------------------------------------------------------

def _classify_value_conflict(
    existing: CanonEntry,
    incoming: CanonEntry,
) -> Conflict:
    """
    Build a Conflict for a same-id value mismatch.

    Severity, type, and suggested action are driven by the EXISTING entry's
    confidence tier (the more conservative path).
    """
    if existing.confidence == "hard_canon":
        return Conflict(
            severity="HIGH",
            type="CANON_VIOLATION",
            existing_entry_id=existing.id,
            existing_value=existing.value,
            existing_source=existing.source_chapter,
            incoming_value=incoming.value,
            incoming_source=incoming.source_chapter,
            suggested_action="block",
            note=(
                "Hard-canon entry value differs from existing. Either "
                "the chapter is breaking established canon (revise chapter), "
                "or the canon was wrong (retcon and supersede)."
            ),
        )

    if existing.confidence == "event":
        return Conflict(
            severity="MEDIUM",
            type="TIMELINE",
            existing_entry_id=existing.id,
            existing_value=existing.value,
            existing_source=existing.source_chapter,
            incoming_value=incoming.value,
            incoming_source=incoming.source_chapter,
            suggested_action="flag",
            note=(
                "Event entry's value changed. Verify timeline consistency: "
                "is this a retelling, a contradiction, or a corrected detail?"
            ),
        )

    # inferred
    namespace_type = (
        "CHARACTER_STATE" if existing.namespace == "character" else "TIMELINE"
    )
    return Conflict(
        severity="LOW",
        type=namespace_type,  # type: ignore[arg-type]
        existing_entry_id=existing.id,
        existing_value=existing.value,
        existing_source=existing.source_chapter,
        incoming_value=incoming.value,
        incoming_source=incoming.source_chapter,
        suggested_action="retcon",
        note=(
            "Inferred reading updated. Likely a natural evolution of the "
            "interpretation — supersede the old reading unless author objects."
        ),
    )


def _classify_loop_issue(
    loop_id: str,
    existing: Optional[CanonEntry],
    chapter: int,
) -> Optional[Conflict]:
    """Return a Conflict if resolving `loop_id` is problematic; None if OK."""
    if existing is None:
        return Conflict(
            severity="HIGH",
            type="LOOP_DOUBLE_RESOLVE",
            existing_entry_id=loop_id,
            existing_value="(not found in store)",
            existing_source=0,
            incoming_value=f"Chapter {chapter} claims to resolve this loop.",
            incoming_source=chapter,
            suggested_action="flag",
            note=(
                f"resolved_loops references unknown id {loop_id!r}. "
                "Either the extractor hallucinated an id, or the loop was "
                "never added to the store. Check the extractor output."
            ),
        )

    if not existing.is_active():
        return Conflict(
            severity="MEDIUM",
            type="LOOP_DOUBLE_RESOLVE",
            existing_entry_id=loop_id,
            existing_value=existing.value,
            existing_source=existing.source_chapter,
            incoming_value=f"Chapter {chapter} claims to resolve this loop again.",
            incoming_source=chapter,
            suggested_action="flag",
            note=(
                f"Loop {loop_id!r} was already superseded by "
                f"{existing.superseded_by!r}. Cannot resolve twice."
            ),
        )

    if not existing.value.startswith(OPEN_LOOP_PREFIX):
        return Conflict(
            severity="MEDIUM",
            type="LOOP_DOUBLE_RESOLVE",
            existing_entry_id=loop_id,
            existing_value=existing.value,
            existing_source=existing.source_chapter,
            incoming_value=f"Chapter {chapter} claims to resolve this entry.",
            incoming_source=chapter,
            suggested_action="flag",
            note=(
                f"Entry {loop_id!r} exists but isn't an OPEN loop "
                "(value lacks the OPEN: prefix). Either the extractor "
                "misclassified, or the entry is a regular fact, not a loop."
            ),
        )

    return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def detect_conflicts(
    delta: StateDelta,
    store_entries: list[CanonEntry],
) -> ConflictReport:
    """
    Compare a StateDelta against existing canon. Produce a ConflictReport.

    Args:
        delta: extractor output for one chapter
        store_entries: full list of CanonEntry from the store

    Returns:
        ConflictReport. clean_to_merge=True iff there are no HIGH conflicts.
    """
    by_id: dict[str, CanonEntry] = {e.id: e for e in store_entries}
    conflicts: list[Conflict] = []

    # 1. Compare new_entries against existing same-id entries
    for incoming in delta.new_entries:
        existing = by_id.get(incoming.id)
        if existing is None:
            # Clean addition — no conflict
            continue
        if not values_differ_substantively(existing.value, incoming.value):
            # Identical value (whitespace/punctuation aside) — silent skip
            continue
        # Only compare against ACTIVE existing entries; superseded ones
        # are history.
        if not existing.is_active():
            # Adding a new value for an id that was already retired —
            # this is fine if the new entry is a re-revival, but the
            # extractor shouldn't be doing this. Flag softly.
            conflicts.append(Conflict(
                severity="LOW",
                type="CHARACTER_STATE",
                existing_entry_id=existing.id,
                existing_value=existing.value,
                existing_source=existing.source_chapter,
                incoming_value=incoming.value,
                incoming_source=incoming.source_chapter,
                suggested_action="flag",
                note=(
                    f"Re-using superseded id {existing.id!r}. The store "
                    "convention is one-active-per-id; consider a fresh slug."
                ),
            ))
            continue

        conflicts.append(_classify_value_conflict(existing, incoming))

    # 2. Validate resolved_loops point to real, active, OPEN loops
    for loop_id in delta.resolved_loops:
        existing = by_id.get(loop_id)
        issue = _classify_loop_issue(loop_id, existing, delta.chapter)
        if issue is not None:
            conflicts.append(issue)

    # 3. Validate new_loops are well-formed open loops
    #    (Pydantic enforces namespace='plot' already; we add OPEN: check)
    for loop in delta.new_loops:
        if not loop.value.startswith(OPEN_LOOP_PREFIX):
            conflicts.append(Conflict(
                severity="LOW",
                type="LOOP_DOUBLE_RESOLVE",  # closest fit
                existing_entry_id=loop.id,
                existing_value=loop.value[:80],
                existing_source=loop.source_chapter,
                incoming_value=loop.value[:80],
                incoming_source=loop.source_chapter,
                suggested_action="flag",
                note=(
                    f"new_loops entry {loop.id!r} is missing the "
                    f"{OPEN_LOOP_PREFIX!r} prefix. It won't appear in "
                    "open-loop retrievals."
                ),
            ))

    clean_to_merge = not any(c.severity == "HIGH" for c in conflicts)

    return ConflictReport(
        chapter=delta.chapter,
        pass_id=delta.pass_id,
        conflicts=conflicts,
        clean_to_merge=clean_to_merge,
    )


# ---------------------------------------------------------------------------
# Author UX — markdown rendering
# ---------------------------------------------------------------------------

_SEVERITY_EMOJI = {"HIGH": "🛑", "MEDIUM": "⚠️", "LOW": "ℹ️"}


def render_report_markdown(
    report: ConflictReport,
    delta: Optional[StateDelta] = None,
) -> str:
    """
    Render a ConflictReport as author-readable markdown.

    If `delta` is provided, includes a summary of additions/resolutions
    above the conflict list. Otherwise just the conflicts.
    """
    lines: list[str] = []
    lines.append(f"# Chapter {report.chapter} — Conflict Report")
    lines.append(f"_Pass: `{report.pass_id}`_")
    lines.append("")

    high = report.high()
    med = report.medium()
    low = report.low()

    if report.clean_to_merge and not report.conflicts:
        lines.append("## ✅ Clean — no conflicts detected")
        lines.append("")
    elif report.clean_to_merge:
        lines.append(
            f"## ✅ Clean to merge "
            f"(0 HIGH · {len(med)} MEDIUM · {len(low)} LOW)"
        )
        lines.append("")
    else:
        lines.append(
            f"## ⚠️ Pending review — "
            f"{len(high)} HIGH · {len(med)} MEDIUM · {len(low)} LOW"
        )
        lines.append("")
        lines.append("**Merge blocked** until HIGH conflicts are resolved.")
        lines.append("")

    # Delta summary (optional)
    if delta is not None:
        lines.append("## Delta summary")
        lines.append(f"- new entries: {len(delta.new_entries)}")
        lines.append(f"- resolved loops: {len(delta.resolved_loops)}")
        lines.append(f"- new loops: {len(delta.new_loops)}")
        if delta.tone_notes:
            lines.append("- tone notes:")
            for n in delta.tone_notes:
                lines.append(f"  - {n}")
        lines.append("")

    # Conflicts grouped by severity
    for label, group in (("HIGH", high), ("MEDIUM", med), ("LOW", low)):
        if not group:
            continue
        emoji = _SEVERITY_EMOJI[label]
        lines.append(f"## {emoji} {label} ({len(group)})")
        lines.append("")
        for i, c in enumerate(group, 1):
            lines.append(f"### {label}.{i} — {c.type} on `{c.existing_entry_id}`")
            lines.append(f"- **Existing** (Ch {c.existing_source}): {c.existing_value}")
            lines.append(f"- **Incoming** (Ch {c.incoming_source}): {c.incoming_value}")
            lines.append(f"- **Suggested action:** `{c.suggested_action}`")
            if c.note:
                lines.append(f"- **Note:** {c.note}")
            lines.append("")

    return "\n".join(lines)
