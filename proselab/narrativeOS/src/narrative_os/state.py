from __future__ import annotations
from pathlib import Path
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class CharacterState(BaseModel):
    physical: str = "nominal"
    belief: str = "stable"
    attributes: Dict[str, Any] = Field(default_factory=dict)

class NarrativeState(BaseModel):
    current_act: int = 1
    current_chapter: float = 1.0
    character_states: Dict[str, CharacterState] = Field(default_factory=dict)
    open_loops: List[str] = Field(default_factory=list)
    promises: List[str] = Field(default_factory=list)
    world_state: Dict[str, Any] = Field(default_factory=dict)

    @classmethod
    def load(cls, path: Path) -> NarrativeState:
        if not path.exists():
            return cls()
        with open(path, "r", encoding="utf-8") as f:
            import json
            return cls.model_validate(json.load(f))

    def save(self, path: Path):
        with open(path, "w", encoding="utf-8") as f:
            f.write(self.model_dump_json(indent=2))
