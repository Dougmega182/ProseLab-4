"""verify_pass_b_chen.py"""
import json
from pathlib import Path

with Path("data/canon_store.json").open(encoding="utf-8") as f:
    store = json.load(f)
by_id = {e["id"]: e for e in store["entries"]}

print("=== Pass B Chen verification ===")

old = by_id.get("chen.identity")
if old is None:
    print("  MISSING: chen.identity")
elif old.get("superseded_by") != "chen.identity.v2":
    print(f"  FAIL: chen.identity.superseded_by = {old.get('superseded_by')}")
else:
    print("  OK: chen.identity -> chen.identity.v2")

new = by_id.get("chen.identity.v2")
if new is None:
    print("  MISSING: chen.identity.v2")
else:
    print(f"  OK NEW: chen.identity.v2 (entity={new['entity']}, ch={new['source_chapter']})")

loop = by_id.get("plot.loop_chen_dead_mans_switch_fate")
if loop is None:
    print("  MISSING: plot.loop_chen_dead_mans_switch_fate")
else:
    print("  OK NEW LOOP: plot.loop_chen_dead_mans_switch_fate")

active_seed_chen = [
    e for e in store["entries"]
    if e.get("superseded_by") is None
    and e.get("extracted_at_pass") == "seed"
    and e.get("entity") == "Chen"
]
print(f"\nActive seed-Chen entries remaining: {len(active_seed_chen)}  (expected: 0)")
