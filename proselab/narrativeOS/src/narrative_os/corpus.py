from __future__ import annotations
from pathlib import Path
from typing import List, Dict, Any, Optional
import json
import re
from pydantic import BaseModel, Field

class CorpusExerpt(BaseModel):
    author: str
    source: str
    text: str
    axis: str = "A" # "A" for Restraint/Precision, "B" for Formal Risk
    tags: List[str] = Field(default_factory=list)
    structural_features: Dict[str, Any] = Field(default_factory=dict)

class CorpusOracle:
    """
    The ground-truth anchor for NarrativeOS.
    Stores elite prose excerpts for forced comparison, not just inspiration.
    """
    def __init__(self, corpus_path: Path):
        self.corpus_path = corpus_path
        self.excerpts: List[CorpusExerpt] = []
        if self.corpus_path.exists():
            self._load()

    @staticmethod
    def _tokenize(text: str) -> set[str]:
        return {token.lower() for token in re.findall(r"[A-Za-z][A-Za-z'-]{1,}", text)}

    def _lexical_overlap(self, query: str, excerpt: CorpusExerpt) -> float:
        query_tokens = self._tokenize(query)
        excerpt_tokens = self._tokenize(excerpt.text)
        if not query_tokens or not excerpt_tokens:
            return 0.0
        return len(query_tokens & excerpt_tokens) / min(len(query_tokens), len(excerpt_tokens))

    def _load(self):
        with open(self.corpus_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            self.excerpts = [CorpusExerpt.model_validate(e) for e in data]

    def get_relevant_anchors(self, query: str, limit_per_axis: int = 2) -> Dict[str, List[CorpusExerpt]]:
        """
        Retrieves anchors grouped by aesthetic axis.
        """
        axes = {}
        for e in self.excerpts:
            if e.axis not in axes:
                axes[e.axis] = []
            if len(axes[e.axis]) < limit_per_axis:
                axes[e.axis].append(e)
        return axes

    def get_relevant_exemplars(self, query: str, limit: int = 3) -> List[CorpusExerpt]:
        """
        Retrieve the most relevant concrete exemplars by lexical overlap.

        This replaces axis-first retrieval with a direct comparison against
        the current prompt context, which keeps the evaluation grounded in
        actual passages rather than abstract score labels.
        """
        scored = sorted(
            self.excerpts,
            key=lambda excerpt: (
                self._lexical_overlap(query, excerpt),
                excerpt.author,
            ),
            reverse=True,
        )
        return scored[:limit]

    def add_excerpt(self, excerpt: CorpusExerpt):
        self.excerpts.append(excerpt)
        self._save()

    def _save(self):
        with open(self.corpus_path, "w", encoding="utf-8") as f:
            json.dump([e.model_dump() for e in self.excerpts], f, indent=2)
