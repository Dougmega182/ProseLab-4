"""
Command-line entry point.

Usage:
    python -m narrative_os analyze <manuscript> <chapter>
    python -m narrative_os analyze-all <manuscript>
    python -m narrative_os stats
    python -m narrative_os pending
    python -m narrative_os report
    python -m narrative_os clear-cache
    python -m narrative_os build-contract --decisions decisions.md --out data/contracts/book1_contract.json
"""

from __future__ import annotations

import argparse
import sys
import json
from pathlib import Path
from typing import Sequence

from .manuscript import Manuscript
from .pipeline import (
    AnalysisStatus,
    PENDING_DIR,
    analyze_chapter,
)
from .schemas import ConflictReport
from .store import DEFAULT_STORE_PATH, stats as store_stats


def _print_result(result, verbose: bool = False) -> None:
    """Pretty-print an AnalysisResult to stdout."""
    chapter_label = (
        f"{int(result.chapter)}" if result.chapter == int(result.chapter)
        else f"{result.chapter}"
    )
    if result.status == AnalysisStatus.MERGED:
        m = result.merge
        print(
            f"  [SUCCESS] Ch {chapter_label:<6}  merged   "
            f"+{m.new_entries_added} entries, "
            f"+{m.loops_opened} loops, "
            f"-{m.loops_resolved} resolved"
            + (f", {m.entries_superseded} superseded" if m.entries_superseded else "")
        )
    elif result.status == AnalysisStatus.PENDING_REVIEW:
        r = result.report
        print(
            f"  [PENDING] Ch {chapter_label:<6}  pending  "
            f"{len(r.high())} HIGH, {len(r.medium())} MEDIUM, {len(r.low())} LOW"
            f"  → {result.pending_path}"
        )
    elif result.status == AnalysisStatus.SKIPPED_IDEMPOTENT:
        print(f"  [SKIPPED] Ch {chapter_label:<6}  skipped  (pass already applied)")
    elif result.status == AnalysisStatus.FAILED:
        print(f"  [FAILED]  Ch {chapter_label:<6}  failed   {result.error}")
        if verbose and result.report:
            print(result.report.model_dump_json(indent=2))


def cmd_analyze(args: argparse.Namespace) -> int:
    p = Path(args.manuscript)
    if p.is_dir():
        ms = Manuscript.load_from_directory(p)
    else:
        ms = Manuscript.load(p)
    if args.verbose:
        print(f"Manuscript: {ms}")
    result = analyze_chapter(
        manuscript=ms,
        chapter_num=args.chapter,
        canon_store_path=args.store,
        pass_id=args.pass_id,
    )
    _print_result(result, verbose=args.verbose)
    return 0 if result.status != AnalysisStatus.FAILED else 1


def cmd_analyze_all(args: argparse.Namespace) -> int:
    p = Path(args.manuscript)
    if p.is_dir():
        ms = Manuscript.load_from_directory(p)
    else:
        ms = Manuscript.load(p)
    print(f"Manuscript: {ms}")
    print(f"Analysing {ms.chapter_count} chapters...")
    print()
    failures = 0
    for chapter in ms.chapters:
        if args.skip and chapter.display_number in args.skip:
            continue
        try:
            result = analyze_chapter(
                manuscript=ms,
                chapter_num=chapter.number,
                canon_store_path=args.store,
                pass_id=args.pass_id,
                auto_merge_clean=not args.dry_run,
            )
            _print_result(result, verbose=args.verbose)
            if result.status == AnalysisStatus.FAILED:
                failures += 1
                if not args.continue_on_error:
                    print(f"\nStopping due to failure on chapter {chapter.display_number}.")
                    return 1
        except KeyboardInterrupt:
            print("\nInterrupted.")
            return 130
    print()
    print(f"Done. {failures} failures." if failures else "Done.")
    return 0 if failures == 0 else 1


def cmd_stats(args: argparse.Namespace) -> int:
    s = store_stats(args.store)
    print(f"Canon store: {args.store or DEFAULT_STORE_PATH}")
    print(f"  Total entries:    {s['total']}")
    print(f"  Active:           {s['active']}")
    print(f"  Superseded:       {s['superseded']}")
    print(f"  Open loops:       {s['open_loops']}")
    print(f"  By namespace:")
    for ns, count in sorted(s["by_namespace"].items()):
        print(f"    {ns:<12} {count}")
    print(f"  By confidence:")
    for conf, count in sorted(s["by_confidence"].items()):
        print(f"    {conf:<12} {count}")
    return 0


def cmd_audit_fake_pass_ids(args: argparse.Namespace) -> int:
    from .canon_audit import audit_fake_pass_ids

    store_path = args.store or DEFAULT_STORE_PATH
    res = audit_fake_pass_ids(store_path, clean=args.clean)
    print(f"Fake pass ID audit:")
    print(f"  Found fake pass entries: {res['fake_count']}")
    if args.clean:
        print(f"  Cleaned entries:         {res['cleaned_count']}")
    else:
        if res['fake_count'] > 0:
            print("  Run with --clean to fix these entries.")
    if res['fake_ids']:
        print("  Affected Entry IDs:")
        for eid in res['fake_ids']:
            print(f"    - {eid}")
    return 1 if (res['fake_count'] > 0 and not args.clean) else 0


def cmd_audit_contamination(args: argparse.Namespace) -> int:
    from .canon_audit import audit_contamination

    store_path = args.store or DEFAULT_STORE_PATH
    res = audit_contamination(store_path, entity=args.entity)
    print(f"Contamination audit for entity: {args.entity}")
    print(f"  Total seed entries found:    {res['contamination_count']}")
    print(f"  Violations (unallowed seeds): {res['violation_count']}")
    if res['entries']:
        print("  Matching entries:")
        for eid in res['entries']:
            prefix = "❌ VIOLATION" if eid in res['violations'] else "✅ ALLOWED"
            print(f"    - [{prefix}] {eid}")
    return 1 if res['violation_count'] > 0 else 0


def cmd_snapshot_canon(args: argparse.Namespace) -> int:
    from .canon_audit import snapshot_canon

    store_path = args.store or DEFAULT_STORE_PATH
    out_path = args.out or (Path(__file__).parents[2] / "data" / "canon.phase8_clean.json")
    try:
        snapshot_canon(store_path, out_path)
        print(f"Snapshot successfully written to: {out_path.absolute()}")
        return 0
    except Exception as e:
        print(f"Failed to create snapshot: {e}")
        return 1



def cmd_pending(args: argparse.Namespace) -> int:
    pending_dir = Path(args.pending_dir) if args.pending_dir else PENDING_DIR
    if not pending_dir.exists():
        print(f"No pending reviews (directory {pending_dir} does not exist).")
        return 0
    md_files = sorted(pending_dir.glob("*.md"))
    if not md_files:
        print("No pending reviews.")
        return 0
    print(f"Pending reviews in {pending_dir}:")
    for f in md_files:
        print(f"  {f.name}")
    return 0


def cmd_report(args: argparse.Namespace) -> int:
    pending_dir = Path(args.pending_dir) if args.pending_dir else PENDING_DIR
    if not pending_dir.exists():
        print(f"No pending reports (directory {pending_dir} does not exist).")
        return 0

    report_files = sorted(pending_dir.glob("*.report.json"))
    if not report_files:
        print(f"No .report.json files found in {pending_dir}.")
        return 0

    total_chapters = len(report_files)
    total_high = 0
    total_medium = 0
    total_low = 0
    chapter_stats = []

    for path in report_files:
        name_parts = path.name.split("__")
        chapter_str = name_parts[0][2:] if len(name_parts) > 0 else "Unknown"

        try:
            report_data = json.loads(path.read_text(encoding="utf-8"))
            report = ConflictReport.model_validate(report_data)
            
            high = len(report.high())
            medium = len(report.medium())
            low = len(report.low())

            total_high += high
            total_medium += medium
            total_low += low

            chapter_stats.append({
                "chapter": chapter_str,
                "high": high,
                "medium": medium,
                "low": low,
            })
        except Exception as e:
            print(f"Failed to parse {path.name}: {e}")

    report_md = [
        "# Narrative OS Backfill Report",
        "",
        f"**Total Chapters Analyzed:** {total_chapters}",
        f"**Total High Conflicts:** {total_high}",
        f"**Total Medium Conflicts:** {total_medium}",
        f"**Total Low Conflicts:** {total_low}",
        "",
        "## Chapter Breakdown",
        ""
    ]

    for stat in chapter_stats:
        status_icon = "❌" if stat["high"] > 0 else ("⚠️" if stat["medium"] > 0 else "✅")
        report_md.append(f"### {status_icon} Chapter {stat['chapter']}")
        report_md.append(f"- HIGH: {stat['high']}")
        report_md.append(f"- MEDIUM: {stat['medium']}")
        report_md.append(f"- LOW: {stat['low']}")
        report_md.append("")

    out_path = Path("backfill_report.md")
    out_path.write_text("\n".join(report_md), encoding="utf-8")
    print(f"Generated aggregate report at {out_path.absolute()}")
    return 0


def cmd_clear_cache(args: argparse.Namespace) -> int:
    from .llm.cache.local import LocalCache
    cache = LocalCache(cache_dir=args.cache_dir)
    n = cache.clear()
    print(f"Cleared {n} cache entries.")
    return 0


def cmd_build_contract(args: argparse.Namespace) -> int:
    from .decisions_parser import parse_section_22, write_contract

    contract = parse_section_22(
        args.decisions,
        project=args.project,
        book=args.book,
        mapping_path=args.mapping,
    )
    out_path = write_contract(contract, args.out)
    print(f"Wrote {len(contract.rules)} contract rules to {out_path}")
    return 0


def cmd_check_contract_canon(args: argparse.Namespace) -> int:
    from .contract_canon_bridge import preflight_contract_canon

    findings = preflight_contract_canon(
        contract_path=args.contract,
        store_path=args.store,
        mapping_path=args.mapping,
    )
    if not findings:
        print("Contract/canon bridge: clean")
        return 0

    print(f"Contract/canon bridge findings: {len(findings)}")
    for finding in findings:
        print(f"  [{finding.severity}] {finding.guard_id}")
        print(f"    canon: {finding.canon_fact_id}")
        print(f"    {finding.message}")
    return 1 if any(f.severity == "HIGH" for f in findings) else 0


def cmd_generate_scene(args: argparse.Namespace) -> int:
    from .prose_generator import generate_scene_with_retry, generate_scene

    if args.contract and not args.skip_bridge_preflight:
        from .contract_canon_bridge import preflight_contract_canon

        findings = preflight_contract_canon(
            contract_path=args.contract,
            store_path=args.store,
            mapping_path=args.mapping,
        )
        blocking = [finding for finding in findings if finding.severity == "HIGH"]
        if blocking:
            print("Refusing generation: Section 22 contract and canon disagree.")
            for finding in blocking:
                print(f"  [{finding.severity}] {finding.guard_id}")
                print(f"    canon: {finding.canon_fact_id}")
                print(f"    {finding.message}")
            return 1
    
    if args.retry:
        result = generate_scene_with_retry(
            scene_outline=args.outline,
            chapter_num=args.chapter,
            store_path=args.store,
            contract_path=args.contract,
            max_retries=args.max_retries,
            use_cache=not args.no_cache,
            verbose=args.verbose or True,
        )
    else:
        out = generate_scene(
            scene_outline=args.outline,
            chapter_num=args.chapter,
            store_path=args.store,
            contract_path=args.contract,
            use_cache=not args.no_cache,
        )
        from .prose_lint import lint_prose
        from .contract_lint import lint_contract
        
        lint = lint_prose(out["prose"])
        c_lint = (
            lint_contract(
                out["prose"],
                contract_path=args.contract,
                use_cache=not args.no_cache,
            )
            if args.contract
            else None
        )
        
        passed = lint.passed and (c_lint.passed if c_lint else True)
        
        rep = lint.render()
        if c_lint and not c_lint.passed:
            rep += "\n\n=== CONTRACT LINT FAILURES ===\n"
            for f in c_lint.findings:
                rep += f"\n[{f.severity}] {f.guard_id}\n  Span: {f.span}\n  Rationale: {f.rationale}\n"
                
        result = {
            "thinking": out["thinking"],
            "prose": out["prose"],
            "passed": passed,
            "attempts": 1,
            "lint_report": rep,
        }
        
    print()
    print("=" * 70)
    print(f"THINKING (Attempts: {result['attempts']}, Passed Lint: {result['passed']})")
    print("=" * 70)
    print(result["thinking"])
    print()
    print("=" * 70)
    print("PROSE:")
    print("=" * 70)
    print(result["prose"])
    print()
    print("=" * 70)
    print("LINT REPORT:")
    print("=" * 70)
    print(result["lint_report"])
    
    return 0 if result["passed"] else 1


def cmd_generate_scene_plan(args: argparse.Namespace) -> int:
    from .contract_canon_bridge import preflight_contract_canon
    from .scene_generator import ScenePlan, generate_scene_draft

    plan = ScenePlan.model_validate_json(args.plan.read_text(encoding="utf-8"))
    if args.contract and not args.skip_bridge_preflight:
        findings = preflight_contract_canon(
            contract_path=args.contract,
            store_path=args.store,
            mapping_path=args.mapping,
        )
        blocking = [finding for finding in findings if finding.severity == "HIGH"]
        if blocking:
            print("Refusing scene generation: Section 22 contract and canon disagree.")
            for finding in blocking:
                print(f"  [{finding.severity}] {finding.guard_id}")
                print(f"    canon: {finding.canon_fact_id}")
                print(f"    {finding.message}")
            return 1

    draft = generate_scene_draft(
        plan,
        store_path=args.store,
        contract_path=args.contract,
        max_retries=args.max_retries,
        use_cache=not args.no_cache,
        verbose=args.verbose,
    )
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(draft.prose, encoding="utf-8")
        print(f"Wrote scene draft to {args.out}")
    else:
        print(draft.prose)
    print()
    print("LINT REPORT:")
    print(draft.lint_report)
    return 0 if draft.passed else 1

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="narrative_os",
        description="Quantum Shadows narrative OS — chapter-by-chapter continuity analysis.",
    )
    p.add_argument("--store", type=Path, default=None,
                   help="Path to canon_store.json (default: package default)")
    p.add_argument("--verbose", "-v", action="store_true")
    sub = p.add_subparsers(dest="command", required=True)

    # analyze
    sp = sub.add_parser("analyze", help="Analyse one chapter.")
    sp.add_argument("manuscript", type=Path)
    sp.add_argument("chapter", help="Chapter number (1, 7.5, PROLOGUE, EPILOGUE)")
    sp.add_argument("--pass-id", default=None, help="Override the pass id.")
    sp.set_defaults(fn=cmd_analyze)

    # analyze-all
    sp = sub.add_parser("analyze-all", help="Analyse every chapter sequentially.")
    sp.add_argument("manuscript", type=Path)
    sp.add_argument("--pass-id", default=None)
    sp.add_argument("--skip", nargs="*", default=[],
                    help="Chapter numbers to skip (e.g. --skip PROLOGUE 7.5)")
    sp.add_argument("--continue-on-error", action="store_true",
                    help="Don't stop on extractor/merge failures.")
    sp.add_argument("--dry-run", action="store_true",
                    help="Extract and detect conflicts without modifying the canon store.")
    sp.set_defaults(fn=cmd_analyze_all)

    # stats
    sp = sub.add_parser("stats", help="Show canon store statistics.")
    sp.set_defaults(fn=cmd_stats)

    # audit-fake-pass-ids
    sp = sub.add_parser("audit-fake-pass-ids", help="Detect and optionally clean fake pass IDs in canon store.")
    sp.add_argument("--clean", action="store_true", help="Replace fake pass IDs with sentinel 'audit_trail_lost'.")
    sp.set_defaults(fn=cmd_audit_fake_pass_ids)

    # audit-contamination
    sp = sub.add_parser("audit-contamination", help="Audit entity seed contamination in active canon store.")
    sp.add_argument("--entity", required=True, help="Entity name (e.g. Hayden, Kain) to check.")
    sp.set_defaults(fn=cmd_audit_contamination)

    # snapshot-canon
    sp = sub.add_parser("snapshot-canon", help="Create a read-only baseline JSON copy of the canon store.")
    sp.add_argument("--out", type=Path, default=None, help="Output snapshot path (default: data/canon.phase8_clean.json)")
    sp.set_defaults(fn=cmd_snapshot_canon)

    # pending
    sp = sub.add_parser("pending", help="List pending conflict reviews.")
    sp.add_argument("--pending-dir", default=None)
    sp.set_defaults(fn=cmd_pending)

    # report
    sp = sub.add_parser("report", help="Generate an aggregate backfill report from pending items.")
    sp.add_argument("--pending-dir", default=None)
    sp.set_defaults(fn=cmd_report)

    # clear-cache
    sp = sub.add_parser("clear-cache", help="Drop the local LLM response cache.")
    sp.add_argument("--cache-dir", default=None)
    sp.set_defaults(fn=cmd_clear_cache)

    # build-contract
    sp = sub.add_parser("build-contract", help="Parse Section 22 into a contract JSON file.")
    sp.add_argument("--decisions", type=Path, default=Path("decisions.md"))
    sp.add_argument("--out", type=Path, default=Path("data/contracts/book1_contract.json"))
    sp.add_argument("--mapping", type=Path, default=Path("data/contracts/s22_canon_mapping.json"))
    sp.add_argument("--project", default="Quantum Shadows")
    sp.add_argument("--book", default="Book 1")
    sp.set_defaults(fn=cmd_build_contract)

    # check-contract-canon
    sp = sub.add_parser("check-contract-canon", help="Verify Section 22 contract support in canon.")
    sp.add_argument("--contract", type=Path, default=Path("data/contracts/book1_contract.json"))
    sp.add_argument("--mapping", type=Path, default=Path("data/contracts/s22_canon_mapping.json"))
    sp.set_defaults(fn=cmd_check_contract_canon)

    # generate-scene
    sp = sub.add_parser("generate-scene", help="Generate a scene from an outline.")
    sp.add_argument("outline", help="Text outline or scene intent.")
    sp.add_argument("--chapter", type=int, default=1, help="Context chapter number (default: 1)")
    sp.add_argument("--retry", action="store_true", help="Enable the auto-loop repair daemon.")
    sp.add_argument("--max-retries", type=int, default=5, help="Maximum repair loops (default: 5)")
    sp.add_argument("--no-cache", action="store_true", help="Bypass local cache for the first pass.")
    sp.add_argument("--contract", type=Path, default=None, help="Path to BookContract JSON.")
    sp.add_argument("--mapping", type=Path, default=Path("data/contracts/s22_canon_mapping.json"), help="Path to Section 22 canon mapping JSON.")
    sp.add_argument("--skip-bridge-preflight", action="store_true", help="Skip contract/canon bridge preflight.")
    sp.add_argument("--contract-only", action="store_true", help="Only run contract checks (if applicable).")
    sp.set_defaults(fn=cmd_generate_scene)

    # generate-scene-plan
    sp = sub.add_parser("generate-scene-plan", help="Generate a multi-beat scene from a ScenePlan JSON file.")
    sp.add_argument("plan", type=Path, help="Path to ScenePlan JSON.")
    sp.add_argument("--contract", type=Path, default=Path("data/contracts/book1_contract.json"))
    sp.add_argument("--mapping", type=Path, default=Path("data/contracts/s22_canon_mapping.json"))
    sp.add_argument("--out", type=Path, default=None, help="Optional markdown/text output path.")
    sp.add_argument("--max-retries", type=int, default=5)
    sp.add_argument("--no-cache", action="store_true")
    sp.add_argument("--skip-bridge-preflight", action="store_true")
    sp.set_defaults(fn=cmd_generate_scene_plan)

    return p


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
