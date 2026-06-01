# scripts/verify_bell_correction_strict.py
import json
from pathlib import Path

with Path("data/canon_store.json").open(encoding="utf-8") as f:
    store = json.load(f)

active = [e for e in store["entries"] if e.get("superseded_by") is None]

# Match the original verification criterion exactly:
# active entries that mention BOTH "Bell" AND ("Kain" AND "ICS 41") in the value
flagged = [
    e for e in active
    if "Bell" in e.get("value", "")
    and "Kain" in e.get("value", "")
    and "ICS 41" in e.get("value", "")
]

print(f"Flagged entries: {len(flagged)}")
print()
for e in flagged:
    print("=" * 70)
    print(f"ID:           {e['id']}")
    print(f"Pass:         {e['extracted_at_pass']}")
    print(f"Source ch:    {e['source_chapter']}")
    print(f"Confidence:   {e['confidence']}")
    print(f"Value:")
    print(e["value"])
    print()

# Separately, confirm v2 entries exist and chain
print("=" * 70)
print("Supersession chain check:")
for old_id, new_id in [("bell.identity", "bell.identity.v2"),
                       ("bell.discovery", "bell.discovery.v2")]:
    old = next((e for e in store["entries"] if e["id"] == old_id), None)
    new = next((e for e in store["entries"] if e["id"] == new_id), None)
    if not old:
        print(f"  FAIL: {old_id} not found in store")
    elif not new:
        print(f"  FAIL: {new_id} not found in store")
    elif old.get("superseded_by") != new_id:
        print(f"  FAIL: {old_id}.superseded_by = {old.get('superseded_by')!r}, expected {new_id!r}")
    else:
        print(f"  OK:   {old_id} -> {new_id}")
