import argparse
import json
from collections import defaultdict
from pathlib import Path

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("target", help="Entity name (e.g. 'Hayden')")
    parser.add_argument("--split-by-pass", action="store_true",
                        help="Write one file per extracted_at_pass instead of one combined dump")
    args = parser.parse_args()
    target = args.target
    target_lower = target.lower()

    with Path("data/canon_store.json").open(encoding="utf-8") as f:
        store = json.load(f)

    active = [e for e in store["entries"] if e.get("superseded_by") is None]
    matched = [
        e for e in active
        if e.get("entity") == target
        or target_lower in e.get("id", "").lower()
    ]

    by_pass = defaultdict(list)
    for e in matched:
        by_pass[e.get("extracted_at_pass", "unknown")].append(e)

    def render_entries(entries: list) -> str:
        lines = []
        for e in sorted(entries, key=lambda x: x.get("source_chapter", 999)):
            ch = e.get("source_chapter")
            ch_label = f"[{ch}] " if ch is not None else ""
            lines.append(f"### {ch_label}{e['id']}")
            lines.append(f"  confidence: {e.get('confidence')}  |  namespace: {e.get('namespace')}  |  entity: {e.get('entity')}")
            lines.append(f"  value: {e.get('value')}")
            lines.append("")
        return "\n".join(lines)

    if args.split_by_pass:
        out_dir = Path(f"{target_lower}_dumps")
        out_dir.mkdir(exist_ok=True)
        # Write a manifest summarising all passes
        manifest_lines = [f"=== {target}: {len(matched)} active entries across {len(by_pass)} passes ===\n"]
        for pass_id, entries in sorted(by_pass.items()):
            safe = str(pass_id).replace(":", "-").replace("/", "-")
            fname = f"{target_lower}__{safe}.md"
            content = (
                f"=== {target} entries from pass: {pass_id} "
                f"({len(entries)} entries) ===\n\n"
                + render_entries(entries)
            )
            (out_dir / fname).write_text(content, encoding="utf-8")
            manifest_lines.append(f"  {fname}  ({len(entries)} entries)")
        manifest_lines.append("")
        (out_dir / "MANIFEST.md").write_text("\n".join(manifest_lines), encoding="utf-8")
        print(f"Wrote {len(by_pass)} pass files + MANIFEST.md to {out_dir}/")
        print(f"Total entries: {len(matched)}")
    else:
        # Existing single-file behavior
        lines = []
        lines.append(f"=== {target} (ID or entity match): {len(matched)} active entries ===\n")
        
        # Seed first
        for pass_id in ["seed"]:
            if pass_id in by_pass:
                lines.append(f"## SEED ENTRIES ({len(by_pass[pass_id])}):\n")
                for e in by_pass.pop(pass_id):
                    lines.append(f"### {e['id']}")
                    lines.append(f"  confidence: {e.get('confidence')}  |  source_chapter: {e.get('source_chapter')}")
                    lines.append(f"  value: {e.get('value')}")
                    lines.append("")
        
        # Everything else, grouped by pass
        for pass_id, entries in sorted(by_pass.items()):
            lines.append(f"\n## PASS: {pass_id} ({len(entries)} entries)\n")
            for e in sorted(entries, key=lambda x: x.get("source_chapter", 999)):
                ch = e.get("source_chapter")
                ch_label = f"[{ch}] " if ch is not None else ""
                lines.append(f"### {ch_label}{e['id']}")
                lines.append(f"  confidence: {e.get('confidence')}  |  namespace: {e.get('namespace')}")
                lines.append(f"  value: {e.get('value')}")
                lines.append("")
        
        rendered = "\n".join(lines)
        output_file = f"{target_lower}_focused.md"
        Path(output_file).write_text(rendered, encoding="utf-8")
        print(f"Written to: {output_file}  ({len(lines)} lines)")
        print(f"{target} entry count: {len(matched)}")

if __name__ == "__main__":
    main()
