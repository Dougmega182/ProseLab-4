"""Gemini provider — STUB. Implement when needed for T1_default / T3_fast roles."""

from __future__ import annotations

from .base import LLMCall, LLMProvider, LLMResult, ProviderNotConfigured


class GeminiProvider(LLMProvider):
    name = "google"

    def supports_prompt_caching(self) -> bool:
        return True   # explicit context caching

    def call(self, request: LLMCall) -> LLMResult:
        raise ProviderNotConfigured(
            "GeminiProvider is a stub. Implement when you need T1_default."
        )
