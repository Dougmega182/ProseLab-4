"""
Role-based Panel Judge.
Moves beyond voting to specialized dialectic evaluation.
"""
from __future__ import annotations
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from .tournament import run_tournament, TournamentResult
from .llm.router import llm_call

class PanelVerdict(BaseModel):
    winner_id: str
    rankings: List[str]
    disagreement_delta: float # 0-10
    disagreement_type: str # "epistemic", "aesthetic", "factual", "stochastic"
    role_critiques: Dict[str, TournamentResult]
    final_rationale: str
    disagreement_analysis: str

def run_specialized_panel(
    variants: List[Dict[str, str]], 
    outline: str,
    metadata: str,
    judges: List[Dict[str, str]] = None
) -> PanelVerdict:
    """
    Executes a role-based dialectic with disagreement classification.
    """
    if not judges:
        judges = [
            {"name": "detector", "tier": "T1_default", "prompt_add": "You are a Mechanism Detector. Focus on technical gears."},
            {"name": "skeptic", "tier": "T1_default", "prompt_add": "You are a Mechanism Skeptic. Your goal is to prove the identified mechanisms are accidental or non-causal."},
            {"name": "auditor", "tier": "T1_default", "prompt_add": "You are a Mutation Auditor. Detect 'Fake Greatness' and 'Aesthetic Monoculture'."}
        ]
    
    results = {}
    for j in judges:
        try:
            role_meta = metadata + f"\n\nROLE INSTRUCTION: {j['prompt_add']}"
            res = run_tournament(
                variants=variants,
                scene_outline=outline,
                project_metadata=role_meta,
                use_cache=False,
                tier_override=j['tier']
            )
            results[j['name']] = res
        except Exception as e:
            print(f"Role {j['name']} failed: {e}")

    # Compute disagreement
    winners = [r.winner_id for r in results.values()]
    unique_winners = set(winners)
    delta = (len(unique_winners) - 1) * 5.0
    
    # Classification logic (simple heuristic for now)
    d_type = "epistemic"
    if len(unique_winners) == 1:
        d_type = "stochastic" # or agreement
    elif delta > 5.0:
        d_type = "aesthetic"
        
    # Final Lead Editor synthesis
    names = ", ".join(results.keys())
    synthesis_msg = f"Synthesize the findings from these specialized roles: {names}.\n"
    synthesis_msg += "CLASSIFY the disagreement type: epistemic (insufficient evidence), aesthetic (different values), factual (wrong interpretation), or stochastic (random).\n\n"
    for name, r in results.items():
        synthesis_msg += f"--- {name.upper()} ---\n{r.summary_report}\n\n"
    
    final_res = llm_call(
        role="prose_critic",
        system="You are the Lead Editor. Synthesize findings and classify disagreement.",
        user_message=synthesis_msg,
        tier_override="T1_default",
        use_cache=False,
        temperature=0.1
    )

    # Extract d_type from final_res.text if possible
    for t in ["epistemic", "aesthetic", "factual", "stochastic"]:
        if t in final_res.text.lower():
            d_type = t
            break

    return PanelVerdict(
        winner_id=winners[0] if winners else "unknown",
        rankings=results[list(results.keys())[0]].rankings if results else [],
        disagreement_delta=delta,
        disagreement_type=d_type,
        role_critiques=results,
        final_rationale=final_res.text,
        disagreement_analysis=f"Disagreement classified as {d_type}."
    )
