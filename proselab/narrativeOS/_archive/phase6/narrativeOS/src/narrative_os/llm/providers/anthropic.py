"""
Anthropic provider — Claude Opus 4.7 via the Galaxy/Magica proxy.

The Galaxy proxy exposes an Anthropic-compatible endpoint; we use the
official `anthropic` SDK with a custom base_url. API key is read from env.

Environment variables:
    GALAXY_API_KEY    — proxy key (preferred)
    ANTHROPIC_API_KEY — direct Anthropic key (fallback)
    GALAXY_BASE_URL   — proxy base URL; default https://api.galaxy.ai/anthropic
    ANTHROPIC_BASE_URL — override fully (skips Galaxy)

The provider uses Anthropic's prompt caching via `cache_control` markers
on stable content blocks (system prompt + manuscript + schema instructions).
The per-call user message is NOT cached.
"""

from __future__ import annotations

import json
import os
from typing import Any, Optional

from .base import (
    LLMCall,
    LLMProvider,
    LLMResult,
    ProviderAPIError,
    ProviderNotConfigured,
)


DEFAULT_GALAXY_BASE_URL = "https://api.galaxy.ai/anthropic"
DEFAULT_ANTHROPIC_BASE_URL = "https://api.anthropic.com"


class AnthropicProvider(LLMProvider):
    """Calls Claude via the Galaxy proxy (or direct Anthropic if configured)."""

    name = "anthropic"

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout_seconds: float = 120.0,
    ):
        self.api_key = (
            api_key
            or os.environ.get("GALAXY_API_KEY")
            or os.environ.get("ANTHROPIC_API_KEY")
        )
        self.base_url = (
            base_url
            or os.environ.get("ANTHROPIC_BASE_URL")
            or os.environ.get("GALAXY_BASE_URL")
            or DEFAULT_GALAXY_BASE_URL
        )
        self.timeout_seconds = timeout_seconds
        self._client = None   # lazy-init so import works without SDK installed

    def supports_prompt_caching(self) -> bool:
        return True

    # ------------------------------------------------------------------

    def _get_client(self):
        if self._client is not None:
            return self._client
        if not self.api_key:
            raise ProviderNotConfigured(
                "AnthropicProvider needs an API key. Set GALAXY_API_KEY "
                "or ANTHROPIC_API_KEY in your environment."
            )
        try:
            import anthropic   # type: ignore
        except ImportError as e:
            raise ProviderNotConfigured(
                "anthropic SDK not installed. Run: pip install anthropic"
            ) from e
        self._client = anthropic.Anthropic(
            api_key=self.api_key,
            base_url=self.base_url,
            timeout=self.timeout_seconds,
        )
        return self._client

    # ------------------------------------------------------------------

    def call(self, request: LLMCall) -> LLMResult:
        """
        Build a Claude messages.create call with prompt caching.

        Caching strategy:
            - system: list of content blocks, last 2 marked cache_control
              (Anthropic allows up to 4 cache breakpoints).
            - The cached_blocks become part of the system content.
            - The user_message is the only block NOT marked for caching.
        """
        client = self._get_client()

        # Build system content as a list of blocks. Anthropic accepts:
        #   system=[{"type": "text", "text": "...", "cache_control": {...}}]
        system_blocks: list[dict] = [
            {"type": "text", "text": request.system}
        ]
        # Each cached_block becomes its own text block; mark the LAST one
        # with cache_control to checkpoint the entire stable prefix.
        for i, block in enumerate(request.cached_blocks):
            entry: dict[str, Any] = {"type": "text", "text": block}
            # Mark the final stable block for caching
            if i == len(request.cached_blocks) - 1:
                entry["cache_control"] = {"type": "ephemeral"}
            system_blocks.append(entry)

        # Compose user message; include schema directive if provided
        user_text = request.user_message
        if request.schema is not None:
            schema_str = json.dumps(request.schema, indent=2)
            user_text = (
                f"{user_text}\n\n"
                f"Return ONLY a JSON object matching this schema. "
                f"No prose, no markdown fences:\n```json\n{schema_str}\n```"
            )

        try:
            response = client.messages.create(
                model=request.model_id,
                max_tokens=request.max_output_tokens,
                temperature=request.temperature,
                system=system_blocks,
                messages=[{"role": "user", "content": user_text}],
            )
        except Exception as e:
            raise ProviderAPIError(f"Anthropic API call failed: {e}") from e

        text = _extract_text(response)
        parsed = _try_parse_json(text) if request.schema is not None else None

        usage_dict = _extract_usage(response)
        cache_hit = usage_dict.get("cache_read_input_tokens", 0) > 0

        return LLMResult(
            text=text,
            parsed=parsed,
            model_id=request.model_id,
            usage=usage_dict,
            cache_hit=cache_hit,
            raw_response=_safe_response_dump(response),
        )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _extract_text(response: Any) -> str:
    """Pull text from a Claude Messages response."""
    content = getattr(response, "content", None)
    if content is None:
        return ""
    parts: list[str] = []
    for block in content:
        block_type = getattr(block, "type", None)
        if block_type == "text":
            parts.append(getattr(block, "text", "") or "")
    return "".join(parts).strip()


def _extract_usage(response: Any) -> dict[str, int]:
    usage = getattr(response, "usage", None)
    if usage is None:
        return {}
    out: dict[str, int] = {}
    for field_name in (
        "input_tokens",
        "output_tokens",
        "cache_creation_input_tokens",
        "cache_read_input_tokens",
    ):
        val = getattr(usage, field_name, None)
        if val is not None:
            out[field_name] = val
    return out


def _try_parse_json(text: str) -> Optional[Any]:
    """
    Try to parse the model's text output as JSON.

    Handles common model affordances:
        - Whole text is JSON
        - JSON wrapped in ```json fences
        - JSON object embedded somewhere in the text
    """
    cleaned = text.strip()
    if cleaned.startswith("```"):
        # Strip a single fenced code block
        lines = cleaned.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()

    # First try whole-text parse
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Fallback: find first { and matching } via brace-counting
    start = cleaned.find("{")
    if start == -1:
        return None
    depth = 0
    for i in range(start, len(cleaned)):
        c = cleaned[i]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(cleaned[start : i + 1])
                except json.JSONDecodeError:
                    return None
    return None


def _safe_response_dump(response: Any) -> Optional[dict]:
    """Best-effort serialization of the raw response for logging."""
    try:
        if hasattr(response, "model_dump"):
            return response.model_dump()
        if hasattr(response, "to_dict"):
            return response.to_dict()
    except Exception:
        return None
    return None
