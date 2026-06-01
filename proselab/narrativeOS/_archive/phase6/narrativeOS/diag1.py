import json
import re
from collections import Counter

with open("data/canon_store.pre_audit_repair.json", encoding="utf-8") as f:
    pre = json.load(f)

strict = re.compile(r"^ch\d+(?:\.\d+)?_20(?:24|25)-")
repair = re.compile(r"^ch\d+(?:\.\d+)?_20(?:24|25)[-T0-9:]+$")

strict_hits = []
repair_only_hits = []
for e in pre["entries"]:
    eap = e.get("extracted_at_pass", "")
    if strict.match(eap):
        strict_hits.append(eap)
    elif repair.match(eap):
        repair_only_hits.append((e["id"], eap))

print(f"Strict-match (definitely fake):       {len(strict_hits)}")
print(f"Repair-only match (need to verify):   {len(repair_only_hits)}")
print()
print("Unique pass IDs caught by strict:")
for p, n in Counter(strict_hits).most_common():
    print(f"  {n:4d}  {p}")
print()
print("Entries caught by repair-only (paste all of them, not just 30):")
for eid, eap in repair_only_hits:
    print(f"  {eid:60s}  {eap}")
