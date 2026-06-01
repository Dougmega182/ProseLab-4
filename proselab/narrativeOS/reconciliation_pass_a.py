"""
reconciliation_pass_a.py — execute Pass A supersessions on the canon store.

9 mutations: 4 SUPERSEDE → existing + 5 SUPERSEDE → NEW (one is a RESOLVED marker).
Backs up to data/canon_store.pre_pass_a.json before mutating.
Pre-flight validates all referenced IDs exist before any write.
Idempotent: skips entries already superseded.
"""
import json
from datetime import datetime, timezone
from pathlib import Path

STORE_PATH = Path("data/canon_store.json")
BACKUP_PATH = Path("data/canon_store.pre_pass_a.json")
PASS_ID = "reconciliation_pass_a_20260525"
NOW = datetime.now(timezone.utc).isoformat()


SUPERSEDE_EXISTING = [
    {"old": "plot.ch1_black_pearl",       "new": "plot.ch1_briefing",
     "reason": "Chapter version covers Emily-Kain meeting + Chen file + Replacement Anomaly framing."},
    {"old": "plot.maltese_falcon_tell",   "new": "chen.maltese_falcon_tell",
     "reason": "Direct duplicate. Chapter version is a strict superset."},
    {"old": "plot.prologue_chen_killed",  "new": "chen.replacement_attack",
     "reason": "Chapter version covers killing + Replacement knowledge + staging as cardiac arrest."},
    {"old": "plot.loop_kains_third_jump", "new": "plot.loop_kains_two_jumps_targets",
     "reason": "Original loop reframed by chapter extraction into targeted-jumps version."},
]


SUPERSEDE_NEW = [
    {
        "old": "plot.ch4_alfred_hospital",
        "new_id": "plot.ch4_alfred_hospital.v2",
        "namespace": "plot",
        "confidence": "event",
        "source_chapter": 4,
        "new_value": (
            "Ch 4 (ALFRED HOSPITAL) is the chapter of Hayden's collapse: "
            "his ICS reading is documented below the operational threshold, "
            "escalating the carrier's clinical situation past the point where "
            "continued fieldwork is institutionally defensible. See "
            "hayden.collapse_ch4, hayden.ics_ch4, hayden.ics_below_threshold "
            "for in-chapter detail. Note: the Reyes contact thread (M. Reyes "
            "at Alfred) is Ch 9, not Ch 4 — original seed was misframed on "
            "this point."
        ),
    },
    {
        "old": "plot.ch5_chen_apartment",
        "new_id": "plot.ch5_chen_apartment.v2",
        "namespace": "plot",
        "confidence": "event",
        "source_chapter": 5,
        "new_value": (
            "Ch 5 (THE APARTMENT) is Kain's solo reading pass of Chen's "
            "preserved apartment. Establishes the handedness palimpsest: "
            "Chen was left-handed; the Replacement is right-handed; four "
            "independent environmental traces preserve evidence of both — "
            "the Maltese Falcon spine crease, the desk lamp position moved "
            "left-to-right in month one of the anomaly period, the shower "
            "dial calcium pattern (7 o'clock for Chen vs. 9 o'clock for the "
            "Replacement), and the kitchen drawer handle wear. See "
            "plot.ch5_maltese_falcon_spine_crease, plot.ch5_shower_anomaly, "
            "plot.ch5_desk_lamp, plot.ch5_kitchen_drawer, chen.left_handed, "
            "chen.replacement_right_handed."
        ),
    },
    {
        "old": "plot.ch10_dead_mans_switch",
        "new_id": "plot.ch10_dead_mans_switch.v2",
        "namespace": "plot",
        "confidence": "event",
        "source_chapter": 10,
        "new_value": (
            "Ch 10 (DEAD MAN'S SWITCH) is a four-scene chapter: Kain at the "
            "Fitzroy library terminal (plot.ch10_fitzroy_library_terminal); "
            "the cipher pointing to the dead-man's switch "
            "(plot.ch10_dead_mans_switch_key); the confrontation with Emily "
            "in her private operations office, where she delivers the 'two "
            "jumps left' warning and Kain refuses stand-down "
            "(plot.ch10_emily_confrontation, emily.two_jumps_warning); and "
            "the PQ-gen-549 conversation thread (plot.ch10_conv_pq_gen_549)."
        ),
    },
    {
        "old": "plot.ch12_the_breach",
        "new_id": "plot.ch12_the_breach.v2",
        "namespace": "plot",
        "confidence": "event",
        "source_chapter": 12,
        "new_value": (
            "Ch 12 (THE BREACH) covers the breach of a credential-denied "
            "space (\"Level 4 credential 'no longer existed'\") and Hayden's "
            "voice drifting spatially as his vocal cord innervation degrades. "
            "The chapter ends at the Sphere convergence event itself (covered "
            "by plot.ch12_convergence_event — the 6% gap, the copper-scented "
            "ward, Kain's left hand failing). See also "
            "plot.ch12_alfred_crescent_14, plot.ch12_identity_scrub."
        ),
    },
    {
        "old": "plot.loop_solis_retirement",
        "new_id": "plot.loop_solis_retirement.resolved_ch14",
        "namespace": "plot",
        "confidence": "event",
        "source_chapter": 14,
        "new_value": (
            "RESOLVED in Ch 14. Solis was sequestered because she had "
            "documented the degradation curve fourteen years ago; the QSA "
            "sequestered her specifically because she wrote it down. See "
            "solis.ch14_sequestration_reason for the in-chapter passage. "
            "Original: Why did Martina Solis retire? Her journals are "
            "sequestered, her research kept at the same classification as "
            "the programme itself."
        ),
    },
]


def main() -> int:
    with STORE_PATH.open(encoding="utf-8") as f:
        store = json.load(f)
    BACKUP_PATH.write_text(json.dumps(store, indent=2), encoding="utf-8")
    print(f"Backup written: {BACKUP_PATH}")

    by_id = {e["id"]: e for e in store["entries"]}

    # Pre-flight: validate all referenced IDs exist (or, for new IDs, don't yet)
    print("\n=== Pre-flight validation ===")
    missing = []
    for s in SUPERSEDE_EXISTING:
        if s["old"] not in by_id:
            missing.append(f"  MISSING OLD: {s['old']}")
        if s["new"] not in by_id:
            missing.append(f"  MISSING NEW (target): {s['new']}")
    for s in SUPERSEDE_NEW:
        if s["old"] not in by_id:
            missing.append(f"  MISSING OLD: {s['old']}")
        if s["new_id"] in by_id:
            missing.append(f"  COLLISION (new_id already exists): {s['new_id']}")

    if missing:
        print("Pre-flight FAILED. Aborting without mutation:")
        for m in missing:
            print(m)
        return 1
    print("Pre-flight OK — all references resolved.")

    actions, skipped = [], []

    print("\n=== SUPERSEDE → existing ===")
    for s in SUPERSEDE_EXISTING:
        old = by_id[s["old"]]
        if old.get("superseded_by") is not None:
            skipped.append(f"  SKIP: {s['old']} already superseded by {old['superseded_by']}")
            continue
        old["superseded_by"] = s["new"]
        actions.append(f"  {s['old']} -> {s['new']}  ({s['reason']})")

    print("\n=== SUPERSEDE → new ===")
    for s in SUPERSEDE_NEW:
        old = by_id[s["old"]]
        if old.get("superseded_by") is not None:
            skipped.append(f"  SKIP: {s['old']} already superseded by {old['superseded_by']}")
            continue
        new_entry = {
            "id": s["new_id"],
            "namespace": s["namespace"],
            "entity": None,
            "value": s["new_value"],
            "aliases": [],
            "confidence": s["confidence"],
            "source_chapter": s["source_chapter"],
            "extracted_at_pass": PASS_ID,
            "created_at": NOW,
            "superseded_by": None,
        }
        store["entries"].append(new_entry)
        by_id[s["new_id"]] = new_entry
        old["superseded_by"] = s["new_id"]
        actions.append(f"  {s['old']} -> {s['new_id']}  (new entry created)")

    with STORE_PATH.open("w", encoding="utf-8") as f:
        json.dump(store, f, indent=2)

    print()
    for a in actions:
        print(a)
    if skipped:
        print("\nSkipped:")
        for s in skipped:
            print(s)
    print(f"\nTotal supersessions executed: {len(actions)}")
    print(f"Skipped (idempotent): {len(skipped)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
