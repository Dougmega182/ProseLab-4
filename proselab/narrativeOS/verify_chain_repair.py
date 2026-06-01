"""verify_chain_repair.py"""
import json
from collections import defaultdict
from pathlib import Path

with Path("data/canon_store.json").open(encoding="utf-8") as f:
    store = json.load(f)

active = [e for e in store["entries"] if e.get("superseded_by") is None]
chen_active = [e for e in active if e.get("entity") == "Chen" or "Chen" in e.get("value", "")]

print(f"Total Chen-active entries (before: 193): {len(chen_active)}")
print(f"Expected: ~140-150 (down by ~45 from the chain repair)")


def root_id(eid):
    parts = eid.split(".")
    if parts[-1].startswith("v") and parts[-1][1:].isdigit():
        return ".".join(parts[:-1])
    return eid


by_root = defaultdict(list)
for e in chen_active:
    by_root[root_id(e["id"])].append(e["id"])

multi = [(r, ids) for r, ids in by_root.items() if len(ids) > 1]
print(f"\nRoot IDs with multiple active versions after repair: {len(multi)}")
print("Expected: 0")
for r, ids in multi:
    print(f"  {r}: {ids}")
