"""
reconciliation_pass_b_reyes.py — Pass B reconciliation for entity Reyes.

3 actions:
  - reyes.case_history -> reyes.case_closed_2149 (SUPERSEDE existing)
  - reyes.m_reyes_contact -> reyes_marcus.civilian_cover (SUPERSEDE existing)
  - ADD reyes_network.identity (new canonical character card for Reyes-the-handler)

Backs up to data/canon_store.pre_pass_b_reyes.json.
Pre-flight validates seed entries exist and references resolve.
Idempotent.
"""
import json
from datetime import datetime, timezone
from pathlib import Path

STORE_PATH = Path("data/canon_store.json")
BACKUP_PATH = Path("data/canon_store.pre_pass_b_reyes.json")
PASS_ID = "reconciliation_pass_b_reyes_20260525"
NOW = datetime.now(timezone.utc).isoformat()


SUPERSEDE_EXISTING = [
    {
        "old": "reyes.case_history",
        "new": "reyes.case_closed_2149",
        "reason": "Ch 1 extraction has same fact with the actual dialogue quote.",
    },
    {
        "old": "reyes.m_reyes_contact",
        "new": "reyes_marcus.civilian_cover",
        "reason": "Seed framed M. Reyes as a hostile contact; actually Emily's civilian cover identity (Ch 9 hard_canon).",
    },
]


ADD_NEW_ENTRIES = [
    {
        "id": "reyes_network.identity",
        "namespace": "character",
        "entity": "Reyes",
        "aliases": [],
        "confidence": "hard_canon",
        "source_chapter": 7,
        "value": (
            "Reyes -- senior handler within 'the network' (the entity behind "
            "the Replacement program). Male, eleven years operational tenure, "
            "operates from a Flinders Lane cafe in Melbourne, uses a "
            "four-second-latency relay routed through three jurisdictions "
            "for communications. Carries a newspaper as cover, drinks long "
            "blacks, speaks with structural authority. "
            ""
            "Has been surveilling Kain for six weeks "
            "(reyes.kain_surveillance_duration), following the B-734 "
            "investigation that first flagged Kain as a dormant carrier "
            "with active Sphere exposure. Reads pre-classification "
            "literature on dormant carrier degradation "
            "(reyes.classified_research_access), allowing him to perform "
            "the degradation arithmetic without QSA-internal sources. "
            ""
            "Knows Emily Voss has the Solis journals and has an independent "
            "agenda (reyes.knows_emily_has_journals). Network strategy "
            "regarding Kain: not recruitment but pointing -- deliberately "
            "laid the M. Reyes intake-form breadcrumb to draw Kain toward "
            "discovering Emily's journal possession "
            "(plot.ch7_5_reyes_name_breadcrumb, "
            "plot.ch7_5_network_strategy_point_kain). Frames Kain as 'a "
            "mechanism the network had not built and did not need to "
            "maintain' (plot.ch7_5_network_did_not_create_kain). "
            ""
            "NOT to be confused with: 'the Reyes case' (closed 2149 case, "
            "reyes.case_closed_2149) or 'Marcus Reyes' (Emily's civilian "
            "cover identity, reyes_marcus.civilian_cover). Identity beyond "
            "the operational name unresolved "
            "(plot.loop_reyes_network_position). "
            ""
            "See: reyes.network_role, reyes.eleven_year_relay, "
            "reyes.replacement_methodology_knowledge, "
            "reyes.kain_terminal_assessment, "
            "plot.ch7_5_network_fork_outcome."
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
    for e in ADD_NEW_ENTRIES:
        if e["id"] in by_id:
            missing.append(f"  COLLISION: {e['id']}")
    referenced = [
        "reyes.kain_surveillance_duration",
        "reyes.classified_research_access",
        "reyes.knows_emily_has_journals",
        "plot.ch7_5_reyes_name_breadcrumb",
        "plot.ch7_5_network_strategy_point_kain",
        "plot.ch7_5_network_did_not_create_kain",
        "reyes.case_closed_2149",
        "reyes_marcus.civilian_cover",
        "plot.loop_reyes_network_position",
        "reyes.network_role",
        "reyes.eleven_year_relay",
        "reyes.replacement_methodology_knowledge",
        "reyes.kain_terminal_assessment",
        "plot.ch7_5_network_fork_outcome",
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

    print("\n=== ADD new entries ===")
    for e in ADD_NEW_ENTRIES:
        new_entry = {
            "id": e["id"],
            "namespace": e["namespace"],
            "entity": e["entity"],
            "value": e["value"],
            "aliases": e["aliases"],
            "confidence": e["confidence"],
            "source_chapter": e["source_chapter"],
            "extracted_at_pass": PASS_ID,
            "created_at": NOW,
            "superseded_by": None,
        }
        store["entries"].append(new_entry)
        by_id[e["id"]] = new_entry
        actions.append(f"  ADDED: {e['id']}")

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
