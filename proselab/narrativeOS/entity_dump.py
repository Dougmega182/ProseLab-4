"""
entity_dump.py — dump all active canon entries for a given entity, organised
by extracted_at_pass, so we can review what the seed says vs. what the
chapter extractions added.

Usage: python entity_dump.py Varn
"""
import sys
import json
from collections import defaultdict
from pathlib import Path

if len(sys.argv) != 2:
    print("Usage: python entity_dump.py <EntityName>")
    sys.exit(1)

target = sys.argv[1]

with Path("data/canon_store.json").open(encoding="utf-8") as f:
    store = json.load(f)

active = [e for e in store["entries"] if e.get("superseded_by") is None]

# Match entity field OR mentions in value (case-insensitive)
relevant = []
for e in active:
    if e.get("entity") == target:
        relevant.append(e)
    elif target.lower() in e.get("value", "").lower() and e.get("namespace") in ("character", "plot"):
        relevant.append(e)

# Group by pass_id
by_pass = defaultdict(list)
for e in relevant:
    by_pass[e.get("extracted_at_pass", "unknown")].append(e)

rendered = []
rendered.append(f"=== {target}: {len(relevant)} active entries ===\n")

# Seed first
seed_entries = by_pass.pop("seed", [])
if seed_entries:
    rendered.append(f"## SEED ENTRIES ({len(seed_entries)}):\n")
    for e in seed_entries:
        rendered.append(f"### {e['id']}")
        rendered.append(f"  namespace: {e['namespace']}  |  confidence: {e['confidence']}  |  source_chapter: {e['source_chapter']}")
        rendered.append(f"  value: {e['value']}\n")

# Then chapter extractions in chapter order
rendered.append(f"## CHAPTER ENTRIES (sorted by source_chapter):\n")
chapter_entries = []
for pass_id, entries in by_pass.items():
    for e in entries:
        chapter_entries.append(e)
chapter_entries.sort(key=lambda e: (e.get("source_chapter", 999), e["id"]))

for e in chapter_entries:
    rendered.append(f"### [{e.get('source_chapter')}] {e['id']}  (pass: {e['extracted_at_pass']})")
    rendered.append(f"  namespace: {e['namespace']}  |  confidence: {e['confidence']}")
    rendered.append(f"  value: {e['value']}\n")

output_text = "\n".join(rendered)
print(output_text)

output_path = Path(f"{target.lower()}_dump.md")
output_path.write_text(output_text, encoding="utf-8")
print(f"\nFull dump written to: {output_path}")
