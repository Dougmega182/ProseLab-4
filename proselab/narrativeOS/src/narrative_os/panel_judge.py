"""Adversarial panel judge — harvesting disagreement deltas."""
from __future__ import annotations
from typing import List, Dict, Any
from .tournament import run_tournament, TournamentResult
from .llm.router import LLMResult

class PanelVerdict(BaseModel):
    consensus_winner: str
    disagreement_delta: float # 0 = perfect agreement, 10 = absolute chaos
    judge_reports: Dict[str, TournamentResult]
    disagreement_notes: str

def run_adversarial_panel(
    variants: List[Dict[str, str]], 
    outline: str,
    metadata: str,
    judges: List[str] = ["google:gemini-3-flash", "ollama:qwen2.5-coder:7b"]
) -> PanelVerdict:
    """
    Run the tournament across multiple independent models.
    """
    results = {}
    for judge in judges:
        try:
            res = run_tournament(
                variants=variants,
                scene_outline=outline,
                project_metadata=metadata,
                use_cache=False,
                tier_override=judge # Need to update run_tournament to accept tier
            )
            results[judge] = res
        except Exception as e:
            print(f"Judge {judge} failed: {e}")

    # Logic to compute disagreement delta and consensus...
    # (Omitted for brevity, will implement if this path is selected)
    return results
