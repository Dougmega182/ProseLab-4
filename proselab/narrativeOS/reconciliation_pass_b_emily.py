"""
reconciliation_pass_b_emily.py — Pass B reconciliation for entity Emily.

1 SUPERSEDE → NEW:
  - emily.identity -> emily.identity.v2 (corrected baseline; was missing
    Delta-6 designation, Solis acquisition role, Marcus Reyes alias,
    eleven-year Kain history; corrected the Bell-as-partner error)

emily.two_jumps_warning is kept as-is — the seed accurately captures
the Ch 10 quote and there's no better consolidating chapter entry.

Backs up to data/canon_store.pre_pass_b_emily.json.
Pre-flight validates seed entry exists and references resolve.
Idempotent.
"""
import json
from datetime import datetime, timezone
from pathlib import Path

STORE_PATH = Path("data/canon_store.json")
BACKUP_PATH = Path("data/canon_store.pre_pass_b_emily.json")
PASS_ID = "reconciliation_pass_b_emily_20260525"
NOW = datetime.now(timezone.utc).isoformat()


SUPERSEDE_NEW = [
    {
        "old": "emily.identity",
        "new_id": "emily.identity.v2",
        "namespace": "character",
        "entity": "Emily",
        "aliases": ["Emily Voss", "Voss", "Operative Delta-6", "Marcus Reyes"],
        "confidence": "hard_canon",
        "source_chapter": 0,
        "new_value": (
            "Emily Voss -- Operative Delta-6 (emily.solis_acquisition), "
            "senior QSA handler. Eleven-year professional history with "
            "Kain spanning multiple key inflection points: the closed "
            "Reyes case (2149), Kain's clearance revocation (four years "
            "ago), the present recruitment. Was a senior analyst seven "
            "years into her QSA career when she received Kain's Varn "
            "report and escalated it; subsequently 'made him invisible' "
            "by systematically dismantling his career as protective cover "
            "from the Replacement Network (emily.role_at_varn_time, "
            "kain.career_destruction). Wrote the "
            "SHADOW/DELTA-14/K.J. PRE-ACQUISITION file on Kain. "
            ""
            "Operational signatures: jaw-clench tell on the left side "
            "when 'managing information rather than sharing it' "
            "(emily.jaw_tell); deliberate empty-handed protocol when "
            "meeting Kain in Ch 1, unprecedented in their relationship "
            "(emily.protocol_ch1); reads with 'the methodical patience "
            "of someone who had already read them and was reading them "
            "again for the specific purpose of reading them in his "
            "presence' (emily.prior_access_files). "
            ""
            "Custodian of the three green Solis journals -- took them "
            "four months before the sequestration was filed "
            "(plot.ch13_solis_journals_four_months_before). Personally "
            "conducted Solis's acquisition and sequestration four years "
            "ago under OPS-CONV-784-C, using the Marcus Reyes civilian "
            "cover identity to access Alfred Hospital's off-network "
            "archive (emily.solis_acquisition). Maintains her own six "
            "black institutional notebooks of resonance data from Kain's "
            "deployments -- raw ICS readings, buffer efficiency, Bleed "
            "episodes, and the most complete Sphere coherence map the "
            "QSA has produced (emily.solis_journals_content; distinct "
            "from Solis's journals). "
            ""
            "Knew Kain's Bleed prognosis before the Threshold briefing "
            "and 'built the operation around it, factoring his impending "
            "terminality into the calculus' (emily.prior_knowledge_bleed). "
            "Approved the operational parameters allowing Hayden to "
            "continue fieldwork at ICS 41 without mandatory partner "
            "disclosure (Bell's inference from Ch 8; "
            "plot.loop_emily_handler_complicity). In Ch 10 delivers the "
            "'two jumps left' warning; Kain refuses stand-down "
            "(emily.two_jumps_warning). "
            ""
            "Note: the prior seed entry incorrectly described Bell as "
            "Emily's operational partner. Bell is Hayden's operational "
            "partner; Emily sits above both in the handler hierarchy. "
            ""
            "For scene-level detail: plot.ch10_emily_confrontation, "
            "plot.loop_emily_career_destruction_motive, "
            "plot.loop_emily_reading_performance, "
            "kain.emily_betrayal_taxonomy."
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
    referenced = [
        "emily.solis_acquisition",
        "emily.role_at_varn_time",
        "kain.career_destruction",
        "emily.jaw_tell",
        "emily.protocol_ch1",
        "emily.prior_access_files",
        "plot.ch13_solis_journals_four_months_before",
        "emily.solis_journals_content",
        "emily.prior_knowledge_bleed",
        "plot.loop_emily_handler_complicity",
        "emily.two_jumps_warning",
        "plot.ch10_emily_confrontation",
        "plot.loop_emily_career_destruction_motive",
        "plot.loop_emily_reading_performance",
        "kain.emily_betrayal_taxonomy",
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
