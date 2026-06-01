import json
from pathlib import Path

with Path("data/canon_store.json").open(encoding="utf-8") as f:
    store = json.load(f)

print("All entries with entity='Chen':")
for e in store["entries"]:
    if e.get("entity") == "Chen":
        active = "ACTIVE" if e.get("superseded_by") is None else f"-> {e['superseded_by']}"
        print(f"  {active:30s}  {e['id']}  (pass: {e['extracted_at_pass']})")
