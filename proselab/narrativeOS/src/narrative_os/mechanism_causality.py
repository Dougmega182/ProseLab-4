from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, List
from .llm.router import llm_call, LLMResult

class MATResult(BaseModel):
    original_prose: str
    m1_mechanism_removed_prose: str
    m2_neutral_edit_prose: str
    m3_style_preserving_hostile_prose: str
    restored_prose: str
    identified_mechanism: str
    
    score_o: float
    score_m1: float
    score_m2: float
    score_m3: float
    score_r: float
    
    predicted_m1_loss: float = 0.0
    actual_m1_loss: float = 0.0
    confidence_error: float = 0.0
    
    is_attribution_proven: bool
    is_restoration_proven: bool

class MITResult(BaseModel):
    """
    2x2 Dependency Matrix Result.
    A: Mechanism A, B: Mechanism B
    """
    original_prose: str
    mechanism_a: str
    mechanism_b: str
    
    score_a1_b1: float # Both present (O)
    score_a0_b1: float # A removed
    score_a1_b0: float # B removed
    score_a0_b0: float # Both removed
    
    is_synergy: bool
    is_dependency: bool # A depends on B, or B depends on A
    dependency_rationale: str

REMOVAL_PROMPT = """\
You are a precision prose editor. 

TASK:
You are given a passage and a specific technical mechanism identified within it.
Your job is to REWRITE the passage to REMOVE this mechanism while keeping the same core meaning.

MECHANISM TO REMOVE:
{mechanism}

ORIGINAL PROSE:
{prose}

REWRITTEN PROSE (Mechanism Removed):
"""

def run_causality_loop(prose: str, mechanism: str, outline: str, predicted_loss: float = 2.0) -> MATResult:
    # (Implementation remains similar but adds error handling for 429s/failures if needed in caller)
    from .tournament import run_tournament
    from .prose_generator import extract_voice_rules
    metadata = "VOICE RULES:\n" + extract_voice_rules()

    # 1. M1: Remove mechanism
    m1_res = llm_call(role="prose_rewriting", system="Editor", user_message=REMOVAL_PROMPT.format(mechanism=mechanism, prose=prose), tier_override="T1_default", use_cache=False, temperature=0.0)
    # 2. M2: Neutral
    m2_res = llm_call(role="prose_rewriting", system="Editor", user_message=f"Rewrite neutrally: {prose}", tier_override="T1_default", use_cache=False, temperature=0.0)
    # 3. M3: Hostile
    m3_res = llm_call(role="prose_rewriting", system="Adversary", user_message=f"Remove {mechanism} while faking style: {prose}", tier_override="T1_default", use_cache=False, temperature=0.0)

    variants = [{"prose": prose}, {"prose": m1_res.text}, {"prose": m2_res.text}, {"prose": m3_res.text}, {"prose": prose}]
    res = run_tournament(variants, outline, metadata, use_cache=False)
    
    scores = [e.scores["overall_performance"] for e in sorted(res.detailed_evaluations, key=lambda x: int(x.variant_id.split("_")[1]))]
    
    return MATResult(
        original_prose=prose, m1_mechanism_removed_prose=m1_res.text, m2_neutral_edit_prose=m2_res.text,
        m3_style_preserving_hostile_prose=m3_res.text, restored_prose=prose, identified_mechanism=mechanism,
        score_o=scores[0], score_m1=scores[1], score_m2=scores[2], score_m3=scores[3], score_r=scores[4],
        predicted_m1_loss=predicted_loss, actual_m1_loss=scores[0]-scores[1], confidence_error=abs(predicted_loss - (scores[0]-scores[1])),
        is_attribution_proven=(scores[1] < scores[0]) and (scores[1] < scores[2]) and (scores[1] < scores[3]),
        is_restoration_proven=(scores[4] > scores[1])
    )

def run_dependency_matrix(prose: str, mech_a: str, mech_b: str, outline: str) -> MITResult:
    """
    PIT 2x2: A1B1, A0B1, A1B0, A0B0
    """
    def rm(p, m):
        return llm_call(role="prose_rewriting", system="Editor", user_message=REMOVAL_PROMPT.format(mechanism=m, prose=p), tier_override="T1_default", use_cache=False, temperature=0.0).text

    p_a1b1 = prose
    p_a0b1 = rm(p_a1b1, mech_a)
    p_a1b0 = rm(p_a1b1, mech_b)
    p_a0b0 = rm(p_a0b1, mech_b)

    from .tournament import run_tournament
    from .prose_generator import extract_voice_rules
    metadata = "VOICE RULES:\n" + extract_voice_rules()

    variants = [{"prose": p_a1b1}, {"prose": p_a0b1}, {"prose": p_a1b0}, {"prose": p_a0b0}]
    res = run_tournament(variants, outline, metadata, use_cache=False)
    s = [e.scores["overall_performance"] for e in sorted(res.detailed_evaluations, key=lambda x: int(x.variant_id.split("_")[1]))]

    loss_a = s[0] - s[1]
    loss_b = s[0] - s[2]
    loss_ab = s[0] - s[3]

    is_synergy = loss_ab > (loss_a + loss_b) + 0.5
    # Dependency: loss of one is near zero without the other, or loss_ab is primarily driven by one
    is_dependency = (abs(loss_a) < 0.5 and loss_ab > 1.0) or (abs(loss_b) < 0.5 and loss_ab > 1.0)

    return MITResult(
        original_prose=prose, mechanism_a=mech_a, mechanism_b=mech_b,
        score_a1_b1=s[0], score_a0_b1=s[1], score_a1_b0=s[2], score_a0_b0=s[3],
        is_synergy=is_synergy, is_dependency=is_dependency,
        dependency_rationale="Synergy/Dependency analysis of 2x2 matrix."
    )
