import json
with open("data/canon_store.json", encoding="utf-8") as f:
    store = json.load(f)

seed_active = [e for e in store["entries"]
               if e.get("extracted_at_pass") == "seed"
               and e.get("superseded_by") is None]
seed_total = [e for e in store["entries"]
              if e.get("extracted_at_pass") == "seed"]

print(f"Seed entries originally: {len(seed_total)}")
print(f"Seed entries still active (not superseded): {len(seed_active)}")
print()
print("Active seed entries by namespace:")
from collections import Counter
for ns, n in Counter(e["namespace"] for e in seed_active).most_common():
    print(f"  {ns}: {n}")
