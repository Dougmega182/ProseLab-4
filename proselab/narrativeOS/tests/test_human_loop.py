import json
from pathlib import Path

from narrative_os.human_loop import HumanRanker, HumanVerdict


def test_human_ranker_exports_blind_task(tmp_path: Path):
    ranker = HumanRanker(tmp_path)

    md_path = ranker.export_task(
        outline="A quiet hallway at midnight.",
        prose_a="The hallway breathed cold air.",
        prose_b="Cold air moved through the hallway.",
        metadata={"source": "ci-test"},
    )

    assert md_path.exists()
    assert md_path.suffix == ".md"

    json_files = list(tmp_path.glob("task_*.json"))
    assert len(json_files) == 1

    payload = json_files[0].read_text(encoding="utf-8")
    assert '"outline": "A quiet hallway at midnight."' in payload
    assert '"source": "ci-test"' in payload


def test_human_verdict_accepts_expected_fields():
    verdict = HumanVerdict(
        winner_id="A",
        reason="Passage A is more grounded.",
        immediate_readability=8,
        lasting_impact=7,
        risk_level=3,
    )

    assert verdict.winner_id == "A"
    assert verdict.immediate_readability == 8


def test_human_ranker_exports_zero_knowledge_task(tmp_path: Path):
    ranker = HumanRanker(tmp_path)

    md_path = ranker.export_zero_knowledge_task(
        outline="A corridor at midnight.",
        prose_a="The corridor breathed cold air.",
        prose_b="Cold air moved through the corridor.",
        metadata={"source": "zero-knowledge-test"},
    )

    assert md_path.exists()
    content = md_path.read_text(encoding="utf-8")
    assert "mechanism" not in content.lower()
    assert "causality" not in content.lower()
    assert "trap" not in content.lower()
    assert "Which passage feels stronger?" in content


def test_human_ranker_ingests_verdict_to_ledger(tmp_path: Path):
    ranker = HumanRanker(tmp_path)

    verdict_path = tmp_path / "verdict.json"
    verdict_path.write_text(json.dumps({
        "task_id": "abc123",
        "winner_id": "B",
        "reason": "Passage B had stronger rhythm.",
        "immediate_readability": 9,
        "lasting_impact": 8,
        "risk_level": 4,
    }), encoding="utf-8")

    ledger_path = ranker.ingest_result(verdict_path)

    assert ledger_path.exists()
    lines = ledger_path.read_text(encoding="utf-8").strip().splitlines()
    assert len(lines) == 1
    assert '"task_id": "abc123"' in lines[0]
    assert '"winner_id": "B"' in lines[0]
