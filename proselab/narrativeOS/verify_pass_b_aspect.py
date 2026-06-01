"""verify_pass_b_aspect.py"""
import json
from pathlib import Path

with Path("data/canon_store.json").open(encoding="utf-8") as f:
    store = json.load(f)
by_id = {e["id"]: e for e in store["entries"]}

print("=== Pass B Aspect verification ===")

for old_id, new_id in [
    ("aspect.identity", "aspect.identity.v2"),
    ("plot.ch6_aspect_intake", "plot.ch3_aspect_skip_intake"),
]:
    old = by_id.get(old_id)
    new = by_id.get(new_id)
    if old is None:
        print(f"  MISSING OLD: {old_id}")
    elif old.get("superseded_by") != new_id:
        print(f"  FAIL: {old_id}.superseded_by = {old.get('superseded_by')}")
    elif new is None:
        print(f"  MISSING NEW: {new_id}")
    else:
        print(f"  OK: {old_id} -> {new_id}")

active_seed_aspect = [
    e for e in store["entries"]
    if e.get("superseded_by") is None
    and e.get("extracted_at_pass") == "seed"
    and (e.get("entity") == "Aspect" or "aspect" in e.get("id", "").lower())
]
print(f"\nActive seed-Aspect entries remaining: {len(active_seed_aspect)}")
print("Expected: 1 (plot.loop_aspect_identity, deliberately kept)")
for e in active_seed_aspect:
    print(f"  - {e['id']}")
