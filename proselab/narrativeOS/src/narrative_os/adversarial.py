from __future__ import annotations
from pathlib import Path
import json
from enum import Enum
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class HorsemanType(str, Enum):
    FAKE_GREATNESS = "fake_greatness"
    UGLY_GENIUS = "ugly_genius"
    WRONG_PLACEMENT = "wrong_placement"
    COMPETENT_NOTHING = "competent_nothing"
    SATURATION_FAILURE = "saturation_failure"

class AdversarialPair(BaseModel):
    axis: str # "Precision", "Rhythm", "Voice", etc.
    horseman_type: HorsemanType
    strong_example: str 
    trap_example: str 
    meta: Dict[str, str] = Field(default_factory=dict)

class AdversarialBenchmark(BaseModel):
    name: str
    pairs: List[AdversarialPair] = Field(default_factory=list)

    @classmethod
    def load(cls, path: Path) -> AdversarialBenchmark:
        with open(path, "r", encoding="utf-8") as f:
            return cls.model_validate(json.load(f))

    def save(self, path: Path):
        with open(path, "w", encoding="utf-8") as f:
            f.write(self.model_dump_json(indent=2))

class DisagreementEntry(BaseModel):
    input_outline: str
    choice_human: str
    choice_model: str
    human_reason: str
    human_explanation_mechanism: str # How the human articulated the 'why' technically
    model_reason: str
    failure_category: str # "popularity_bias", "canon_bias", "misunderstood_mechanism", etc.
    repair_strategy: Optional[str] = None

class DisagreementLedger:
    """
    Records where human taste and model judgment diverge.
    This becomes the primary dataset for performance engineering.
    """
    def __init__(self, ledger_path: Path):
        self.ledger_path = ledger_path
        self.entries: List[DisagreementEntry] = []
        if self.ledger_path.exists():
            self._load()

    def _load(self):
        with open(self.ledger_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            self.entries = [DisagreementEntry.model_validate(e) for e in data]

    def record_disagreement(self, entry: DisagreementEntry):
        self.entries.append(entry)
        self._save()

    def _save(self):
        with open(self.ledger_path, "w", encoding="utf-8") as f:
            json.dump([e.model_dump() for e in self.entries], f, indent=2)
