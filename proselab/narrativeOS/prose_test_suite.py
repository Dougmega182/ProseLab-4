"""
prose_test_suite.py -- run the 5-scene prose generation test suite.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
from pathlib import Path

from narrative_os.prose_generator import generate_scene, generate_scene_with_retry
from narrative_os.prose_lint import lint_prose


OUT_DIR = Path("data/prose_test")

SCENES = [
    {
        "id": "01_black_pearl_rerun",
        "label": "Black Pearl rerun (calibration)",
        "chapter": 1,
        "outline": (
            "Kain returns to the Black Pearl bar three months after Ch 1. "
            "Emily is not there. He notices something specific about the "
            "space that wasn't there before. The scene runs approximately "
            "200 words."
        ),
    },
    {
        "id": "02_hayden_pov_safehouse",
        "label": "Hayden POV in active Bleed",
        "chapter": 8,
        "outline": (
            "Hayden, alone in the Docklands safe house. ICS 32, three days "
            "after jump 417. Bell is in the next room but the apartment "
            "registers as empty to him. He attempts to make tea. "
            "Approximately 220 words."
        ),
    },
    {
        "id": "03_three_character_cafe",
        "label": "Three-character intersection",
        "chapter": 999,
        "outline": (
            "Six weeks post-Epilogue. Bell walks into a Carlton cafe where "
            "Kain is sitting alone. Emily arrives ninety seconds later. "
            "None of them planned this. None of them leaves. Approximately "
            "280 words. Limit dialogue to six exchanges total."
        ),
    },
    {
        "id": "04_post_epilogue_invention",
        "label": "Post-Epilogue invention",
        "chapter": 999,
        "outline": (
            "Eight months after the Epilogue. Kain takes the tram out to "
            "the Punt Road flat for the first time since Solis was "
            "sequestered. The kitchen is no longer Solis's. Approximately "
            "240 words."
        ),
    },
    {
        "id": "05_action_brachial_plexus",
        "label": "Action sequence",
        "chapter": 4,
        "outline": (
            "Hayden at Alfred Hospital, Ch 4, the brachial-plexus "
            "incapacitation of the security guard Jacob. Forty seconds "
            "of compressed time. Approximately 180 words. The act, not "
            "the build-up; not the aftermath."
        ),
    },
]


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the 5-scene prose generation test suite.")
    parser.add_argument("--retry", action="store_true", help="Enable the auto-loop repair daemon.")
    parser.add_argument("--max-retries", type=int, default=5, help="Maximum repair loops per scene.")
    parser.add_argument("--no-cache", action="store_true", help="Bypass local cache for the first pass.")
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    run_stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    summary_lines = [
        f"# Prose Test Suite Results -- {run_stamp}",
        "",
        "| # | Scene | Words | Hard | Caps | Flags | Attempts | Passed |",
        "|---|---|---|---|---|---|---|---|",
    ]

    for scene in SCENES:
        print(f"\n=== Generating: {scene['label']} ===", flush=True)
        if args.retry:
            result = generate_scene_with_retry(
                scene_outline=scene["outline"],
                chapter_num=scene["chapter"],
                max_retries=args.max_retries,
                use_cache=not args.no_cache,
                verbose=True,
            )
            passed = result["passed"]
            attempts = result["attempts"]
            lint_report = result["lint_report"]
        else:
            out = generate_scene(
                scene_outline=scene["outline"],
                chapter_num=scene["chapter"],
                use_cache=not args.no_cache,
            )
            result = out
            passed = True
            attempts = 1
            lint_report = None

        prose = result["prose"]
        thinking = result["thinking"]
        lint = lint_prose(prose)

        # If we didn't use retry, compute lint report now
        if lint_report is None:
            lint_report = lint.render()

        out_path = OUT_DIR / f"{scene['id']}.md"
        
        history_md = ""
        if "history" in result and len(result["history"]) > 1:
            history_md += "\n\n## Retry History\n\n"
            for h in result["history"]:
                history_md += (
                    f"### Attempt {h['attempt']} (Passed: {h['lint']['passed']})\n\n"
                    f"**Thinking:**\n{h['thinking']}\n\n"
                    f"**Prose:**\n{h['prose']}\n\n"
                    f"**Lint Report:**\n```\n{h['lint']['report']}\n```\n\n"
                )

        content = (
            f"# {scene['label']}\n\n"
            f"**Scene id:** `{scene['id']}`  \n"
            f"**Chapter context:** {scene['chapter']}  \n"
            f"**Canon slice tokens:** ~{result['slice_token_estimate']}  \n"
            f"**Attempts:** {attempts}  \n"
            f"**Passed Lint:** {passed}\n\n"
            f"## Outline\n\n{scene['outline']}\n\n"
            f"## Thinking\n\n{thinking}\n\n"
            f"## Prose\n\n{prose}\n\n"
            f"## Lint report\n\n```\n{lint_report}\n```"
            f"{history_md}"
        )
        out_path.write_text(content, encoding="utf-8")
        print(f"  -> wrote {out_path}")
        print(f"  -> {lint.word_count} words; "
              f"{len(lint.hard_violations)} hard; "
              f"{len(lint.cap_violations)} caps; "
              f"{len(lint.soft_flags)} flags; "
              f"attempts: {attempts}")

        summary_lines.append(
            f"| {scene['id'].split('_')[0]} | {scene['label']} | "
            f"{lint.word_count} | {len(lint.hard_violations)} | "
            f"{len(lint.cap_violations)} | {len(lint.soft_flags)} | "
            f"{attempts} | {passed} |"
        )

    summary_path = OUT_DIR / f"SUMMARY_{run_stamp}.md"
    summary_path.write_text("\n".join(summary_lines), encoding="utf-8")
    print(f"\n=== Summary: {summary_path} ===")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
