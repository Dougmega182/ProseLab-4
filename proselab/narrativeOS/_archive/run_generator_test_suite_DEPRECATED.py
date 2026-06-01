"""
run_generator_test_suite.py — runs the 4-scene validation test suite for the prose generator.

This script executes 4 distinct prose generation tasks targeting specific narrative vectors:
  1. POV Switch: Emily Voss's clinical third-person POV.
  2. Multi-character interaction: Kain J. and Aspect's biometric intake, including Aspect's characteristic pauses.
  3. Post-Epilogue extrapolation: Kain J.'s return to Chen's unsealed apartment under critical degradation.
  4. Paced Action Sequence: Hayden's descent into the Sphere, tracking Coherence Offsets.

Saves results to a markdown artifact for inspection.
"""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path
from datetime import datetime, timezone

from src.narrative_os.prose_generator import generate_scene


SCENES = [
    {
        "id": "1_pov_switch_emily",
        "name": "POV Switch (Emily Voss)",
        "chapter_num": 10,
        "outline": (
            "Emily Voss sits in her locked office at the Threshold facility, "
            "reviewing the pre-acquisition file SHADOW/DELTA-14/K.J. "
            "She hears the deep hum of the magnetic levitation system from the lower levels. "
            "She considers Kain's upcoming stand-down. Pacing is deliberate, proprioceptive register."
        ),
        "expected_indicators": ["Voss", "SHADOW/DELTA-14", "Threshold", "hum"],
    },
    {
        "id": "2_multi_char_aspect",
        "name": "Multi-Character (Kain and Aspect)",
        "chapter_num": 6,
        "outline": (
            "Kain J. is in the biometric intake room with Aspect. Aspect performs the "
            "biometric scan, pausing for exactly two to three seconds before each response. "
            "Kain feels the right-hand tremor in his ring and little finger and counts his carotid pulse."
        ),
        "expected_indicators": ["Aspect", "tremor", "pulse", "intake"],
    },
    {
        "id": "3_post_epilogue_melbourne",
        "name": "Post-Epilogue Extrapolation (Melbourne Return)",
        "chapter_num": 16,
        "outline": (
            "Kain J. returns to Melbourne after the Epilogue. His right-hand tremor has worsened "
            "and he reports himself as clinical wreckage. He walks into Marcus Chen's old, "
            "unsealed apartment. The Maltese Falcon remains on the shelf. Pacing is slow, empty."
        ),
        "expected_indicators": ["Chen", "Maltese Falcon", "apartment", "tremor"],
    },
    {
        "id": "4_action_descent",
        "name": "Action Sequence (Sphere Descent)",
        "chapter_num": 13,
        "outline": (
            "Hayden descends into the Sphere. The Coherence Offset gradient increases "
            "rapidly from 77-Alpha-9 (0.004) to 88-Gamma-3 (0.011). "
            "His outline stutters. Clinical, proprioceptive mapping of structural degradation."
        ),
        "expected_indicators": ["Sphere", "Coherence Offset", "77-Alpha-9", "stutter"],
    },
]


def grade_prose(prose: str, expected: list[str]) -> tuple[int, list[str]]:
    """Simple rubric-based grader. Returns (score/10, match_details)."""
    matches = []
    missing = []
    for exp in expected:
        if exp.lower() in prose.lower():
            matches.append(exp)
        else:
            missing.append(exp)
    
    # Check forbidden commercial tells
    forbidden = ["sadness", "unease", "felt", "realized", "noticed", "saw", "heard"]
    found_forbidden = [w for w in forbidden if f" {w} " in prose.lower() or prose.lower().endswith(w)]
    
    # Calculate score
    base_score = 10
    if len(expected) > 0:
        match_ratio = len(matches) / len(expected)
        base_score = int(match_ratio * 10)
    
    # Penalize forbidden words
    base_score -= len(found_forbidden)
    base_score = max(0, min(10, base_score))
    
    details = []
    if matches:
        details.append(f"Matched indicators: {', '.join(matches)}")
    if missing:
        details.append(f"Missing indicators: {', '.join(missing)}")
    if found_forbidden:
        details.append(f"Penalized for forbidden words: {', '.join(found_forbidden)}")
    else:
        details.append("Zero forbidden/filter words detected (Excellent voice preservation).")
        
    return base_score, details


def main() -> int:
    print("=" * 80)
    print("PROSE GENERATOR 4-SCENE VALIDATION TEST SUITE RUNNER")
    print("=" * 80)
    
    api_key = os.environ.get("VITE_GALAXY_AI_API_KEY")
    if not api_key:
        print("[WARNING] VITE_GALAXY_AI_API_KEY is missing from environment. Real LLM calls will fail.")
        print("Please check your .env settings.")
        sys.exit(1)
        
    canon_store = Path("E:/Ai/ProseLabV2/proselab/narrativeOS/data/canon_store.json")
    if not canon_store.exists():
        print(f"[ERROR] Canon store not found at {canon_store}. Please seed it first.")
        sys.exit(1)
        
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    report_lines = [
        "# Prose Generator 4-Scene Validation Test Suite Report",
        f"**Executed At:** {timestamp}",
        f"**Canon Source:** [{canon_store.name}](file:///{canon_store.as_posix()})",
        "",
        "## Summary Results",
        "",
        "| Scene | Namespace/POV | Score | Status | Details |",
        "|---|---|---|---|---|",
    ]
    
    results = []
    for sc in SCENES:
        print(f"\n[RUNNING] Scene {sc['id']}: {sc['name']}...")
        start_time = time.time()
        try:
            # Generate the scene (L1 cache enabled to save money on identical runs)
            out = generate_scene(
                scene_outline=sc["outline"],
                chapter_num=sc["chapter_num"],
                store_path=canon_store,
                use_cache=True,
            )
            duration = time.time() - start_time
            print(f"Completed in {duration:.2f}s.")
            
            score, details_list = grade_prose(out["prose"], sc["expected_indicators"])
            print(f"Grade: {score}/10")
            print("\n".join(f"  - {d}" for d in details_list))
            
            status = "PASSED" if score >= 8 else "REWRITE"
            results.append({
                "scene": sc,
                "thinking": out["thinking"],
                "prose": out["prose"],
                "score": score,
                "status": status,
                "details": "; ".join(details_list),
                "duration": duration,
            })
            
            report_lines.append(
                f"| {sc['name']} | Ch {sc['chapter_num']} | **{score}/10** | `{status}` | {'; '.join(details_list)} |"
            )
            
        except Exception as e:
            print(f"[ERROR] Generation failed for scene {sc['name']}: {e}")
            report_lines.append(
                f"| {sc['name']} | Ch {sc['chapter_num']} | **0/10** | `FAILED` | Exception: {e} |"
            )
            results.append({
                "scene": sc,
                "thinking": "",
                "prose": f"Generation failed: {e}",
                "score": 0,
                "status": "FAILED",
                "details": str(e),
                "duration": 0,
            })
            
    report_lines.append("\n---\n")
    report_lines.append("## Detailed Scene Outputs")
    report_lines.append("")
    
    for r in results:
        sc = r["scene"]
        report_lines.extend([
            f"### Scene: {sc['name']}",
            f"**Outline:** *{sc['outline']}*",
            f"**Execution Status:** `{r['status']}` ({r['duration']:.2f}s) | **Grade:** {r['score']}/10",
            "",
            "#### Thinking Critique:",
            "```xml",
            r["thinking"],
            "```",
            "",
            "#### Generated Prose:",
            "> " + r["prose"].replace("\n", "\n> "),
            "",
            "---",
            ""
        ])
        
    # Write report to E:\Ai\ProseLabV2\prose_generation_report.md
    report_path = Path("E:/Ai/ProseLabV2/prose_generation_report.md")
    report_path.write_text("\n".join(report_lines), encoding="utf-8")
    print(f"\n[SUCCESS] Validation report written to [{report_path.name}](file:///{report_path.as_posix()})")
    
    # Also copy to the brain artifacts directory
    artifact_path = Path("D:/Users/DalePsaila/.gemini/antigravity/brain/121245f6-9434-489a-b73f-48ce6221af1d/prose_generation_report.md")
    artifact_path.parent.mkdir(parents=True, exist_ok=True)
    artifact_path.write_text("\n".join(report_lines), encoding="utf-8")
    print(f"[SUCCESS] Artifact written to [{artifact_path.name}](file:///{artifact_path.as_posix()})")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
