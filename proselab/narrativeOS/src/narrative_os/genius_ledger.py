from __future__ import annotations
from pathlib import Path
import json
import hashlib
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class GeniusEntry(BaseModel):
    entry_id: str
    outline: str
    prose: str
    initial_rationale: str # Why the system thought it was genius/anomalous
    human_outcome: Optional[Dict[str, Any]] = None # Populated after human ranking
    risk_score: float
    
class DangerousGeniusLedger:
    """
    The archive for 'Powerful but Unpopular' or 'Ahead of Taste' prose.
    Prevents the system from optimizing purely for immediate approval.
    """
    def __init__(self, ledger_path: Path):
        self.ledger_path = ledger_path
        self.entries: List[GeniusEntry] = []
        if self.ledger_path.exists():
            self._load()

    def _load(self):
        with open(self.ledger_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            self.entries = [GeniusEntry.model_validate(e) for e in data]

    def record_mutation(self, outline: str, prose: str, rationale: str, risk_score: float):
        """
        Records a high-risk variant that might lose a standard tournament.
        """
        entry_id = hashlib.sha256(prose.encode()).hexdigest()[:8]
        entry = GeniusEntry(
            entry_id=entry_id,
            outline=outline,
            prose=prose,
            initial_rationale=rationale,
            risk_score=risk_score
        )
        self.entries.append(entry)
        self._save()

    def _save(self):
        with open(self.ledger_path, "w", encoding="utf-8") as f:
            json.dump([e.model_dump() for e in self.entries], f, indent=2)
            
    def get_unvalidated_geniuses(self) -> List[GeniusEntry]:
        return [e for e in self.entries if e.human_outcome is None]
