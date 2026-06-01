"""
reconciliation_pass_b_hayden.py — Pass B reconciliation for entity Hayden.

2 SUPERSEDE → existing/NEW:
  - hayden.identity -> hayden.identity.v2 (consolidated baseline; was
    missing surname Marsh, 412+ transitions, Ch 4 POV, Bell as anchor,
    pharmacological protocol, memory insertions, Reyes/Winters investigation)
  - hayden.transit_arc -> hayden.identity.v2 (fold the Ch 12.5 framing
    into the new identity card; transit_arc was just a narrow note)

1 NEW open loop:
  - plot.loop_laughing_woman_cross_carrier_identity

Backs up to data/canon_store.pre_pass_b_hayden.json.
Pre-flight validates seed entries exist and references resolve.
Idempotent.
"""
import json
from datetime import datetime, timezone
from pathlib import Path

STORE_PATH = Path("data/canon_store.json")
BACKUP_PATH = Path("data/canon_store.pre_pass_b_hayden.json")
PASS_ID = "reconciliation_pass_b_hayden_20260525"
NOW = datetime.now(timezone.utc).isoformat()


SUPERSEDE_NEW = [
    {
        "old": "hayden.identity",
        "new_id": "hayden.identity.v2",
        "namespace": "character",
        "entity": "Hayden",
        "aliases": ["Hayden Marsh", "Marsh"],
        "confidence": "hard_canon",
        "source_chapter": 0,
        "new_value": (
            "Hayden Marsh -- TUBA1A-PQ carrier in active Bleed; runs solo "
            "covert operations from a B-734 branch-reality safe house using "
            "B-734 as insertion point. Eight months operational tenure, "
            "412+ transitions performed (412 by Ch 4, 417 by Ch 8). Has "
            "QSA-level override codes and combat training (brachial-plexus "
            "incapacitation, observed Ch 4 at Alfred Hospital). Source of "
            "override access: a QSA internal archive he accessed during his "
            "third month of operation, 'a file he wasn't supposed to have "
            "access to' (plot.loop_hayden_qsa_archive_access). "
            ""
            "POV chapters: Ch 4 (Alfred Hospital infiltration of Dr "
            "Winters's office, theft of unpublished Bleed-stabilization "
            "research) and Ch 12.5 ('The Instrument's Consent'). Likely "
            "also a technical narrator in Ch 13-14 Sphere/SEP-NULL "
            "sequences. "
            ""
            "Clinical signature: ICS trajectory across 417 jumps -- "
            "96 -> 71 -> 58 -> 49 -> 41 -> 34 -> 32 -> 28 (by Ch 12.5), "
            "continuous decline with no recovery periods "
            "(hayden.ics_full_trajectory). Crossed the operational ICS 40 "
            "threshold six days before Ch 4 (hayden.ics_below_threshold). "
            "Temporal anchoring became intermittent at ICS 30; by Ch 12.5 "
            "he reports 'I am aware that I am in this room. I am not "
            "continuously aware of when I am in this room' "
            "(hayden.ics_28_ch12_5). "
            ""
            "Self-monitoring: subdural ICS monitor pulsing behind the left "
            "eye, audio alert disabled 8 months ago because it triggered "
            "auditory fragmentation (hayden.ics_monitor). Counts pulse at "
            "the carotid (radial pulse unreliable past 6 months due to "
            "coherence calcification in vessel walls; hayden.pulse_method). "
            "Initiated independent pharmacological neuroinhibitor protocol "
            "at jump 300 (hayden.pharmacological_protocol). Word "
            "'Unreported' appears 11 times in his first 150 clinical-log "
            "entries -- he has systematically withheld data from QSA "
            "medical (hayden.clinical_notes_unreported). "
            ""
            "Bell is his operational partner and 'anchor variable': her "
            "proximity provides documented 23% bleed-rate reduction; her "
            "departure would accelerate his cascade from 40-55 jumps to "
            "14-20 (hayden.anchor_variable, "
            "hayden.jump380_cascade_projection). He has concealed his "
            "condition from her with deliberate professional precision -- "
            "the Fitzroy 'fragments only' description was a lie from the "
            "outset (hayden.bleed_early_description_lie). Bell discovers "
            "all of this in Ch 8 and decides to leave incrementally "
            "(bell.discovery.v2, bell.departure_geometry). "
            ""
            "Recurring memory insertion across hundreds of jumps: a female "
            "subject in an unknown apartment with winter light, laughing "
            "at something Hayden cannot hear. Began at jump 112 (11 "
            "seconds), escalated to 47 seconds with full sensory data by "
            "jump 380; the final jump 417 entry, four words: 'I can't "
            "hear her' (hayden.memory_insertions, "
            "hayden.jump417_final_note, "
            "plot.loop_hayden_memory_insertion_identity, "
            "plot.loop_laughing_woman_cross_carrier_identity). "
            ""
            "Investigating the Reyes alias and Winters database in "
            "parallel with Kain (hayden.reyes_alias_reference, "
            "plot.loop_hayden_bell_investigation_parallel). Mirror figure "
            "to Kain: both TUBA1A-PQ carriers, both clinical/proprioceptive "
            "self-observers, both concealing their conditions, both "
            "counting pulse at the carotid "
            "(plot.loop_hayden_kain_parallel). Hayden's ICS 28 is lower "
            "than Kain's. Institutional affiliation and backstory "
            "unresolved (plot.loop_hayden_identity)."
        ),
    },
]


SUPERSEDE_EXISTING = [
    {
        "old": "hayden.transit_arc",
        "new": "hayden.identity.v2",
        "reason": "Ch 12.5 transit framing is now folded into the consolidated identity card.",
    },
]


ADD_NEW_LOOPS = [
    {
        "id": "plot.loop_laughing_woman_cross_carrier_identity",
        "namespace": "plot",
        "entity": None,
        "aliases": [],
        "confidence": "inferred",
        "source_chapter": 8,
        "value": (
            "OPEN: Two distinct manifestations of the same female subject "
            "appear across different carriers' Bleed experiences. Hayden's "
            "recurring memory insertion (jumps 112 -> 380+) features a "
            "female subject in an unknown apartment, winter light, "
            "laughing at something he cannot hear -- escalating in "
            "duration and sensory specificity over hundreds of jumps "
            "(hayden.memory_insertions). Kain's hallucination of the "
            "'laughing woman' (Ch 7) progressed from internal (behind "
            "his eyes) to externally located in physical space, two "
            "metres ahead, 'her presence directional' "
            "(plot.loop_laughing_woman_externalization). "
            ""
            "Is this the same entity? The Ch 9 Bleed crossover "
            "(plot.loop_kain_hayden_bleed_crossover) established that "
            "Kain's Bleed imports sensory data directly from Hayden's "
            "experience (the burning fenugreek scent from Hayden's safe "
            "house). Could the laughing woman be the same cross-carrier "
            "import in the reverse direction -- Hayden's sensory data "
            "appearing in Kain's perception? Or are both carriers "
            "independently detecting a common external entity that "
            "becomes visible only at advanced Bleed stages? "
            "Author/manuscript review needed for canonical status."
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
    for s in SUPERSEDE_EXISTING:
        if s["old"] not in by_id:
            missing.append(f"  MISSING OLD: {s['old']}")
        # Target is the new entry we're about to create — skip target check
    for loop in ADD_NEW_LOOPS:
        if loop["id"] in by_id:
            missing.append(f"  COLLISION (loop): {loop['id']}")
    referenced = [
        "plot.loop_hayden_qsa_archive_access",
        "hayden.ics_full_trajectory",
        "hayden.ics_below_threshold",
        "hayden.ics_28_ch12_5",
        "hayden.ics_monitor",
        "hayden.pulse_method",
        "hayden.pharmacological_protocol",
        "hayden.clinical_notes_unreported",
        "hayden.anchor_variable",
        "hayden.jump380_cascade_projection",
        "hayden.bleed_early_description_lie",
        "bell.discovery.v2",
        "bell.departure_geometry",
        "hayden.memory_insertions",
        "hayden.jump417_final_note",
        "plot.loop_hayden_memory_insertion_identity",
        "hayden.reyes_alias_reference",
        "plot.loop_hayden_bell_investigation_parallel",
        "plot.loop_hayden_kain_parallel",
        "plot.loop_hayden_identity",
        "plot.loop_laughing_woman_externalization",
        "plot.loop_kain_hayden_bleed_crossover",
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

    # New entries first (so SUPERSEDE_EXISTING can target them)
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

    print("\n=== SUPERSEDE -> existing ===")
    for s in SUPERSEDE_EXISTING:
        old = by_id[s["old"]]
        if old.get("superseded_by"):
            skipped.append(f"  SKIP: {s['old']} already superseded")
            continue
        # Target must now exist (we just created it above)
        if s["new"] not in by_id:
            missing.append(f"  MISSING TARGET after creation: {s['new']}")
            continue
        old["superseded_by"] = s["new"]
        actions.append(f"  {s['old']} -> {s['new']} ({s['reason']})")

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
