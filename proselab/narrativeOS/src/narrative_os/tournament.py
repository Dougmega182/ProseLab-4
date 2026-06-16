from __future__ import annotations
from pathlib import Path
from typing import List, Dict, Any, Optional
import random
import json
from pydantic import BaseModel, Field
from .llm.router import llm_call
from .corpus import CorpusOracle

class AestheticAlignment(BaseModel):
    primary_axis: str # "A" or "B"
    violation_axis: Optional[str] = None
    is_monoculture_collapse: bool # True if it just tries to 'average' both
    productive_violation_rationale: Optional[str] = None

class MechanismAttribution(BaseModel):
    identified_mechanism: str
    removal_test_description: str
    predicted_score_degradation: str

class VariantEvaluation(BaseModel):
    variant_id: str
    scores: Dict[str, float] = Field(..., description="Scores for cliche_score, grounding_density, rhythmic_vitality, character_integrity, memorability, meaningful_residue, overall_performance, immediate_impact, predicted_delayed_payoff")
    alignment: AestheticAlignment
    mechanism_analysis: str
    mechanism_attribution_test: MechanismAttribution
    rationale: str
    corpus_citations: List[str] = Field(default_factory=list, description="Citations of corpus anchors used for comparison")
    standout_lines: List[str] = Field(default_factory=list)

class AnomalyReport(BaseModel):
    variant_id: str
    anomaly_type: str  # "high_risk", "structural_deviation", "weirdness"
    rationale: str

class TournamentResult(BaseModel):
    winner_id: str
    rankings: List[str] = Field(..., description="Ordered list of variant IDs from best to worst")
    detailed_evaluations: List[VariantEvaluation]
    summary_report: str
    anomalous_variant_id: Optional[str] = None
    anomaly_rationale: Optional[str] = None

TOURNAMENT_SYSTEM_PROMPT = """\
You are an elite literary critic. Your task is to perform a blind comparative evaluation of multiple versions of the same scene.

CRITICAL INSTRUCTION: 
- You MUST NOT use vague adjectives like "evocative," "engaging," "vivid," or "beautiful." 
- You MUST articulate the TECHNICAL MECHANISM of the prose. Explain *how* the sentence structure, word choice, or rhythmic cadence achieves its effect.
- Example of bad critique: "The prose is very evocative and vivid."
- Example of good critique: "The sentence delays the emotional reveal by 11 words, forcing inference before confirmation."

CRITERIA (Locked Schema):
1. CLICHÉ SCORE: 10 = zero predictable patterns.
2. GROUNDING DENSITY: 10 = absolute physical friction and sensory detail.
3. RHYTHMIC VITALITY: 10 = purposeful, non-AI cadence and sentence variety.
4. CHARACTER INTEGRITY: 10 = irreducible internal psychological truth.
5. MEMORABILITY: 10 = passage sticks in the mind, even if uncomfortable.
6. MEANINGFUL RESIDUE: 10 = the impact is thematic/emotional, not just confusion.
7. OVERALL PERFORMANCE: Weighted average / overall impact.
8. IMMEDIATE IMPACT: T+0 punch and readability.
9. PREDICTED DELAYED PAYOFF: T+24h psychological residue.

FORCED COMPARISON:
You are provided with anchors from two competing aesthetic axes:
- AXIS A (Restraint/Precision): Optimized for physical embodiment and rhythmic variance.
- AXIS B (Formal Risk/Instability): Optimized for linguistic risk and formal rupture.

You MUST cite specific anchors for every variant to justify your mechanism analysis.

MECHANISM ATTRIBUTION TEST (MAT):
For every variant, you MUST identify the single most powerful technical mechanism (e.g., 'delayed revelation', 'somatic frequency'). 
- Describe the mechanism.
- Removal Test: Describe exactly how the passage would change if this mechanism were removed.
- Predicted Effect: Predict how the scores would degrade if the mechanism were removed. This proves you understand the CAUSALITY of the prose power, not just its surface pattern.

STRUCTURAL ANOMALY DETECTION:
Identify one variant that is 'structurally anomalous' or 'weird.' This variant must contradict corpus norms in a precise, named way.

OUTPUT FORMAT:
You MUST return a JSON object with EXACTLY these keys:
- "winner_id": The ID of the winning variant
- "rankings": An array of variant IDs ordered from best to worst.
- "detailed_evaluations": An array of objects, one for each variant, with keys:
    - "variant_id": (string)
    - "scores": { "cliche_score", "grounding_density", "rhythmic_vitality", "character_integrity", "memorability", "meaningful_residue", "overall_performance", "immediate_impact", "predicted_delayed_payoff" }
    - "alignment": { "primary_axis", "violation_axis", "is_monoculture_collapse", "productive_violation_rationale" }
    - "mechanism_analysis": (string) Explain the technical mechanism without adjectives.
    - "mechanism_attribution_test": { "identified_mechanism", "removal_test_description", "predicted_score_degradation" }
    - "rationale": (string) Summary justification.
    - "corpus_citations": (array of strings) Mandatory citations.
    - "standout_lines": (array of strings)
- "summary_report": (string) overview.
- "anomalous_variant_id": (string or null)
- "anomaly_rationale": (string or null)
"""

def run_tournament(
    variants: List[Dict[str, str]], 
    scene_outline: str,
    project_metadata: str,
    use_cache: bool = True,
    tier_override: Optional[str] = "T1_default"
) -> TournamentResult:
    """
    Runs a blind ranking tournament between multiple prose variants,
    grounded in elite corpus anchors.
    """
    from .project import get_project
    try:
        project = get_project()
        oracle = CorpusOracle(project.corpus)
        anchors = oracle.get_relevant_anchors(scene_outline, limit_per_axis=2)
    except Exception as e:
        print(f"Warning: Failed to load anchors: {e}")
        anchors = {}

    # 1. Anonymize and shuffle
    labeled_variants = []
    for i, v in enumerate(variants):
        labeled_variants.append({"id": f"variant_{i}", "prose": v["prose"]})
    
    shuffled = list(labeled_variants)
    random.shuffle(shuffled)
    
    # 2. Build the judge prompt
    anchors_block = ""
    for axis, axis_anchors in anchors.items():
        anchors_block += f"## AXIS {axis}\n"
        for a in axis_anchors:
            anchors_block += f"### ANCHOR: {a.author} ({a.source})\n{a.text}\n\n"
    
    variants_block = ""
    for v in shuffled:
        variants_block += f"### {v['id']}\n\n{v['prose']}\n\n---\n\n"
        
    user_msg = f"""\
# ELITE CORPUS ANCHORS (GROUND TRUTH)
{anchors_block}

# PROJECT CONTEXT
{project_metadata}

# SCENE OUTLINE
{scene_outline}

# VARIANTS TO JUDGE
{variants_block}

Compare these variants against the anchors. Identify the winner based on the presence of greatness and closeness to elite structural features.
"""

    # 3. Call the judge
    schema = TournamentResult.model_json_schema()
    
    result = llm_call(
        role="prose_critic",
        system=TOURNAMENT_SYSTEM_PROMPT,
        user_message=user_msg,
        schema=schema,
        tier_override=tier_override,
        use_cache=use_cache,
        max_output_tokens=8192,
        temperature=0.1
    )
    
    if not result.parsed:
        # Fallback: find the first { and last } in the text
        text = result.text
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1:
            try:
                data = json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                from .llm.providers.anthropic import _try_parse_json
                data = _try_parse_json(text)
        else:
            raise RuntimeError(f"Tournament Judge failed to return valid JSON. Raw output:\n{result.text}")
    else:
        data = result.parsed
    
    if not data:
        raise RuntimeError(f"Tournament Judge returned empty or invalid data. Raw output:\n{result.text}")
        
    return TournamentResult.model_validate(data)
