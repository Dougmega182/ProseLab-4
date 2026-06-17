"""
narrative_os.prose_generator (v3) -- Minimal 3-node architecture:
Generator (Single Model) -> Critic (Grounded in Corpus) -> Tournament (Selection Pressure)
"""
from __future__ import annotations

import re
import sys
import hashlib
from pathlib import Path
from typing import Optional, List, Dict, Any

import json

from .retriever import retrieve, render_slice_for_prompt
from .store import get_by_namespace
from .llm.router import llm_call
from .project import get_project
from .dna import NovelDNA
from .prose_lint import lint_prose
from .contract_lint import lint_contract

MIN_GENERATED_PROSE_WORDS = 25

def _retrieval_chapter_num(chapter_num: int | float) -> int:
    return int(chapter_num)

SYSTEM_PROMPT = """\
You are an uncompromising literary fiction author. You write prose that earns every word
through physical friction, sensory anchors, and subtext. You refuse the
defaults of AI-generated prose. You show; you do not tell.
"""

PROMPT_TEMPLATE = """\
<voice_rules_from_canon>
{voice_rules}
</voice_rules_from_canon>

<section_22_contract>
{contract_rules}
</section_22_contract>

<canon_slice>
{canon_slice}
</canon_slice>

<scene_outline>
{scene_outline}
</scene_outline>

<task>
Write the scene described in <scene_outline> in the established voice
of "{project_name}." Honor every fact in <canon_slice>. Do not
contradict canon.

Before writing prose, you MUST open a <thinking> block:
1. Identify cliches to avoid.
2. State the scene's NEGATIVE SPACE.
3. Identify tropes and grounding.
4. Review against forbidden patterns.
Close </thinking>.

After thinking, open <prose_output> and write the scene. Plain prose only. Close </prose_output> when done.
</task>
"""

def extract_voice_rules(store_path: Optional[Path] = None) -> str:
    from .store import resolve_store_path
    path = resolve_store_path(store_path)
    craft = get_by_namespace("craft", path=path)
    lines = [f"- {e.id}: {e.value}" for e in craft]

    try:
        project = get_project()
        if project.dna.exists():
            dna = NovelDNA.load(project.dna)
            lines.append(f"\nVOICE CONSTRAINTS (Tone: {dna.tone}):")
            lines.append(f"- sentence_variance: {dna.prose_targets.sentence_variance}")
            lines.append(f"- metaphor_density: {dna.prose_targets.metaphor_density}")
            lines.append(f"- abstract_emotion: {dna.prose_targets.abstract_emotion}")
            lines.append(f"- sensory_grounding: {dna.prose_targets.sensory_grounding}")
            lines.append("\nFORBIDDEN PATTERNS: " + ", ".join(dna.forbidden_patterns))
            lines.append("\nAUTHOR INFLUENCES: " + ", ".join(dna.authors_influence))
    except RuntimeError:
        pass

    return "\n".join(lines)

def extract_contract_rules(contract_path: Optional[Path] = None) -> str:
    if not contract_path or not contract_path.exists():
        return "No explicit Section 22 contract provided."
    import json
    from .contracts import BookContract
    try:
        data = json.loads(contract_path.read_text(encoding="utf-8"))
        contract = BookContract.model_validate(data)
        lines = [
            f"- [{r.severity.upper()}] {r.guard_id}: {r.kind} — {r.text}"
            for r in contract.rules
        ]
        return "\n".join(lines)
    except Exception as e:
        return f"Error loading contract: {e}"

def _extract_tag(text: str, tag: str) -> str:
    match = re.search(rf"<{tag}>(.*?)</{tag}>", text, re.DOTALL)
    return match.group(1).strip() if match else ""

def _get_project_name() -> str:
    try:
        return get_project().root.name
    except RuntimeError:
        return "Quantum Shadows"

def generate_scene_variant(
    scene_outline: str,
    chapter_num: int | float = 1,
    store_path: Optional[Path] = None,
    contract_path: Optional[Path] = None,
    use_cache: bool = True,
    temperature: float = 0.7,
    repair_instructions: Optional[str] = None,
) -> dict:
    """Generate a single variant of a scene using T2_premium."""
    slice_ = retrieve(
        chapter_text=scene_outline,
        chapter_num=_retrieval_chapter_num(chapter_num),
        store_path=store_path,
        log_dir=None,
    )
    
    user_message = PROMPT_TEMPLATE.format(
        voice_rules=extract_voice_rules(store_path),
        contract_rules=extract_contract_rules(contract_path),
        canon_slice=render_slice_for_prompt(slice_),
        scene_outline=scene_outline,
        project_name=_get_project_name(),
    )

    if repair_instructions:
        user_message = (
            user_message
            + "\n\nREPAIR INSTRUCTION:\n"
            + repair_instructions
            + "\nReturn the rewritten scene only."
        )

    result = llm_call(
        role="prose_rewriting",
        system=SYSTEM_PROMPT,
        user_message=user_message,
        tier_override="T2_premium",
        use_cache=use_cache,
        max_output_tokens=4096,
        temperature=temperature,
        cache_key_parts=["generator.v3", scene_outline, chapter_num, temperature, hashlib.sha256(user_message.encode()).hexdigest()[:8]]
    )
    
    return {
        "thinking": _extract_tag(result.text, "thinking"),
        "prose": _extract_tag(result.text, "prose_output"),
        "raw": result.text,
        "slice_token_estimate": slice_.token_estimate,
    }

def generate_scene(
    scene_outline: str,
    chapter_num: int | float = 1,
    store_path: Optional[Path] = None,
    contract_path: Optional[Path] = None,
    use_cache: bool = True,
    temperature: float = 0.7,
) -> dict:
    """Compatibility wrapper for the legacy single-scene generation API."""
    return generate_scene_variant(
        scene_outline=scene_outline,
        chapter_num=chapter_num,
        store_path=store_path,
        contract_path=contract_path,
        use_cache=use_cache,
        temperature=temperature,
    )


def generate_scene_with_retry(
    scene_outline: str,
    chapter_num: int | float = 1,
    store_path: Optional[Path] = None,
    contract_path: Optional[Path] = None,
    use_cache: bool = True,
    max_retries: int = 3,
    verbose: bool = False,
    target_min_words: Optional[int] = None,
    target_max_words: Optional[int] = None,
    must_include_terms: Optional[list[str]] = None,
    forbidden_terms: Optional[list[str]] = None,
) -> dict:
    """Generate a scene and retry until the result passes lint and contract checks."""
    must_include_terms = must_include_terms or []
    forbidden_terms = forbidden_terms or []
    history = []
    last_result = None

    def _build_repair_instructions(lint_info: dict, contract_result, critic_findings) -> str:
        lines = ["Fix the following issues in the next draft:"]
        for name, match in lint_info.get("hard_violations", []):
            lines.append(f"- hard violation: {name} -> {match}")
        for name, count, cap in lint_info.get("cap_violations", []):
            lines.append(f"- soft cap violation: {name} ({count} > {cap})")
        for finding in contract_result.findings:
            lines.append(
                f"- CONTRACT {finding.severity.lower()} VIOLATION: {finding.guard_id} -> {finding.rationale}"
            )
        for finding in critic_findings:
            severity = finding.get("severity", "info")
            if severity == "hard_failure":
                lines.append(
                    "- SEMANTIC CRITIC HARD_FAILURE VIOLATION: "
                    f"{finding.get('rule_name', 'semantic_critic')} -> {finding.get('rationale', '')}"
                )
            else:
                lines.append(
                    f"- critic finding: {finding.get('rule_name', 'semantic_critic')} -> {finding.get('rationale', '')}"
                )
        return "\n".join(lines)

    def _lint_candidate(prose: str) -> dict:
        lint_result = lint_prose(prose)
        contract_result = lint_contract(prose, contract_path=contract_path, use_cache=use_cache)

        critic_findings = []
        try:
            critic_response = llm_call(
                role="prose_critic",
                system="You are a semantic prose critic. Return JSON with a findings array.",
                user_message=(
                    "Review the prose for forbidden, awkward, or non-literary phrasing. "
                    f"Return only JSON with a 'findings' array.\n\nPROSE:\n{prose}"
                ).format(prose=prose),
                tier_override="T3_fast",
                use_cache=use_cache,
                schema={
                    "type": "object",
                    "properties": {"findings": {"type": "array", "items": {"type": "object"}}},
                    "required": ["findings"],
                },
            )
            parsed = critic_response.parsed
            if parsed is None:
                parsed = json.loads(critic_response.text)
            critic_findings = list(parsed.get("findings", []) if isinstance(parsed, dict) else [])
        except Exception:
            critic_findings = []

        hard_violations = list(lint_result.hard_violations)
        cap_violations = list(lint_result.cap_violations)

        if target_min_words is not None and lint_result.word_count < target_min_words:
            cap_violations.append(("beat_word_budget_under", lint_result.word_count, target_min_words))
        if target_max_words is not None and lint_result.word_count > target_max_words:
            cap_violations.append(("beat_word_budget_over", lint_result.word_count, target_max_words))
        for term in must_include_terms:
            if term.lower() not in prose.lower():
                hard_violations.append(("missing_required_term", term))
        for term in forbidden_terms:
            if term.lower() in prose.lower():
                hard_violations.append(("contains_forbidden_term", term))

        report_lines = [lint_result.render()]
        if contract_result.findings:
            report_lines.append("")
            report_lines.append("CONTRACT FINDINGS:")
            for finding in contract_result.findings:
                report_lines.append(f"  - {finding.guard_id}: {finding.rationale}")
        if critic_findings:
            report_lines.append("")
            report_lines.append("CRITIC FINDINGS:")
            for finding in critic_findings:
                report_lines.append(f"  - {finding.get('rule_name', 'semantic_critic')}: {finding.get('rationale', '')}")

        passed = not hard_violations and not cap_violations and not contract_result.findings and not any(
            isinstance(item, dict) and item.get("severity") == "hard_failure" for item in critic_findings
        )

        return {
            "passed": passed,
            "hard_violations": hard_violations,
            "cap_violations": cap_violations,
            "contract_findings": [finding.model_dump() for finding in contract_result.findings],
            "critic_findings": critic_findings,
            "report": "\n".join(report_lines),
        }

    for attempt in range(1, max_retries + 1):
        repair_instructions = None
        if history:
            repair_instructions = _build_repair_instructions(
                history[-1]["lint"],
                lint_contract(history[-1]["prose"], contract_path=contract_path, use_cache=use_cache),
                history[-1]["lint"]["critic_findings"],
            )

        result = generate_scene_variant(
            scene_outline=scene_outline,
            chapter_num=chapter_num,
            store_path=store_path,
            contract_path=contract_path,
            use_cache=use_cache,
            repair_instructions=repair_instructions,
        )
        last_result = result

        lint_info = _lint_candidate(result["prose"])
        entry = {
            "attempt": attempt,
            "thinking": result.get("thinking", ""),
            "prose": result["prose"],
            "lint": lint_info,
        }
        history.append(entry)

        if verbose:
            print(f"[generate_scene_with_retry] attempt {attempt}: {'PASS' if lint_info['passed'] else 'RETRY'}")

        if lint_info["passed"]:
            return {
                "passed": True,
                "attempts": attempt,
                "prose": result["prose"],
                "thinking": result.get("thinking", ""),
                "history": history,
            }

    return {
        "passed": False,
        "attempts": len(history),
        "prose": last_result["prose"] if last_result else "",
        "thinking": last_result.get("thinking", "") if last_result else "",
        "history": history,
    }


def generate_elite_scene(
    scene_outline: str,
    chapter_num: int | float = 1,
    n_variants: int = 3,
    store_path: Optional[Path] = None,
    contract_path: Optional[Path] = None,
    use_cache: bool = True,
) -> dict:
    """
    GENERATE -> TOURNAMENT (Selection Pressure)
    Generates N variants and runs a blind grounded tournament to select the winner.
    """
    from .tournament import run_tournament
    
    print(f"Generating {n_variants} elite variants...")
    variants = []
    for i in range(n_variants):
        # Slightly different temperatures to force variance
        temp = 0.7 + (i * 0.1)
        variants.append(generate_scene_variant(
            scene_outline, chapter_num, store_path, contract_path, use_cache, temperature=temp
        ))
        
    metadata = "VOICE RULES:\n" + extract_voice_rules(store_path)
    
    print("Holding Grounded Tournament...")
    result = run_tournament(
        variants=variants,
        scene_outline=scene_outline,
        project_metadata=metadata,
        use_cache=use_cache
    )
    
    winner_idx = int(result.winner_id.split("_")[1])
    winner = variants[winner_idx]
    
    return {
        "thinking": winner["thinking"],
        "prose": winner["prose"],
        "raw": winner["raw"],
        "tournament": result.model_dump(),
        "variants": variants
    }
