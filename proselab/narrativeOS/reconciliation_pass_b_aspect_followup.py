import json
from datetime import datetime, timezone
from pathlib import Path

STORE_PATH = Path("data/canon_store.json")
BACKUP_PATH = Path("data/canon_store.pre_pass_b_aspect_followup.json")
PASS_ID = "reconciliation_pass_b_aspect_followup_20260525"
NOW = datetime.now(timezone.utc).isoformat()

SUPERSEDE_NEW = [{
    "old": "world.aspect_designation",
    "new_id": "world.aspect_designation.v2",
    "namespace": "world",
    "entity": None,
    "aliases": [],
    "confidence": "hard_canon",
    "source_chapter": 0,
    "new_value": (
        "Aspect is a QSA designation, not a surname -- 'a single-word "
        "identifier the QSA assigned to personnel whose operational role "
        "required a layer of institutional distance between their function "
        "and their identity.' The designation pattern implies the QSA "
        "routinely separates clinical/operational identity from personal "
        "identity for at least some categories of personnel. For "
        "Aspect-the-individual (the senior intake clinician encountered "
        "in Ch 3), see aspect.identity.v2."
    ),
}]


def main():
    with STORE_PATH.open(encoding="utf-8") as f:
        store = json.load(f)
    BACKUP_PATH.write_text(json.dumps(store, indent=2), encoding="utf-8")
    by_id = {e["id"]: e for e in store["entries"]}
    
    missing = []
    for s in SUPERSEDE_NEW:
        if s["old"] not in by_id:
            missing.append(s["old"])
        if s["new_id"] in by_id:
            missing.append(f"COLLISION: {s['new_id']}")
    if "aspect.identity.v2" not in by_id:
        missing.append("MISSING REF: aspect.identity.v2")
    if missing:
        print("Pre-flight FAILED:", missing)
        return 1
    print("Pre-flight OK.")
    
    for s in SUPERSEDE_NEW:
        old = by_id[s["old"]]
        if old.get("superseded_by"):
            print(f"SKIP: {s['old']} already superseded")
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
        old["superseded_by"] = s["new_id"]
        print(f"  {s['old']} -> {s['new_id']}")
    
    with STORE_PATH.open("w", encoding="utf-8") as f:
        json.dump(store, f, indent=2)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
