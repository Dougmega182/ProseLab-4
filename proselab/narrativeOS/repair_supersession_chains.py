"""
repair_supersession_chains.py — repair fractured supersession chains from the
audit-trail-loss incident. Points all intermediate versions of each root to
the current head (highest .vN).

Backs up to data/canon_store.pre_chain_repair.json.
Idempotent — skips entries already correctly superseded.
"""
import json
from pathlib import Path

STORE_PATH = Path("data/canon_store.json")
BACKUP_PATH = Path("data/canon_store.pre_chain_repair.json")

# From Diagnostic 1: roots with multiple active versions and their head .vN
CHAINS_TO_REPAIR = {
    "chen.apartment_location": 6,
    "chen.caseload": 3,
    "chen.comm_device_activation": 4,
    "chen.dead_mans_switch_activation": 6,
    "chen.divorce": 6,
    "chen.fathers_rule": 3,
    "chen.flagged_eighteen_months": 3,
    "chen.schedule_forgery": 3,
    "chen.white_mug": 4,
    "chen.wrist_injury": 6,
    "plot.loop_already_optimised": 2,
    "plot.loop_chen_behavioural_flag": 3,
    "plot.loop_chen_cover_up": 2,
    "plot.loop_chen_evidence_trail": 3,
    "plot.loop_dead_mans_switch_recipient": 3,
    "plot.loop_differences_are_the_point": 2,
    "plot.loop_reflection_delay": 3,
    "plot.loop_reflection_mechanism": 2,
    "plot.loop_replacement_knowledge_source": 2,
    "replacement.recognition_not_surprise": 5,
    "replacement.voice_mimicry": 3,
}


def main() -> int:
    with STORE_PATH.open(encoding="utf-8") as f:
        store = json.load(f)
    BACKUP_PATH.write_text(json.dumps(store, indent=2), encoding="utf-8")
    print(f"Backup written: {BACKUP_PATH}")

    by_id = {e["id"]: e for e in store["entries"]}

    # Pre-flight: verify all head versions exist
    print("\n=== Pre-flight: verify heads exist ===")
    missing_heads = []
    for root, max_v in CHAINS_TO_REPAIR.items():
        head_id = root if max_v == 1 else f"{root}.v{max_v}"
        if head_id not in by_id:
            missing_heads.append(head_id)
    if missing_heads:
        print("ABORT: Missing head IDs:")
        for m in missing_heads:
            print(f"  {m}")
        return 1
    print("OK")

    # Apply repairs
    print("\n=== Repairing chains ===")
    repaired = 0
    skipped = 0
    for root, max_v in CHAINS_TO_REPAIR.items():
        head_id = root if max_v == 1 else f"{root}.v{max_v}"

        # The bare root and v2..v(max-1) all get pointed at head, if not already
        candidates = []
        if root in by_id and root != head_id:
            candidates.append(root)
        for v in range(2, max_v):
            vid = f"{root}.v{v}"
            if vid in by_id:
                candidates.append(vid)

        for vid in candidates:
            e = by_id[vid]
            current_target = e.get("superseded_by")
            if current_target == head_id:
                skipped += 1
                continue
            if current_target is None:
                e["superseded_by"] = head_id
                print(f"  {vid} -> {head_id}  (was: ACTIVE)")
                repaired += 1
            else:
                e["superseded_by"] = head_id
                print(f"  {vid} -> {head_id}  (was: -> {current_target})")
                repaired += 1

    with STORE_PATH.open("w", encoding="utf-8") as f:
        json.dump(store, f, indent=2)

    print(f"\nRepairs: {repaired}")
    print(f"Skipped (already correct): {skipped}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
