"""
Abstract LLM provider interface.

A provider takes a normalized call shape and returns a normalized result.
The router handles cache layers around it; the provider only cares about
making the API call itself.

Call shape:
    LLMCall(
        model_id="claude-opus-4-7",
        system="You are a continuity analyst...",
        cached_blocks=[<long, stable text>, ...],   # prefix to be cached
        user_message="Analyse Chapter 5...",        # not cached
        schema={...},                               # JSON schema for output
        max_output_tokens=2048,
    )
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class LLMCall:
    model_id: str
    system: str
    user_message: str
    cached_blocks: list[str] = field(default_factory=list)
    schema: Optional[dict] = None
    max_output_tokens: int = 4096
    temperature: float = 0.2
    extra: dict[str, Any] = field(default_factory=dict)


@dataclass
class LLMResult:
    text: str                            # raw text returned
    parsed: Optional[Any] = None         # JSON-parsed if schema was supplied
    model_id: str = ""
    usage: dict[str, int] = field(default_factory=dict)  # input/output/cache tokens
    cache_hit: bool = False              # provider-level cache hit
    raw_response: Optional[dict] = None  # for debugging / logging


class LLMProvider(ABC):
    """Implement one of these per vendor."""

    name: str = "base"

    @abstractmethod
    def call(self, request: LLMCall) -> LLMResult:
        ...

    @abstractmethod
    def supports_prompt_caching(self) -> bool:
        ...


# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------

class ProviderError(Exception):
    pass


class ProviderNotConfigured(ProviderError):
    """Raised when a provider stub is invoked without a real implementation."""


class ProviderAPIError(ProviderError):
    """Raised when the upstream API returns an error."""
