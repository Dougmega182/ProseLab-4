import json
from pathlib import Path

with Path("data/canon_store.json").open(encoding="utf-8") as f:
    store = json.load(f)

by_id = {e["id"]: e for e in store["entries"]}

expected_superseded = [
    "plot.ch1_black_pearl",
    "plot.maltese_falcon_tell",
    "plot.prologue_chen_killed",
    "plot.loop_kains_third_jump",
    "plot.ch4_alfred_hospital",
    "plot.ch5_chen_apartment",
    "plot.ch10_dead_mans_switch",
    "plot.ch12_the_breach",
    "plot.loop_solis_retirement",
]
print("=== Superseded-state check ===")
for eid in expected_superseded:
    e = by_id.get(eid)
    if e is None:
        print(f"  MISSING: {eid}")
    elif e.get("superseded_by") is None:
        print(f"  NOT SUPERSEDED: {eid}")
    else:
        print(f"  OK: {eid} -> {e['superseded_by']}")

new_ids = [
    "plot.ch4_alfred_hospital.v2",
    "plot.ch5_chen_apartment.v2",
    "plot.ch10_dead_mans_switch.v2",
    "plot.ch12_the_breach.v2",
    "plot.loop_solis_retirement.resolved_ch14",
]
print("\n=== New-entry presence check ===")
for nid in new_ids:
    if nid in by_id:
        print(f"  OK NEW: {nid}")
    else:
        print(f"  MISSING NEW: {nid}")

active = [e for e in store["entries"] if e.get("superseded_by") is None]
active_seed_plot = [
    e for e in active
    if e.get("extracted_at_pass") == "seed" and e.get("namespace") == "plot"
]
print(f"\nActive seed-plot entries remaining: {len(active_seed_plot)}  (expected: 7)")
for e in active_seed_plot:
    print(f"  - {e['id']}")
