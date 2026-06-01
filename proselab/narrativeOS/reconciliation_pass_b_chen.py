"""
reconciliation_pass_b_chen.py — Pass B reconciliation for entity Chen.

1 SUPERSEDE → NEW (chen.identity -> chen.identity.v2, consolidated baseline)
1 NEW open loop (plot.loop_chen_dead_mans_switch_fate)

Backs up to data/canon_store.pre_pass_b_chen.json.
Pre-flight validates seed entry exists and new IDs don't collide.
Idempotent.
"""
import json
from datetime import datetime, timezone
from pathlib import Path

STORE_PATH = Path("data/canon_store.json")
BACKUP_PATH = Path("data/canon_store.pre_pass_b_chen.json")
PASS_ID = "reconciliation_pass_b_chen_20260525"
NOW = datetime.now(timezone.utc).isoformat()


SUPERSEDE_NEW = [
    {
        "old": "chen.identity",
        "new_id": "chen.identity.v2",
        "namespace": "character",
        "entity": "Chen",
        "aliases": ["Marcus Chen", "Marcus"],
        "confidence": "hard_canon",
        "source_chapter": 0,
        "new_value": (
            "Marcus Chen \u2014 Senior Policy Architect, Civilian Integration "
            "Directorate, Level 6 clearance. Father was a rare book dealer; "
            "Chen was raised with strict archival habits. On Solis\u2019s "
            "original research team. Killed in the Prologue by his "
            "Replacement during a forced morning routine; official record "
            "lists \u2018cardiac arrest, four days before Ch 1.\u2019 Left-handed "
            "(Ch 5 reveal); the Replacement is right-handed, producing the "
            "handedness palimpsest Kain reads. Fourth confirmed Replacement "
            "Anomaly in fourteen months. During the attack, Chen triggered "
            "a dead-man\u2019s switch on his QSA comm device (sequence: thumb, "
            "thumb, index; indicator masked by palm), reversed The Maltese "
            "Falcon spine \u2014 violating his father\u2019s strictest rule \u2014 as a "
            "planted tell, and photographed the forged schedule. His final "
            "thought: \u2018Someone will find this.\u2019 For specific Prologue and "
            "Ch 5 detail, see chen.morning_routine, chen.replacement_attack, "
            "chen.dead_mans_switch, chen.maltese_falcon_tell, "
            "chen.real_habits, chen.cause_of_death, chen.left_handed, "
            "chen.replacement_right_handed, plot.ch5_chen_apartment.v2."
        ),
    },
]


ADD_NEW_LOOPS = [
    {
        "id": "plot.loop_chen_dead_mans_switch_fate",
        "namespace": "plot",
        "entity": None,
        "aliases": [],
        "confidence": "inferred",
        "source_chapter": 0,
        "value": (
            "OPEN: Chen activated his QSA comm device\u2019s dead-man\u2019s switch "
            "during the Replacement attack (chen.dead_mans_switch). The "
            "Replacement subsequently identified the device as a threat "
            "and stopped the recording (chen.replacement_stopped_recording). "
            "Did the dead-man\u2019s-switch signal transmit before the "
            "Replacement\u2019s stop, or did the stop neutralise it? The "
            "official-cause-of-death framing notes the signal \u2018sat "
            "unprocessed or was deliberately delayed,\u2019 implying "
            "transmission did occur \u2014 but this is inferred, not confirmed "
            "in the visible canon. Author/manuscript review needed before "
            "treating either reading as canonical."
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
    for loop in ADD_NEW_LOOPS:
        if loop["id"] in by_id:
            missing.append(f"  COLLISION (loop id exists): {loop['id']}")
    # Verify cross-referenced IDs in the new_value actually exist
    referenced = [
        "chen.morning_routine", "chen.replacement_attack",
        "chen.dead_mans_switch", "chen.maltese_falcon_tell",
        "chen.real_habits", "chen.cause_of_death",
        "chen.left_handed", "chen.replacement_right_handed",
        "plot.ch5_chen_apartment.v2",
        "chen.replacement_stopped_recording",
    ]
    for ref in referenced:
        if ref not in by_id:
            missing.append(f"  MISSING REFERENCE: {ref} (referenced in new entry value or loop)")

    if missing:
        print("Pre-flight FAILED. Aborting:")
        for m in missing:
            print(m)
        return 1
    print("Pre-flight OK.")

    actions, skipped = [], []

    print("\n=== SUPERSEDE -> new ===")
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
