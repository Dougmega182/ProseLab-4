from __future__ import annotations
from pydantic import BaseModel, Field

class LockedEvaluationSchema(BaseModel):
    """
    HARD LOCKED SCHEMA. 
    This is the only allowed evaluation structure for the performance gate.
    Prevents 'metric drift' and 'justification theater'.
    """
    cliche_score: float = Field(..., ge=0, le=10, description="10 = zero predictable patterns")
    grounding_density: float = Field(..., ge=0, le=10, description="10 = absolute physical friction")
    rhythmic_vitality: float = Field(..., ge=0, le=10, description="10 = purposeful, non-AI cadence")
    character_integrity: float = Field(..., ge=0, le=10, description="10 = irreducible internal truth")
    memorability: float = Field(..., ge=0, le=10, description="10 = passage sticks in the mind, even if uncomfortable")
    meaningful_residue: float = Field(..., ge=0, le=10, description="10 = the impact is thematic/emotional, not just confusion")
    
    overall_performance: float = Field(..., ge=0, le=10, description="Weighted average / overall impact")
    
    # Temporal Dimension
    immediate_impact: float = Field(..., ge=0, le=10, description="T+0 impact: immediate readability and punch")
    predicted_delayed_payoff: float = Field(..., ge=0, le=10, description="Predicted T+24h impact: durable psychological residue")
