"""
reconciliation_pass_b_aspect.py — Pass B reconciliation for entity Aspect.

2 SUPERSEDE → NEW:
  - aspect.identity -> aspect.identity.v2 (corrected baseline; was Ch 6 → Ch 3)
  - plot.ch6_aspect_intake -> plot.ch3_aspect_skip_intake
    (corrected chapter + corrected action: intake was skipped, not performed)

Backs up to data/canon_store.pre_pass_b_aspect.json.
Pre-flight validates seed entries exist and new IDs don't collide.
Idempotent.
"""
import json
from datetime import datetime, timezone
from pathlib import Path

STORE_PATH = Path("data/canon_store.json")
BACKUP_PATH = Path("data/canon_store.pre_pass_b_aspect.json")
PASS_ID = "reconciliation_pass_b_aspect_20260525"
NOW = datetime.now(timezone.utc).isoformat()


SUPERSEDE_NEW = [
    {
        "old": "aspect.identity",
        "new_id": "aspect.identity.v2",
        "namespace": "character",
        "entity": "Aspect",
        "aliases": [],
        "confidence": "hard_canon",
        "source_chapter": 0,
        "new_value": (
            "Aspect is a QSA designation (not a surname) assigned to a "
            "senior intake clinician at the Threshold facility. Appears in "
            "Ch 3 ('THRESHOLD'), not Ch 6 \u2014 the previous seed misattributed "
            "the chapter. Emily knows him and announces his presence "
            "('Aspect is already inside'). Standard procedure would be a "
            "four-minute biometric intake, but when Kain demands it be "
            "skipped, Aspect complies after a two-to-three second "
            "recalibration pause \u2014 a consistent behavioural tic. Delivers "
            "Kain's formal Bleed diagnosis and prognosis (4-9 year range "
            "from first presentation; 6 year median; 14-month fragmentation "
            "cluster). Aspect's clinical finding on 'dormant carrier "
            "activation' resurfaces in Ch 10 (kain.terminal_status_confirmed) "
            "as the authoritative document Emily uses to confirm Kain's "
            "terminal status. Identity beyond the designation remains "
            "unresolved (plot.loop_aspect_identity). See "
            "aspect.briefing_departure, kain.bleed_first_presentation, "
            "kain.bleed_prognosis."
        ),
    },
    {
        "old": "plot.ch6_aspect_intake",
        "new_id": "plot.ch3_aspect_skip_intake",
        "namespace": "plot",
        "entity": None,
        "aliases": [],
        "confidence": "event",
        "source_chapter": 3,
        "new_value": (
            "Ch 3 (THRESHOLD): Aspect is present to conduct Kain's standard "
            "biometric intake \u2014 a four-minute procedure that would generate "
            "a formal record. Kain demands the intake be skipped; Aspect "
            "complies after a two-to-three second recalibration pause. The "
            "intake never occurs, but Aspect proceeds to deliver the Bleed "
            "diagnosis and prognosis anyway, implying he already had Kain's "
            "PQ genotype data on file. The unrecorded intake becomes an "
            "open continuity question (plot.loop_aspect_skipped_intake). "
            "See aspect.briefing_departure, plot.loop_aspect_skipped_intake."
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
    referenced = [
        "aspect.briefing_departure",
        "kain.bleed_first_presentation",
        "kain.bleed_prognosis",
        "kain.terminal_status_confirmed",
        "plot.loop_aspect_identity",
        "plot.loop_aspect_skipped_intake",
    ]
    for ref in referenced:
        if ref not in by_id:
            missing.append(f"  MISSING REFERENCE: {ref}")
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
