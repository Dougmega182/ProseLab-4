"""
Tests for narrative_os.prose_generator.

Uses a mock provider so no real API calls are made.
"""

from __future__ import annotations

from pathlib import Path
import pytest

from narrative_os.prose_generator import generate_scene, generate_scene_with_retry
from narrative_os.llm.router import clear_providers, register_provider
from narrative_os.store import save
from narrative_os.seeds.qs_seed import all_seed_entries
from narrative_os.contracts import BookContract, ContractRule
from narrative_os.decisions_parser import write_contract
from .test_router import MockProvider


@pytest.fixture
def mock_galaxy() -> MockProvider:
    clear_providers()
    mock = MockProvider(name="galaxy")
    register_provider("galaxy", mock)
    yield mock
    clear_providers()


@pytest.fixture
def populated_store(tmp_path: Path) -> Path:
    store_path = tmp_path / "canon_store.json"
    save(all_seed_entries(), store_path)
    return store_path


@pytest.fixture
def contract_path(tmp_path: Path) -> Path:
    contract = BookContract(
        source_path="decisions.md",
        source_hash="c" * 64,
        rules=[
            ContractRule(
                guard_id="s22.guard.no_kain_ics_misattribution",
                kind="foreclosure_guard",
                text="Never misattribute the ICS readings to Kain in prose.",
                section_ref="Section 23.8",
                severity="hard",
            )
        ],
    )
    return write_contract(contract, tmp_path / "book1_contract.json")


def test_prose_generator_prompt_assembly(mock_galaxy: MockProvider, populated_store: Path):
    # Set up mock response
    mock_galaxy.next_response = {
        "text": (
            "<thinking>\n"
            "1. Cliche: Emily is emotionally melodramatic.\n"
            "2. Impossible due to craft.register_clinical.\n"
            "3. Negative space: Bell's watch.\n"
            "</thinking>\n"
            "<prose_output>\n"
            "Kain observed the black lacquer of the table. His carotid pulse registered seventy-two.\n"
            "</prose_output>"
        )
    }

    outline = "Kain sits in the Black Pearl. Emily enters. Pacing is slow."
    result = generate_scene(
        scene_outline=outline,
        chapter_num=1,
        store_path=populated_store,
        use_cache=False,
    )

    assert result["thinking"] == (
        "1. Cliche: Emily is emotionally melodramatic.\n"
        "2. Impossible due to craft.register_clinical.\n"
        "3. Negative space: Bell's watch."
    )
    assert result["prose"] == "Kain observed the black lacquer of the table. His carotid pulse registered seventy-two."
    assert "Kain J." in mock_galaxy.last_request.user_message
    assert "craft.register_clinical" in mock_galaxy.last_request.user_message
    assert outline in mock_galaxy.last_request.user_message
    assert mock_galaxy.last_request.model_id == "claude-opus-4-6"


def test_prose_generator_accepts_scene_fixture_chapter(
    mock_galaxy: MockProvider,
    populated_store: Path,
):
    mock_galaxy.next_response = {
        "text": (
            "<thinking>\nScene fixture context\n</thinking>\n"
            "<prose_output>\nKain copied the date and closed the folder.\n</prose_output>"
        )
    }

    result = generate_scene(
        scene_outline="Kain enters Solis's apartment.",
        chapter_num=9,
        store_path=populated_store,
        use_cache=False,
    )

    assert result["prose"] == "Kain copied the date and closed the folder."


def test_prose_generator_includes_contract_in_prompt(
    mock_galaxy: MockProvider,
    populated_store: Path,
    contract_path: Path,
):
    mock_galaxy.next_response = {
        "text": (
            "<thinking>\nContract-aware thinking\n</thinking>\n"
            "<prose_output>\nBell copied Hayden's ICS reading.\n</prose_output>"
        )
    }

    generate_scene(
        scene_outline="Bell reads the file.",
        chapter_num=8,
        store_path=populated_store,
        contract_path=contract_path,
        use_cache=False,
    )

    assert "s22.guard.no_kain_ics_misattribution" in mock_galaxy.last_request.user_message
    assert "Never misattribute the ICS readings to Kain in prose." in mock_galaxy.last_request.user_message


def test_prose_generator_retry_success(populated_store: Path):
    from narrative_os.llm.providers.base import LLMCall, LLMResult
    
    class SequenceMockProvider(MockProvider):
        def __init__(self, responses: list[dict], name: str = "galaxy"):
            super().__init__(name=name)
            self.responses = responses
            
        def call(self, request: LLMCall) -> LLMResult:
            self.call_count += 1
            self.last_request = request
            response = self.responses.pop(0) if self.responses else {"text": ""}
            return LLMResult(
                text=response.get("text", ""),
                parsed=response.get("parsed"),
                model_id=request.model_id,
                usage={"input_tokens": 100, "output_tokens": 50},
                cache_hit=False,
            )
            
    clear_providers()
    responses = [
        # Pass 1: fails because of delve
        {
            "text": (
                "<thinking>\n"
                "Attempt 1 thinking\n"
                "</thinking>\n"
                "<prose_output>\n"
                "Kain began to delve into the files.\n"
                "</prose_output>"
            )
        },
        # Pass 2: passes, clean
        {
            "text": (
                "<thinking>\n"
                "Attempt 2 thinking to fix delve\n"
                "</thinking>\n"
                "<prose_output>\n"
                "Kain began to read the files. The first page carried three dates, each written in the same narrow hand. "
                "He copied the sequence, closed the folder, and left the chair exactly where it had been.\n"
                "</prose_output>"
            )
        }
    ]
    
    mock = SequenceMockProvider(responses=responses, name="galaxy")
    register_provider("galaxy", mock)
    
    outline = "Kain sits in the Black Pearl."
    result = generate_scene_with_retry(
        scene_outline=outline,
        chapter_num=1,
        store_path=populated_store,
        max_retries=3,
        use_cache=False,
        verbose=False,
    )
    
    assert mock.call_count == 2
    assert result["passed"] is True
    assert result["attempts"] == 2
    assert result["prose"].startswith("Kain began to read the files.")
    assert "delve" in result["history"][0]["lint"]["report"]
    assert "delve" not in result["history"][1]["lint"]["report"]
    clear_providers()


def test_prose_generator_retry_on_contract_failure(
    populated_store: Path,
    contract_path: Path,
):
    from narrative_os.llm.providers.base import LLMCall, LLMResult

    class SequenceMockProvider(MockProvider):
        def __init__(self, responses: list[dict], name: str = "galaxy"):
            super().__init__(name=name)
            self.responses = responses

        def call(self, request: LLMCall) -> LLMResult:
            self.call_count += 1
            self.last_request = request
            response = self.responses.pop(0) if self.responses else {"text": ""}
            return LLMResult(
                text=response.get("text", ""),
                parsed=response.get("parsed"),
                model_id=request.model_id,
                usage={"input_tokens": 100, "output_tokens": 50},
                cache_hit=False,
            )

    clear_providers()
    responses = [
        {
            "text": (
                "<thinking>\nAttempt 1\n</thinking>\n"
                "<prose_output>\nBell discovers Kain's ICS data in the file.\n</prose_output>"
            )
        },
        {
            "text": (
                "<thinking>\nAttempt 2\n</thinking>\n"
                "<prose_output>\n"
                "Bell copies Hayden's ICS data from the file. The number sits beside his name without annotation. "
                "She photographs the page, returns the folder to its original angle, and leaves the drawer open by one millimetre.\n"
                "</prose_output>"
            )
        },
    ]
    mock = SequenceMockProvider(responses=responses, name="galaxy")
    register_provider("galaxy", mock)

    result = generate_scene_with_retry(
        scene_outline="Bell reads the file.",
        chapter_num=8,
        store_path=populated_store,
        contract_path=contract_path,
        max_retries=3,
        use_cache=False,
        verbose=False,
    )

    assert mock.call_count == 2
    assert result["passed"] is True
    assert result["attempts"] == 2
    assert result["prose"].startswith("Bell copies Hayden's ICS data from the file.")
    assert result["history"][0]["lint"]["contract_findings"][0]["guard_id"] == (
        "s22.guard.no_kain_ics_misattribution"
    )
    assert "CONTRACT hard VIOLATION" in mock.last_request.user_message
    clear_providers()
