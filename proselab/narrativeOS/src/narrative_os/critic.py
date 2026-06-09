"""
narrative_os.critic -- Semantic / Adversarial Critic for Prose Lab V2.
Evaluates generated prose against the Semantic Critic Rubric using Gemini.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional
from pydantic import BaseModel, Field

from .llm.router import llm_call


class CriticFinding(BaseModel):
    rule_name: str = Field(..., description="The name of the rule violated.")
    severity: str = Field(..., description="'warning' or 'hard_failure'.")
    span: str = Field(..., description="The exact offending text from the prose.")
    rationale: str = Field(..., description="Detailed explanation of the violation.")


class CriticResult(BaseModel):
    findings: list[CriticFinding] = Field(default_factory=list)

    @property
    def passed(self) -> bool:
        return not any(f.severity == "hard_failure" for f in self.findings)

    def render(self) -> str:
        if not self.findings:
            return "SEMANTIC CRITIC: pass"
        lines = [f"SEMANTIC CRITIC FINDINGS ({len(self.findings)}):"]
        for f in self.findings:
            lines.append(f"  - [{f.severity}] {f.rule_name}")
            lines.append(f"    Span: {f.span}")
            lines.append(f"    Rationale: {f.rationale}")
        return "\n".join(lines)


SEMANTIC_CRITIC_SYSTEM_PROMPT = """\
You are an adversarial literary editor reviewing prose for the novel "Quantum Shadows."
Your job is to identify violations of the Semantic Critic Rubric. You must be strict and uncompromising.

Here is the Semantic Critic Rubric:

1. **Awkward/Mechanical Similes**: Banish similes that describe human posture, motion, or emotion in mechanical or cybernetic terms unless the character is literally cybernetic/denervated (e.g. "his arm bent at a 90-degree angle, like a pipe").
2. **Pacing Stalls**: Avoid spending multiple paragraphs on spatial analysis or object descriptions before characters interact, move, or take action.
3. **Clinical Observation vs. Final Explanation**: Keep observations objective and proprioceptive. Do not allow clinical descriptions of bodily states to culminate in tidy emotional summaries (e.g., describing a tremor and then concluding "He was nervous"). The prose must show the reaction and let the reader feel the emotion.
4. **Anaphora chains (Max 2 sentences)**: Repeating the same starting word across three or more consecutive sentences.
5. **Rule of three (Max 2 per scene)**: Avoid lists of three items or clauses (e.g., "A, B, and C") unless used deliberately for environmental listing (e.g., "Three sodium lights. One dead, one cycling, one steady").
6. **"As if" similes (Max 2 per scene)**: Overuse of comparative "as if" constructions.
7. **Underwriting-by-absence (Max 1 per scene)**: Narrating what is not felt or present (e.g., "he did not feel...", "it wasn't that he...").
8. **Colon-into-fragment stacking**: Avoid listing qualities or descriptors after a colon in fragment form (e.g., "He was the perfect spy: quiet, unassuming, deadly").

Evaluate the prose and return a JSON object with a list of findings.
For each finding, specify:
- `rule_name`: one of "awkward_simile", "pacing_stall", "clinical_explanation_leak", "anaphora_chain", "rule_of_three", "as_if_simile", "underwriting_absence", "colon_fragment_stacking".
- `severity`: "hard_failure" for explicit rule breaches, "warning" for stylistic guidance.
  - Note: awkward similes, pacing stalls, and clinical explanation leaks should always be "warning" unless egregious.
  - Anaphora chain >= 3 consecutive sentences is a "hard_failure".
  - Rule of three > 2 occurrences is a "hard_failure".
  - "As if" simile > 2 occurrences is a "hard_failure".
  - Underwriting-by-absence > 1 occurrence is a "hard_failure".
- `span`: the exact text span from the prose that contains the violation.
- `rationale`: a clear explanation of why this span violates the rubric.
"""

CRITIC_SCHEMA = {
    "type": "object",
    "properties": {
        "findings": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "rule_name": {"type": "string"},
                    "severity": {"type": "string", "enum": ["warning", "hard_failure"]},
                    "span": {"type": "string"},
                    "rationale": {"type": "string"}
                },
                "required": ["rule_name", "severity", "span", "rationale"]
            }
        }
    },
    "required": ["findings"]
}


def call_semantic_critic(prose: str, use_cache: bool = True) -> CriticResult:
    """
    Calls the Gemini/google T1_default model to review prose against the semantic rubric.
    """
    result = llm_call(
        role="prose_critic",
        system=SEMANTIC_CRITIC_SYSTEM_PROMPT,
        user_message=f"<prose_to_review>\n{prose}\n</prose_to_review>",
        schema=CRITIC_SCHEMA,
        tier_override="T1_default",
        use_cache=use_cache,
        max_output_tokens=2048,
        temperature=0.1,
    )

    if result.parsed:
        try:
            findings = [
                CriticFinding(**f) for f in result.parsed.get("findings", [])
            ]
            return CriticResult(findings=findings)
        except Exception:
            pass
    return CriticResult()
