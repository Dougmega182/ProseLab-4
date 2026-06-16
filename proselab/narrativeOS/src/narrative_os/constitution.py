from __future__ import annotations
from pathlib import Path
from typing import Optional, List, Dict
from pydantic import BaseModel, Field

class HardFailureRule(BaseModel):
    pattern: str
    detect: List[str] = Field(default_factory=list)
    rule: Optional[str] = None
    severity: int = 9

class ScoringWeights(BaseModel):
    voice_alignment: float = 0.25
    specificity: float = 0.25
    tension: float = 0.25
    rhythm: float = 0.25

class CriticConstitution(BaseModel):
    name: str
    hard_failures: List[HardFailureRule] = Field(default_factory=list)
    scoring: ScoringWeights = Field(default_factory=ScoringWeights)
    legacy_rubric: Optional[str] = None  # To support existing 8-point rubric if needed

    @classmethod
    def load(cls, path: Path) -> CriticConstitution:
        with open(path, "r", encoding="utf-8") as f:
            import json
            return cls.model_validate(json.load(f))

    def save(self, path: Path):
        with open(path, "w", encoding="utf-8") as f:
            f.write(self.model_dump_json(indent=2))
