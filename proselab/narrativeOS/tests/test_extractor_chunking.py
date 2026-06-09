"""Tests for chunked extraction in narrative_os.extractor."""
import pytest
from unittest.mock import patch, MagicMock

from narrative_os.extractor import extract_delta, chunk_text
from narrative_os.manuscript import Manuscript, Chapter
from narrative_os.retriever import ContextSlice


def test_chunk_text_basic():
    # Construct paragraph-based text of ~600 words total
    paras = ["This is paragraph number {} of the mock chapter text. It is designed to be long enough to test chunking.".format(i) for i in range(20)]
    text = "\n\n".join(paras)
    
    # Chunk with a small max_words limit (e.g. 50 words) to force multiple chunks
    chunks = chunk_text(text, max_words=50)
    assert len(chunks) > 1
    # Check that paragraphs aren't split mid-sentence/mid-paragraph
    for chunk in chunks:
        assert len(chunk.split()) >= 10
        assert "paragraph" in chunk


@patch("narrative_os.extractor.llm_call")
@patch("narrative_os.extractor.retrieve")
def test_extractor_runs_chunked_and_merges(mock_retrieve, mock_llm_call):
    # Setup mock chapter with 2 paragraphs totaling ~200 words
    para1 = "Paragraph one with some random details about Kain walking down the street."
    para2 = "Paragraph two with details about Kain entering his apartment and seeing Bell."
    chapter = Chapter(number=1, title="Walk", text=f"{para1}\n\n{para2}", kind="chapter", start_line=1, end_line=10)
    ms = Manuscript(chapters=[chapter], path="mock_path", raw="mock_raw")
    
    # Mock retrieve
    mock_retrieve.return_value = ContextSlice(chapter=1, entries=[])
    
    # Setup mock LLM responses for 2 chunks
    mock_result_1 = MagicMock()
    mock_result_1.text = ""
    mock_result_1.usage = {}
    mock_result_1.cache_hit = False
    mock_result_1.parsed = {
        "chapter": 1,
        "pass_id": "test_pass",
        "new_entries": [
            {
                "id": "kain.walking",
                "namespace": "character",
                "entity": "Kain",
                "confidence": "event",
                "value": "Kain walks down the street.",
                "extracted_at_pass": "test_pass",
                "source_chapter": 1
            }
        ],
        "new_loops": [
            {
                "id": "plot.loop_walking_destination",
                "namespace": "plot",
                "confidence": "inferred",
                "value": "OPEN: Where is Kain walking to?",
                "extracted_at_pass": "test_pass",
                "source_chapter": 1
            }
        ],
        "resolved_loops": [],
        "tone_notes": ["Fast pacing"]
    }

    mock_result_2 = MagicMock()
    mock_result_2.text = ""
    mock_result_2.usage = {}
    mock_result_2.cache_hit = False
    mock_result_2.parsed = {
        "chapter": 1,
        "pass_id": "test_pass",
        "new_entries": [
            # Test duplicate ID updating the value (should keep latest, which is this one)
            {
                "id": "kain.walking",
                "namespace": "character",
                "entity": "Kain",
                "confidence": "event",
                "value": "Kain arrived at his apartment.",
                "extracted_at_pass": "test_pass",
                "source_chapter": 1
            },
            {
                "id": "bell.location",
                "namespace": "character",
                "entity": "Bell",
                "confidence": "event",
                "value": "Bell is inside Kain's apartment.",
                "extracted_at_pass": "test_pass",
                "source_chapter": 1
            }
        ],
        "new_loops": [],
        "resolved_loops": ["plot.loop_walking_destination"],
        "tone_notes": ["Tense environment", "Fast pacing"]
    }

    # Side effect returns chunk 1 response, then chunk 2 response
    mock_llm_call.side_effect = [mock_result_1, mock_result_2]

    # Run extract_delta with small max_words limit to force chunking
    # We patch chunk_text to return two chunks representing para1 and para2
    with patch("narrative_os.extractor.chunk_text", return_value=[para1, para2]) as mock_chunk:
        delta = extract_delta(
            manuscript=ms,
            chapter_num=1,
            pass_id="test_pass",
            log_dir="tests/tmp_logs"
        )
        
        # Verify chunking was called on chapter text
        mock_chunk.assert_called_once_with(chapter.text, max_words=1500)

    # Verify LLM was called exactly twice (once per chunk)
    assert mock_llm_call.call_count == 2

    # Verify retrieve was called twice (once per chunk)
    assert mock_retrieve.call_count == 2

    # Verify the results are merged and deduplicated
    assert delta.chapter == 1
    assert delta.pass_id == "test_pass"
    
    # kain.walking was duplicated across chunks, last chunk had "arrived at his apartment"
    assert len(delta.new_entries) == 2
    entry_ids = {e.id for e in delta.new_entries}
    assert "kain.walking" in entry_ids
    assert "bell.location" in entry_ids
    
    kain_walk_entry = next(e for e in delta.new_entries if e.id == "kain.walking")
    assert kain_walk_entry.value == "Kain arrived at his apartment."

    # Loop was created in first chunk, resolved in second chunk
    assert len(delta.new_loops) == 1
    assert delta.new_loops[0].id == "plot.loop_walking_destination"
    assert delta.resolved_loops == ["plot.loop_walking_destination"]

    # Tone notes should be merged and deduplicated
    assert set(delta.tone_notes) == {"Fast pacing", "Tense environment"}
