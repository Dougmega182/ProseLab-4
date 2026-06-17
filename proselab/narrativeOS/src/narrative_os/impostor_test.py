from __future__ import annotations
from pathlib import Path
from typing import List, Dict, Any, Optional
import json
from pydantic import BaseModel, Field
from .tournament import run_tournament
from .prose_generator import extract_voice_rules

class ImpostorTestResult(BaseModel):
    case_id: str
    winner_type: str # "elite_original", "synthetic_impostor", "ugly_genius"
    rankings: List[str]
    choice_attribution_summary: str
    is_fooled_by_synthetic: bool
    is_blind_to_ugly_genius: bool

def run_impostor_test(bench_path: Path) -> List[ImpostorTestResult]:
    """
    Mechanism Impostor Test: Elite vs Synthetic vs Ugly Genius.
    """
    with open(bench_path, "r", encoding="utf-8") as f:
        bench = json.load(f)

    results = []
    metadata = "VOICE RULES:\n" + extract_voice_rules()

    for case in bench:
        import time
        time.sleep(10) # 10 second delay
        print(f"\nRunning Impostor Test: {case['id']} ({case['axis']})")
        variants = [{"prose": v["prose"]} for v in case["variants"]]
        
        # We need to pass the 'Choice Attribution' instruction in the project_metadata or similar
        # For now, we'll assume the refactored tournament judge prompt handles it.
        
        try:
            tournament_res = run_tournament(
                variants=variants,
                scene_outline=case["outline"],
                project_metadata=metadata,
                use_cache=False
            )
            
            # Map back winner
            winner_idx = int(tournament_res.winner_id.split("_")[1])
            winner_type = case["variants"][winner_idx]["type"]
            
            rankings = []
            for rid in tournament_res.rankings:
                idx = int(rid.split("_")[1])
                rankings.append(case["variants"][idx]["type"])

            is_fooled = (winner_type == "synthetic_impostor")
            is_blind = ("ugly_genius" in rankings and rankings.index("ugly_genius") > rankings.index("synthetic_impostor"))

            results.append(ImpostorTestResult(
                case_id=case["id"],
                winner_type=winner_type,
                rankings=rankings,
                choice_attribution_summary=tournament_res.summary_report,
                is_fooled_by_synthetic=is_fooled,
                is_blind_to_ugly_genius=is_blind
            ))
            
            print(f"WINNER: {winner_type}")
            if is_fooled: print("❌ FOOLED BY SYNTHETIC")
            if is_blind: print("❌ BLIND TO UGLY GENIUS")
            
        except Exception as e:
            print(f"Case {case['id']} failed: {e}")

    return results
