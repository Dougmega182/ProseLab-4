"""
LLM router — orchestrates local cache → provider call → cache write.

Two-layer cache strategy:
    L1: local response cache  (this module)  — 100% saving on hits
    L2: provider prompt cache (per provider) — 90% saving on partial hits

Public entry point: llm_call()
"""

from __future__ import annotations

from typing import Any, Optional

from .cache.local import LocalCache, make_cache_key
from .providers.base import LLMCall, LLMProvider, LLMResult
from .providers.anthropic import AnthropicProvider
from .providers.openai import OpenAIProvider
from .providers.gemini import GeminiProvider
from .tiers import resolve_model


# Singleton-ish provider registry
_PROVIDERS: dict[str, LLMProvider] = {}


def get_provider(name: str) -> LLMProvider:
    if name not in _PROVIDERS:
        if name == "anthropic":
            _PROVIDERS[name] = AnthropicProvider()
        elif name == "openai":
            _PROVIDERS[name] = OpenAIProvider()
        elif name == "google":
            _PROVIDERS[name] = GeminiProvider()
        else:
            raise ValueError(f"Unknown provider: {name!r}")
    return _PROVIDERS[name]


def register_provider(name: str, provider: LLMProvider) -> None:
    """For tests: inject a mock provider."""
    _PROVIDERS[name] = provider


def clear_providers() -> None:
    """For tests: reset registry."""
    _PROVIDERS.clear()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def llm_call(
    *,
    role: str,
    system: str,
    user_message: str,
    cached_blocks: Optional[list[str]] = None,
    schema: Optional[dict] = None,
    cache_key_parts: Optional[list[Any]] = None,
    tier_override: Optional[str] = None,
    cache: Optional[LocalCache] = None,
    use_cache: bool = True,
    ttl_seconds: Optional[float] = None,
    max_output_tokens: int = 4096,
    temperature: float = 0.2,
) -> LLMResult:
    """
    Route a call through L1 (local) → provider (with L2 prompt cache).

    Args:
        role: from tiers.ROLE_TIERS
        system: system prompt
        user_message: per-call user instruction
        cached_blocks: stable prefix blocks (manuscript, schema, etc.)
        schema: JSON schema for the model's output (drives parsing)
        cache_key_parts: extra parts to include in the L1 cache key.
            Should typically include content hashes for everything the
            output depends on (manuscript hash, canon slice hash, etc.)
        tier_override: skip role's default tier
        cache: LocalCache instance (creates default if None)
        use_cache: set False to bypass L1 entirely (fresh call)
        ttl_seconds: per-call TTL override
    """
    provider_name, model_id = resolve_model(role, tier_override)
    provider = get_provider(provider_name)

    cache = cache or LocalCache()

    # Build L1 cache key from everything that affects output
    key_parts = [
        "narrative_os.llm.v1",
        role,
        provider_name,
        model_id,
        system,
        cached_blocks or [],
        user_message,
        schema or {},
        cache_key_parts or [],
    ]
    key = make_cache_key(*key_parts)

    if use_cache:
        hit = cache.get(key)
        if hit is not None:
            return LLMResult(
                text=hit.get("text", ""),
                parsed=hit.get("parsed"),
                model_id=model_id,
                usage=hit.get("usage", {}),
                cache_hit=True,
                raw_response=None,
            )

    # L1 miss — call the provider
    request = LLMCall(
        model_id=model_id,
        system=system,
        user_message=user_message,
        cached_blocks=cached_blocks or [],
        schema=schema,
        max_output_tokens=max_output_tokens,
        temperature=temperature,
    )
    result = provider.call(request)

    if use_cache:
        cache.set(
            key,
            {
                "text": result.text,
                "parsed": result.parsed,
                "usage": result.usage,
                "model_id": result.model_id,
            },
            ttl_seconds=ttl_seconds,
        )

    return result
