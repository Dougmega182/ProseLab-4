import json
from collections import Counter

with open("data/canon_store.json", encoding="utf-8") as f:
    store = json.load(f)

verify_fix_ids = {e["id"] for e in store["entries"] if e["extracted_at_pass"] == "verify-fix-001"}

superseded_into_fix = [
    e for e in store["entries"]
    if e.get("superseded_by") in verify_fix_ids
]
print(f"Entries superseded by verify-fix-001 entries: {len(superseded_into_fix)}")
print()
print("Distribution of superseded entries' original pass IDs:")
for p, n in Counter(e["extracted_at_pass"] for e in superseded_into_fix).most_common():
    print(f"  {n:4d}  {p}")
