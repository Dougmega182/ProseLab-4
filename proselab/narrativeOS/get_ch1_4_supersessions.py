import json

with open("data/canon_store.json", encoding="utf-8") as f:
    store = json.load(f)

entries = store["entries"]
entry_map = {e["id"]: e for e in entries}

ch1_4_passes = ["20260525T002543Z", "20260525T002753Z", "20260525T003030Z", "20260525T003313Z"]

print("--- Superseded entries created or replaced in Ch1-4 backfill ---")
count = 0
for e in entries:
    is_old_in_ch1_4 = e.get("extracted_at_pass") in ch1_4_passes and e.get("superseded_by") is not None
    
    new_e = entry_map.get(e.get("superseded_by", ""))
    is_new_in_ch1_4 = new_e is not None and new_e.get("extracted_at_pass") in ch1_4_passes
            
    if is_old_in_ch1_4 or is_new_in_ch1_4:
        count += 1
        print(f"\n{count}. ID: {e['id']}")
        print(f"   Old Pass: {e.get('extracted_at_pass')} | Old Ch: {e.get('source_chapter')}")
        print(f"   Old Value: {e['value']}")
        if new_e:
            print(f"   New Pass: {new_e.get('extracted_at_pass')} | New Ch: {new_e.get('source_chapter')}")
            print(f"   New Value: {new_e['value']}")

