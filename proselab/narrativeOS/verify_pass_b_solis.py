"""verify_pass_b_solis.py"""
import json
from pathlib import Path

with Path("data/canon_store.json").open(encoding="utf-8") as f:
    store = json.load(f)
by_id = {e["id"]: e for e in store["entries"]}

print("=== Pass B Solis verification ===")

checks = [
    ("solis.identity", "solis.identity.v2"),
    ("solis.journals", "solis.journals_not_on_manifest"),
    ("plot.solis_residue_quote", "solis.residue_reframed"),
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

loop = by_id.get("plot.loop_b734_solis_reality_status")
if loop is None:
    print("  MISSING LOOP: plot.loop_b734_solis_reality_status")
else:
    print("  OK NEW LOOP: plot.loop_b734_solis_reality_status")

t = "solis"
active_seed_solis = [
    e for e in store["entries"]
    if e.get("superseded_by") is None
    and e.get("extracted_at_pass") == "seed"
    and (e.get("entity") == "Solis" or t in e.get("id", "").lower())
]
print(f"\nActive seed-Solis entries remaining: {len(active_seed_solis)}  (expected: 0)")
for e in active_seed_solis:
    print(f"  - {e['id']}")
