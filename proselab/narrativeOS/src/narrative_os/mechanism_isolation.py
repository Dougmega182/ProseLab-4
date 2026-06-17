from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, List
from .llm.router import llm_call

class MIT2Result(BaseModel):
    original_prose: str
    isolated_mechanism_prose: str # C1: Mechanism preserved, everything else destroyed
    removed_mechanism_prose: str  # C2: Mechanism removed, everything else preserved
    blind_preservation_prose: str # C3: Preserved impact without knowing mechanism
    identified_mechanism: str
    
    score_o: float
    score_c1: float
    score_c2: float
    score_c3: float
    
    is_necessity_proven: bool
    is_sufficiency_proven: bool
    is_blind_preservation_successful: bool # True if C3 preserves quality but X disappears

ISOLATION_PROMPT = """\
You are a precision prose editor.
TASK: REWRITE to PRESERVE the technical mechanism {mechanism} while DESTROYING all surface style/imagery.
"""

BLIND_PRESERVATION_PROMPT = """\
You are a high-end prose editor.
TASK: REWRITE this passage to preserve its emotional and narrative impact, but change all surface details (imagery, specific scenario).
DO NOT change the core quality of the writing.

ORIGINAL PROSE:
{prose}

REWRITTEN PROSE (Impact Preserved):
"""

SWAP_TEST_PROMPT = """\
You are a precision editor.
TASK: You are given a passage and an identified mechanism {mechanism}.
REWRITE the passage to REMOVE this mechanism, but ADD a DIFFERENT mechanism of equivalent strength (e.g. if it used 'delayed revelation', swap it for 'unreliable perspective' or 'dense sensory friction') to achieve the same effect.

ORIGINAL PROSE:
{prose}

REWRITTEN PROSE (Mechanism Swapped):
"""

def run_mechanism_isolation_test(prose: str, mechanism: str, outline: str) -> MIT2Result:
    """
    MIT-2 + C3 Blind Test.
    """
    from .tournament import run_tournament
    from .prose_generator import extract_voice_rules
    from .mechanism_causality import REMOVAL_PROMPT
    
    metadata = "VOICE RULES:\n" + extract_voice_rules()

    # 1. C1: Isolate
    c1 = llm_call(role="prose_rewriting", system="Editor", user_message=ISOLATION_PROMPT.format(mechanism=mechanism, prose=prose), tier_override="T1_default", use_cache=False, temperature=0.0).text
    
    # 2. C2: Remove
    c2 = llm_call(role="prose_rewriting", system="Editor", user_message=REMOVAL_PROMPT.format(mechanism=mechanism, prose=prose), tier_override="T1_default", use_cache=False, temperature=0.0).text

    # 3. C3: Blind Preservation
    c3 = llm_call(role="prose_rewriting", system="Impact Editor", user_message=BLIND_PRESERVATION_PROMPT.format(prose=prose), tier_override="T1_default", use_cache=False, temperature=0.0).text

    variants = [{"prose": prose}, {"prose": c1}, {"prose": c2}, {"prose": c3}]
    res = run_tournament(variants, outline, metadata, use_cache=False)
    scores = [e.scores["overall_performance"] for e in sorted(res.detailed_evaluations, key=lambda x: int(x.variant_id.split("_")[1]))]
    
    o, c1_s, c2_s, c3_s = scores[0], scores[1], scores[2], scores[3]
    
    return MIT2Result(
        original_prose=prose, isolated_mechanism_prose=c1, removed_mechanism_prose=c2, blind_preservation_prose=c3,
        identified_mechanism=mechanism, score_o=o, score_c1=c1_s, score_c2=c2_s, score_c3=c3_s,
        is_necessity_proven=(o - c2_s) > 1.5,
        is_sufficiency_proven=(c1_s > (o * 0.7)),
        is_blind_preservation_successful=(c3_s >= (o * 0.9))
    )
