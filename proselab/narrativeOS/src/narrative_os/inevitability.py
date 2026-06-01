"""
Inevitability Engine -- Logical Extrapolation, Character Axiom Continuity, and Thematic Pressure.

Performs deep semantic continuity audits on chapter texts against active canon store axioms.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from narrative_os.schemas import CanonEntry, Conflict
from narrative_os.llm.router import llm_call


SYSTEM_PROMPT = """\
You are the Adversarial Inevitability Critic for the dark-noir novel "Quantum Shadows."
Your role is to perform a rigorous semantic and logical audit of the provided chapter text against the active story axioms.
Axioms represent established physical/magical laws of the world (world namespace), character traits and limitations (character namespace), and core thematic/plot invariants (plot or craft namespace).

Your goal is to detect three kinds of high-level continuity violations:
1. LOGICAL EXTRAPOLATION VIOLATIONS: The chapter text directly breaks or contradicts a physical, magical, or mechanical rule of the world (e.g., someone performing an impossible transition, violating Bleed rules, or ignoring established scientific mechanics).
2. CHARACTER AXIOM VIOLATIONS: Characters acting or speaking in a way that violates their established traits, psychological invariants, or physical limitations (e.g., a character displaying high fine-motor control despite severe calcification, behaving out of character, or ignoring deep psychological traumas without operational motivation).
3. THEMATIC DRIFT / PRESSURE DISAPPEARANCE: Established narrative themes or structural pressures suddenly disappearing, being completely ignored, or resetting in a way that breaks story inevitability.

You must be clinical, precise, and adversarial. Do not flag trivial stylistic preferences. Only flag genuine semantic contradictions, logical loopholes, and character drift.
"""

AXIOM_AUDIT_SCHEMA = {
    "type": "object",
    "properties": {
        "violations": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "axiom_id": {
                        "type": "string",
                        "description": "The exact ID of the violated active axiom, e.g. 'world.fade_mechanics' or 'hayden.calcification'."
                    },
                    "severity": {
                        "type": "string",
                        "enum": ["HIGH", "MEDIUM"],
                        "description": "HIGH for direct physical/magical law breaking or complete character behavioral reversal. MEDIUM for major drift or timeline anomalies."
                    },
                    "type": {
                        "type": "string",
                        "enum": ["CANON_VIOLATION", "CHARACTER_STATE", "TIMELINE"],
                        "description": "CANON_VIOLATION for world rule breaches, CHARACTER_STATE for character trait/limitation violations, TIMELINE for temporal anomalies."
                    },
                    "incoming_value": {
                        "type": "string",
                        "description": "A concise description of the scene/event in the chapter text that violates the axiom."
                    },
                    "note": {
                        "type": "string",
                        "description": "A detailed, clinical explanation of how and why the text contradicts the axiom."
                    }
                },
                "required": ["axiom_id", "severity", "type", "incoming_value", "note"]
            }
        }
    },
    "required": ["violations"]
}


def detect_inevitability_conflicts(
    *,
    chapter_num: float | int,
    chapter_text: str,
    store_entries: list[CanonEntry],
    use_cache: bool = True,
) -> list[Conflict]:
    """
    Compare a chapter's full text against active canon store axioms.
    Returns a list of Conflict objects for any logical, character, or thematic violations found.
    """
    # 1. Filter store entries to active, relevant axioms
    active_axioms = [e for e in store_entries if e.is_active()]
    if not active_axioms:
        return []

    # 2. Format active axioms as readable text block
    axiom_lines = []
    for e in active_axioms:
        entity_str = f" ({e.entity})" if e.entity else ""
        axiom_lines.append(
            f"- ID: {e.id}{entity_str}\n"
            f"  Confidence: {e.confidence}\n"
            f"  Established in Chapter: {e.source_chapter}\n"
            f"  Description: {e.value}\n"
        )
    axioms_text = "\n".join(axiom_lines)

    # 3. Construct prompt
    user_message = (
        f"<active_axioms>\n{axioms_text}\n</active_axioms>\n\n"
        f"<chapter_context>\nChapter Number: {chapter_num}\n</chapter_context>\n\n"
        f"<chapter_text>\n{chapter_text}\n</chapter_text>\n\n"
        f"Perform the continuity and inevitability audit. Identify any logical, character, or thematic violations."
    )

    # 4. Call LLM Router
    # Using 'continuity_extractor' role to ensure routing to Opus via Galaxy proxy
    result = llm_call(
        role="continuity_extractor",
        system=SYSTEM_PROMPT,
        user_message=user_message,
        cached_blocks=[],
        schema=AXIOM_AUDIT_SCHEMA,
        cache_key_parts=["inevitability_engine.v1", chapter_num, hash(chapter_text)],
        use_cache=use_cache,
        max_output_tokens=4096,
    )

    parsed = result.parsed
    if not parsed or "violations" not in parsed:
        return []

    # 5. Map violations to Conflict objects
    conflicts = []
    axiom_map = {e.id: e for e in active_axioms}

    for v in parsed["violations"]:
        axiom_id = v["axiom_id"]
        existing = axiom_map.get(axiom_id)
        if not existing:
            possible_matches = [e for e in active_axioms if e.id.lower().strip() == axiom_id.lower().strip()]
            if possible_matches:
                existing = possible_matches[0]
            else:
                existing = CanonEntry(
                    id=axiom_id,
                    namespace="world" if "world" in axiom_id else "character",
                    value="(Active axiom not retrieved directly, ID generated by critic)",
                    confidence="hard_canon",
                    source_chapter=0,
                    extracted_at_pass="fallback",
                )

        conflicts.append(
            Conflict(
                severity=v["severity"],
                type=v["type"],
                existing_entry_id=existing.id,
                existing_value=existing.value,
                existing_source=existing.source_chapter,
                incoming_value=v["incoming_value"],
                incoming_source=int(chapter_num) if chapter_num == int(chapter_num) else int(chapter_num),
                suggested_action="block" if v["severity"] == "HIGH" else "flag",
                note=v["note"],
            )
        )

    return conflicts
