"""verify_pass_b_emily.py"""
import json
from pathlib import Path

with Path("data/canon_store.json").open(encoding="utf-8") as f:
    store = json.load(f)
by_id = {e["id"]: e for e in store["entries"]}

print("=== Pass B Emily verification ===")

old = by_id.get("emily.identity")
new = by_id.get("emily.identity.v2")
if old is None:
    print("  MISSING OLD: emily.identity")
elif old.get("superseded_by") != "emily.identity.v2":
    print(f"  FAIL: emily.identity.superseded_by = {old.get('superseded_by')}")
elif new is None:
    print("  MISSING NEW: emily.identity.v2")
else:
    print("  OK: emily.identity -> emily.identity.v2")

# emily.two_jumps_warning kept intentionally — verify it's still active
two_jumps = by_id.get("emily.two_jumps_warning")
if two_jumps is None:
    print("  MISSING: emily.two_jumps_warning (should still exist)")
elif two_jumps.get("superseded_by") is not None:
    print(f"  UNEXPECTED: emily.two_jumps_warning now superseded by {two_jumps.get('superseded_by')}")
else:
    print("  OK: emily.two_jumps_warning still active (kept intentionally)")

t = "emily"
active_seed = [
    e for e in store["entries"]
    if e.get("superseded_by") is None
    and e.get("extracted_at_pass") == "seed"
    and (e.get("entity") == "Emily" or t in e.get("id", "").lower())
]
print(f"\nActive seed-Emily entries remaining: {len(active_seed)}  (expected: 1 — emily.two_jumps_warning)")
for e in active_seed:
    print(f"  - {e['id']}")
