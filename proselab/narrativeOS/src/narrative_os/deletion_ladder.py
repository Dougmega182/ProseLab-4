"""
Mechanism Deletion Ladder (Dose-Response Curve).
Tests sensitivity of prose quality to incremental removal of a mechanism.
"""
from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Dict, Any, List
from .llm.router import llm_call

class LadderStep(BaseModel):
    intensity: int # 100, 75, 50, 25, 0
    prose: str
    score: float

class DoseResponseCurve(BaseModel):
    mechanism: str
    steps: List[LadderStep]
    is_linear: bool
    is_steep: bool # True if significant drop between 100 and 0
    area_under_curve: float

LADDER_PROMPT = """\
You are a precision prose editor. 

TASK:
You are given a passage and a technical mechanism.
Rewrite the passage at {intensity}% intensity of that mechanism.

100% = Original mechanism fully present.
0% = Mechanism completely removed.
50% = Mechanism present but weakened or diluted.

MECHANISM: {mechanism}
ORIGINAL PROSE: {prose}

REWRITTEN PROSE ({intensity}% Intensity):
"""

def run_deletion_ladder(prose: str, mechanism: str, outline: str) -> DoseResponseCurve:
    """
    Generates 5 steps of mechanism intensity and scores them.
    """
    steps = []
    intensities = [100, 75, 50, 25, 0]
    
    from .tournament import run_tournament
    from .prose_generator import extract_voice_rules
    metadata = "VOICE RULES:\n" + extract_voice_rules()

    # 1. Generate versions
    ladder_prose = {}
    for intensity in intensities:
        if intensity == 100:
            ladder_prose[intensity] = prose
        else:
            res = llm_call(
                role="prose_rewriting",
                system="Editor generating dose-response variants.",
                user_message=LADDER_PROMPT.format(intensity=intensity, mechanism=mechanism, prose=prose),
                tier_override="T1_default",
                use_cache=False,
                temperature=0.0
            )
            ladder_prose[intensity] = res.text

    # 2. Score in a single large tournament (blind)
    variants = [{"prose": ladder_prose[i]} for i in intensities]
    res = run_tournament(variants, outline, metadata, use_cache=False)
    
    # Map back scores
    # run_tournament returns variant_0...variant_N in order of input variants
    for i, intensity in enumerate(intensities):
        eval_step = next(e for e in res.detailed_evaluations if e.variant_id == f"variant_{i}")
        steps.append(LadderStep(
            intensity=intensity,
            prose=ladder_prose[intensity],
            score=eval_step.scores["overall_performance"]
        ))
        
    # 3. Analyze curve
    scores = [s.score for s in steps]
    is_steep = (scores[0] - scores[-1]) > 2.0
    
    return DoseResponseCurve(
        mechanism=mechanism,
        steps=steps,
        is_linear=False, # Could compute correlation
        is_steep=is_steep,
        area_under_curve=sum(scores)
    )
