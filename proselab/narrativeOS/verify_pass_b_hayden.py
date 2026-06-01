"""verify_pass_b_hayden.py"""
import json
from pathlib import Path

with Path("data/canon_store.json").open(encoding="utf-8") as f:
    store = json.load(f)
by_id = {e["id"]: e for e in store["entries"]}

print("=== Pass B Hayden verification ===")

# Identity superseded to v2
old = by_id.get("hayden.identity")
new = by_id.get("hayden.identity.v2")
if old is None:
    print("  MISSING OLD: hayden.identity")
elif old.get("superseded_by") != "hayden.identity.v2":
    print(f"  FAIL: hayden.identity.superseded_by = {old.get('superseded_by')}")
elif new is None:
    print("  MISSING NEW: hayden.identity.v2")
else:
    print(f"  OK: hayden.identity -> hayden.identity.v2 (entity={new['entity']}, aliases={new['aliases']})")

# transit_arc superseded into identity.v2 (folded)
transit = by_id.get("hayden.transit_arc")
if transit is None:
    print("  MISSING: hayden.transit_arc")
elif transit.get("superseded_by") != "hayden.identity.v2":
    print(f"  FAIL: hayden.transit_arc.superseded_by = {transit.get('superseded_by')}")
else:
    print("  OK: hayden.transit_arc -> hayden.identity.v2 (folded)")

# New loop
loop = by_id.get("plot.loop_laughing_woman_cross_carrier_identity")
if loop is None:
    print("  MISSING LOOP: plot.loop_laughing_woman_cross_carrier_identity")
else:
    print("  OK NEW LOOP: plot.loop_laughing_woman_cross_carrier_identity")

t = "hayden"
active_seed = [
    e for e in store["entries"]
    if e.get("superseded_by") is None
    and e.get("extracted_at_pass") == "seed"
    and (e.get("entity") == "Hayden" or t in e.get("id", "").lower())
]
print(f"\nActive seed-Hayden entries remaining: {len(active_seed)}  (expected: 0)")
for e in active_seed:
    print(f"  - {e['id']}")
