"""
reconciliation_pass_b_kain.py — Pass B reconciliation for Kain (final entity).

Actions:
  - kain.identity -> kain.identity.v2 (consolidated baseline; SHADOW/DELTA-14,
    eleven deployments, Solis origin, lighter, career destruction, tradecraft)
  - kain.bleed_status -> kain.bleed_status.v2 (full clinical arc; Emily
    knew-from-before correction; post-Alfred permanent state)
  - ADD plot.loop_kain_two_jumps_vs_epilogue_state

kain.investigation_method is intentionally KEPT — seed text is precise.

Backs up to data/canon_store.pre_pass_b_kain.json.
Pre-flight validates 30+ referenced IDs.
Idempotent.
"""
import json
from datetime import datetime, timezone
from pathlib import Path

STORE_PATH = Path("data/canon_store.json")
BACKUP_PATH = Path("data/canon_store.pre_pass_b_kain.json")
PASS_ID = "reconciliation_pass_b_kain_20260525"
NOW = datetime.now(timezone.utc).isoformat()


SUPERSEDE_NEW = [
    {
        "old": "kain.identity",
        "new_id": "kain.identity.v2",
        "namespace": "character",
        "entity": "Kain",
        "aliases": ["Kain J.", "K.J.", "Marcus Webb"],
        "confidence": "hard_canon",
        "source_chapter": 0,
        "new_value": (
            "Kain J. -- primary POV character. QSA auditor/investigator "
            "and active TUBA1A-PQ carrier. Subject of file "
            "SHADOW/DELTA-14/K.J. -- PRE-ACQUISITION "
            "(kain.shadow_delta_14.v2), designation CONV-PQ-GEN-549/KAIN-D. "
            "ICS Baseline 96 pre-degradation. Deliberately recruited and "
            "run through eleven deployments because his TUBA1A-PQ variant "
            "produces a resonance signal 340% cleaner than the median "
            "carrier (kain.deployment_count). Emily Voss recruited him at "
            "deployment 8 with full knowledge of his prognosis "
            "(emily.kain_deployment_calculus). "
            ""
            "Reading-pass investigative method established over nine years "
            "working under Martina Solis at the Punt Road era: Case 7, "
            "the Northcote disappearances (solis.lighter_backstory). "
            "Carries a dead lighter -- brass casing engraved "
            "'N.K. -- Solis -- Case 7', flint spent for nine years -- as "
            "reality-testing anchor (kain.lighter). Stopped smoking the "
            "week Solis gave it to him. "
            ""
            "Career destroyed fifteen years ago by Emily as protective "
            "cover after the Varn extraction (kain.career_destruction); "
            "spent four subsequent years on insurance fraud and missing "
            "persons; recruited back to QSA investigation when Emily "
            "named Chen. Eleven-year continuous professional history "
            "with Emily includes the closed Reyes case (2149), the "
            "clearance revocation, and the present recruitment. "
            ""
            "Black Pearl bar regular for four years (the Bleed-onset "
            "period); off-grid mesh node makes it operationally clean. "
            "Carries the Marcus Webb cover identity (administratively "
            "deceased since 2021, file closed by Kain himself with the "
            "notation 'Subject deceased, no surviving architecture'; "
            "kain.marcus_webb_cover). Mapped Melbourne CCTV coverage gaps "
            "personally during the 2019 VicTrack retrofit survey "
            "(kain.2019_retrofit_survey). "
            ""
            "Methodology: passive reading pass first (no touching of "
            "objects), then targeted questions. Treats information "
            "density of a space as equal in weight to physical objects "
            "(kain.investigation_method). Proprioceptive mapping habit "
            "learned during the Varn case "
            "(kain.proprioceptive_mapping_habit). "
            ""
            "For Bleed clinical state: kain.bleed_status.v2. For shadow-"
            "instance discovery and the optimised-replacement plot: "
            "kain.shadow_delta_14.v2. For Epilogue post-Alfred state: "
            "kain.left_hand_denervated, kain.iridescent_fringe_permanent, "
            "kain.pq_pathways_permanent, kain.operational_status_epilogue, "
            "plot.epilogue_kain_settles."
        ),
    },
    {
        "old": "kain.bleed_status",
        "new_id": "kain.bleed_status.v2",
        "namespace": "character",
        "entity": "Kain",
        "aliases": [],
        "confidence": "hard_canon",
        "source_chapter": 0,
        "new_value": (
            "Kain's Bleed activated four years before Ch 1. He had not "
            "disclosed it to anyone in his immediate operational circle, "
            "but Emily knew operationally from before recruitment, having "
            "designed the operation around his prognosis "
            "(emily.prior_knowledge_bleed). Right-hand tremor in ring and "
            "little finger 'as reliable as weather' is the continuous "
            "baseline. Counts pulse at the carotid as self-monitoring tic. "
            "Peripheral field stutters under stress. "
            ""
            "Multiplier effects: sleep deprivation amplifies Bleed effects "
            "~1.4x (kain.bleed_multiplier); REM sleep converts memory "
            "consolidation into destructive entanglement events, making "
            "sleep a tactical liability (kain.bleed_rem_vulnerability). "
            "Buffer efficiency degrades with each deployment; first "
            "fragmentation presented at deployment 7. Deployment 12 was "
            "scheduled (kain.deployment_count). "
            ""
            "Ch 10 formal terminal confirmation: 'irreversible level of "
            "neurological degradation. You have two jumps left. The third "
            "will accelerate the neurological collapse to a point that "
            "you will not recover. You will fracture in transit and "
            "remain fragmented' (kain.terminal_status_confirmed). The "
            "31-jumps-in-4-days episode preceding this assessment "
            "accelerated degradation past the median "
            "(kain.thirty_one_jumps_four_days). Outcome relative to this "
            "prognosis tracked at plot.loop_kain_two_jumps_vs_epilogue_state. "
            ""
            "Bleed episode patterns: "
            "Visual -- sensory continuity cuts, environmental folds "
            "between current location and B-734 or other reality layers "
            "(kain.bleed_episode_street, kain.bleed_episode_stairwell), "
            "iridescent fringe at left visual field. "
            "Auditory -- the laughing woman, a recurring residual "
            "fragment identified in Ch 10 as Sphere resonance carrying a "
            "Sphere-touched presence, not hallucination "
            "(kain.laughing_woman_reframed). May share origin with "
            "Hayden's female-subject memory insertion "
            "(plot.loop_laughing_woman_cross_carrier_identity). "
            "Olfactory -- cross-carrier residue: the burning fenugreek "
            "scent from Hayden's safe house surfaces during the Ch 9 "
            "Bleed episode (kain.fenugreek_bleed_residue). Kain has "
            "access to Hayden's jump logs (kain.hayden_jump_logs_access). "
            "Motor -- left-leg muscle tone loss during sustained episodes "
            "(kain.ch9_bleed_compensation); concealment compensation "
            "patterns refined over four years. "
            "Cognitive -- targeted erasure of operationally critical "
            "information during Ch 9: the replacement's face, voice, and "
            "conversation specifics cleared; abstract knowledge and the "
            "word 'Solis' preserved (kain.bleed_targeted_erasure). "
            "Mechanism unresolved (plot.loop_bleed_targeted_mechanism). "
            ""
            "Post-Alfred (three weeks later, Epilogue state): left hand "
            "permanently denervated (kain.left_hand_denervated); "
            "right-hand tremor settled as new baseline "
            "(kain.right_hand_tremor_baseline); permanent iridescent "
            "fringe at left peripheral vision "
            "(kain.iridescent_fringe_permanent); PQ pathways permanent "
            "and continue to register quantum-coherent phenomena -- e.g. "
            "the 7.83 Hz tram bell resonance "
            "(kain.pq_pathways_permanent). Operational status: "
            "'indefinite suspension pending physiological review' "
            "(kain.operational_status_epilogue)."
        ),
    },
]


ADD_NEW_LOOPS = [
    {
        "id": "plot.loop_kain_two_jumps_vs_epilogue_state",
        "namespace": "plot",
        "entity": None,
        "aliases": [],
        "confidence": "inferred",
        "source_chapter": 999,
        "value": (
            "OPEN: Emily's Ch 10 prognosis specified Kain had two jumps "
            "left before the third would 'fracture in transit and remain "
            "fragmented.' The Epilogue shows Kain surviving with "
            "permanent damage (left-hand denervation, iridescent fringe, "
            "integrated PQ pathways) but intact cognitive continuity. "
            "Possible readings: (a) the prognosis was wrong; (b) Kain "
            "used only two jumps total; (c) the Sphere resonance event "
            "itself was the third 'jump,' producing a permanent altered "
            "baseline rather than total dissolution; (d) Sphere "
            "intervention or some other actor altered the predicted "
            "outcome. The Epilogue's register -- incorporation rather "
            "than collapse -- suggests (c) is the intended reading, but "
            "this is not stated in canon. Author/manuscript review "
            "needed for canonical resolution."
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
            missing.append(f"  COLLISION: {s['new_id']}")
    for loop in ADD_NEW_LOOPS:
        if loop["id"] in by_id:
            missing.append(f"  COLLISION (loop): {loop['id']}")
    referenced = [
        "kain.shadow_delta_14.v2", "kain.deployment_count",
        "emily.kain_deployment_calculus", "solis.lighter_backstory",
        "kain.lighter", "kain.career_destruction",
        "kain.marcus_webb_cover", "kain.2019_retrofit_survey",
        "kain.investigation_method", "kain.proprioceptive_mapping_habit",
        "kain.left_hand_denervated", "kain.iridescent_fringe_permanent",
        "kain.pq_pathways_permanent", "kain.operational_status_epilogue",
        "plot.epilogue_kain_settles", "emily.prior_knowledge_bleed",
        "kain.bleed_multiplier", "kain.bleed_rem_vulnerability",
        "kain.terminal_status_confirmed", "kain.thirty_one_jumps_four_days",
        "kain.bleed_episode_street", "kain.bleed_episode_stairwell",
        "kain.laughing_woman_reframed",
        "plot.loop_laughing_woman_cross_carrier_identity",
        "kain.fenugreek_bleed_residue", "kain.hayden_jump_logs_access",
        "kain.ch9_bleed_compensation", "kain.bleed_targeted_erasure",
        "plot.loop_bleed_targeted_mechanism", "kain.right_hand_tremor_baseline",
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
        if old.get("superseded_by"):
            skipped.append(f"  SKIP: {s['old']} already superseded")
            continue
        new_entry = {
            "id": s["new_id"], "namespace": s["namespace"],
            "entity": s["entity"], "value": s["new_value"],
            "aliases": s["aliases"], "confidence": s["confidence"],
            "source_chapter": s["source_chapter"],
            "extracted_at_pass": PASS_ID, "created_at": NOW,
            "superseded_by": None,
        }
        store["entries"].append(new_entry)
        by_id[s["new_id"]] = new_entry
        old["superseded_by"] = s["new_id"]
        actions.append(f"  {s['old']} -> {s['new_id']}")

    print("\n=== ADD new loops ===")
    for loop in ADD_NEW_LOOPS:
        new_entry = {
            "id": loop["id"], "namespace": loop["namespace"],
            "entity": loop["entity"], "value": loop["value"],
            "aliases": loop["aliases"], "confidence": loop["confidence"],
            "source_chapter": loop["source_chapter"],
            "extracted_at_pass": PASS_ID, "created_at": NOW,
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
