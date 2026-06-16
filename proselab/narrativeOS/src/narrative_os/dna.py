from __future__ import annotations
from pathlib import Path
from pydantic import BaseModel, Field

class ProseTargets(BaseModel):
    sentence_variance: float = 0.85
    metaphor_density: float = 0.6
    abstract_emotion: float = 0.2
    sensory_grounding: float = 0.9

class NovelDNA(BaseModel):
    novel_id: str
    genre: str = "science fiction"
    tone: str = "existential, restrained"
    prose_targets: ProseTargets = Field(default_factory=ProseTargets)
    forbidden_patterns: list[str] = Field(default_factory=lambda: [
        "generic_ai_phrasing",
        "emotion_labels",
        "exposition_blocks"
    ])
    authors_influence: list[str] = Field(default_factory=lambda: ["Le Guin", "Wolfe", "Butler"])
    world_constraints: list[str] = Field(default_factory=list)

    @classmethod
    def load(cls, path: Path) -> NovelDNA:
        with open(path, "r", encoding="utf-8") as f:
            import json
            return cls.model_validate(json.load(f))

    def save(self, path: Path):
        with open(path, "w", encoding="utf-8") as f:
            f.write(self.model_dump_json(indent=2))
