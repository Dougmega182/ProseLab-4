"""
Tier and role → model mappings.

The ONLY file in the codebase that knows model names.
When models change (and they will), update here. The pipeline doesn't change.

Tier conventions:
    T1_default    cost-conscious workhorse for routine extraction
    T2_premium    best literary nuance for high-stakes / spot-check passes
    T3_fast       cheap fast for mass dry-runs and iteration
    T4_reasoning  heavy reasoning for plot-logic / contradiction passes

Picks below are dated May 2026 — REVIEW BEFORE PRODUCTION USE.
"""

from __future__ import annotations

from typing import Literal

Tier = Literal["T1_default", "T2_premium", "T3_fast", "T4_reasoning"]
Role = Literal[
    "continuity_extractor",
    "world_logic_check",
    "plot_structure_audit",
    "character_psychology",
    "prose_rewriting",
    "fast_iteration",
    "continuity_timeline",
]


# provider:model_id strings. The router parses on the colon.
TIERS: dict[str, str] = {
    "T1_default":   "google:gemini-3-pro",
    "T2_premium":   "anthropic:claude-opus-4-7",
    "T3_fast":      "google:gemini-3-flash",
    "T4_reasoning": "openai:gpt-5.5-thinking",
}


# Default tier per role. Overridable per-call.
ROLE_TIERS: dict[str, str] = {
    "continuity_extractor":  "T2_premium",   # ← Opus 4.7 via Galaxy proxy
    "world_logic_check":     "T4_reasoning",
    "plot_structure_audit":  "T4_reasoning",
    "character_psychology":  "T2_premium",
    "prose_rewriting":       "T2_premium",
    "fast_iteration":        "T3_fast",
    "continuity_timeline":   "T4_reasoning",
}


def resolve_model(role: str, tier_override: str | None = None) -> tuple[str, str]:
    """
    Given a role (and optional tier override), return (provider, model_id).

    Example:
        >>> resolve_model("continuity_extractor")
        ("anthropic", "claude-opus-4-7")
    """
    tier = tier_override or ROLE_TIERS.get(role)
    if tier is None:
        raise ValueError(f"Unknown role: {role!r}")
    spec = TIERS.get(tier)
    if spec is None:
        raise ValueError(f"Unknown tier: {tier!r}")
    if ":" not in spec:
        raise ValueError(f"Malformed tier spec (missing ':'): {spec!r}")
    provider, model_id = spec.split(":", 1)
    return provider, model_id
