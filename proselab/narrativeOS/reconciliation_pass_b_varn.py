"""
reconciliation_pass_b_varn.py — Pass B reconciliation for entity Varn.

1 SUPERSEDE → NEW (varn.first_name -> varn.identity.v2, expanded baseline)
1 SUPERSEDE → existing (varn.identity -> varn.identity.v2)
1 NEW open loop (plot.loop_varn_timeline_discrepancy)

Backs up to data/canon_store.pre_pass_b_varn.json.
Pre-flight validates seed entry exists and new IDs don't collide.
Idempotent.
"""
import json
from datetime import datetime, timezone
from pathlib import Path

STORE_PATH = Path("data/canon_store.json")
BACKUP_PATH = Path("data/canon_store.pre_pass_b_varn.json")
PASS_ID = "reconciliation_pass_b_varn_20260525"
NOW = datetime.now(timezone.utc).isoformat()


SUPERSEDE_NEW = [
    {
        "old": "varn.first_name",
        "new_id": "varn.identity.v2",
        "namespace": "character",
        "entity": "Varn",
        "aliases": ["Elias Varn", "Elias"],
        "confidence": "hard_canon",
        "source_chapter": 2,
        "new_value": (
            "Elias Varn — mid-level procurement officer in the Department "
            "of Infrastructure's quantum relay division, Level 2 clearance, "
            "six years in post when Kain was assigned to audit his "
            "contractor payments. Replaced by an instance during Kain's "
            "investigation. The Varn extraction is the inflection point of "
            "Kain's career and the operation Emily names when she recruits "
            "him: 'You did it four years ago with Elias Varn' (note: "
            "Ch 1 dialogue's 'four years ago' and Ch 2 extraction's "
            "'fifteen years before the present' are in apparent conflict; "
            "see plot.loop_varn_timeline_discrepancy). Origin of multiple "
            "downstream entries: varn.replacement_case, varn.gait_variance, "
            "varn.extraction_outcome, kain.varn_case, kain.career_destruction, "
            "kain.emily_betrayal_taxonomy, kain.varn_proxy_server, "
            "kain.proprioceptive_mapping_habit."
        ),
    },
]

SUPERSEDE_EXISTING = [
    {
        "old": "varn.identity",
        "new": "varn.identity.v2"
    }
]


ADD_NEW_LOOPS = [
    {
        "id": "plot.loop_varn_timeline_discrepancy",
        "namespace": "plot",
        "entity": None,
        "aliases": [],
        "confidence": "inferred",
        "source_chapter": 2,
        "value": (
            "OPEN: Two Varn-related entries hold incompatible timelines. "
            "kain.varn_case quotes Emily in Ch 1: 'You did it four years "
            "ago with Elias Varn.' kain.varn_career_timeline (Ch 2 "
            "extraction) states 'The Varn case occurred fifteen years "
            "before the present chapter.' Resolution paths: (a) the "
            "extraction operation was four years ago, the investigation "
            "period was fifteen years ago; (b) one of the extractions "
            "misread the manuscript timeline; (c) the manuscript itself "
            "has a continuity error needing author review. Author "
            "confirmation needed before collapsing these into a single "
            "timeline."
        ),
    },
]


def main() -> int:
    with STORE_PATH.open(encoding="utf-8") as f:
        store = json.load(f)
    BACKUP_PATH.write_text(json.dumps(store, indent=2), encoding="utf-8")
    print(f"Backup written: {BACKUP_PATH}")

    by_id = {e["id"]: e for e in store["entries"]}

    print("\n=== Pre-flight validation ===")
    missing = []
    for s in SUPERSEDE_NEW:
        if s["old"] not in by_id:
            missing.append(f"  MISSING OLD: {s['old']}")
        if s["new_id"] in by_id:
            missing.append(f"  COLLISION (new_id exists): {s['new_id']}")
    for s in SUPERSEDE_EXISTING:
        if s["old"] not in by_id:
            missing.append(f"  MISSING OLD: {s['old']}")
    for loop in ADD_NEW_LOOPS:
        if loop["id"] in by_id:
            missing.append(f"  COLLISION (loop id exists): {loop['id']}")
    if missing:
        print("Pre-flight FAILED. Aborting:")
        for m in missing:
            print(m)
        return 1
    print("Pre-flight OK.")

    actions, skipped = [], []

    print("\n=== SUPERSEDE → new ===")
    for s in SUPERSEDE_NEW:
        old = by_id[s["old"]]
        if old.get("superseded_by") is not None:
            skipped.append(f"  SKIP: {s['old']} already superseded by {old['superseded_by']}")
            continue
        new_entry = {
            "id": s["new_id"],
            "namespace": s["namespace"],
            "entity": s["entity"],
            "value": s["new_value"],
            "aliases": s["aliases"],
            "confidence": s["confidence"],
            "source_chapter": s["source_chapter"],
            "extracted_at_pass": PASS_ID,
            "created_at": NOW,
            "superseded_by": None,
        }
        store["entries"].append(new_entry)
        by_id[s["new_id"]] = new_entry
        old["superseded_by"] = s["new_id"]
        actions.append(f"  {s['old']} -> {s['new_id']}")

    print("\n=== SUPERSEDE → existing ===")
    for s in SUPERSEDE_EXISTING:
        old = by_id[s["old"]]
        if old.get("superseded_by") is not None:
            skipped.append(f"  SKIP: {s['old']} already superseded by {old['superseded_by']}")
            continue
        old["superseded_by"] = s["new"]
        actions.append(f"  {s['old']} -> {s['new']}")

    print("\n=== ADD new loops ===")
    for loop in ADD_NEW_LOOPS:
        new_entry = {
            "id": loop["id"],
            "namespace": loop["namespace"],
            "entity": loop["entity"],
            "value": loop["value"],
            "aliases": loop["aliases"],
            "confidence": loop["confidence"],
            "source_chapter": loop["source_chapter"],
            "extracted_at_pass": PASS_ID,
            "created_at": NOW,
            "superseded_by": None,
        }
        store["entries"].append(new_entry)
        by_id[loop["id"]] = new_entry
        actions.append(f"  ADDED loop: {loop['id']}")

    with STORE_PATH.open("w", encoding="utf-8") as f:
        json.dump(store, f, indent=2)

    for a in actions:
        print(a)
    if skipped:
        print("\nSkipped:")
        for s in skipped:
            print(s)
    print(f"\nMutations executed: {len(actions)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
