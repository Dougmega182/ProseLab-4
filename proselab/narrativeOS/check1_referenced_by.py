"""
check1_referenced_by.py — Pre-flight: are any intermediate versions we plan
to re-supersede currently the supersession TARGET of another entry?
"""
import json
from collections import defaultdict
from pathlib import Path

with Path("data/canon_store.json").open(encoding="utf-8") as f:
    store = json.load(f)

versioned_roots = {
    "chen.apartment_location": 6,
    "chen.caseload": 3,
    "chen.comm_device_activation": 4,
    "chen.dead_mans_switch_activation": 6,
    "chen.divorce": 6,
    "chen.fathers_rule": 3,
    "chen.flagged_eighteen_months": 3,
    "chen.schedule_forgery": 3,
    "chen.white_mug": 4,
    "chen.wrist_injury": 6,
    "plot.loop_already_optimised": 2,
    "plot.loop_chen_behavioural_flag": 3,
    "plot.loop_chen_cover_up": 2,
    "plot.loop_chen_evidence_trail": 3,
    "plot.loop_dead_mans_switch_recipient": 3,
    "plot.loop_differences_are_the_point": 2,
    "plot.loop_reflection_delay": 3,
    "plot.loop_reflection_mechanism": 2,
    "plot.loop_replacement_knowledge_source": 2,
    "replacement.recognition_not_surprise": 5,
    "replacement.voice_mimicry": 3,
}

# For each root, intermediate versions are v2..v(max-1)
all_to_supersede = []
for root, max_v in versioned_roots.items():
    for v in range(2, max_v):
        all_to_supersede.append(f"{root}.v{v}")

all_to_supersede_set = set(all_to_supersede)

# Are any of these the supersession TARGET of another entry?
referenced_by = defaultdict(list)
for e in store["entries"]:
    target = e.get("superseded_by")
    if target in all_to_supersede_set:
        referenced_by[target].append(e["id"])

if referenced_by:
    print("WARNING: Some entries we plan to re-supersede are CURRENTLY THE TARGET of other supersessions:")
    for target, sources in sorted(referenced_by.items()):
        print(f"  {target} is the target of: {sources}")
    print(f"\nTotal affected targets: {len(referenced_by)}")
    print("\nThis means the existing chain is: source -> target -> NEW HEAD")
    print("Re-pointing target to NEW HEAD will leave 'source' chained to target,")
    print("which then chains to NEW HEAD. That's actually fine — chains are walkable.")
    print("Confirm intentional before proceeding.")
else:
    print("OK: None of the intermediate versions are referenced by other entries.")
