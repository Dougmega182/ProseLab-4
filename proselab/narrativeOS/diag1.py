import json
from collections import defaultdict
from pathlib import Path

with Path("data/canon_store.json").open(encoding="utf-8") as f:
    store = json.load(f)

active = [e for e in store["entries"] if e.get("superseded_by") is None]
chen_active = [
    e for e in active
    if e.get("entity") == "Chen" or "Chen" in e.get("value", "")
]

# Group by "root ID" — strip .v2, .v3, etc.
def root_id(eid):
    parts = eid.split(".")
    # Strip trailing .vN if present
    if parts[-1].startswith("v") and parts[-1][1:].isdigit():
        return ".".join(parts[:-1])
    return eid

by_root = defaultdict(list)
for e in chen_active:
    by_root[root_id(e["id"])].append(e["id"])

print(f"Total Chen-active entries: {len(chen_active)}")
print(f"Unique root IDs: {len(by_root)}")
print()
print("Root IDs with multiple active versions (these are the real problem):")
for root, ids in sorted(by_root.items()):
    if len(ids) > 1:
        print(f"  {root}: {len(ids)} versions")
        for eid in ids:
            print(f"    - {eid}")
