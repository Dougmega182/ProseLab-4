import json
import re

logs = [
    (7, 'CHAPTER 7 — THE MIRROR HUNT.md', 'ch0070_backfill_ch7_20260525.json'),
    (7.5, 'CHAPTER 7.5 — REYES.md', 'ch0075_backfill_ch7_5_20260525.json'),
    (8, 'CHAPTER 8 —  BELL DISCOVERS THE LIE.md', 'ch0080_backfill_ch8_20260525.json'),
    (9, 'CHAPTER 9 — THE TUESDAY CONTACT.md', 'ch0090_backfill_ch9_20260525.json')
]

for ch, md, log_name in logs:
    with open('data/logs/extraction/' + log_name, encoding='utf-8') as f:
        data = json.load(f)
        entries = data.get('delta', {}).get('new_entries', [])
        found = False
        for e in entries:
            val = e.get('value', '')
            match = re.search(r"'([^']{20,})'", val)
            if match:
                quote = match.group(1)
                if quote.startswith('Winters doesn'): continue
                print(f"Ch {ch} quote: {quote}")
                # check in md
                with open(f"E:/Ai/ProseLabV2/novels/CHAPTERS/{md}", encoding='utf-8') as mf:
                    lines = mf.readlines()
                    for i, line in enumerate(lines):
                        if quote in line:
                            print(f"  Found at line {i+1}: {line.strip()}")
                            found = True
                            break
                if found:
                    break
        if not found:
            print(f"Ch {ch}: No quote found")
