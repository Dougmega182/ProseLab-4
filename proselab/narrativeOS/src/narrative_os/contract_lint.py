"""Contract linting for Section 22 prose-surface rules."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Callable

from pydantic import BaseModel, Field

from .contracts import BookContract, ContractRule

CANONICAL_GUARD_IDS = {
    "never misattribute the ics readings to kain": "s22.guard.no_kain_ics_misattribution",
    "never narrate the attribution as wrong": "s22.guard.no_aspect_identity_reveal",
    "never narrate a concrete physical interaction that proves solis is human flesh": "s22.guard.no_solis_physical_interaction",
    "never confirm to chen's pov that he is a replacement": "s22.guard.no_chen_replacement_confirmation",
    "never explicitly state the qsa records on varn are falsified": "s22.guard.no_explicit_varn_timeline_falsification",
    "never have the narrative voice explicitly merge the laughing woman": "s22.guard.no_explicit_laughing_woman_merge",
    "never reveal hayden's ultimate objective before the culmination": "s22.guard.no_early_hayden_objective_reveal",
}


class ContractFinding(BaseModel):
    guard_id: str
    severity: str
    span: str = Field(..., min_length=1)
    rationale: str = Field(..., min_length=1)


class ContractLintResult(BaseModel):
    findings: list[ContractFinding] = Field(default_factory=list)

    @property
    def passed(self) -> bool:
        return not any(f.severity == "hard" for f in self.findings)

    def render(self) -> str:
        if not self.findings:
            return "CONTRACT LINT: pass"
        lines = [f"CONTRACT LINT FINDINGS ({len(self.findings)}):"]
        for finding in self.findings:
            lines.append(f"  - [{finding.severity}] {finding.guard_id}")
            lines.append(f"    Span: {finding.span}")
            lines.append(f"    Rationale: {finding.rationale}")
        return "\n".join(lines)


def load_contract(path: Path | str) -> BookContract:
    return BookContract.model_validate_json(Path(path).read_text(encoding="utf-8"))


def render_contract_for_prompt(contract: BookContract) -> str:
    lines = [
        f"# {contract.project} {contract.book} Prose Contract",
        "",
        "## Hard Guards",
    ]
    for rule in contract.hard_rules():
        ref = f" ({rule.section_ref})" if rule.section_ref else ""
        lines.append(f"- {rule.guard_id}: {rule.text}{ref}")
    lines.append("")
    lines.append("## Permitted Signals")
    for rule in contract.soft_rules():
        ref = f" ({rule.section_ref})" if rule.section_ref else ""
        lines.append(f"- {rule.guard_id}: {rule.text}{ref}")
    return "\n".join(lines)


def _find(pattern: str, prose: str) -> str | None:
    match = re.search(pattern, prose, re.IGNORECASE | re.DOTALL)
    return match.group(0).strip() if match else None


def _rule_check(rule: ContractRule, prose: str) -> ContractFinding | None:
    text = rule.text.lower()
    guard_id = rule.guard_id
    for marker, canonical_id in CANONICAL_GUARD_IDS.items():
        if marker in text:
            guard_id = canonical_id
            break

    checks: list[tuple[str, str]] = []
    if "misattribute the ics readings to kain" in text:
        checks = [
            (r"\bBell\s+discovers\s+Kain'?s\s+ICS\b", "Bell discovery is attributed to Kain instead of Hayden."),
            (r"\bKain'?s\s+ICS\s+(data|reading|readings|number|score)\b", "ICS readings are attributed to Kain."),
        ]
    elif "qsa records on varn are falsified" in text:
        checks = [
            (r"\bQSA\s+records?\s+(were|are)\s+falsified\b", "Varn record falsification is stated outright."),
            (r"\bVarn'?s\s+.*records?\s+(were|are)\s+falsified\b", "Varn record falsification is stated outright."),
        ]
    elif "chen's pov" in text and "replacement" in text:
        checks = [
            (r"\bI\s+(am|was)\s+(the\s+)?replacement\b", "Chen POV directly confirms replacement status."),
            (r"\bChen\s+knew\s+he\s+was\s+(the\s+)?replacement\b", "Narration directly confirms Chen's self-knowledge."),
        ]
    elif "solis is human flesh" in text:
        checks = [
            (r"\bSolis\s+was\s+(human|alive|flesh\s+and\s+blood)\b", "Solis is concretely proven human/alive."),
            (r"\bSolis'?s\s+(pulse|heartbeat|blood|skin)\b", "Concrete flesh evidence is assigned to Solis."),
        ]
    elif "laughing woman and hayden's memory" in text:
        checks = [
            (r"\bthe\s+laughing\s+woman\s+was\s+Hayden'?s\s+memory\b", "Narration explicitly merges the laughing woman with Hayden's memory."),
        ]
    elif "hayden's ultimate objective" in text:
        checks = [
            (r"\bHayden'?s\s+ultimate\s+objective\s+(was|is)\b", "Hayden's ultimate objective is revealed directly."),
        ]
    elif "attribution as wrong" in text:
        checks = [
            (r"\bAspect\s+was\s+not\s+(a\s+)?title\b", "Aspect attribution is narrated as wrong."),
            (r"\bAspect\s+was\s+Alain\s+Aspect\b", "Aspect identity is stated directly in prose."),
        ]
    elif "n.k." in text:
        checks = [
            (r"\bN\.K\.\s+(meant|means|stood\s+for|stands\s+for)\b", "A character/speculative line explains N.K."),
        ]
    elif "ics 32" in text and "hand-restoration" in text:
        checks = [
            (r"\bICS\s+32\b.*\b(impossible|irreversible|no\s+restoration|cannot\s+be\s+restored)\b", "ICS 32 is framed as foreclosing restoration."),
        ]

    for pattern, rationale in checks:
        span = _find(pattern, prose)
        if span:
            return ContractFinding(
                guard_id=guard_id,
                severity=rule.severity,
                span=span,
                rationale=rationale,
            )
    return None


def lint_contract(
    prose: str,
    *,
    contract: BookContract | None = None,
    contract_path: Path | str | None = None,
    llm_linter: Callable[[str, BookContract], ContractLintResult] | None = None,
    use_cache: bool = True,
) -> ContractLintResult:
    """
    Lint prose against a parsed Section 22 contract.

    `use_cache` is accepted for API compatibility with future LLM-backed
    linting. The deterministic baseline does not use it.
    """
    del use_cache
    if contract is None:
        if contract_path is None:
            return ContractLintResult()
        contract = load_contract(contract_path)

    findings = [
        finding
        for rule in contract.rules
        if (finding := _rule_check(rule, prose)) is not None
    ]

    if llm_linter is not None:
        findings.extend(llm_linter(prose, contract).findings)

    return ContractLintResult(findings=findings)
