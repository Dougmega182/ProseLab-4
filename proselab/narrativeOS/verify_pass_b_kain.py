"""verify_pass_b_kain.py"""
import json
from pathlib import Path

with Path("data/canon_store.json").open(encoding="utf-8") as f:
    store = json.load(f)
by_id = {e["id"]: e for e in store["entries"]}

print("=== Pass B Kain verification ===")

for old_id, new_id in [
    ("kain.identity", "kain.identity.v2"),
    ("kain.bleed_status", "kain.bleed_status.v2"),
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

# investigation_method should still be active (kept)
im = by_id.get("kain.investigation_method")
if im is None:
    print("  MISSING: kain.investigation_method")
elif im.get("superseded_by") is not None:
    print(f"  UNEXPECTED: kain.investigation_method superseded by {im.get('superseded_by')}")
else:
    print("  OK: kain.investigation_method active (kept intentionally)")

loop = by_id.get("plot.loop_kain_two_jumps_vs_epilogue_state")
print(f"  {'OK NEW LOOP' if loop else 'MISSING LOOP'}: plot.loop_kain_two_jumps_vs_epilogue_state")

active_seed = [
    e for e in store["entries"]
    if e.get("superseded_by") is None
    and e.get("extracted_at_pass") == "seed"
    and (e.get("entity") == "Kain" or "kain" in e.get("id", "").lower())
]
print(f"\nActive seed-Kain entries remaining: {len(active_seed)}  (expected: 1 - kain.investigation_method)")
for e in active_seed:
    print(f"  - {e['id']}")
