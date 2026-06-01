"""
Regression test: when canon slice attributes a fact to character X but
chapter text clearly attributes it to character Y, the extractor must
reuse the existing id (not invent a new slug).
"""
import pytest
from unittest.mock import patch, MagicMock

from narrative_os.schemas import StateDelta
from narrative_os.extractor import extract_delta
from narrative_os.manuscript import Manuscript, Chapter
from narrative_os.retriever import ContextSlice


@patch("narrative_os.extractor.llm_call")
@patch("narrative_os.extractor.retrieve")
def test_extractor_can_correct_identity_attribution(mock_retrieve, mock_llm_call):
    """
    Verifies that the extractor's plumbing accepts an LLM-emitted
    correction that reuses an existing id with a substantively different
    value. (We don't test that the LLM *does* this — that's prompt-level —
    but we test that when it does, the system doesn't mangle it.)
    """
    chapter = Chapter(
        number=8, title="Bell Discovers The Lie",
        text="Bell read Hayden's clinical log. ICS 41 at jump 340.",
        kind="chapter", start_line=1, end_line=1,
    )
    ms = Manuscript(chapters=[chapter], path="mock", raw="mock")
    mock_retrieve.return_value = ContextSlice(chapter=8, entries=[])

    result = MagicMock()
    result.text = ""
    result.usage = {}
    result.cache_hit = False
    result.parsed = {
        "chapter": 8,
        "pass_id": "test-correction-001",
        "new_entries": [
            # The extractor reuses the existing seed id with a corrected value
            {
                "id": "bell.discovery",
                "namespace": "character",
                "entity": "Bell",
                "value": "Bell discovers Hayden's ICS data, not Kain's.",
                "confidence": "event",
                "extracted_at_pass": "test-correction-001",
                "source_chapter": 8,
            }
        ],
        "new_loops": [],
        "resolved_loops": [],
    }
    mock_llm_call.return_value = result

    delta = extract_delta(
        manuscript=ms,
        chapter_num=8,
        pass_id="test-correction-001",
        log_dir="tests/tmp_logs",
    )

    assert len(delta.new_entries) == 1
    assert delta.new_entries[0].id == "bell.discovery"
    assert "Hayden" in delta.new_entries[0].value
    assert "not Kain" in delta.new_entries[0].value
