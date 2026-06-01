"""
Command-line entry point.

Usage:
    python -m narrative_os analyze <manuscript> <chapter>
    python -m narrative_os analyze-all <manuscript>
    python -m narrative_os stats
    python -m narrative_os pending
    python -m narrative_os report
    python -m narrative_os clear-cache
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

    return p


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
