import json

with open("data/canon_store.json", encoding="utf-8") as f:
    store = json.load(f)

entries = store["entries"]
entry_map = {e["id"]: e for e in entries}

ch1_4_passes = ["20260525T002543Z", "20260525T002753Z", "20260525T003030Z", "20260525T003313Z"]

print("--- ALL ENTRIES IN CH 1-4 PASSES ---")
for e in entries:
    if e.get("extracted_at_pass") in ch1_4_passes:
        status = "superseded" if e.get("superseded_by") else "active"
        print(f"ID: {e['id']} | Pass: {e['extracted_at_pass']} | Ch: {e['source_chapter']} | Status: {status}")
        print(f"  Val: {e['value']}")
