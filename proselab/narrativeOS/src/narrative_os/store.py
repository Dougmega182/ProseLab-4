"""
Canon store — JSON-backed CRUD layer for CanonEntry objects.

Design notes:
  - Single flat file: canon_store.json
  - Atomic writes: write to tmp, fsync, rename. No corrupted file on crash.
  - In-process cache invalidated on save. Multi-process safety is NOT a goal.
  - All queries return *active* entries (superseded_by is None) by default.
    Pass include_superseded=True to see history.
"""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Iterable, Optional

from .schemas import CanonEntry, Namespace


# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

DEFAULT_STORE_PATH = Path(__file__).parents[2] / "data" / "canon_store.json"
STORE_VERSION = 1


def resolve_store_path(path: Path | str | None = None) -> Path:
    if path:
        return Path(path)
    from .project import get_project
    try:
        return get_project().canon
    except RuntimeError:
        return DEFAULT_STORE_PATH


class CanonStoreError(Exception):
    """Raised on store-level invariant violations (duplicate ids, etc.)."""


# ---------------------------------------------------------------------------
# Low-level IO
# ---------------------------------------------------------------------------

def _atomic_write(path: Path, payload: str) -> None:
    """Write to a sibling tmp file, fsync, then rename. POSIX atomic on same fs."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(
        prefix=".canon_store.",
        suffix=".tmp",
        dir=str(path.parent),
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(payload)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_name, path)
    except Exception:
        # Best-effort cleanup; suppress secondary errors
        try:
            os.unlink(tmp_name)
        except OSError:
            pass
        raise


def _read_raw(path: Path) -> dict:
    if not path.exists():
        return {"version": STORE_VERSION, "entries": []}
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict) or "entries" not in data:
        raise CanonStoreError(f"Store file {path} is malformed (missing 'entries').")
    return data


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def load(path: Path | str | None = None) -> list[CanonEntry]:
    """Load all entries from disk. Returns [] if file does not exist."""
    p = resolve_store_path(path)
    data = _read_raw(p)
    return [CanonEntry.model_validate(e) for e in data["entries"]]


def save(entries: list[CanonEntry], path: Path | str | None = None) -> None:
    """
    Persist entries to disk atomically.

    Enforces id uniqueness across the entire store.
    """
    p = resolve_store_path(path)

    # Invariant: no duplicate ids
    seen: set[str] = set()
    for e in entries:
        if e.id in seen:
            raise CanonStoreError(f"Duplicate entry id in store: {e.id!r}")
        seen.add(e.id)

    payload = {
        "version": STORE_VERSION,
        "entries": [json.loads(e.model_dump_json()) for e in entries],
    }
    _atomic_write(p, json.dumps(payload, indent=2, sort_keys=False))


def get_by_id(
    eid: str,
    path: Path | str | None = None,
    entries: Optional[list[CanonEntry]] = None,
) -> Optional[CanonEntry]:
    """Lookup a single entry by id. Returns None if not found."""
    entries = entries if entries is not None else load(path)
    for e in entries:
        if e.id == eid:
            return e
    return None


def get_by_entity(
    entity: str,
    *,
    include_aliases: bool = True,
    include_superseded: bool = False,
    path: Path | str | None = None,
    entries: Optional[list[CanonEntry]] = None,
) -> list[CanonEntry]:
    """All entries whose `entity` (or alias, if include_aliases=True) matches."""
    entries = entries if entries is not None else load(path)
    out: list[CanonEntry] = []
    for e in entries:
        if not include_superseded and not e.is_active():
            continue
        if include_aliases:
            if e.matches_entity(entity):
                out.append(e)
        else:
            if e.entity and e.entity.strip().lower() == entity.strip().lower():
                out.append(e)
    return out


def get_by_namespace(
    namespace: Namespace,
    *,
    include_superseded: bool = False,
    path: Path | str | None = None,
    entries: Optional[list[CanonEntry]] = None,
) -> list[CanonEntry]:
    """All entries in the given namespace."""
    entries = entries if entries is not None else load(path)
    return [
        e for e in entries
        if e.namespace == namespace
        and (include_superseded or e.is_active())
    ]


# Convention: open loops are entries in the 'plot' namespace whose value
# starts with "OPEN:". When resolved, the entry is superseded by a new
# entry whose value starts with "RESOLVED:".
OPEN_LOOP_PREFIX = "OPEN:"
RESOLVED_LOOP_PREFIX = "RESOLVED:"


def get_open_loops(
    path: Path | str | None = None,
    entries: Optional[list[CanonEntry]] = None,
) -> list[CanonEntry]:
    """All unresolved open-loop entries."""
    entries = entries if entries is not None else load(path)
    return [
        e for e in entries
        if e.namespace == "plot"
        and e.is_active()
        and e.value.startswith(OPEN_LOOP_PREFIX)
    ]


def append(
    entry: CanonEntry,
    path: Path | str | None = None,
) -> None:
    """Add a single entry and save. Rejects duplicate ids."""
    entries = load(path)
    if any(e.id == entry.id for e in entries):
        raise CanonStoreError(f"Cannot append: entry id {entry.id!r} already exists.")
    entries.append(entry)
    save(entries, path)


def append_many(
    new_entries: Iterable[CanonEntry],
    path: Path | str | None = None,
) -> None:
    """Add multiple entries in one save. Atomic."""
    entries = load(path)
    existing_ids = {e.id for e in entries}
    for e in new_entries:
        if e.id in existing_ids:
            raise CanonStoreError(f"Cannot append: entry id {e.id!r} already exists.")
        existing_ids.add(e.id)
        entries.append(e)
    save(entries, path)


def supersede(
    old_id: str,
    new_id: str,
    path: Path | str | None = None,
) -> None:
    """
    Mark `old_id` as superseded by `new_id`.

    Both must already exist in the store. This is the ONLY supported way to
    retire an entry — we never delete.
    """
    entries = load(path)
    by_id = {e.id: e for e in entries}
    if old_id not in by_id:
        raise CanonStoreError(f"supersede: old_id {old_id!r} not found.")
    if new_id not in by_id:
        raise CanonStoreError(f"supersede: new_id {new_id!r} not found.")
    if by_id[old_id].superseded_by is not None:
        raise CanonStoreError(
            f"supersede: {old_id!r} is already superseded by "
            f"{by_id[old_id].superseded_by!r}."
        )
    # Pydantic models are immutable-ish; rebuild with new field.
    updated = by_id[old_id].model_copy(update={"superseded_by": new_id})
    new_entries = [updated if e.id == old_id else e for e in entries]
    save(new_entries, path)


def store_stats(path: Path | str | None = None) -> dict:
    """Summary counts. Useful for debugging and the CLI."""
    entries = load(path)
    by_ns: dict[str, int] = {}
    by_conf: dict[str, int] = {}
    active = 0
    superseded = 0
    for e in entries:
        by_ns[e.namespace] = by_ns.get(e.namespace, 0) + 1
        by_conf[e.confidence] = by_conf.get(e.confidence, 0) + 1
        if e.is_active():
            active += 1
        else:
            superseded += 1
    return {
        "total": len(entries),
        "active": active,
        "superseded": superseded,
        "by_namespace": by_ns,
        "by_confidence": by_conf,
        "open_loops": len(get_open_loops(entries=entries)),
    }


# Backwards-compatible alias used by the tests and older callers.
stats = store_stats
