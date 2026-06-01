"""verify_pass_b_reyes.py"""
import json
from pathlib import Path

with Path("data/canon_store.json").open(encoding="utf-8") as f:
    store = json.load(f)
by_id = {e["id"]: e for e in store["entries"]}

print("=== Pass B Reyes verification ===")

checks = [
    ("reyes.case_history", "reyes.case_closed_2149"),
    ("reyes.m_reyes_contact", "reyes_marcus.civilian_cover"),
]
for old_id, new_id in checks:
    old = by_id.get(old_id)
    new = by_id.get(new_id)
    if old is None:
        print(f"  MISSING OLD: {old_id}")
    elif old.get("superseded_by") != new_id:
        print(f"  FAIL: {old_id}.superseded_by = {old.get('superseded_by')}")
    elif new is None:
        print(f"  MISSING TARGET: {new_id}")
    else:
        print(f"  OK: {old_id} -> {new_id}")

new_entry = by_id.get("reyes_network.identity")
if new_entry is None:
    print("  MISSING NEW: reyes_network.identity")
else:
    print(f"  OK NEW: reyes_network.identity (entity={new_entry['entity']}, ch={new_entry['source_chapter']})")

t = "reyes"
active_seed = [
    e for e in store["entries"]
    if e.get("superseded_by") is None
    and e.get("extracted_at_pass") == "seed"
    and (e.get("entity") == "Reyes" or t in e.get("id", "").lower())
]
print(f"\nActive seed-Reyes entries remaining: {len(active_seed)}  (expected: 0)")
for e in active_seed:
    print(f"  - {e['id']}")
