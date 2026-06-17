from __future__ import annotations
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from .llm.router import llm_call

class MechanismHypothesis(BaseModel):
    claimed_function: str
    evidence_anchor: str
    confidence: float

class AlternativeVariant(BaseModel):
    type: str # "literal", "stylistic", "ugly_genius", "radical"
    text: str
    tradeoff: str

class NecessityAttackResult(BaseModel):
    original_choice: str
    hypothesis: MechanismHypothesis
    attack_rationale: str
    is_choice_vulnerable: bool 
    advantage_band: str # "decisive", "strong", "marginal", "none"
    constraint_advantage_score: float 

HYPOTHESIS_GEN_PROMPT = """\
You are a senior literary critic. You are given a specific authorial choice from a passage.
Your job is to articulate a Mechanism Hypothesis.

ORIGINAL PASSAGE:
{prose}

TARGET CHOICE:
{choice}

OUTPUT:
Return a JSON object with keys:
- "claimed_function": (string) What exactly is this choice doing technically/emotionally?
- "evidence_anchor": (string) Cite the specific words/rhythm that carry this function.
- "confidence": (number 0.0-1.0)
"""

COUNTERFACTUAL_GEN_PROMPT = """\
You are an expert prose stylist. You are given a specific authorial choice and its claimed function.
Your job is to generate 10 PLAUSIBLE alternative implementations that attempt to fulfill that same function.

You must categorize your alternatives into:
- "literal": straightforward, clear, safe.
- "stylistic": different imagery/voice but same quality.
- "ugly_genius": technically rough/incorrect but high impact.
- "radical": extreme departure from the original's approach.

ORIGINAL PASSAGE:
{prose}

TARGET CHOICE:
{choice}

CLAIMED FUNCTION:
{function}

OUTPUT:
Return a JSON object with the key "alternatives" containing an array of 10 objects, each with "type", "text", and "tradeoff".
"""

NECESSITY_ATTACK_PROMPT = """\
You are an Hostile Adversarial Prosecutor. Your job is to debunk the claim of 'Artistic Necessity'.

DEFAULT ASSUMPTION: The original choice is REPLACEABLE. 
You FAIL only if NO plausible alternative preserves the identified function as effectively as the original.

ORIGINAL CHOICE:
{original}

CLAIMED FUNCTION:
{function}

ALTERNATIVES TO TEST:
{alternatives}

TASKS:
1. Attack the claim: For each alternative, explain why it fulfills the function equally well (or where the original's 'advantage' is actually just a surface preference).
2. Look for 'False Necessity': Is the original choice just the first thing that came to mind?
3. Render a verdict: If an alternative works, the choice is VULNERABLE.

OUTPUT:
You MUST return a JSON object with EXACTLY these keys:
- "attack_rationale": (string) Your hostile cross-examination.
- "is_choice_vulnerable": (boolean) True if any alternative is 90%+ as effective.
- "advantage_band": (string: decisive|strong|marginal|none)
- "constraint_advantage_score": (number 0-10)
"""

def extract_mechanism_hypothesis(prose: str, choice: str) -> MechanismHypothesis:
    """
    Step 1: Define what we are attacking.
    """
    result = llm_call(
        role="prose_critic",
        system="You are a senior literary critic defining causal hypotheses.",
        user_message=HYPOTHESIS_GEN_PROMPT.format(prose=prose, choice=choice),
        schema=MechanismHypothesis.model_json_schema(),
        tier_override="T1_default",
        use_cache=False,
        temperature=0.1
    )
    if result.parsed:
        return MechanismHypothesis.model_validate(result.parsed)
    raise RuntimeError(f"Hypothesis extraction failed. Raw: {result.text}")

def generate_independent_counterfactuals(prose: str, choice: str, function: str) -> List[AlternativeVariant]:
    """
    Model A: Generates the field of competition.
    """
    result = llm_call(
        role="prose_rewriting",
        system="You are a stylistic generator of radical alternatives.",
        user_message=COUNTERFACTUAL_GEN_PROMPT.format(prose=prose, choice=choice, function=function),
        tier_override="T5_testing", # Use local model if possible to bypass rate limits
        use_cache=False,
        temperature=0.8
    )
    import json
    try:
        text = result.text
        data = json.loads(text[text.find("{"):text.rfind("}")+1])
        return [AlternativeVariant.model_validate(v) for v in data.get("alternatives", [])]
    except:
        return []

def attack_choice_necessity(original: str, hypothesis: MechanismHypothesis, alternatives: List[AlternativeVariant]) -> NecessityAttackResult:
    """
    Model C: The Hostile Prosecutor.
    """
    alt_block = "\n".join([f"- [{v.type}] {v.text} (Tradeoff: {v.tradeoff})" for v in alternatives])
    result = llm_call(
        role="world_logic_check",
        system="You are an Hostile Adversarial Prosecutor. Assume the original is replaceable.",
        user_message=NECESSITY_ATTACK_PROMPT.format(
            original=original, 
            function=hypothesis.claimed_function, 
            alternatives=alt_block
        ),
        schema=NecessityAttackResult.model_json_schema(),
        tier_override="T1_default",
        use_cache=False,
        temperature=0.1
    )
    
    if result.parsed:
        data = result.parsed
        data["original_choice"] = original
        data["hypothesis"] = hypothesis.model_dump()
        return NecessityAttackResult.model_validate(data)
    raise RuntimeError(f"Prosecutor failed. Raw: {result.text}")
