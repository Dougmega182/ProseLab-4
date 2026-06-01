"""OpenAI provider — STUB. Implement when needed for T4_reasoning role."""

from __future__ import annotations

from .base import LLMCall, LLMProvider, LLMResult, ProviderNotConfigured


class OpenAIProvider(LLMProvider):
    name = "openai"

    def supports_prompt_caching(self) -> bool:
        return True   # automatic, no code change required

    def call(self, request: LLMCall) -> LLMResult:
        raise ProviderNotConfigured(
            "OpenAIProvider is a stub. Implement when you need T4_reasoning role."
        )
