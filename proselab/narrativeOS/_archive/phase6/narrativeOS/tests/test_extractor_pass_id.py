"""Regression test: extractor must force pass_id onto all entries
regardless of what the mock LLM returns."""
import json
import pytest
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock

from narrative_os.schemas import StateDelta, CanonEntry
from narrative_os.extractor import extract_delta
from narrative_os.manuscript import Manuscript, Chapter

@patch("narrative_os.extractor.llm_call")
@patch("narrative_os.extractor.retrieve")
def test_extractor_forces_pass_id(mock_retrieve, mock_llm_call):
    # Setup mock chapter
    chapter = Chapter(number=0, title="Prologue", text="The reflection finished tying its shoe a half-second late.", kind="chapter", start_line=1, end_line=1)
    ms = Manuscript(chapters=[chapter], path="mock_path", raw="mock_raw")
    
    from narrative_os.retriever import ContextSlice
    # Mock retrieve
    mock_retrieve.return_value = ContextSlice(chapter=0, entries=[])
    
    # Setup mock LLM response that returns a fabricated past pass_id
    mock_result = MagicMock()
    mock_result.text = ""
    mock_result.usage = {}
    mock_result.cache_hit = False
    
    fabricated_pass = "ch0_2025-07-08T12:00:00"
    
    mock_result.parsed = {
        "chapter": 0,
        "pass_id": fabricated_pass,
        "new_entries": [
            {
                "id": "plot.prologue_reflection_anomaly",
                "namespace": "plot",
                "confidence": "event",
                "value": "The reflection finished tying its shoe a half-second late.",
                "extracted_at_pass": fabricated_pass,
                "source_chapter": 0
            }
        ],
        "new_loops": [
            {
                "id": "plot.loop_reflection_mechanism",
                "namespace": "plot",
                "confidence": "inferred",
                "value": "OPEN: What caused the temporal desynchronisation?",
                "extracted_at_pass": fabricated_pass,
                "source_chapter": 0
            }
        ],
        "resolved_loops": []
    }
    
    mock_llm_call.return_value = mock_result
    
    # Call extractor with a specific pass_id
    expected_pass_id = "verify-fix-001"
    
    # Needs to not fail during model_validate and then should override
    delta = extract_delta(
        manuscript=ms,
        chapter_num=0,
        pass_id=expected_pass_id,
        log_dir="tests/tmp_logs"
    )
    
    # Assertions
    assert delta.pass_id == expected_pass_id
    assert len(delta.new_entries) == 1
    assert delta.new_entries[0].extracted_at_pass == expected_pass_id
    assert len(delta.new_loops) == 1
    assert delta.new_loops[0].extracted_at_pass == expected_pass_id
