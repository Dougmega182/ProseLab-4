"""
reconciliation_pass_b_solis.py — Pass B reconciliation for entity Solis.

3 supersessions:
  - solis.identity -> solis.identity.v2 (new, consolidated baseline)
  - solis.journals -> solis.journals_not_on_manifest (existing, Ch 3)
  - plot.solis_residue_quote -> solis.residue_reframed (existing, Ch 3)

1 new open loop:
  - plot.loop_b734_solis_reality_status

Backs up to data/canon_store.pre_pass_b_solis.json.
Pre-flight validates seed entries exist and references resolve.
Idempotent.
"""
import json
from datetime import datetime, timezone
from pathlib import Path

STORE_PATH = Path("data/canon_store.json")
BACKUP_PATH = Path("data/canon_store.pre_pass_b_solis.json")
PASS_ID = "reconciliation_pass_b_solis_20260525"
NOW = datetime.now(timezone.utc).isoformat()


SUPERSEDE_EXISTING = [
    {
        "old": "solis.journals",
        "new": "solis.journals_not_on_manifest",
        "reason": "Ch 3 extraction has fuller manifest detail; supersede.",
    },
    {
        "old": "plot.solis_residue_quote",
        "new": "solis.residue_reframed",
        "reason": "Ch 3 hard_canon entry has full quote + detection method; supersede.",
    },
]


SUPERSEDE_NEW = [
    {
        "old": "solis.identity",
        "new_id": "solis.identity.v2",
        "namespace": "character",
        "entity": "Solis",
        "aliases": ["Martina Solis"],
        "confidence": "hard_canon",
        "source_chapter": 0,
        "new_value": (
            "Martina Solis -- first director of the QSA's quantum insertion "
            "program. Built it from theoretical framework into operational "
            "reality over twenty-two years; named the Threshold facility; "
            "retired in 2141 with a commendation classified at the same "
            "level as the program itself (solis.retirement_year). Her "
            "clinical and methodological work -- including the discovery "
            "of the 'residue' detection method that drives the present "
            "investigation -- is documented in three hardbound A5 journals "
            "with dark green covers. Chen worked under her on her original "
            "research team. "
            ""
            "Status: cognitively sequestered at Threshold "
            "(plot.ch15_solis_sequestered_threshold), NOT retired. The "
            "'retired' framing in the operational briefing was a procedural "
            "lie -- Emily (Operative Delta-6) personally conducted the "
            "acquisition-and-sequestration four years ago under "
            "OPS-CONV-784-C (emily.solis_acquisition). The QSA's stated "
            "rationale: 'compromised field asset.' Kain's deduction in "
            "Ch 14: 'They had sequestered Solis because she had written it "
            "down' -- the sequestration was suppression of documentation, "
            "not of knowledge (solis.ch14_sequestration_reason). "
            ""
            "Solis appears to Kain in Bleed visions / Reality B-734 "
            "superpositions in Ch 12, 16, and the Epilogue. Status of "
            "these appearances is unresolved "
            "(plot.loop_b734_solis_reality_status). "
            ""
            "See: solis.residue_reframed, solis.journals_not_on_manifest, "
            "solis.article7_classification, solis.lighter_backstory, "
            "plot.ch13_solis_journals_four_months_before, "
            "kain.solis_sequestered_not_retired, "
            "plot.loop_solis_wrote_it_down_implications."
        ),
    },
]


ADD_NEW_LOOPS = [
    {
        "id": "plot.loop_b734_solis_reality_status",
        "namespace": "plot",
        "entity": None,
        "aliases": [],
        "confidence": "inferred",
        "source_chapter": 16,
        "value": (
            "OPEN: Solis appears to Kain across multiple Bleed/convergence "
            "sequences: in Ch 12 during the convergence event she speaks "
            "from the Punt Road kitchen ('You designed the instrument. You "
            "decided. Those are different things.'); in Ch 16 she appears "
            "reading-glasses-on-forehead with a red pen, knowing his "
            "prognosis ('You're going to lose the use of your left hand by "
            "March'); in the Epilogue Kain thinks of her 'in the kitchen "
            "that was not a kitchen.' The Ch 16 framing -- 'not dead in "
            "Reality B-734, only transferred, only gone in the specific way "
            "that meant she was somewhere else and not nowhere' -- sits "
            "between metaphysical claim and metaphor. Is B-734-Solis a "
            "real entity Kain can communicate with across realities, "
            "residual sensory data from the convergence, or his "
            "subconscious projection? Author/manuscript review needed "
            "for canonical status of B-734 presences in general."
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
    for s in SUPERSEDE_EXISTING:
        if s["old"] not in by_id:
            missing.append(f"  MISSING OLD: {s['old']}")
        if s["new"] not in by_id:
            missing.append(f"  MISSING TARGET: {s['new']}")
    for s in SUPERSEDE_NEW:
        if s["old"] not in by_id:
            missing.append(f"  MISSING OLD: {s['old']}")
        if s["new_id"] in by_id:
            missing.append(f"  COLLISION: {s['new_id']}")
    for loop in ADD_NEW_LOOPS:
        if loop["id"] in by_id:
            missing.append(f"  COLLISION (loop): {loop['id']}")
    referenced = [
        "solis.retirement_year",
        "solis.residue_reframed",
        "solis.journals_not_on_manifest",
        "solis.article7_classification",
        "solis.lighter_backstory",
        "plot.ch13_solis_journals_four_months_before",
        "plot.ch15_solis_sequestered_threshold",
        "kain.solis_sequestered_not_retired",
        "plot.loop_solis_wrote_it_down_implications",
        "emily.solis_acquisition",
        "solis.ch14_sequestration_reason",
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

    print("\n=== SUPERSEDE -> existing ===")
    for s in SUPERSEDE_EXISTING:
        old = by_id[s["old"]]
        if old.get("superseded_by"):
            skipped.append(f"  SKIP: {s['old']} already superseded")
            continue
        old["superseded_by"] = s["new"]
        actions.append(f"  {s['old']} -> {s['new']} ({s['reason']})")

    print("\n=== SUPERSEDE -> new ===")
    for s in SUPERSEDE_NEW:
        old = by_id[s["old"]]
        if old.get("superseded_by"):
            skipped.append(f"  SKIP: {s['old']} already superseded")
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
