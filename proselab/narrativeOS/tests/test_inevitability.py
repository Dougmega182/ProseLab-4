"""Tests for the narrative_os.inevitability engine."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch
import pytest

from narrative_os.manuscript import Manuscript
from narrative_os.pipeline import analyze_chapter, AnalysisStatus
from narrative_os.schemas import CanonEntry, StateDelta
from narrative_os.inevitability import detect_inevitability_conflicts
from narrative_os.llm.providers.base import LLMResult


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _e(id_: str, *, value: str, confidence: str = "hard_canon",
       namespace: str = "world", entity: str | None = None,
       chapter: int = 0, superseded_by: str | None = None) -> CanonEntry:
    return CanonEntry(
        id=id_,
        namespace=namespace,  # type: ignore[arg-type]
        entity=entity,
        value=value,
        confidence=confidence,  # type: ignore[arg-type]
        source_chapter=chapter,
        extracted_at_pass="seed",
        superseded_by=superseded_by,
    )


SAMPLE_MD = """\
# **CHAPTER 1 — INCEPTION**

Hayden transitions using the new ICS stabilizer.
"""


@pytest.fixture
def manuscript(tmp_path: Path) -> Manuscript:
    p = tmp_path / "ms.md"
    p.write_text(SAMPLE_MD, encoding="utf-8")
    return Manuscript.load(p)


@pytest.fixture
def store_path(tmp_path: Path) -> Path:
    return tmp_path / "canon_store.json"


@pytest.fixture
def pending_dir(tmp_path: Path) -> Path:
    return tmp_path / "pending"


# ---------------------------------------------------------------------------
# Unit tests for Inevitability Engine
# ---------------------------------------------------------------------------

def test_inevitability_empty_active_axioms():
    # If store has no active axioms, should return empty conflicts without LLM call
    conflicts = detect_inevitability_conflicts(
        chapter_num=1,
        chapter_text="Hayden walked.",
        store_entries=[],
    )
    assert conflicts == []


@patch("narrative_os.inevitability.llm_call")
def test_inevitability_no_violations(mock_llm_call):
    mock_llm_call.return_value = LLMResult(
        text='{"violations": []}',
        parsed={"violations": []},
        model_id="test-model",
    )

    axioms = [
        _e("world.fade_mechanics", value="Calcification triggers Fade.", confidence="hard_canon"),
    ]

    conflicts = detect_inevitability_conflicts(
        chapter_num=1,
        chapter_text="Hayden walked.",
        store_entries=axioms,
    )
    assert conflicts == []
    assert mock_llm_call.called


@patch("narrative_os.inevitability.llm_call")
def test_inevitability_has_violations(mock_llm_call):
    mock_llm_call.return_value = LLMResult(
        text='{"violations": [{"axiom_id": "world.fade_mechanics", "severity": "HIGH", "type": "CANON_VIOLATION", "incoming_value": "Hayden Fades instantly without calcification.", "note": "Direct violation of world rule"}]}',
        parsed={
            "violations": [
                {
                    "axiom_id": "world.fade_mechanics",
                    "severity": "HIGH",
                    "type": "CANON_VIOLATION",
                    "incoming_value": "Hayden Fades instantly without calcification.",
                    "note": "Direct violation of world rule",
                }
            ]
        },
        model_id="test-model",
    )

    axioms = [
        _e("world.fade_mechanics", value="Calcification triggers Fade.", confidence="hard_canon"),
    ]

    conflicts = detect_inevitability_conflicts(
        chapter_num=1,
        chapter_text="Hayden walked.",
        store_entries=axioms,
    )
    assert len(conflicts) == 1
    c = conflicts[0]
    assert c.severity == "HIGH"
    assert c.type == "CANON_VIOLATION"
    assert c.existing_entry_id == "world.fade_mechanics"
    assert c.incoming_value == "Hayden Fades instantly without calcification."
    assert c.suggested_action == "block"
    assert "Direct violation" in c.note


# ---------------------------------------------------------------------------
# Pipeline Integration tests
# ---------------------------------------------------------------------------

@patch("narrative_os.inevitability.llm_call")
def test_pipeline_integration_triggers_pending(
    mock_llm_call, manuscript, store_path, pending_dir
):
    from narrative_os.store import save
    # Seed the store with active world axiom
    save([
        _e("world.fade_mechanics", value="Calcification triggers Fade.", confidence="hard_canon"),
    ], store_path)

    # Mock the inevitability check to return a HIGH violation
    mock_llm_call.return_value = LLMResult(
        text='{"violations": [{"axiom_id": "world.fade_mechanics", "severity": "HIGH", "type": "CANON_VIOLATION", "incoming_value": "Hayden Fades without calcification.", "note": "Breaks physical law."}]}',
        parsed={
            "violations": [
                {
                    "axiom_id": "world.fade_mechanics",
                    "severity": "HIGH",
                    "type": "CANON_VIOLATION",
                    "incoming_value": "Hayden Fades without calcification.",
                    "note": "Breaks physical law.",
                }
            ]
        },
        model_id="test-model",
    )

    # Extractor stub returns a clean delta
    delta = StateDelta(
        chapter=1,
        pass_id="p1",
        new_entries=[],
    )

    def mock_extractor(**kwargs):
        return delta

    # Run the pipeline
    result = analyze_chapter(
        manuscript=manuscript,
        chapter_num=1,
        canon_store_path=store_path,
        pending_dir=pending_dir,
        extractor_fn=mock_extractor,
    )

    # Should be pending review due to the high inevitability conflict!
    assert result.status == AnalysisStatus.PENDING_REVIEW
    assert result.report is not None
    assert len(result.report.high()) == 1
    assert result.report.high()[0].existing_entry_id == "world.fade_mechanics"
    assert result.report.clean_to_merge is False
    assert result.pending_path.exists()
