from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional
from .llm.router import llm_call

class RepairResult(BaseModel):
    repaired_prose: str
    articulated_intent: str
    mechanism_reconstructed: str
    predicted_score_degradation: float # On a scale of 0-10
    is_irreducible_garbage: bool

REPAIR_PROMPT = """\
You are an elite literary editor. You are given a 'structurally anomalous' prose mutation.

TASK:
1. Articulate the 'Hidden Intent': What was the author trying to achieve with this weirdness?
2. Reconstruct the Mechanism: How does this passage try to function technically?
3. Predict Score Degradation: If the identified mechanism were removed, how many points (0-10) would the overall quality drop? Be precise.
4. Counterfactual Repair: Can you repair this into something excellent WITHOUT replacing the core idea? 
   If it is irreducible garbage (no seed of brilliance), mark it so.

OUTPUT FORMAT:
You MUST return a JSON object with EXACTLY these keys:
- "articulated_intent": (string)
- "mechanism_reconstructed": (string)
- "predicted_score_degradation": (number)
- "repaired_prose": (string) The repaired version, or "N/A" if garbage.
- "is_irreducible_garbage": (boolean)

PROSE MUTATION:
{prose}

SCENE OUTLINE:
{outline}
"""

def test_counterfactual_repair(prose: str, outline: str) -> RepairResult:
    """
    The Anti-Bullshit Gate: Can an elite editor salvage the mutation?
    """
    result = llm_call(
        role="prose_critic",
        system="You are an uncompromising editor detecting 'Dangerous Brilliance' vs 'AI Garbage'.",
        user_message=REPAIR_PROMPT.format(prose=prose, outline=outline),
        schema=RepairResult.model_json_schema(),
        tier_override="T1_default",
        use_cache=False,
        temperature=0.1
    )
    
    if result.parsed:
        return RepairResult.model_validate(result.parsed)
    raise RuntimeError(f"Counterfactual Repair failed. Raw: {result.text}")
