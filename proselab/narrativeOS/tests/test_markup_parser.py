import os
import json
import pytest
from unittest.mock import patch
from narrative_os.markup_parser import (
    parse_markup,
    log_amendment,
    apply_feedback,
    FeedbackRoute,
    FeedbackNote,
)

def test_parse_markup_span_specific():
    text = "The lock was a deadbolt. The pick took [eleven seconds]{#local_rewrite: Make this seven seconds}. Kain entered."
    clean_text, notes = parse_markup(text)
    
    assert clean_text == "The lock was a deadbolt. The pick took eleven seconds. Kain entered."
    assert len(notes) == 1
    
    note = notes[0]
    assert note.route == FeedbackRoute.LOCAL_REWRITE
    assert note.original_span == "eleven seconds"
    assert note.note == "Make this seven seconds"
    assert "The lock was a deadbolt" in note.context_before
    assert "Kain entered." in note.context_after

def test_parse_markup_free_standing():
    text = "Kain gave the living room four seconds. {#prompt_tuning: Make him feel more tired} The study door was open."
    clean_text, notes = parse_markup(text)
    
    assert clean_text == "Kain gave the living room four seconds.  The study door was open."
    assert len(notes) == 1
    
    note = notes[0]
    assert note.route == FeedbackRoute.PROMPT_TUNING
    assert note.original_span is None
    assert note.note == "Make him feel more tired"

def test_parse_markup_multiple_mixed():
    text = "Start. [One]{#local_rewrite: change} Middle. {#canon_correction: update} End."
    clean_text, notes = parse_markup(text)
    
    assert clean_text == "Start. One Middle.  End."
    assert len(notes) == 2
    
    assert notes[0].route == FeedbackRoute.LOCAL_REWRITE
    assert notes[0].original_span == "One"
    assert notes[0].note == "change"
    
    assert notes[1].route == FeedbackRoute.CANON_CORRECTION
    assert notes[1].original_span is None
    assert notes[1].note == "update"

def test_parse_markup_invalid_route():
    text = "Something [wrong]{#unknown_route: error}"
    with pytest.raises(ValueError, match="Unknown feedback route: 'unknown_route'"):
        parse_markup(text)

def test_log_amendment(tmp_path):
    log_file = tmp_path / "amendments.log.jsonl"
    
    note = FeedbackNote(
        route=FeedbackRoute.LOCAL_REWRITE,
        original_span="eleven seconds",
        note="Make this seven seconds",
    )
    
    log_amendment(note, source="solis_apartment_scene_draft.txt", replacement="seven seconds", log_path=str(log_file))
    
    assert log_file.exists()
    lines = log_file.read_text(encoding="utf-8").splitlines()
    assert len(lines) == 1
    
    entry = json.loads(lines[0])
    assert entry["source"] == "solis_apartment_scene_draft.txt"
    assert entry["route"] == "local_rewrite"
    assert entry["original_span"] == "eleven seconds"
    assert entry["note"] == "Make this seven seconds"
    assert entry["replacement"] == "seven seconds"
    assert "timestamp" in entry

@patch("narrative_os.markup_parser.llm_call")
def test_apply_feedback(mock_llm_call, tmp_path):
    from narrative_os.llm.providers.base import LLMResult
    
    mock_llm_call.return_value = LLMResult(
        text="seven seconds",
        model_id="claude-opus-4-6",
        usage={},
        cache_hit=False,
    )
    
    text = "The lock was a deadbolt. The pick took [eleven seconds]{#local_rewrite: Make this seven seconds}. Kain entered."
    log_file = tmp_path / "amendments.log.jsonl"
    
    clean_text, notes = apply_feedback(
        text,
        use_cache=True,
        log_path=str(log_file),
        source="test_draft",
    )
    
    assert clean_text == "The lock was a deadbolt. The pick took seven seconds. Kain entered."
    assert mock_llm_call.call_count == 1
    assert len(notes) == 1
    assert notes[0].original_span == "eleven seconds"
    assert notes[0].note == "Make this seven seconds"
    
    # Check that it was logged correctly
    assert log_file.exists()
    lines = log_file.read_text(encoding="utf-8").splitlines()
    assert len(lines) == 1
    entry = json.loads(lines[0])
    assert entry["replacement"] == "seven seconds"

@patch("narrative_os.markup_parser.llm_call")
def test_cli_apply_feedback(mock_llm_call, tmp_path):
    from narrative_os.llm.providers.base import LLMResult
    from narrative_os.cli import main
    
    mock_llm_call.return_value = LLMResult(
        text="seven seconds",
        model_id="claude-opus-4-6",
        usage={},
        cache_hit=False,
    )
    
    draft_file = tmp_path / "draft.txt"
    draft_file.write_text("The pick took [eleven seconds]{#local_rewrite: Make it seven}.", encoding="utf-8")
    
    out_file = tmp_path / "clean.txt"
    log_file = tmp_path / "amendments.log.jsonl"
    
    args = [
        "apply-feedback",
        str(draft_file),
        "--out", str(out_file),
        "--log", str(log_file),
        "--no-cache",
    ]
    
    exit_code = main(args)
    assert exit_code == 0
    
    assert out_file.exists()
    assert out_file.read_text(encoding="utf-8") == "The pick took seven seconds."
    
    assert log_file.exists()
    lines = log_file.read_text(encoding="utf-8").splitlines()
    assert len(lines) == 1
    entry = json.loads(lines[0])
    assert entry["replacement"] == "seven seconds"


def test_apply_prompt_tuning_logic(tmp_path):
    from narrative_os.markup_parser import apply_prompt_tuning, FeedbackNote, FeedbackRoute
    from pathlib import Path
    
    tuning_file = tmp_path / "prompt_tuning.txt"
    note = FeedbackNote(
        route=FeedbackRoute.PROMPT_TUNING,
        note="Avoid starting sentences with 'There was'",
    )
    
    apply_prompt_tuning(note, tuning_file)
    assert tuning_file.exists()
    assert tuning_file.read_text(encoding="utf-8") == "Avoid starting sentences with 'There was'\n"
    
    # Try adding again (should not duplicate)
    apply_prompt_tuning(note, tuning_file)
    assert tuning_file.read_text(encoding="utf-8") == "Avoid starting sentences with 'There was'\n"


@patch("narrative_os.markup_parser.llm_call")
def test_apply_contract_amendment_logic(mock_llm_call, tmp_path):
    from narrative_os.markup_parser import apply_contract_amendment, FeedbackNote, FeedbackRoute
    from narrative_os.llm.providers.base import LLMResult
    from pathlib import Path
    
    decisions_file = tmp_path / "decisions.md"
    decisions_file.write_text(
        "## Section 22: Prose-Generation Contract (Surface)\n"
        "### 1. Canonical Facts (What to show)\n"
        "- Fact A.\n"
        "## Section 23: Load-Bearing Architecture (Spine)\n"
        "### Section 23 Content\n",
        encoding="utf-8"
    )
    
    mock_llm_call.return_value = LLMResult(
        text=(
            "## Section 22: Prose-Generation Contract (Surface)\n"
            "### 1. Canonical Facts (What to show)\n"
            "- Fact A.\n"
            "- New Fact B from note."
        ),
        model_id="mock-model",
        usage={},
        cache_hit=False
    )
    
    note = FeedbackNote(
        route=FeedbackRoute.CONTRACT_AMENDMENT,
        note="Add Fact B",
    )
    
    apply_contract_amendment(note, decisions_file, use_cache=True)
    
    assert decisions_file.exists()
    content = decisions_file.read_text(encoding="utf-8")
    assert "- New Fact B from note." in content
    assert "## Section 23: Load-Bearing Architecture (Spine)" in content


@patch("narrative_os.markup_parser.llm_call")
def test_apply_canon_correction_logic(mock_llm_call, tmp_path):
    from narrative_os.markup_parser import apply_canon_correction, FeedbackNote, FeedbackRoute
    from narrative_os.llm.providers.base import LLMResult
    from narrative_os.store import load
    from pathlib import Path
    
    store_file = tmp_path / "canon_store.json"
    store_file.write_text('{"entries": []}', encoding="utf-8")
    
    # 1. Test append action
    mock_llm_call.return_value = LLMResult(
        text=json.dumps({
            "action": "append",
            "new_entry": {
                "id": "character.kain_weapon",
                "namespace": "character",
                "entity": "Kain",
                "value": "Kain carries a standard pulse pistol.",
                "confidence": "hard_canon"
            }
        }),
        model_id="mock-model",
        usage={},
        cache_hit=False
    )
    
    note = FeedbackNote(
        route=FeedbackRoute.CANON_CORRECTION,
        note="Kain carries a standard pulse pistol",
    )
    
    apply_canon_correction(note, store_file, source_chapter=1, pass_id="test_pass", use_cache=True)
    
    entries = load(store_file)
    assert len(entries) == 1
    assert entries[0].id == "character.kain_weapon"
    assert entries[0].value == "Kain carries a standard pulse pistol."
    assert entries[0].is_active()

    # 2. Test supersede action
    mock_llm_call.return_value = LLMResult(
        text=json.dumps({
            "action": "supersede",
            "old_id": "character.kain_weapon",
            "new_entry": {
                "id": "character.kain_weapon_v2",
                "namespace": "character",
                "entity": "Kain",
                "value": "Kain carries a modified laser pistol.",
                "confidence": "hard_canon"
            }
        }),
        model_id="mock-model",
        usage={},
        cache_hit=False
    )
    
    note_v2 = FeedbackNote(
        route=FeedbackRoute.CANON_CORRECTION,
        note="Kain actually carries a modified laser pistol, not a pulse pistol",
    )
    
    apply_canon_correction(note_v2, store_file, source_chapter=2, pass_id="test_pass_v2", use_cache=True)
    
    entries_after = load(store_file)
    assert len(entries_after) == 2
    # The old entry should be marked inactive (superseded)
    old_entry = next(e for e in entries_after if e.id == "character.kain_weapon")
    assert not old_entry.is_active()
    assert old_entry.superseded_by == "character.kain_weapon_v2"
    
    # The new entry should be active
    new_entry = next(e for e in entries_after if e.id == "character.kain_weapon_v2")
    assert new_entry.is_active()
    assert new_entry.value == "Kain carries a modified laser pistol."


