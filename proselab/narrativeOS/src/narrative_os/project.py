from __future__ import annotations
from pathlib import Path
from typing import Optional
from .dna import NovelDNA

class ProjectPaths:
    def __init__(self, novel_root: Path):
        self.root = novel_root
        self.dna = novel_root / "novel_dna.json"
        self.data = novel_root / "data"
        self.canon = self.data / "canon_store.json"
        self.contracts = self.data / "contracts"
        self.pending = self.data / "pending"
        self.mutations = self.data / "mutations"
        self.genius_ledger = self.data / "genius_ledger.json"
        self.corpus = self.data / "elite_corpus.json"
        self.validation = self.data / "human_validation"
        self.disagreement_ledger = self.data / "disagreement_ledger.json"
        self.adversarial_bench = self.data / "adversarial_benchmark.json"
        self.logs = self.data / "logs"
        self.manuscript = novel_root / "manuscript"
        self.decisions = novel_root / "decisions.md"
        self.state = novel_root / "narrative_state.json"
        self.cache = self.data / ".cache" / "llm_responses"

    @property
    def extraction_logs(self) -> Path:
        return self.logs / "extraction"

    @property
    def retrieval_logs(self) -> Path:
        return self.logs / "retrieval"

_current_project: Optional[ProjectPaths] = None

def set_active_project(novel_root: Path):
    global _current_project
    _current_project = ProjectPaths(novel_root)

def get_project() -> ProjectPaths:
    if _current_project is None:
        # Fallback to current directory as a temporary legacy support or error out
        # For now, let's assume we want explicit setting
        raise RuntimeError("No active project set. Use set_active_project(path).")
    return _current_project
