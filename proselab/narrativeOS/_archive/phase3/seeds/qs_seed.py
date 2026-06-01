"""
Quantum Shadows — initial canon seed.

Pulled from:
  - QS_Batch1_Execution.md, QS_Batch2_Execution.md, QS_Batch3_Execution.md
  - Quantum Shadows - Book 1 - Entanglement - DRAFT v2

Conventions:
  - id format: {entity_or_topic}.{slug}
  - All seeded entries use pass_id="seed" and source_chapter=0 unless the
    fact is explicitly tied to a specific chapter event.
  - Open loops use OPEN: prefix in value (see store.OPEN_LOOP_PREFIX).
  - Confidence tiers:
      hard_canon = world rules / character baselines you will never retcon
      event      = specific occurrences at specific chapter timestamps
      inferred   = interpretive readings; expected to evolve

Usage:
    python -m narrative_os.seeds.qs_seed              # writes to default store
    python -m narrative_os.seeds.qs_seed --path X     # writes to X
    python -m narrative_os.seeds.qs_seed --dry-run    # prints counts only
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from schemas import CanonEntry
from store import (
    OPEN_LOOP_PREFIX,
    append_many,
    load,
    save,
    stats,
)


SEED_PASS = "seed"


def _entry(
    id_: str,
    namespace: str,
    value: str,
    *,
    entity: str | None = None,
    aliases: list[str] | None = None,
    confidence: str = "hard_canon",
    source_chapter: int = 0,
) -> CanonEntry:
    """Compact constructor for seed entries."""
    return CanonEntry(
        id=id_,
        namespace=namespace,  # type: ignore[arg-type]
        entity=entity,
        aliases=aliases or [],
        value=value,
        confidence=confidence,  # type: ignore[arg-type]
        source_chapter=source_chapter,
        extracted_at_pass=SEED_PASS,
    )


# ===========================================================================
# WORLD CANON — Fade, ICS, Sphere, QSA mechanics
# ===========================================================================

WORLD_ENTRIES: list[CanonEntry] = [
    _entry(
        "world.fade_mechanics",
        "world",
        "The Fade is the progressive decoherence of an instance's physical "
        "presence in baseline reality. It escalates with each unauthorized "
        "transition and is visible as intermittent phasing of body parts, "
        "tracked clinically against the ICS scale.",
    ),
    _entry(
        "world.ics_scale",
        "world",
        "ICS (Instance Coherence Scale) measures structural integrity of an "
        "instance during and after transition. Documented ceiling is 3; "
        "exceeding without cascade-suppression protocols results in "
        "catastrophic decoherence. ICS 28 and ICS 32 readings have been "
        "observed in Hayden during late-stage Fade.",
    ),
    _entry(
        "world.transition_signature",
        "world",
        "Standard transitions produce baseline copper-and-ozone ionisation. "
        "Anomalous transitions carry a sharper chemical note indicating "
        "process running at a frequency without prior classification.",
    ),
    _entry(
        "world.qsa_authority",
        "world",
        "The QSA (Quantum Stability Authority) is the regulatory body "
        "overseeing instance transitions. Maintains intake stations, "
        "personal-effects archives, and surveillance teams that preserve "
        "subject apartments with full informational fidelity.",
    ),
    _entry(
        "world.threshold_facility",
        "world",
        "QSA-operated facility housing personal effects archives. Items are "
        "sequestered under a formal intake manifest. Visits to the archive "
        "require single-supervised approval.",
    ),
    _entry(
        "world.pq_flag",
        "world",
        "PQ flag is a clearance status marker used at QSA intake stations. "
        "Triggers technician verification gestures (eye-movement check) "
        "and is the basis for the 'Clear' release call.",
    ),
    _entry(
        "world.aspect_existence",
        "world",
        "Aspect is a named entity operating outside or alongside QSA control. "
        "Has demonstrated capacity to plant misdirects (the A&S mug), "
        "place an instance into Chen's apartment, and coordinate operations "
        "the QSA's surveillance team did not detect.",
        confidence="inferred",
    ),
    _entry(
        "world.replacement_protocol",
        "world",
        "A replacement instance can occupy a sequestered subject's apartment, "
        "maintaining the original layout with documented institutional "
        "caution rather than habitual movement. Compression patterns and "
        "object positions remain unchanged from the original record.",
        confidence="inferred",
    ),
]


# ===========================================================================
# CHARACTER CARDS — Kain, Hayden, Emily, Bell, Reyes, Solis, Chen, Aspect
# ===========================================================================

CHARACTER_ENTRIES: list[CanonEntry] = [
    # ----- Kain ------------------------------------------------------------
    _entry(
        "kain.baseline_traits",
        "character",
        "Kain is a QSA auditor / investigator. Calm, observant, methodical. "
        "Conducts a 'reading pass' on spaces before imposing questions on "
        "them — letting the space tell him what it knows. Developed the "
        "technique in the field. Does not touch objects on first pass.",
        entity="Kain",
        aliases=["Kain J.", "the auditor"],
    ),
    _entry(
        "kain.investigation_method",
        "character",
        "Kain's process: reading pass first (passive observation), then "
        "targeted questions. Treats information density of a space as "
        "equally valuable as physical objects.",
        entity="Kain",
    ),
    _entry(
        "kain.has_decryption_key",
        "character",
        "By the start of Ch 11, Kain has obtained the decryption key for "
        "Emily's journals and is reading them. Confrontation with Emily "
        "already occurred in Ch 10.",
        entity="Kain",
        confidence="event",
        source_chapter=11,
    ),

    # ----- Hayden ----------------------------------------------------------
    _entry(
        "hayden.baseline_traits",
        "character",
        "Hayden is an instance subject undergoing progressive Fade. POV "
        "character for multiple chapters. Maintains clinical/proprioceptive "
        "self-observation under physiological stress.",
        entity="Hayden",
        aliases=["Hayden D.", "the carrier"],
    ),
    _entry(
        "hayden.fade_status_ch4",
        "character",
        "At Ch 4, Hayden has just completed a transition with anomalous "
        "ionisation signature. Legs report (no pain, only proprioceptive "
        "notification). Pulse-count is part of his self-monitoring.",
        entity="Hayden",
        confidence="event",
        source_chapter=4,
    ),
    _entry(
        "hayden.fade_status_ch12",
        "character",
        "At Ch 12 (Alfred Crescent, ICS 28), Hayden's body parts are "
        "phasing significantly. Right hand visible in baseline for "
        "approximately 3 seconds. Bell has been gone 6+ hours.",
        entity="Hayden",
        confidence="event",
        source_chapter=12,
    ),
    _entry(
        "hayden.transit_arc",
        "character",
        "Hayden's Transit (planned Ch 12.75) is the final Hayden POV and "
        "covers the D1 mechanism. Mandatory continuity fix between Ch 12 "
        "and what follows.",
        entity="Hayden",
        confidence="inferred",
    ),

    # ----- Emily ----------------------------------------------------------
    _entry(
        "emily.baseline_traits",
        "character",
        "Emily kept journals encrypted with a key Kain ultimately obtains. "
        "Confrontation with Kain occurs in Ch 10. Took the journals before "
        "QSA sequestration was filed — this is the institutional gap that "
        "tells Kain when she acted.",
        entity="Emily",
    ),
    _entry(
        "emily.journal_timing",
        "character",
        "The journals are NOT on the QSA intake manifest. Emily removed "
        "them before the sequestration order was filed.",
        entity="Emily",
        confidence="event",
        source_chapter=4,  # Ch 4.5 — The Manifest
    ),

    # ----- Bell -----------------------------------------------------------
    _entry(
        "bell.baseline_traits",
        "character",
        "Bell is associated with Hayden's late-Fade chapters (Ch 12, "
        "Alfred Crescent). Absent for 6+ hours during the ICS 28 episode. "
        "Role and motivations to be developed.",
        entity="Bell",
        confidence="inferred",
    ),

    # ----- Reyes ----------------------------------------------------------
    _entry(
        "reyes.baseline_traits",
        "character",
        "Reyes is an analyst-type figure whose arithmetic develops a "
        "qualification (\"probably\") over the course of the narrative. "
        "Voice precision degrades as certainty erodes — tracked as a "
        "craft signal.",
        entity="Reyes",
        confidence="inferred",
    ),

    # ----- Solis ----------------------------------------------------------
    _entry(
        "solis.baseline_traits",
        "character",
        "Solis appears in the QSA intake manifest as a single physical "
        "photograph at a field site — a human detail in an institutional "
        "record. Civilian apartment is the payoff location for the A&S mug "
        "(scene planned between Ch 11 and Ch 12).",
        entity="Solis",
    ),
    _entry(
        "solis.wristwatch",
        "character",
        "Solis's wristwatch appears on the QSA intake manifest. Brief "
        "appearance — the chapter's work is the gap (missing journals), "
        "not the watch itself.",
        entity="Solis",
        confidence="event",
        source_chapter=4,
    ),

    # ----- Chen -----------------------------------------------------------
    _entry(
        "chen.apartment_state",
        "character",
        "Chen's apartment is preserved by the QSA surveillance team: "
        "nothing cleaned, nothing moved. Kitchen counter holds a mug ring "
        "from a mug set down and not retrieved. Living room carpet "
        "compression patterns match the original layout. A replacement "
        "instance currently occupies the space.",
        entity="Chen",
        confidence="event",
        source_chapter=5,
    ),

    # ----- Aspect ---------------------------------------------------------
    _entry(
        "aspect.identity",
        "character",
        "Aspect is named but unidentified. Three planted scenes (aspect "
        "interludes) remain to be developed across the manuscript. Backstory "
        "and agenda pending.",
        entity="Aspect",
        confidence="inferred",
    ),
]


# ===========================================================================
# PLOT — Timeline anchors, open loops, planted objects
# ===========================================================================

PLOT_ENTRIES: list[CanonEntry] = [
    # ----- Timeline anchors (events) -------------------------------------
    _entry(
        "plot.ch4_alfred_hospital",
        "plot",
        "Ch 4 takes place at Alfred Hospital. Ends with Hayden's transition "
        "and the anomalous ionisation signature.",
        confidence="event",
        source_chapter=4,
    ),
    _entry(
        "plot.ch4_5_manifest_visit",
        "plot",
        "Between Ch 4 and Ch 5, Kain is granted a single supervised visit "
        "to the Threshold facility's personal-effects archive. Intake "
        "manifest contains 47 items. The journals are not on it.",
        confidence="event",
        source_chapter=4,
    ),
    _entry(
        "plot.ch5_chen_apartment",
        "plot",
        "Ch 5: Kain walks through Chen's preserved apartment performing "
        "his reading pass. Replacement instance is in residence. Mug ring "
        "is on the kitchen counter.",
        confidence="event",
        source_chapter=5,
    ),
    _entry(
        "plot.ch10_emily_confrontation",
        "plot",
        "Ch 10: shadow-instance arc and Emily confrontation. Kain "
        "obtains the decryption key for the journals.",
        confidence="event",
        source_chapter=10,
    ),
    _entry(
        "plot.ch11_journal_reading",
        "plot",
        "Ch 11: Kain reads Emily's journals using the decryption key. "
        "Chapter restructure required — opens AFTER the Ch 10 confrontation.",
        confidence="event",
        source_chapter=11,
    ),
    _entry(
        "plot.ch12_alfred_crescent",
        "plot",
        "Ch 12: Alfred Crescent, ICS 28. Hayden's body parts beginning to "
        "phase significantly. Bell gone 6+ hours.",
        confidence="event",
        source_chapter=12,
    ),

    # ----- Planted objects ------------------------------------------------
    _entry(
        "plot.as_mug_planted",
        "plot",
        "The A&S mug is a planted misdirect by Aspect. Payoff scene is "
        "in Solis's civilian apartment, between Ch 11 and Ch 12. The mug "
        "is NOT in the Threshold manifest chapter (Ch 4.5).",
        confidence="inferred",
        source_chapter=5,
    ),
    _entry(
        "plot.intake_manifest_count",
        "plot",
        "QSA intake manifest for the Chen/Solis case lists exactly 47 items. "
        "Specific absence (journals) is the meaningful information.",
        confidence="event",
        source_chapter=4,
    ),

    # ----- Open loops -----------------------------------------------------
    _entry(
        "plot.loop_aspect_identity",
        "plot",
        f"{OPEN_LOOP_PREFIX} Who is Aspect? Identity, agenda, and "
        f"organizational position all unresolved.",
        confidence="inferred",
    ),
    _entry(
        "plot.loop_journal_contents",
        "plot",
        f"{OPEN_LOOP_PREFIX} What is in Emily's journals? Kain has the key "
        f"as of Ch 11 — contents drive subsequent revelations.",
        confidence="inferred",
    ),
    _entry(
        "plot.loop_fade_divergence",
        "plot",
        f"{OPEN_LOOP_PREFIX} What triggered Hayden's Fade divergence from "
        f"baseline ICS progression? Anomalous ionisation signature in Ch 4 "
        f"suggests an unclassified process.",
        confidence="inferred",
    ),
    _entry(
        "plot.loop_replacement_origin",
        "plot",
        f"{OPEN_LOOP_PREFIX} Where did the replacement instance occupying "
        f"Chen's apartment come from, and who authorized the placement?",
        confidence="inferred",
    ),
    _entry(
        "plot.loop_as_mug_meaning",
        "plot",
        f"{OPEN_LOOP_PREFIX} What does the 'A&S' on the mug refer to? "
        f"Aspect-and-S? Payoff scene between Ch 11 and Ch 12.",
        confidence="inferred",
    ),
    _entry(
        "plot.loop_d1_mechanism",
        "plot",
        f"{OPEN_LOOP_PREFIX} What is the D1 mechanism covered in Hayden's "
        f"Transit (planned Ch 12.75)?",
        confidence="inferred",
    ),
    _entry(
        "plot.loop_bell_whereabouts",
        "plot",
        f"{OPEN_LOOP_PREFIX} Where is Bell during the 6+ hour absence at "
        f"Alfred Crescent (Ch 12)?",
        confidence="inferred",
    ),
]


# ===========================================================================
# CRAFT — Voice, prose metrics, register rules
# ===========================================================================

CRAFT_ENTRIES: list[CanonEntry] = [
    _entry(
        "craft.register_clinical",
        "craft",
        "Default narrative register for Hayden POV under physiological "
        "stress: clinical / proprioceptive. NOT lyrical, NOT purple. "
        "Replaces 'betrayal of physics' purple-prose passages with "
        "report-style observation ('legs reported', 'no pain — only "
        "notification').",
    ),
    _entry(
        "craft.filter_words_target",
        "craft",
        "Filter words (saw / heard / felt / noticed / realized) target "
        "count: 0 across the manuscript. Currently 15. Scheduled for "
        "final Batch 4 polish pass.",
    ),
    _entry(
        "craft.the_specific_target",
        "craft",
        "'The specific' construction: target 65 occurrences (from 133). "
        "Scheduled for final Batch 4 polish pass.",
    ),
    _entry(
        "craft.pulse_count_target",
        "craft",
        "Pulse-count motif: target 27 occurrences (from 54). Hayden's "
        "self-monitoring tic; overuse blunts effect.",
    ),
    _entry(
        "craft.cdir_block_ch125",
        "craft",
        "Ch 12.5 CDIR block replacement is mandatory before submission.",
    ),
    _entry(
        "craft.voice_reyes_qualification",
        "craft",
        "Reyes's arithmetic develops a 'probably' qualification across "
        "chapters as certainty erodes. This is a deliberate voice drift, "
        "not a continuity error — flag conflicts but do not block.",
    ),
]


# ===========================================================================
# Assembly
# ===========================================================================

def all_seed_entries() -> list[CanonEntry]:
    return [
        *WORLD_ENTRIES,
        *CHARACTER_ENTRIES,
        *PLOT_ENTRIES,
        *CRAFT_ENTRIES,
    ]


# ===========================================================================
# CLI
# ===========================================================================

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Seed the Quantum Shadows canon store."
    )
    parser.add_argument(
        "--path",
        type=Path,
        default=None,
        help="Path to canon_store.json (default: narrative_os/canon_store.json)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print counts but do not write.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing store. Otherwise refuses if store is non-empty.",
    )
    args = parser.parse_args(argv)

    entries = all_seed_entries()

    print(f"Prepared {len(entries)} seed entries:")
    print(f"  world:     {len(WORLD_ENTRIES)}")
    print(f"  character: {len(CHARACTER_ENTRIES)}")
    print(f"  plot:      {len(PLOT_ENTRIES)}")
    print(f"  craft:     {len(CRAFT_ENTRIES)}")

    if args.dry_run:
        print("[dry-run] not writing.")
        return 0

    existing = load(args.path)
    if existing and not args.force:
        print(
            f"[abort] Store already contains {len(existing)} entries. "
            f"Use --force to overwrite.",
            file=sys.stderr,
        )
        return 1

    if args.force:
        save(entries, args.path)
    else:
        append_many(entries, args.path)

    s = stats(args.path)
    print(f"Wrote store. Stats: {s}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
