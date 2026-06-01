import json
from pathlib import Path

with Path("data/canon_store.json").open(encoding="utf-8") as f:
    store = json.load(f)

active_bell = [
    e for e in store["entries"]
    if e.get("superseded_by") is None
    and "Bell" in e.get("value", "")
    and ("Kain" in e.get("value", "") and "ICS 41" in e.get("value", ""))
]
print(f"Active entries claiming Bell discovers Kain's ICS 41: {len(active_bell)}")
if active_bell:
    print("STILL CONTAMINATED:")
    for e in active_bell:
        print(f"  {e['id']}: {e['value'][:200]}")

# Also: confirm the new v2 entries are present and superseded-by points correctly
for old_id, new_id in [("bell.identity", "bell.identity.v2"),
                       ("bell.discovery", "bell.discovery.v2")]:
    old = next((e for e in store["entries"] if e["id"] == old_id), None)
    new = next((e for e in store["entries"] if e["id"] == new_id), None)
    if old and new and old.get("superseded_by") == new_id:
        print(f"OK: {old_id} -> {new_id}")
    else:
        print(f"FAIL: {old_id} / {new_id} not linked correctly")
