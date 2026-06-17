from __future__ import annotations
from pathlib import Path
from typing import List, Dict, Any, Optional
import random
import json
from pydantic import BaseModel, Field
from .llm.router import llm_call
from .corpus import CorpusOracle
from .contrast_memory import build_contrast_brief, retrieve_exemplars

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
    mechanism_confidence: float = Field(..., ge=0, le=100, description="Certainty that identified mechanism is causal")
    alternative_possible: bool = Field(..., description="Could another mechanism explain the effect?")
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
- You MUST articulate technical mechanisms without vague adjectives.
- You MUST perform the Mechanism Attribution Test (MAT) for every variant.
- You MUST state your mechanism_confidence (0-100). If you are pattern-matching but not sure of causality, score it LOW.

FORCED COMPARISON:
... cite anchors ...

MECHANISM ATTRIBUTION TEST (MAT):
... predict degradation ...

OUTPUT FORMAT:
Return a JSON object with keys:
- "winner_id", "rankings", "summary_report", "anomalous_variant_id", "anomaly_rationale"
- "detailed_evaluations": [
    {
      "variant_id", "scores", "alignment", "mechanism_analysis", 
      "mechanism_attribution_test", "mechanism_confidence", "alternative_possible",
      "rationale", "corpus_citations", "standout_lines"
    }
  ]
"""

def run_tournament(
    variants: List[Dict[str, str]], 
    scene_outline: str,
    project_metadata: str,
    use_cache: bool = True,
    tier_override: Optional[str] = "T1_default"
) -> TournamentResult:
    # (Rest of implementation remains the same, using updated schema)
    from .project import get_project
    try:
        project = get_project()
        oracle = CorpusOracle(project.corpus)
        anchors = oracle.get_relevant_anchors(scene_outline, limit_per_axis=2)
    except Exception as e:
        print(f"Warning: Failed to load anchors: {e}")
        anchors = {}

    labeled_variants = []
    for i, v in enumerate(variants):
        labeled_variants.append({"id": f"variant_{i}", "prose": v["prose"]})
    
    shuffled = list(labeled_variants)
    random.shuffle(shuffled)
    
    anchors_block = ""
    for axis, axis_anchors in anchors.items():
        anchors_block += f"## AXIS {axis}\n"
        for a in axis_anchors:
            anchors_block += f"### ANCHOR: {a.author} ({a.source})\n{a.text}\n\n"
    
    variants_block = ""
    for v in shuffled:
        variants_block += f"### {v['id']}\n\n{v['prose']}\n\n---\n\n"
        
    user_msg = f"# ELITE CORPUS ANCHORS\n{anchors_block}\n\n# PROJECT CONTEXT\n{project_metadata}\n\n# SCENE OUTLINE\n{scene_outline}\n\n# VARIANTS\n{variants_block}"

    schema = TournamentResult.model_json_schema()
    result = llm_call(role="prose_critic", system=TOURNAMENT_SYSTEM_PROMPT, user_message=user_msg, schema=schema, tier_override=tier_override, use_cache=use_cache, max_output_tokens=8192, temperature=0.1)
    
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
                from .llm.providers.anthropic import _try_parse_json
                data = _try_parse_json(text)
    
    if not data:
        raise RuntimeError(f"Tournament Judge failed. Raw: {result.text}")
        
    return TournamentResult.model_validate(data)
