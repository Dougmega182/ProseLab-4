import json

with open("data/canon_store.json", encoding="utf-8") as f:
    store = json.load(f)

# Find bell.discovery and its supersession chain
print("=== All bell.discovery* entries (active + superseded) ===")
for e in store["entries"]:
    if e["id"].startswith("bell.discovery"):
        print(f"\n  ID: {e['id']}")
        print(f"  Pass: {e['extracted_at_pass']}")
        print(f"  Source ch: {e['source_chapter']}")
        print(f"  Superseded_by: {e.get('superseded_by')}")
        print(f"  Value: {e['value']}")

# Find all Bell + Hayden + Kain ICS references across the canon
print("\n\n=== Bell entries mentioning ICS or hidden readings ===")
for e in store["entries"]:
    val = e.get("value", "")
    if e.get("superseded_by") is not None:
        continue   # active only
    if "Bell" in val and ("ICS" in val or "withheld" in val or "hidden" in val):
        print(f"\n  [{e['source_chapter']}] {e['id']}")
        print(f"  -> {val[:250]}")
