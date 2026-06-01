"""
Tests for narrative_os.llm.router.

Uses a mock provider so no real API calls are made.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from narrative_os.llm.providers.base import LLMCall, LLMProvider, LLMResult
from narrative_os.llm.cache.local import LocalCache
from narrative_os.llm.router import (
    clear_providers,
    get_provider,
    llm_call,
    register_provider,
)


# ---------------------------------------------------------------------------
# Mock provider
# ---------------------------------------------------------------------------

class MockProvider(LLMProvider):
    name = "mock"

    def __init__(self, name: str = "galaxy"):
        self.name = name
        self.call_count = 0
        self.last_request: LLMCall | None = None
        self.next_response: dict | None = None

    def supports_prompt_caching(self) -> bool:
        return True

    def call(self, request: LLMCall) -> LLMResult:
        self.call_count += 1
        self.last_request = request
        response = self.next_response or {"text": '{"chapter": 5, "pass_id": "x"}'}
        return LLMResult(
            text=response.get("text", ""),
            parsed=response.get("parsed"),
            model_id=request.model_id,
            usage={"input_tokens": 100, "output_tokens": 50},
            cache_hit=False,
        )


@pytest.fixture
def mock_galaxy() -> MockProvider:
    clear_providers()
    mock = MockProvider(name="galaxy")
    register_provider("galaxy", mock)
    yield mock
    clear_providers()


@pytest.fixture
def cache(tmp_path: Path) -> LocalCache:
    return LocalCache(cache_dir=tmp_path / "cache")


class TestRouterBasics:
    def test_calls_provider_on_l1_miss(self, mock_galaxy: MockProvider, cache):
        llm_call(
            role="continuity_extractor",
            system="sys",
            user_message="user",
            cache=cache,
        )
        assert mock_galaxy.call_count == 1

    def test_l1_hit_skips_provider(self, mock_galaxy: MockProvider, cache):
        llm_call(
            role="continuity_extractor",
            system="sys",
            user_message="user",
            cache=cache,
        )
        # Same inputs → cache hit
        result = llm_call(
            role="continuity_extractor",
            system="sys",
            user_message="user",
            cache=cache,
        )
        assert mock_galaxy.call_count == 1   # not called again
        assert result.cache_hit is True

    def test_different_inputs_different_keys(
        self, mock_galaxy: MockProvider, cache,
    ):
        llm_call(
            role="continuity_extractor",
            system="sys",
            user_message="user1",
            cache=cache,
        )
        llm_call(
            role="continuity_extractor",
            system="sys",
            user_message="user2",
            cache=cache,
        )
        assert mock_galaxy.call_count == 2

    def test_use_cache_false_forces_call(
        self, mock_galaxy: MockProvider, cache,
    ):
        llm_call(
            role="continuity_extractor",
            system="sys",
            user_message="user",
            cache=cache,
        )
        llm_call(
            role="continuity_extractor",
            system="sys",
            user_message="user",
            cache=cache,
            use_cache=False,
        )
        assert mock_galaxy.call_count == 2

    def test_cache_key_includes_extra_parts(
        self, mock_galaxy: MockProvider, cache,
    ):
        llm_call(
            role="continuity_extractor",
            system="sys",
            user_message="u",
            cache_key_parts=["chapter_5"],
            cache=cache,
        )
        # Different cache_key_parts → cache miss
        llm_call(
            role="continuity_extractor",
            system="sys",
            user_message="u",
            cache_key_parts=["chapter_6"],
            cache=cache,
        )
        assert mock_galaxy.call_count == 2

    def test_passes_cached_blocks_to_provider(
        self, mock_galaxy: MockProvider, cache,
    ):
        llm_call(
            role="continuity_extractor",
            system="sys",
            user_message="u",
            cached_blocks=["manuscript text here"],
            cache=cache,
        )
        assert mock_galaxy.last_request is not None
        assert mock_galaxy.last_request.cached_blocks == ["manuscript text here"]

    def test_tier_override_changes_model(self, mock_galaxy: MockProvider, cache):
        # Override to T3_fast (google:gemini-3-flash)
        # Will fail to find provider since we only registered galaxy mock
        # — so register google too
        google_mock = MockProvider(name="google")
        register_provider("google", google_mock)

        llm_call(
            role="continuity_extractor",
            system="sys",
            user_message="u",
            tier_override="T3_fast",
            cache=cache,
        )
        assert google_mock.call_count == 1
        assert mock_galaxy.call_count == 0


class TestProviderRegistration:
    def test_get_provider_returns_singleton(self):
        clear_providers()
        # Without registering, get_provider("galaxy") returns real provider
        p1 = get_provider("galaxy")
        p2 = get_provider("galaxy")
        assert p1 is p2
        clear_providers()

    def test_unknown_provider_raises(self):
        clear_providers()
        with pytest.raises(ValueError, match="Unknown provider"):
            get_provider("nope")
