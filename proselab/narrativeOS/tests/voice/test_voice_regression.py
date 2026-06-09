import json
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock
from pydantic import BaseModel
from narrative_os.voice_linter import lint_voice, ACTIVE_VOICE_RUBRIC, VoiceScoreResult

class MockLLMResponse(BaseModel):
    text: str

def test_voice_regression_corpus():
    corpus_path = Path(__file__).parent / "voice_regression_corpus.json"
    if not corpus_path.exists():
        pytest.skip("Voice regression corpus not found.")
        
    cases = json.loads(corpus_path.read_text(encoding="utf-8"))
    
    print(f"\n--- Voice Rubric Version: {ACTIVE_VOICE_RUBRIC.version} ---")
    print(f"Thresholds:")
    print(f"  lexical_density:   >= {ACTIVE_VOICE_RUBRIC.lexical_density}")
    print(f"  rhythm_delta:      >= {ACTIVE_VOICE_RUBRIC.rhythm_delta}")
    print(f"  sentence_variance: >= {ACTIVE_VOICE_RUBRIC.sentence_variance}")
    print(f"  forbidden_drift:   >= {ACTIVE_VOICE_RUBRIC.forbidden_drift}\n")
    
    for case in cases:
        case_id = case["id"]
        expected_pass = case["expected_pass"]
        expected_failed_metrics = set(case.get("expected_failed_metrics", []))
        mock_metrics = case["mock_llm_metrics"]
        
        # We patch llm_call to return exactly what the corpus defines as the mock metric outputs
        mock_response = MockLLMResponse(text=json.dumps(mock_metrics))
        
        with patch("narrative_os.voice_linter.llm_call", return_value=mock_response):
            result: VoiceScoreResult = lint_voice(case["input"])
            
            # Assert Immutability logic via Pydantic
            try:
                result.lexical_density = 1.0
                assert False, f"Case {case_id}: VoiceScoreResult should be immutable!"
            except Exception: # Pydantic ValidationError or TypeError
                pass
                
            # Assert Pass/Fail
            assert result.passed == expected_pass, f"Case {case_id}: Expected pass={expected_pass}, got {result.passed}"
            
            # Assert specific failed metrics matched expectations
            actual_failed_metrics = set(result.failed_metrics)
            assert actual_failed_metrics == expected_failed_metrics, (
                f"Case {case_id}: Expected failures {expected_failed_metrics}, got {actual_failed_metrics}"
            )
            
            print(f"[PASS] {case_id}: passed={result.passed}, failed_metrics={result.failed_metrics}")

if __name__ == "__main__":
    test_voice_regression_corpus()
