from __future__ import annotations
from pathlib import Path
import json
import hashlib
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

class HumanPairwiseTask(BaseModel):
    task_id: str
    outline: str
    passage_a: str
    passage_b: str
    metadata: Dict[str, Any]

class HumanVerdict(BaseModel):
    winner_id: str  # "A" or "B"
    reason: str
    immediate_readability: int = Field(..., ge=1, le=10)
    lasting_impact: int = Field(..., ge=1, le=10)
    risk_level: int = Field(..., ge=1, le=10)
    rejection_type: Optional[str] = None # "bad", "too_weird", "too_slow", "misunderstood", "ahead_of_taste", "could_not_evaluate"

class HumanRanker:
    """
    The only 'Ground Truth' anchor.
    Exports pairs for human evaluation and ingests the results to calibrate the engine.
    """
    def __init__(self, export_dir: Path):
        self.export_dir = export_dir
        self.export_dir.mkdir(parents=True, exist_ok=True)

    def export_task(self, outline: str, prose_a: str, prose_b: str, metadata: Dict[str, Any]) -> Path:
        """
        Creates a blind comparison task for a human reader.
        """
        task_id = hashlib.sha256(f"{outline}{prose_a}{prose_b}".encode()).hexdigest()[:12]
        
        # Randomize A/B for the human
        if hash(task_id) % 2 == 0:
            a, b = prose_a, prose_b
            m_a, m_b = "A", "B"
        else:
            a, b = prose_b, prose_a
            m_a, m_b = "B", "A"

        task = HumanPairwiseTask(
            task_id=task_id,
            outline=outline,
            passage_a=a,
            passage_b=b,
            metadata={
                "original_order": {"A": m_a, "B": m_b},
                "generated_at": datetime.now(timezone.utc).isoformat(),
                **metadata
            }
        )
        
        out_path = self.export_dir / f"task_{task_id}.json"
        out_path.write_text(task.model_dump_json(indent=2), encoding="utf-8")
        
        # Also write a human-readable markdown version for quick ranking
        md_path = self.export_dir / f"task_{task_id}.md"
        md_content = f"""# PROSE COMPARISON TASK: {task_id}

## OUTLINE
{outline}

---
## PASSAGE A
{a}

---
## PASSAGE B
{b}

---
## YOUR VERDICT
**Winner (A/B):** 
**Reason:** 

**Scores (1-10):**
- Immediate Readability: 
- Lasting Impact: 
- Risk Level: 

**If you rejected a 'weird' but interesting one, why?**
(Rejection Type: bad / too_weird / too_slow / misunderstood / ahead_of_taste / could_not_evaluate)
**Rejection Type:** 
"""
        md_path.write_text(md_content, encoding="utf-8")
        return md_path

    def ingest_result(self, task_result_path: Path):
        """
        Ingests a human's choice to build the 'Taste Dataset'.
        """
        # Implementation for later: updating a weights.json or fine-tuning set
        pass
