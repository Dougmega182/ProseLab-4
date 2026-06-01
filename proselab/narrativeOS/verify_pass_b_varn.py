"""verify_pass_b_varn.py"""
import json
from pathlib import Path

with Path("data/canon_store.json").open(encoding="utf-8") as f:
    store = json.load(f)
by_id = {e["id"]: e for e in store["entries"]}

print("=== Pass B Varn verification ===")

# Old seed superseded?
for eid in ["varn.first_name", "varn.identity"]:
    old = by_id.get(eid)
    if old is None:
        print(f"  MISSING: {eid}")
    elif old.get("superseded_by") != "varn.identity.v2":
        print(f"  FAIL: {eid}.superseded_by = {old.get('superseded_by')}")
    else:
        print(f"  OK: {eid} -> varn.identity.v2")

# New identity entry exists?
new = by_id.get("varn.identity.v2")
if new is None:
    print("  MISSING: varn.identity.v2")
else:
    print(f"  OK NEW: varn.identity.v2 (entity={new['entity']}, ch={new['source_chapter']})")

# New loop exists?
loop = by_id.get("plot.loop_varn_timeline_discrepancy")
if loop is None:
    print("  MISSING: plot.loop_varn_timeline_discrepancy")
else:
    print(f"  OK NEW LOOP: plot.loop_varn_timeline_discrepancy")

# Active seed-character count for Varn
active_seed_varn = [
    e for e in store["entries"]
    if e.get("superseded_by") is None
    and e.get("extracted_at_pass") == "seed"
    and e.get("entity") == "Varn"
]
print(f"\nActive seed-Varn entries remaining: {len(active_seed_varn)}  (expected: 0)")
