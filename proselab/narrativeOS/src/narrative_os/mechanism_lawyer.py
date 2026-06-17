"""
Mechanism Lawyer — specialized scientific cross-examination of prose claims.
"""
from __future__ import annotations
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from .llm.router import llm_call

class CrossExaminationResult(BaseModel):
    claim: str
    evidence_for: List[str]
    evidence_against: List[str]
    confounders: List[str]
    falsifier: str # A specific intervention that would disprove the claim
    verdict: str # "supported", "weak", "rejected"
    vulnerability_score: float # 0-10, high = mechanism is likely a hallucination

LAWYER_PROMPT = """\
You are an Experimental Designer and Logic Auditor. Your job is to perform a cross-examination of a literary critic's causal claim. 

You do NOT care if the prose is good. You only care about variables, controls, and falsification.

CLAIM:
Mechanism: {mechanism}
Causal Role: {rationale}

PASSAGE:
{prose}

TASKS:
1. Identify the claim being made.
2. List evidence from the text that supports this mechanism's presence.
3. List evidence or alternative patterns that might be the REAL drivers (confounders).
4. Propose a Falsifier: What specific change would prove this mechanism is NOT causal?
5. Render a Verdict: Is the claim supported, weak, or rejected?

OUTPUT:
You MUST return a JSON object with EXACTLY these keys:
- "claim": (string)
- "evidence_for": (array of strings)
- "evidence_against": (array of strings)
- "confounders": (array of strings)
- "falsifier": (string)
- "verdict": (string: supported|weak|rejected)
- "vulnerability_score": (number 0-10)
"""

def cross_examine_mechanism(prose: str, mechanism: str, rationale: str) -> CrossExaminationResult:
    """
    Scientific Designer attacks the judge's explanation.
    """
    schema = CrossExaminationResult.model_json_schema()
    result = llm_call(
        role="world_logic_check", # Use a colder reasoning role
        system="You are an uncompromising Logic Auditor detecting 'Explanation Inflation'.",
        user_message=LAWYER_PROMPT.format(mechanism=mechanism, rationale=rationale, prose=prose),
        schema=schema,
        tier_override="T1_default", # Fallback from T4
        use_cache=False,
        temperature=0.0
    )
    
    data = result.parsed
    if not data:
        import json
        text = result.text
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1:
            try:
                data = json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                pass
    
    if data:
        # Robust nesting extraction
        target_data = data
        keys_to_search = ["cross_examination", "logic_audit", "result", "findings"]
        for key in keys_to_search:
            if key in target_data:
                target_data = target_data[key]
                break
        
        return CrossExaminationResult.model_validate(target_data)
    raise RuntimeError(f"Lawyer failed to respond. Raw: {result.text}")
