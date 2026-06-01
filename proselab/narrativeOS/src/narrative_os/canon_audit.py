"""
Canon audit and reconciliation module.

Implements audit functions for:
- audit-fake-pass-ids: detecting/cleaning fake pass IDs.
- audit-contamination: checking for un-superseded seed entries for an entity.
- snapshot-canon: saving a baseline copy of the canon store.
"""

from __future__ import annotations

import re
import json
from pathlib import Path
from typing import Optional

from .store import load, save, CanonStoreError
from .schemas import CanonEntry

# Matches LLM-fabricated past-year pass IDs:
#   ch0_2025-07-08T12:00:00
#   ch5_2025-07-14T12:00:00
#   ch2_2025-07-14T00:00:00
FAKE_PASS_RE = re.compile(r"^ch\d+(?:\.\d+)?_20(?:24|25)[-T0-9:]+$")
SENTINEL = "audit_trail_lost"


def audit_fake_pass_ids(store_path: Path, clean: bool = False) -> dict:
    """
    Scans the canon store for entries with fake pass IDs.
    If clean=True, replaces the fake pass IDs with SENTINEL and saves.
    """
    entries = load(store_path)
    fake_entries = []
    cleaned_count = 0

    for e in entries:
        eap = e.extracted_at_pass
        if eap != SENTINEL and FAKE_PASS_RE.match(eap):
            fake_entries.append(e)

    if clean and fake_entries:
        updated_entries = []
        for e in entries:
            eap = e.extracted_at_pass
            if eap != SENTINEL and FAKE_PASS_RE.match(eap):
                updated_entries.append(e.model_copy(update={"extracted_at_pass": SENTINEL}))
                cleaned_count += 1
            else:
                updated_entries.append(e)
        save(updated_entries, store_path)

    return {
        "fake_count": len(fake_entries),
        "cleaned_count": cleaned_count,
        "fake_ids": [e.id for e in fake_entries],
    }


def audit_contamination(store_path: Path, entity: str) -> dict:
    """
    Checks for seed contamination of a given entity in the active canon store.
    Contamination is defined as active entries (superseded_by is None)
    whose extracted_at_pass is "seed" and whose entity matches the given entity
    or whose id contains the entity name.
    """
    entries = load(store_path)
    entity_lower = entity.strip().lower()

    contamination_entries = []
    # kain.investigation_method is a known allowed seed entry that can stay active
    allowed_exceptions = {
        "kain": {"kain.investigation_method"}
    }
    allowed = allowed_exceptions.get(entity_lower, set())

    for e in entries:
        if not e.is_active():
            continue
        if e.extracted_at_pass != "seed":
            continue

        matches = False
        if e.entity and e.entity.strip().lower() == entity_lower:
            matches = True
        elif entity_lower in e.id.lower():
            matches = True
        elif any(a.strip().lower() == entity_lower for a in e.aliases):
            matches = True

        if matches:
            contamination_entries.append(e)

    violations = [e for e in contamination_entries if e.id not in allowed]

    return {
        "entity": entity,
        "contamination_count": len(contamination_entries),
        "violation_count": len(violations),
        "entries": [e.id for e in contamination_entries],
        "violations": [e.id for e in violations],
    }


def snapshot_canon(store_path: Path, out_path: Path) -> Path:
    """
    Creates a baseline copy of the canon store.
    """
    entries = load(store_path)
    save(entries, out_path)
    return out_path
