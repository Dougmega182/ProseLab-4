"""
Quantum Shadows — initial canon seed.

GROUND-TRUTHED against the actual manuscript (DRAFTv2). Earlier versions
of this file contained terminology imported from planning docs that did
NOT match the manuscript (e.g. "Fade", "A&S mug", "D1 mechanism" — all
removed). Every entry below has been verified against manuscript text.

Conventions:
  - id format: {entity_or_topic}.{slug}
  - Seeded entries use pass_id="seed" and source_chapter=0 unless the fact
    is explicitly tied to a specific chapter event.
  - Open loops use OPEN: prefix in value (see store.OPEN_LOOP_PREFIX).
  - Confidence tiers:
      hard_canon  world rules / character baselines you will never retcon
      event       specific occurrences at specific chapter timestamps
      inferred    interpretive readings; expected to evolve

Usage:
    python -m narrative_os.seeds.qs_seed              # dry-run-safe; refuses
                                                      # to overwrite non-empty
    python -m narrative_os.seeds.qs_seed --force      # overwrite
    python -m narrative_os.seeds.qs_seed --dry-run    # counts only
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from ..schemas import CanonEntry
from ..store import OPEN_LOOP_PREFIX, append_many, load, save, stats


SEED_PASS = "seed"


def _entry(id_: str, namespace: str, value: str, *,
           entity: str | None = None,
           aliases: list[str] | None = None,
           confidence: str = "hard_canon",
           source_chapter: int = 0) -> CanonEntry:
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
# WORLD CANON — the Bleed, PQ genotype, ICS, Sphere, Threshold, QSA
# ===========================================================================

WORLD_ENTRIES: list[CanonEntry] = [
    _entry(
        "world.pq_genotype",
        "world",
        "The PQ genotype is a TUBA1A variant ('TUBA1A-PQ') in which the "
        "C-terminal tail is elongated by eleven amino acids, creating a "
        "secondary binding site for quantum-coherent photons. Detectable "
        "only through targeted genetic sequencing. Carriers are clinically "
        "classified as 'Carrier-Proximate'.",
    ),
    _entry(
        "world.bleed",
        "world",
        "The Bleed is the activation event of the PQ genotype. In roughly "
        "one in twelve Carrier-Proximate individuals, the genotype activates "
        "and progressive identity fragmentation begins. Emily Voss: 'The "
        "Bleed is not a symptom — it is the core mechanism of the body's "
        "erasure.' Presents initially as peripheral fragmentation (visual "
        "field stutters) and progresses to neurological collapse.",
    ),
    _entry(
        "world.bleed_dormant_paradox",
        "world",
        "Clinical position: dormant PQ carriers do not fragment. This is "
        "wrong 'in the specific, careful way that clinical positions are "
        "wrong when the data set is too small and the agency funding the "
        "research has reasons to prefer a particular outcome.' (Prologue/Ch 1 "
        "framing.) Kain has been fragmenting for four years while officially "
        "dormant.",
        confidence="inferred",
    ),
    _entry(
        "world.ics_scale",
        "world",
        "ICS (Instance Coherence Scale) measures structural integrity of an "
        "instance. Observed readings in the manuscript: 41, 34, 53, 54, 55, "
        "57, 58. ICS 40 is the documented retirement threshold ('minimum "
        "threshold for directed coherence collapse'). Below 40, carrier is "
        "designated for retirement; retirement = cessation of operational "
        "deployment and does not obligate QSA care beyond that.",
    ),
    _entry(
        "world.coherence_offset",
        "world",
        "Environments are mapped by Coherence Offset values at named "
        "coordinates (e.g. '77-Alpha-9, Coherence Offset: 0.004' / "
        "'88-Gamma-3, Coherence Offset: 0.011' / '44-Theta-8, "
        "Coherence Offset: 0.037'). Higher offset = faster ICS degradation "
        "for any carrier in that environment.",
    ),
    _entry(
        "world.sphere",
        "world",
        "The Sphere is a matte-black 2.8m-diameter calibration chamber "
        "running an 11-megawatt magnetic levitation system; produces ozone "
        "as a byproduct of the entanglement field. The standard insertion "
        "environment for PQ-genotype work. Has a 'coherence structure' "
        "with mapped regions (the SEP-NULL is one of them).",
    ),
    _entry(
        "world.sep_null",
        "world",
        "The SEP-NULL is a specific position within the Sphere's coherence "
        "structure. A PQ carrier in active Bleed positioned within 0.3 radii "
        "of the SEP-NULL would experience complete buffer saturation in "
        "approximately 0.4 seconds: TUBA1A-PQ binding sites absorb coherence "
        "energy at ten million times design capacity; biophotonic "
        "dissipation fails immediately. Clinically: unsurvivable. No carrier "
        "has been positioned there in QSA data.",
    ),
    _entry(
        "world.stabilization_protocol",
        "world",
        "QSA's theoretical stabilization protocol for active TUBA1A-PQ "
        "Bleed: immediate mandatory stand-down, 24 months sequestration in "
        "the Threshold facility, zero Sphere exposure. Effectively removes "
        "carrier from operational service.",
    ),
    _entry(
        "world.qsa",
        "world",
        "The QSA (Quantum Stability Authority) is the regulatory body "
        "overseeing instance transitions and PQ-genotype research. Operates "
        "the Threshold facility, runs the personal-effects intake archive, "
        "and maintains surveillance teams that preserve subject apartments "
        "with full informational fidelity post-incident.",
    ),
    _entry(
        "world.threshold_facility",
        "world",
        "The Threshold is the QSA's primary research / sequestration "
        "facility. Named by its first director, Martina Solis. Houses the "
        "personal-effects archive (intake station), sequestered research, "
        "and the Sphere. Internal doors marked with blue classification "
        "tape. Visits to the archive require single-supervised approval.",
    ),
    _entry(
        "world.replacement_anomalies",
        "world",
        "Pattern of QSA personnel being replaced by instances that maintain "
        "their identities and roles while introducing small behavioural "
        "drifts (different tram time, different coffee preference, schedule "
        "rewritten in their own hand). Detected via fine-grained "
        "behavioural deviation rather than gross substitution. Chen is the "
        "fourth confirmed case in fourteen months; Varn and an unnamed QSA "
        "asset from a 2154 report are the other two recent ones. Three "
        "probable, possibly more.",
        confidence="inferred",
    ),
    _entry(
        "world.aspect_designation",
        "world",
        "Aspect is a QSA designation, not a surname — 'a single-word "
        "identifier the QSA assigned to personnel whose operational role "
        "required a layer of institutional distance between their function "
        "and their identity.' Conducts biometric intake. Knows Kain's PQ "
        "genotype before intake completes.",
    ),
]


# ===========================================================================
# CHARACTER CARDS — Kain, Hayden, Emily, Bell, Reyes, Solis, Chen, Aspect, Varn
# ===========================================================================

CHARACTER_ENTRIES: list[CanonEntry] = [
    # ----- Kain (POV / investigator / active Bleed carrier) ----------------
    _entry(
        "kain.identity",
        "character",
        "Kain J. is a QSA auditor / investigator and the primary POV "
        "character. Active TUBA1A-PQ carrier whose Bleed activated four "
        "years ago; he has not told anyone. Calm, observant, methodical. "
        "Performs a 'reading pass' on spaces before imposing questions on "
        "them. Has been a regular at the Black Pearl bar for four years.",
        entity="Kain",
        aliases=["Kain J.", "the auditor", "K.J."],
    ),
    _entry(
        "kain.bleed_status",
        "character",
        "Kain has been fragmenting for four years while officially classified "
        "dormant. Right-hand tremor in ring and little finger 'as reliable "
        "as weather' (active 4y). Peripheral field stutters under stress. "
        "Counts pulse at carotid as a self-monitoring tic. Has been "
        "deliberately recruited and run while in active Bleed.",
        entity="Kain",
        confidence="hard_canon",
    ),
    _entry(
        "kain.investigation_method",
        "character",
        "Kain's method: reading pass first (passive observation, no touching "
        "of objects), then targeted questions. Treats information density "
        "of a space as equally valuable as physical objects. 'Lets the "
        "space tell him what it knows.'",
        entity="Kain",
    ),
    _entry(
        "kain.shadow_delta_14",
        "character",
        "QSA file SHADOW/DELTA-14/K.J. – PRE-ACQUISITION exists, written "
        "before Kain's recruitment. He was recruited knowing his degradation "
        "curve and retirement threshold. Written by Emily; she knew he "
        "would eventually find it.",
        entity="Kain",
        confidence="inferred",
    ),

    # ----- Hayden (parallel PQ carrier, scientist) -------------------------
    _entry(
        "hayden.identity",
        "character",
        "Hayden is a TUBA1A-PQ carrier in active Bleed, parallel to Kain. "
        "Technically capable: performs the SEP-NULL math and discusses the "
        "0.3-radii threshold quantitatively. Body parts phase ('outline "
        "stuttered twice in rapid succession'); voice drifts spatially when "
        "vocal cord innervation degrades. Maintains clinical / "
        "proprioceptive self-observation under physiological stress.",
        entity="Hayden",
        aliases=["the carrier"],
    ),
    _entry(
        "hayden.transit_arc",
        "character",
        "Hayden has a designated Transit chapter (Ch 17, 'THE "
        "INSTRUMENT'S CONSENT') and is the technical narrator of the "
        "Sphere/SEP-NULL exposure sequence in Ch 19–20.",
        entity="Hayden",
        confidence="inferred",
    ),

    # ----- Emily (handler / insider) --------------------------------------
    _entry(
        "emily.identity",
        "character",
        "Emily is Kain's QSA handler and a senior figure with access to "
        "Solis's sequestered research. Worked on Solis's original research "
        "team. Sent Kain the file on Chen. Confronts Kain about his Bleed "
        "and the two-jumps-left figure in Ch 10. Wrote the SHADOW/DELTA-14 "
        "pre-acquisition file on Kain. Bell is her operational partner.",
        entity="Emily",
        aliases=["Emily Voss"],
    ),
    _entry(
        "emily.two_jumps_warning",
        "character",
        "Emily to Kain (Ch 10, DEAD MAN'S SWITCH): 'You have two jumps "
        "left. Two high-stress, full-spectrum transitions. The third will "
        "accelerate the neurological collapse.' Kain refuses stand-down: "
        "'I have two jumps left. And I'm using them for me.'",
        entity="Emily",
        confidence="event",
        source_chapter=10,
    ),

    # ----- Bell (Emily's partner / technician who discovers the lie) -------
    _entry(
        "bell.identity",
        "character",
        "Bell is Emily's operational partner and a QSA technician/analyst. "
        "Ch 8 ('BELL DISCOVERS THE LIE') is her POV: she discovers that "
        "Kain's true ICS (41) and post-jump readings (e.g. jump 200 ICS 58) "
        "have been withheld from her. Quietly competent — adjusts a kitchen "
        "clock by 45 seconds rather than reach for a tablet when she "
        "realises she's being watched/surveilled.",
        entity="Bell",
    ),
    _entry(
        "bell.discovery",
        "character",
        "Bell concludes (Ch 8 close): 'Kain has been authorised to continue "
        "active fieldwork at ICS 41 without mandatory disclosure to his "
        "partner. No direct evidence. Sufficient inference. The QSA did not "
        "run operations like this without authorisation at the handling "
        "level, and Emily was the handler, and the handler knew the asset's "
        "status or the handler was negligent, and Emily was not negligent.' "
        "She does not call Kain. She does not know Kain.",
        entity="Bell",
        confidence="event",
        source_chapter=8,
    ),

    # ----- Reyes (case name AND present-day contact) -----------------------
    _entry(
        "reyes.case_history",
        "character",
        "'The Reyes case' is a closed case (2149) that Emily closed over "
        "Kain's objection. Referenced in Ch 1 as one of three times Kain "
        "saw a particular expression on Emily — the others being four years "
        "ago when his clearance was revoked, and a third occasion.",
        entity="Reyes",
        aliases=["the Reyes case"],
        confidence="event",
        source_chapter=1,
    ),
    _entry(
        "reyes.m_reyes_contact",
        "character",
        "'M. Reyes' is a name on a blank intake form discovered later "
        "(Ch 9, 'THE TUESDAY CONTACT' area). A contact present at Alfred "
        "Hospital, room two-fourteen, with planned exit routes. Relationship "
        "to the original Reyes case is unresolved.",
        entity="Reyes",
        aliases=["M. Reyes"],
        confidence="event",
        source_chapter=9,
    ),

    # ----- Solis (historical figure whose journals drive Ch 10) -----------
    _entry(
        "solis.identity",
        "character",
        "Martina Solis was the first director of the QSA's quantum "
        "insertion program. Built it from theoretical framework into "
        "operational reality over 22 years. Named the Threshold facility. "
        "Retired in some kind of disgrace/circumstance. Wrote the journals "
        "(three A5 hardbound volumes, dark green covers) now sequestered. "
        "Chen worked under her on her original research team.",
        entity="Solis",
        aliases=["Martina Solis"],
    ),
    _entry(
        "solis.journals",
        "character",
        "Solis's journals — three volumes, A5 hardbound, dark green covers, "
        "first entry dated 14 years before Ch 1. NOT on the QSA intake "
        "manifest (significant absence). Encrypted; Kain obtains the "
        "decryption key during the Ch 10 confrontation. Contain the "
        "residue-analysis line: 'The residue is not a flaw. I have spent "
        "three years treating it as an error.' Read by Kain in Ch 11.",
        entity="Solis",
        confidence="event",
        source_chapter=4,
    ),

    # ----- Chen (prologue victim, the trigger case) ------------------------
    _entry(
        "chen.identity",
        "character",
        "Marcus Chen, Senior Policy Architect, Civilian Integration "
        "Directorate, Level 6 clearance. Killed in the Prologue by his "
        "Replacement during a forced morning routine. Official record: "
        "'cardiac arrest, four days before Ch 1.' Triggered a dead-man's "
        "switch on his QSA comm device during the attack. Fourth confirmed "
        "Replacement Anomaly in 14 months. Was on Solis's original research "
        "team.",
        entity="Chen",
        aliases=["Marcus Chen"],
    ),
    _entry(
        "chen.apartment_state",
        "character",
        "Chen's apartment is preserved by the QSA surveillance team with "
        "full institutional fidelity. Mug ring on the kitchen counter. "
        "Carpet compression patterns match original layout. Father's copy "
        "of THE MALTESE FALCON on the bookshelf with spine reversed — Chen's "
        "tell, placed during the attack. Sealed with a QSA evidence lock "
        "(blue classification tape) when Kain visits in Ch 5.",
        entity="Chen",
        confidence="event",
        source_chapter=5,
    ),

    # ----- Aspect (QSA-internal interlocutor) -----------------------------
    _entry(
        "aspect.identity",
        "character",
        "Aspect is a QSA designation (not a surname) for an individual "
        "running Kain's biometric intake. Knows Kain's PQ genotype before "
        "intake completes. First appears Ch 6 ('THE VECTOR'): door opens, "
        "Emily announces 'Aspect is already inside.' Hands do not move "
        "during conversation; pauses two-to-three seconds before "
        "recalibrating responses.",
        entity="Aspect",
    ),

    # ----- Varn (second-most-recent Replacement Anomaly) ------------------
    _entry(
        "varn.identity",
        "character",
        "Varn is one of the three most recent confirmed Replacement "
        "Anomalies (Chen, Varn, and an unnamed QSA asset from a 2154 "
        "report). No details beyond name and category at this seeding.",
        entity="Varn",
        confidence="inferred",
    ),
]


# ===========================================================================
# PLOT — Timeline anchors, key events, open loops
# ===========================================================================

PLOT_ENTRIES: list[CanonEntry] = [
    # ----- Timeline anchors (events) -------------------------------------
    _entry(
        "plot.prologue_chen_killed",
        "plot",
        "Prologue: Marcus Chen is killed in his Melbourne apartment by his "
        "Replacement during a forced morning routine. Triggers a dead-man's "
        "switch on his QSA comm device, transmitting the last 60 seconds "
        "to a secure QSA server as biometrics flatline against the casing.",
        confidence="event",
        source_chapter=0,
    ),
    _entry(
        "plot.ch1_black_pearl",
        "plot",
        "Ch 1 (BLACK PEARL BAR): Kain meets Emily at the Black Pearl. She "
        "names Marcus Chen and frames the Replacement Anomaly pattern "
        "(fourth confirmed in 14 months). Tremor in Kain's right hand. "
        "Bleed peripheral fragmentation on the walk in.",
        confidence="event",
        source_chapter=1,
    ),
    _entry(
        "plot.ch2_the_mountain",
        "plot",
        "Ch 2 (THE MOUNTAIN): Kain drives switchbacks to a higher-altitude "
        "location; tremor present. Approaching the Threshold facility's "
        "exterior structure.",
        confidence="event",
        source_chapter=2,
    ),
    _entry(
        "plot.ch3_threshold",
        "plot",
        "Ch 3 (THRESHOLD): Kain enters the Threshold facility. Forty-metre "
        "fluorescent corridor; named by Solis. Internal QSA reference for "
        "the facility established.",
        confidence="event",
        source_chapter=3,
    ),
    _entry(
        "plot.ch4_alfred_hospital",
        "plot",
        "Ch 4 (ALFRED HOSPITAL): Hospital sequence. Setup for the Reyes "
        "contact thread. Threshold manifest visit context.",
        confidence="event",
        source_chapter=4,
    ),
    _entry(
        "plot.ch5_chen_apartment",
        "plot",
        "Ch 5 (THE APARTMENT): Kain performs his reading pass at Chen's "
        "preserved apartment. Maltese Falcon spine-reversed. Mug ring on "
        "counter. QSA evidence lock on the door.",
        confidence="event",
        source_chapter=5,
    ),
    _entry(
        "plot.ch6_aspect_intake",
        "plot",
        "Ch 6 (THE VECTOR): Aspect runs Kain's biometric intake. Knows the "
        "PQ genotype before intake completes. First appearance of the "
        "Aspect designation.",
        confidence="event",
        source_chapter=6,
    ),
    _entry(
        "plot.ch10_dead_mans_switch",
        "plot",
        "Ch 10 (DEAD MAN'S SWITCH): Kain reads Solis's journals (after "
        "obtaining the decryption key). Confronts Emily. 'You have two "
        "jumps left.' Kain refuses stand-down and walks out.",
        confidence="event",
        source_chapter=10,
    ),
    _entry(
        "plot.ch12_the_breach",
        "plot",
        "Ch 12 (THE BREACH): Kain breaches a credential-denied space "
        "(Level 4 credential 'no longer existed'). Hayden's voice drifts. "
        "Multiple Coherence Offset coordinates traversed (77-Alpha-9: "
        "0.004, 88-Gamma-3: 0.011). ICS readings 53 → 54/55.",
        confidence="event",
        source_chapter=12,
    ),
    _entry(
        "plot.ch17_instruments_consent",
        "plot",
        "Ch 17 (THE INSTRUMENT'S CONSENT): Hayden's POV / Transit "
        "chapter, situated between the breach and the descent.",
        confidence="event",
        source_chapter=17,
    ),
    _entry(
        "plot.ch19_descent_sphere",
        "plot",
        "Ch 19 (THE DESCENT): Kain and Hayden enter the Sphere. ICS "
        "burning through reserve at predicted rate. Coordinates progress "
        "through Coherence Offset gradient toward the SEP-NULL.",
        confidence="event",
        source_chapter=19,
    ),

    # ----- Key narrative facts -------------------------------------------
    _entry(
        "plot.maltese_falcon_tell",
        "plot",
        "Marcus Chen reversed THE MALTESE FALCON (spine facing in) on his "
        "bookshelf during the Replacement attack — violating his father's "
        "strictest rule. The book's reversed spine survives the Replacement's "
        "cleanup; it is one of the readable signals Kain finds in Ch 5.",
        confidence="event",
        source_chapter=0,
    ),
    _entry(
        "plot.solis_residue_quote",
        "plot",
        "Solis journal (Volume 2, page 44): 'The residue is not a flaw. "
        "I have spent three years treating it as an error in measurement.' "
        "The line reframes the entire research program — what the QSA "
        "treats as a measurement artefact is the actual mechanism.",
        confidence="event",
        source_chapter=10,
    ),

    # ----- Open loops -----------------------------------------------------
    _entry(
        "plot.loop_replacement_origin",
        "plot",
        f"{OPEN_LOOP_PREFIX} Who is running the Replacement Anomaly "
        f"program? The QSA's own internal apparatus, or an external actor "
        f"with QSA access? The replacement of Chen demonstrated "
        f"sophisticated knowledge of QSA personnel and the Sphere.",
        confidence="inferred",
    ),
    _entry(
        "plot.loop_aspect_identity",
        "plot",
        f"{OPEN_LOOP_PREFIX} Who or what is Aspect? Designation only; "
        f"identity, agenda, and direct reporting line unresolved.",
        confidence="inferred",
    ),
    _entry(
        "plot.loop_kains_third_jump",
        "plot",
        f"{OPEN_LOOP_PREFIX} Kain refused stand-down. He has two jumps "
        f"left before the third triggers neurological collapse. How does "
        f"he use them?",
        confidence="inferred",
        source_chapter=10,
    ),
    _entry(
        "plot.loop_solis_retirement",
        "plot",
        f"{OPEN_LOOP_PREFIX} Why did Martina Solis retire? Her journals "
        f"are sequestered, her research kept at the same classification "
        f"as the program itself. What did she find?",
        confidence="inferred",
    ),
    _entry(
        "plot.loop_reyes_identity",
        "plot",
        f"{OPEN_LOOP_PREFIX} Is 'M. Reyes' (Alfred Hospital, room 2-14) "
        f"the same Reyes as the closed 2149 case? If so, why is the case "
        f"reactivating now?",
        confidence="inferred",
    ),
    _entry(
        "plot.loop_emily_motivation",
        "plot",
        f"{OPEN_LOOP_PREFIX} Emily wrote SHADOW/DELTA-14/K.J. – "
        f"PRE-ACQUISITION, recruited Kain knowing his Bleed curve, and "
        f"sent him the Chen file. What is she optimising for — Kain's "
        f"survival, the investigation's outcome, or something else?",
        confidence="inferred",
    ),
    _entry(
        "plot.loop_varn_details",
        "plot",
        f"{OPEN_LOOP_PREFIX} Who was Varn? Named as a Replacement Anomaly "
        f"alongside Chen, no other details seeded.",
        confidence="inferred",
    ),
    _entry(
        "plot.loop_sep_null_purpose",
        "plot",
        f"{OPEN_LOOP_PREFIX} Why would anyone need a carrier at the "
        f"SEP-NULL given that complete buffer saturation occurs in 0.4 "
        f"seconds and the position is clinically unsurvivable?",
        confidence="inferred",
    ),
]


# ===========================================================================
# CRAFT — Voice and register rules grounded in the actual prose
# ===========================================================================

CRAFT_ENTRIES: list[CanonEntry] = [
    _entry(
        "craft.register_clinical",
        "craft",
        "Default narrative register: clinical / proprioceptive. Carriers "
        "report their bodies in the third person ('legs reported', 'tremor "
        "present', 'no pain — only notification'). NOT lyrical, NOT purple. "
        "Counts and timestamps are load-bearing details, not flavour.",
    ),
    _entry(
        "craft.negative_space",
        "craft",
        "The story repeatedly makes meaning in negative space: the "
        "journals NOT on the manifest, the mug Chen never used, the "
        "schedule written in the wrong hand, the spine-reversed novel. "
        "Conflict detection should treat ABSENCES as actionable signals.",
    ),
    _entry(
        "craft.measurement_as_voice",
        "craft",
        "Specific numerical readings (ICS values, Coherence Offsets, pulse "
        "counts, durations in seconds) carry the voice of the world. They "
        "are character-specific tics (Kain's carotid pulse count) as much "
        "as worldbuilding — preserve them in dialogue and narration.",
    ),
    _entry(
        "craft.repeated_phrases",
        "craft",
        "Recurring formulas signal motif continuity: 'the specific quality "
        "of X' (clinical observation), 'X did not Y' (negative-space "
        "observation), 'the kind of Z' (institutional knowledge framing). "
        "Drift away from these blunts the register; the extractor should "
        "treat such drifts as craft-tier notes, not continuity bugs.",
    ),
    _entry(
        "craft.two_mirror_hunt_chapters",
        "craft",
        "There are TWO chapters titled 'THE MIRROR HUNT' (Ch 7 and Ch 11). "
        "This may be deliberate thematic mirroring or an editorial "
        "oversight to be resolved at final pass. The conflict detector "
        "should NOT auto-flag this as a duplicate; it is a known structural "
        "ambiguity.",
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
    parser.add_argument("--path", type=Path, default=None)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--force", action="store_true")
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
