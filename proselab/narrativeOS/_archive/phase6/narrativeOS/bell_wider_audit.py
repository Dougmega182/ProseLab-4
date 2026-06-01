import json
from collections import Counter

with open("data/canon_store.json", encoding="utf-8") as f:
    store = json.load(f)

# Every active entry mentioning Bell, by source chapter
print("=== All ACTIVE entries mentioning Bell ===")
bell_entries = [
    e for e in store["entries"]
    if e.get("superseded_by") is None
    and ("Bell" in e.get("value", "") or e.get("entity") == "Bell")
]
print(f"Total: {len(bell_entries)}")
print()
print("By source chapter:")
for ch, n in Counter(e["source_chapter"] for e in bell_entries).most_common():
    print(f"  Ch {ch}: {n} entries")
print()
print("=== All active Bell entries, full ===")
for e in sorted(bell_entries, key=lambda x: x["source_chapter"]):
    print(f"\n  [{e['source_chapter']}] {e['id']}  (pass: {e['extracted_at_pass']})")
    print(f"  -> {e['value'][:300]}")
