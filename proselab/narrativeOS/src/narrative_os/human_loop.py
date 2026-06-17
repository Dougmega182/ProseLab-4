from __future__ import annotations
from pathlib import Path
import json
import hashlib
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field

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
    rejection_type: Optional[str] = None  # "bad", "too_weird", "too_slow", "misunderstood", "ahead_of_taste", "could_not_evaluate"

class HumanRanker:
    """
    The only 'Ground Truth' anchor.
    Exports pairs for human evaluation and ingests the results to calibrate the engine.
    """
    def __init__(self, export_dir: Path):
        self.export_dir = export_dir
        self.export_dir.mkdir(parents=True, exist_ok=True)

    def export_task(self, outline: str, prose_a: str, prose_b: str, metadata: Dict[str, Any], zero_knowledge: bool = False) -> Path:
        """
        Creates a blind comparison task for a human reader.

        When zero_knowledge=True, the task uses plain preference language only,
        without mechanism, trap, or causality vocabulary, so humans are not
        steered by NarrativeOS terminology.
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
                "zero_knowledge": zero_knowledge,
                **metadata
            }
        )
        
        out_path = self.export_dir / f"task_{task_id}.json"
        out_path.write_text(task.model_dump_json(indent=2), encoding="utf-8")
        
        # Also write a human-readable markdown version for quick ranking
        md_path = self.export_dir / f"task_{task_id}.md"
        if zero_knowledge:
            prompt_line = metadata.get("prompt", "Which passage feels stronger?")
            verdict_instructions = f"""## YOUR VERDICT
{prompt_line}
**Which passage feels stronger?** Choose A or B.
**Reason:** Give one short reason in plain language.

**Quick cues (optional):** vividness, clarity, natural rhythm, emotional force.
"""
        else:
            verdict_instructions = """## YOUR VERDICT
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
{verdict_instructions}
"""
        md_path.write_text(md_content, encoding="utf-8")
        return md_path

    def export_zero_knowledge_task(self, outline: str, prose_a: str, prose_b: str, metadata: Dict[str, Any]) -> Path:
        """
        Export a schema-free human preference task that avoids NarrativeOS
        mechanism vocabulary altogether.
        """
        return self.export_task(outline, prose_a, prose_b, metadata, zero_knowledge=True)

    def export_non_mechanism_task(self, outline: str, prose_a: str, prose_b: str, dimension: str) -> Path:
        """
        Export a schema-free evaluation task over a direct human dimension
        such as emotional persistence or recall, which cannot be cleanly
        expressed in NarrativeOS mechanism vocabulary.
        """
        allowed_dimensions = {
            "emotional_persistence": "Which passage has stronger emotional persistence?",
            "compression": "Which passage conveys more meaning with fewer words?",
            "recall_distortion": "Which passage is easier to remember after a short delay?",
        }
        if dimension not in allowed_dimensions:
            raise ValueError(f"Unsupported non-mechanism dimension: {dimension}")

        return self.export_task(
            outline=outline,
            prose_a=prose_a,
            prose_b=prose_b,
            metadata={
                "source": "non_mechanism_axis",
                "dimension": dimension,
                "prompt": allowed_dimensions[dimension],
            },
            zero_knowledge=True,
        )

    def export_external_corpus_tasks(self, corpus_dir: Path, max_pairs: int = 3) -> list[Path]:
        """
        Export zero-knowledge comparison tasks over unmodified external corpus
        files. This intentionally avoids generated or mutated stimuli.
        """
        corpus_dir = Path(corpus_dir)
        if not corpus_dir.exists():
            raise FileNotFoundError(f"External corpus directory not found: {corpus_dir}")

        samples = [path for path in corpus_dir.glob("*.txt") if path.is_file()]
        if len(samples) < 2:
            raise ValueError("Need at least two external corpus files to build comparison tasks.")

        task_paths = []
        for idx in range(min(max_pairs, len(samples) // 2)):
            left = samples[2 * idx]
            right = samples[2 * idx + 1]
            task_path = self.export_task(
                outline="Compare these two unmodified passages for overall strength.",
                prose_a=left.read_text(encoding="utf-8"),
                prose_b=right.read_text(encoding="utf-8"),
                metadata={
                    "source": "external_corpus",
                    "source_left": left.name,
                    "source_right": right.name,
                    "stimulus_origin": "raw_external_text",
                },
                zero_knowledge=True,
            )
            task_paths.append(task_path)

        return task_paths

    def ingest_result(self, task_result_path: Path) -> Path:
        """
        Ingests a human's choice to build the 'Taste Dataset'.

        The current implementation is intentionally minimal: it reads a JSON
        verdict file, validates it, and appends it to a durable ledger under
        the validation folder for later calibration work.
        """
        if not task_result_path.exists():
            raise FileNotFoundError(f"Human verdict file not found: {task_result_path}")

        raw = json.loads(task_result_path.read_text(encoding="utf-8"))
        verdict = HumanVerdict.model_validate(raw)

        ledger_path = self.export_dir / "human_validation_results.jsonl"
        with ledger_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps({
                "task_id": raw.get("task_id", task_result_path.stem),
                "recorded_at": datetime.now(timezone.utc).isoformat(),
                "verdict": verdict.model_dump(),
            }, ensure_ascii=False) + "\n")

        return ledger_path
