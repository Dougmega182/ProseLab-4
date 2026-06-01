"""
check2_content_spot.py — Pre-flight: spot-check whether the head version
of each chain is meaningfully different from intermediate versions.
"""
import json
from pathlib import Path

with Path("data/canon_store.json").open(encoding="utf-8") as f:
    store = json.load(f)

by_id = {e["id"]: e for e in store["entries"]}

# Spot-check three roots
roots_to_inspect = ["chen.divorce", "chen.wrist_injury", "chen.white_mug"]

for root in roots_to_inspect:
    print(f"\n=== {root} ===")
    for v in range(2, 7):
        eid = f"{root}.v{v}"
        if eid in by_id:
            val = by_id[eid]["value"]
            print(f"\n  {eid}  ({len(val)} chars)")
            print(f"  {val[:200]}...")
