"""
Retrieval — picks the relevant canon slice for analysing a given chapter.

Design:
  - Deterministic: same chapter + same store = same slice. No AI involved.
  - Entity detection: word-boundary string scan against entity + alias names.
  - Five rules: entity match, open loops, active arcs, hard canon, recent events.
  - Token budget: 4000 tokens (heuristic: len(text) // 4).
  - Drop order under budget pressure: recent_events → low-mention active_arcs
    → low-score entries. Open loops and hard canon are never dropped.
  - All retrievals are logged for debugging.

Public API:
    retrieve(chapter_text, chapter_num) -> ContextSlice
    render_slice_for_prompt(slice) -> str
"""

from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from pydantic import BaseModel, Field

from schemas import CanonEntry
from store import (
    DEFAULT_STORE_PATH,
    get_open_loops,
    load,
)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

TOKEN_BUDGET = 4000
CHARS_PER_TOKEN = 4   # heuristic; locked per Phase 3 decision
RECENT_WINDOW = 3     # last N chapters count as "recent events"

DEFAULT_LOG_DIR = Path(__file__).parent / "logs" / "retrieval"


# ---------------------------------------------------------------------------
# Output schema
# ---------------------------------------------------------------------------

class ContextSlice(BaseModel):
    """
    The retrieval bundle handed to the extractor.

    `dropped` is for debugging only — never shown to the model. It records
    which entries were considered but excluded, with the reason.
    """

    chapter: int = Field(..., ge=0)
    mentioned_entities: list[str] = Field(default_factory=list)
    hard_canon: list[CanonEntry] = Field(default_factory=list)
    active_arcs: list[CanonEntry] = Field(default_factory=list)
    open_loops: list[CanonEntry] = Field(default_factory=list)
    recent_events: list[CanonEntry] = Field(default_factory=list)
    dropped: list[tuple[str, str]] = Field(default_factory=list)
    token_estimate: int = 0

    def all_included(self) -> list[CanonEntry]:
        """All entries that made it into the slice (no duplicates)."""
        seen: set[str] = set()
        out: list[CanonEntry] = []
        for bucket in (self.hard_canon, self.active_arcs,
                       self.open_loops, self.recent_events):
            for e in bucket:
                if e.id not in seen:
                    seen.add(e.id)
                    out.append(e)
        return out


# ---------------------------------------------------------------------------
# Token estimation (heuristic)
# ---------------------------------------------------------------------------

def estimate_tokens(text: str) -> int:
    """Rough heuristic. Good enough for budget enforcement."""
    return max(1, len(text) // CHARS_PER_TOKEN)


def estimate_entry_tokens(entry: CanonEntry) -> int:
    """Approximate token cost of an entry when serialized for the prompt."""
    # id + namespace + entity + value + a bit of structural overhead
    serialized = f"{entry.id} [{entry.namespace}] {entry.entity or ''}: {entry.value}"
    return estimate_tokens(serialized) + 5   # +5 for YAML/markdown overhead


# ---------------------------------------------------------------------------
# Entity detection (deterministic word-boundary scan)
# ---------------------------------------------------------------------------

def _normalize(s: str) -> str:
    return s.strip().lower()


def detect_mentioned_entities(
    chapter_text: str,
    entries: list[CanonEntry],
) -> tuple[list[str], dict[str, int]]:
    """
    Scan chapter_text for entity names and aliases.

    Returns:
        canonical_names: deduplicated list of canonical entity names found
                         (in order of first appearance)
        mention_counts:  {canonical_name: count_of_all_matches}

    Match rule: case-insensitive, word-boundary (so "Bell" does NOT match
    "rebellion"). Multi-word aliases use \b on outer boundaries only.
    """
    # Build (canonical_name, pattern) pairs for every distinct entity.
    name_to_aliases: dict[str, set[str]] = {}
    for e in entries:
        if not e.entity:
            continue
        canonical = e.entity.strip()
        if canonical not in name_to_aliases:
            name_to_aliases[canonical] = set()
        name_to_aliases[canonical].add(canonical)
        for alias in e.aliases:
            if alias.strip():
                name_to_aliases[canonical].add(alias.strip())

    text_lower = chapter_text.lower()
    counts: dict[str, int] = {}
    first_pos: dict[str, int] = {}

    for canonical, alias_set in name_to_aliases.items():
        total = 0
        earliest = len(text_lower) + 1
        for alias in alias_set:
            pattern = r"\b" + re.escape(alias.lower()) + r"\b"
            matches = list(re.finditer(pattern, text_lower))
            if matches:
                total += len(matches)
                earliest = min(earliest, matches[0].start())
        if total > 0:
            counts[canonical] = total
            first_pos[canonical] = earliest

    ordered = sorted(counts.keys(), key=lambda n: first_pos[n])
    return ordered, counts


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------

def score_entry(
    entry: CanonEntry,
    chapter_num: int,
    mention_counts: dict[str, int],
) -> int:
    """
    Score an entry's relevance to this chapter. Higher = more relevant.

    Locked weights per Phase 3 design:
        +10 hard_canon AND entity mentioned
        + 8 open loop (always relevant)
        + 6 entity mentioned >= 3 times
        + 4 entity mentioned 1-2 times
        + 3 event from chapter N-1
        + 2 event from chapter N-2 or N-3
        + 1 baseline
    """
    score = 1   # baseline

    # Open loop bonus (plot namespace with OPEN: prefix)
    if entry.namespace == "plot" and entry.value.startswith("OPEN:"):
        score += 8

    # Entity mention bonus
    if entry.entity and entry.entity in mention_counts:
        n = mention_counts[entry.entity]
        if n >= 3:
            score += 6
        else:
            score += 4
        # Hard canon for a mentioned entity is load-bearing
        if entry.confidence == "hard_canon":
            score += 10

    # Universal hard canon (entity=None) for world rules
    if entry.confidence == "hard_canon" and entry.entity is None:
        score += 5

    # Recent event recency bonus
    if entry.confidence == "event":
        delta = chapter_num - entry.source_chapter
        if delta == 1:
            score += 3
        elif 2 <= delta <= RECENT_WINDOW:
            score += 2

    return score


# ---------------------------------------------------------------------------
# Bucketing
# ---------------------------------------------------------------------------

def _bucket_entries(
    entries: list[CanonEntry],
    chapter_num: int,
    mentioned_entities: set[str],
) -> tuple[list[CanonEntry], list[CanonEntry], list[CanonEntry]]:
    """
    Partition active entries into (hard_canon, active_arcs, recent_events).
    Open loops are handled separately via get_open_loops().
    """
    hard: list[CanonEntry] = []
    arcs: list[CanonEntry] = []
    recent: list[CanonEntry] = []

    for e in entries:
        if not e.is_active():
            continue

        # Skip open loops here — handled separately
        if e.namespace == "plot" and e.value.startswith("OPEN:"):
            continue

        is_mentioned = bool(e.entity and e.entity in mentioned_entities)
        is_universal_canon = e.confidence == "hard_canon" and e.entity is None

        if e.confidence == "hard_canon" and (is_mentioned or is_universal_canon):
            hard.append(e)
        elif e.confidence == "inferred" and is_mentioned:
            arcs.append(e)
        elif e.confidence == "event":
            delta = chapter_num - e.source_chapter
            if 1 <= delta <= RECENT_WINDOW:
                recent.append(e)

    return hard, arcs, recent


# ---------------------------------------------------------------------------
# Budget enforcement
# ---------------------------------------------------------------------------

def _enforce_budget(
    hard: list[CanonEntry],
    arcs: list[CanonEntry],
    loops: list[CanonEntry],
    recent: list[CanonEntry],
    mentioned: set[str],
    chapter_num: int,
    mention_counts: dict[str, int],
    budget: int,
) -> tuple[list[CanonEntry], list[CanonEntry], list[CanonEntry],
           list[CanonEntry], list[tuple[str, str]]]:
    """
    Apply the drop ladder. Returns the four buckets (possibly trimmed) plus
    a list of (entry_id, reason) pairs for the dropped log.

    Drop order:
      1. recent_events for non-mentioned entities
      2. active_arcs for entities mentioned only once
      3. lowest-score entries from arcs and recent
    Never dropped: open loops, hard canon.
    """
    dropped: list[tuple[str, str]] = []

    def total() -> int:
        all_e = [*hard, *arcs, *loops, *recent]
        return sum(estimate_entry_tokens(e) for e in all_e)

    # 1. Drop recent_events for non-mentioned entities
    if total() > budget:
        keep = []
        for e in recent:
            if e.entity is None or e.entity in mentioned:
                keep.append(e)
            else:
                dropped.append((e.id, "recent_event_non_mentioned"))
        recent = keep

    # 2. Drop active_arcs where the entity is mentioned only once
    if total() > budget:
        keep = []
        for e in arcs:
            n = mention_counts.get(e.entity or "", 0)
            if n >= 2:
                keep.append(e)
            else:
                dropped.append((e.id, "active_arc_single_mention"))
        arcs = keep

    # 3. Drop lowest-score entries from arcs + recent until under budget
    if total() > budget:
        # Build (score, bucket, entry) tuples and trim ascending by score
        candidates: list[tuple[int, str, CanonEntry]] = []
        for e in arcs:
            candidates.append((score_entry(e, chapter_num, mention_counts),
                               "arc", e))
        for e in recent:
            candidates.append((score_entry(e, chapter_num, mention_counts),
                               "recent", e))
        candidates.sort(key=lambda t: t[0])   # lowest first

        for score, bucket_name, e in candidates:
            if total() <= budget:
                break
            if bucket_name == "arc":
                arcs = [x for x in arcs if x.id != e.id]
                dropped.append((e.id, f"trimmed_low_score_{score}"))
            else:
                recent = [x for x in recent if x.id != e.id]
                dropped.append((e.id, f"trimmed_low_score_{score}"))

    return hard, arcs, loops, recent, dropped


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def retrieve(
    chapter_text: str,
    chapter_num: int,
    *,
    store_path: Path | str | None = None,
    entries: Optional[list[CanonEntry]] = None,
    budget: int = TOKEN_BUDGET,
    log_dir: Path | str | None = None,
    pass_id: Optional[str] = None,
) -> ContextSlice:
    """
    Produce the context slice for analysing `chapter_text` of chapter
    `chapter_num`.

    Args:
        chapter_text: full text of the chapter (or chunk)
        chapter_num:  chapter number (used for recency math)
        store_path:   path to canon_store.json (defaults to package default)
        entries:      bypass disk load; use these entries directly (testing)
        budget:       token budget for the slice (default 4000)
        log_dir:      where to write retrieval logs (None disables logging)
        pass_id:      tag for the log filename; default = timestamp

    Returns:
        ContextSlice — see schema above.
    """
    if entries is None:
        entries = load(store_path) if store_path else load()

    # 1. Detect entities
    mentioned_list, mention_counts = detect_mentioned_entities(
        chapter_text, entries
    )
    mentioned_set = set(mentioned_list)

    # 2. Bucket
    hard, arcs, recent = _bucket_entries(entries, chapter_num, mentioned_set)

    # 3. Open loops — always include all active
    loops = get_open_loops(entries=entries)

    # 4. Enforce budget
    hard, arcs, loops, recent, dropped = _enforce_budget(
        hard, arcs, loops, recent,
        mentioned_set, chapter_num, mention_counts, budget,
    )

    # 5. Sort each bucket by score descending for prompt stability
    def by_score(e: CanonEntry) -> int:
        return -score_entry(e, chapter_num, mention_counts)

    hard.sort(key=by_score)
    arcs.sort(key=by_score)
    loops.sort(key=by_score)
    recent.sort(key=by_score)

    token_estimate = sum(
        estimate_entry_tokens(e) for e in (*hard, *arcs, *loops, *recent)
    )

    slice_ = ContextSlice(
        chapter=chapter_num,
        mentioned_entities=mentioned_list,
        hard_canon=hard,
        active_arcs=arcs,
        open_loops=loops,
        recent_events=recent,
        dropped=dropped,
        token_estimate=token_estimate,
    )

    # 6. Log (best-effort; failures don't crash retrieval)
    if log_dir is not None or log_dir is None:
        try:
            _write_log(
                slice_, chapter_text, chapter_num,
                mention_counts, log_dir, pass_id,
            )
        except Exception:
            pass

    return slice_


def _write_log(
    slice_: ContextSlice,
    chapter_text: str,
    chapter_num: int,
    mention_counts: dict[str, int],
    log_dir: Path | str | None,
    pass_id: Optional[str],
) -> None:
    if log_dir is None:
        log_dir = DEFAULT_LOG_DIR
    log_dir = Path(log_dir)
    log_dir.mkdir(parents=True, exist_ok=True)

    stamp = pass_id or datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    fname = f"ch{chapter_num:02d}_{stamp}.json"

    payload = {
        "chapter": chapter_num,
        "pass_id": pass_id,
        "chapter_hash": hashlib.sha256(chapter_text.encode("utf-8")).hexdigest()[:16],
        "chapter_chars": len(chapter_text),
        "mention_counts": mention_counts,
        "slice": json.loads(slice_.model_dump_json()),
    }
    (log_dir / fname).write_text(json.dumps(payload, indent=2), encoding="utf-8")


# ---------------------------------------------------------------------------
# Prompt rendering
# ---------------------------------------------------------------------------

def render_slice_for_prompt(slice_: ContextSlice) -> str:
    """
    Serialize the slice as a compact markdown block for inclusion in the
    extractor prompt. The `dropped` field is intentionally NOT rendered —
    that's debugging-only.
    """
    lines: list[str] = []
    lines.append(f"# Canon slice for Chapter {slice_.chapter}")
    lines.append(f"_Entities detected: {', '.join(slice_.mentioned_entities) or '(none)'}_")
    lines.append("")

    def section(title: str, bucket: list[CanonEntry]) -> None:
        if not bucket:
            return
        lines.append(f"## {title}")
        for e in bucket:
            tag = f"[{e.confidence}]"
            entity = f" ({e.entity})" if e.entity else ""
            lines.append(f"- **{e.id}**{entity} {tag}")
            lines.append(f"  {e.value}")
        lines.append("")

    section("Hard canon", slice_.hard_canon)
    section("Open loops", slice_.open_loops)
    section("Active arcs (interpretive — may evolve)", slice_.active_arcs)
    section("Recent events (last 3 chapters)", slice_.recent_events)

    lines.append(f"_Token estimate: ~{slice_.token_estimate}_")
    return "\n".join(lines)
