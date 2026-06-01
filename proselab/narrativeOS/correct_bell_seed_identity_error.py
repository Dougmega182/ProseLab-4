# scripts/correct_bell_seed_identity_error.py
"""
One-shot manual correction of the bell.identity and bell.discovery seed
entries that incorrectly attributed Hayden's hidden ICS readings to Kain.

The Ch 8 extraction (pass backfill_ch8_20260525) correctly captured the
full story across 22 entries. The two seed entries below remain only to
fix the identity attribution and link to the canonical Ch 8 coverage.
They are deliberately brief — they exist to retire the wrong seed, not
to re-extract the chapter.

Safe to run multiple times: skips entries already superseded.
"""
import json
from datetime import datetime, timezone
from pathlib import Path

STORE_PATH = Path("data/canon_store.json")
BACKUP_PATH = Path("data/canon_store.pre_bell_correction.json")
CORRECTION_PASS = "manual_seed_correction_bell_20260525"

CORRECTIONS = [
    {
        "old_id": "bell.identity",
        "new": {
            "id": "bell.identity.v2",
            "namespace": "character",
            "entity": "Bell",
            "value": (
                "Bell is Hayden's operational partner and a QSA "
                "technician/analyst. Quietly competent — adjusts a kitchen "
                "clock by 45 seconds rather than reach for a tablet when "
                "she realises she is being watched. Discovers Hayden's "
                "concealed ICS degradation in Ch 8 (see bell.pov_chapter, "
                "hayden.ics_full_trajectory). Knows Kain only by name "
                "from Hayden's early-cycle logs as 'the QSA Norm "
                "consultant, the dormant carrier Emily had brought in as "
                "a procedural instrument' (see bell.knowledge_of_kain)."
            ),
            "aliases": [],
            "confidence": "hard_canon",
            "source_chapter": 8,
            "extracted_at_pass": CORRECTION_PASS,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "superseded_by": None,
        },
        "reason": (
            "Original seed entry incorrectly stated Bell discovered "
            "*Kain's* ICS 41. Ch 8 extraction confirmed it is *Hayden's* "
            "ICS Bell discovers (and Hayden's full jump log: ICS 96 at "
            "jump 1 down to ICS 32 at jump 417). Bell knows Kain only "
            "by name."
        ),
    },
    {
        "old_id": "bell.discovery",
        "new": {
            "id": "bell.discovery.v2",
            "namespace": "character",
            "entity": "Bell",
            "value": (
                "Bell concludes (Ch 8): Hayden has been authorised to "
                "continue active fieldwork at ICS 41 without mandatory "
                "disclosure to his partner. Builds a partition file of "
                "evidence over six weeks. Decides to leave incrementally, "
                "below the threshold of Hayden's residue-reading "
                "(see bell.departure_geometry). Does NOT contact Emily — "
                "infers Emily approved the operational parameters "
                "(see plot.loop_emily_handler_complicity). Does NOT "
                "contact Kain (see bell.knowledge_of_kain). The original "
                "seed entry erroneously attributed this discovery to "
                "Kain's data instead of Hayden's."
            ),
            "aliases": [],
            "confidence": "event",
            "source_chapter": 8,
            "extracted_at_pass": CORRECTION_PASS,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "superseded_by": None,
        },
        "reason": (
            "Original seed entry erroneously named Kain as the subject "
            "of Bell's discovery; the actual subject is Hayden."
        ),
    },
]


def main() -> int:
    with STORE_PATH.open(encoding="utf-8") as f:
        store = json.load(f)

    # Backup
    BACKUP_PATH.write_text(json.dumps(store, indent=2), encoding="utf-8")

    by_id = {e["id"]: e for e in store["entries"]}
    actions = []

    for correction in CORRECTIONS:
        old_id = correction["old_id"]
        new_entry = correction["new"]

        old = by_id.get(old_id)
        if old is None:
            actions.append(f"SKIP: {old_id} not found")
            continue
        if old.get("superseded_by") is not None:
            actions.append(f"SKIP: {old_id} already superseded by {old['superseded_by']}")
            continue
        if new_entry["id"] in by_id:
            actions.append(f"SKIP: {new_entry['id']} already exists")
            continue

        # Append new entry; mark old as superseded
        store["entries"].append(new_entry)
        old["superseded_by"] = new_entry["id"]
        actions.append(
            f"SUPERSEDED: {old_id} -> {new_entry['id']}  ({correction['reason']})"
        )

    with STORE_PATH.open("w", encoding="utf-8") as f:
        json.dump(store, f, indent=2)

    for a in actions:
        print(a)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
