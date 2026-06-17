from __future__ import annotations
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from .llm.router import llm_call

class MechanismDependency(BaseModel):
    surface_weakness: str # What looks like a 'flaw' (ambiguity, unusual syntax, etc.)
    hidden_dependency: str # Why the weakness might be intentional/load-bearing
    removal_damage: str # What psychological/thematic effect collapses if clarified
    inversion_proven: bool # True if clarifying the text destroys the primary mechanism

DEPENDENCY_ANALYSIS_PROMPT = """\
You are an expert literary forensic analyst. You are given a specific authorial choice that some might consider a 'flaw' (ambiguity, paradox, unusual syntax, etc.).

Your task is to perform an INVERSION ANALYSIS: Assume this 'defect' is a precision-engineered mechanism.

ORIGINAL PASSAGE:
{prose}

TARGET CHOICE:
{choice}

TASKS:
1. Identify the 'Surface Weakness': What would a standard editor want to 'fix' here?
2. Articulate the 'Hidden Dependency': How might this specific weakness be carrying the scene's emotional or thematic weight? 
3. Hypothetical Removal: If we rewrite this to be conventionally 'clear' and 'correct', what specific psychological nuance is lost?
4. Verdict: Is the intended effect dependent on the apparent flaw?

OUTPUT:
You MUST return a JSON object with EXACTLY these keys:
- "surface_weakness": (string)
- "hidden_dependency": (string)
- "removal_damage": (string)
- "inversion_proven": (boolean)
"""

EVIL_REWRITE_PROMPT = """\
You are an 'Evil' Conventional Editor. Your goal is to kill the 'soul' of a passage while making it technically 'perfect'.

TASK:
Rewrite the following authorial choice to MAXIMIZE conventional literary clarity, standard grammar, and predictable imagery. 
Preserve the literal meaning, but remove all 'awkwardness', 'ambiguity', or 'paradox'.

ORIGINAL CHOICE:
{choice}

PASSAGE CONTEXT:
{prose}

OUTPUT:
Return the 'perfected' (but deadened) version of the choice.
"""

def run_mechanism_dependency_test(prose: str, choice: str) -> MechanismDependency:
    """
    Step 4: The Inversion Test. 
    Tests if the 'defect' is the 'payload'.
    """
    result = llm_call(
        role="prose_critic",
        system="You are a forensic literary analyst performing inversion tests.",
        user_message=DEPENDENCY_ANALYSIS_PROMPT.format(prose=prose, choice=choice),
        schema=MechanismDependency.model_json_schema(),
        tier_override="T1_default",
        use_cache=False,
        temperature=0.1
    )
    if result.parsed:
        return MechanismDependency.model_validate(result.parsed)
    raise RuntimeError(f"Dependency analysis failed. Raw: {result.text}")

def generate_evil_rewrite(prose: str, choice: str) -> str:
    """
    Generates a 'conventionally perfect' but 'spiritually dead' version.
    """
    result = llm_call(
        role="prose_rewriting",
        system="You are an editor who optimizes for conventional clarity above all else.",
        user_message=EVIL_REWRITE_PROMPT.format(prose=prose, choice=choice),
        tier_override="T1_default",
        use_cache=False,
        temperature=0.3
    )
    return result.text.strip()
