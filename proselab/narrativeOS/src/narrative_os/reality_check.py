from __future__ import annotations
import random
import json
from typing import List, Dict, Any
from .llm.router import llm_call
from .prose_generator import generate_scene_variant

def run_blind_batch_eval(
    scene_outline: str,
    n_variants: int = 10,
    control_passages: List[Dict[str, str]] = None,
    use_cache: bool = False
) -> Dict[str, Any]:
    """
    Reality Check: Generates N variants and runs pairwise blind ranking 
    without any mention of axes, DNA, or specific project rules to the judge.
    Can mix in control passages (external human prose) for calibration.
    """
    print(f"Generating {n_variants} blind variants...")
    variants = []
    import time
    for i in range(n_variants):
        if i > 0:
            time.sleep(2) # 2 second delay between generations
        # Base generation without axis-steering or project context if possible
        temp = 0.5 + (i * 0.05)
        v = generate_scene_variant(scene_outline, temperature=temp, use_cache=use_cache)
        variants.append({"id": f"gen_{i}", "prose": v["prose"], "type": "generated"})

    if control_passages:
        for i, cp in enumerate(control_passages):
            variants.append({"id": f"control_{i}", "prose": cp["prose"], "type": "control", "label": cp.get("label", "unknown")})

    # Total variants to judge
    total_variants = len(variants)
    
    # 1. Pairwise Comparison Judge (Blinded)
    # This judge knows NOTHING about the project, the axes, or the goals.
    # It only knows "Which of these two is better prose?"
    BLIND_JUDGE_PROMPT = """\
You are an objective prose critic. You will be given two short passages of fiction.
Your task is to choose which one is better.

BETTER means:
- More specific and grounded.
- Less reliant on clichés and 'AI-isms'.
- Stronger rhythm and sentence variety.
- More internal psychological truth.

Do NOT explain. Only output JSON with the winner_id and a one-sentence reason.
"""

    results = []
    pairs = []
    # Create random pairs
    indices = list(range(total_variants))
    random.shuffle(indices)
    for i in range(0, total_variants - 1, 2):
        pairs.append((indices[i], indices[i+1]))

    print(f"Running {len(pairs)} pairwise blind judgments...")
    for idx1, idx2 in pairs:
        v1 = variants[idx1]
        v2 = variants[idx2]
        
        user_msg = f"PASSAGE A:\n{v1['prose']}\n\nPASSAGE B:\n{v2['prose']}"
        
        res = llm_call(
            role="fast_iteration", # Use a fast/cheap model for mass ranking
            system=BLIND_JUDGE_PROMPT,
            user_message=user_msg,
            tier_override="T3_fast", # Gemini Flash - less biased by my complex prompts
            use_cache=False,
            max_output_tokens=500,
            temperature=0.0
        )
        
        # Simple extraction
        winner = "A" if "PASSAGE A" in res.text or v1['id'] in res.text else "B"
        results.append({
            "pair": (v1['id'], v2['id']),
            "winner": v1['id'] if winner == "A" else v2['id'],
            "raw": res.text
        })

    return {
        "outline": scene_outline,
        "variants": variants,
        "pairwise_results": results
    }
