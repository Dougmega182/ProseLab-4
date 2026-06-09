"""Scene-scale generation built on the beat-level prose generator."""

from __future__ import annotations

from pathlib import Path
from typing import Callable, Optional

from pydantic import BaseModel, Field, model_validator

from .contract_lint import ContractLintResult, lint_contract
from .prose_lint import LintResult, lint_prose
from .voice_linter import lint_voice, VoiceScoreResult
from .failures import FailureType, NarrativeFailure


class Beat(BaseModel):
    """One generation unit inside a scene."""

    label: str = Field(..., min_length=1)
    outline: str = Field(..., min_length=1)
    required_facts: list[str] = Field(default_factory=list)
    pov_constraints: list[str] = Field(default_factory=list)
    must_include_terms: list[str] = Field(default_factory=list)
    forbidden_terms: list[str] = Field(default_factory=list)
    target_min_words: int | None = None
    target_max_words: int | None = None


class ScenePlan(BaseModel):
    """A scene outline made of ordered beats."""

    title: str = Field(..., min_length=1)
    chapter: int | float
    pov: str = Field(..., min_length=1)
    location: str = Field(..., min_length=1)
    beats: list[Beat]
    global_constraints: list[str] = Field(default_factory=list)
    forbidden_terms: list[str] = Field(default_factory=list)
    target_min_words: int | None = None
    target_max_words: int | None = None

    @model_validator(mode="after")
    def _beat_count_in_scene_range(self) -> "ScenePlan":
        if not 3 <= len(self.beats) <= 8:
            raise ValueError("ScenePlan requires 3-8 beats.")
        return self


class BeatDraft(BaseModel):
    beat: Beat
    thinking: str
    prose: str
    passed: bool
    attempts: int
    lint_report: str


class SceneDraft(BaseModel):
    plan: ScenePlan
    beat_drafts: list[BeatDraft]
    prose: str
    passed: bool
    lint_report: str
    contract_lint: ContractLintResult | None = None
    scene_findings: list[str] = Field(default_factory=list)


GeneratorFn = Callable[..., dict]
StitchFn = Callable[[ScenePlan, list[BeatDraft]], str]


def render_beat_outline(
    plan: ScenePlan,
    beat: Beat,
    beat_index: int,
    previous_prose: Optional[str] = None,
) -> str:
    """Render one beat with enough scene context for the beat generator."""
    lines = [
        f"Scene: {plan.title}",
        f"Location: {plan.location}",
        f"POV: {plan.pov}",
        f"Beat {beat_index}: {beat.label}",
        "",
        beat.outline,
    ]
    if previous_prose:
        lines.extend([
            "",
            "Prose from the immediately preceding beat (for continuity and flow reference):",
            "<previous_beat_prose>",
            previous_prose,
            "</previous_beat_prose>",
        ])
    if plan.global_constraints:
        lines.extend(["", "Scene constraints:"])
        lines.extend(f"- {item}" for item in plan.global_constraints)
    if beat.required_facts:
        lines.extend(["", "Required facts for this beat:"])
        lines.extend(f"- {item}" for item in beat.required_facts)
    if beat.pov_constraints:
        lines.extend(["", "POV constraints for this beat:"])
        lines.extend(f"- {item}" for item in beat.pov_constraints)
    
    lines.extend([
        "",
        "CRITICAL DIRECTIVE FOR THIS TASK:",
        f"You are generating ONLY the prose for Beat {beat_index}: '{beat.label}'.",
        "Do NOT write, draft, or outline any other beats in the scene.",
    ])
    if beat.target_min_words is not None and beat.target_max_words is not None:
        lines.append(f"Target word count for this beat: {beat.target_min_words}-{beat.target_max_words} words.")
        
    return "\n".join(lines)


def default_stitch_scene(plan: ScenePlan, beat_drafts: list[BeatDraft]) -> str:
    """Conservative stitch pass: preserve generated beat prose verbatim."""
    del plan
    return "\n\n".join(draft.prose.strip() for draft in beat_drafts if draft.prose.strip())


def _scene_findings(plan: ScenePlan, beat_drafts: list[BeatDraft], prose: str) -> list[str]:
    findings: list[str] = []
    word_count = len(prose.split())
    if plan.target_min_words is not None and word_count < plan.target_min_words:
        findings.append(f"Scene is under target length: {word_count} < {plan.target_min_words} words.")
    if plan.target_max_words is not None and word_count > plan.target_max_words:
        findings.append(f"Scene is over target length: {word_count} > {plan.target_max_words} words.")
    lower_prose = prose.lower()
    for term in plan.forbidden_terms:
        if term.lower() in lower_prose:
            findings.append(f"Scene contains forbidden term/span: {term}")
    for draft in beat_drafts:
        if not draft.prose.strip():
            findings.append(f"Beat '{draft.beat.label}' produced no prose.")
        beat_word_count = len(draft.prose.split())
        if draft.beat.target_min_words is not None and beat_word_count < draft.beat.target_min_words:
            findings.append(
                f"Beat '{draft.beat.label}' is under target length: "
                f"{beat_word_count} < {draft.beat.target_min_words} words."
            )
        if draft.beat.target_max_words is not None and beat_word_count > draft.beat.target_max_words:
            findings.append(
                f"Beat '{draft.beat.label}' is over target length: "
                f"{beat_word_count} > {draft.beat.target_max_words} words."
            )
        lower = draft.prose.lower()
        for term in draft.beat.must_include_terms:
            if term.lower() not in lower:
                findings.append(f"Beat '{draft.beat.label}' missing required term: {term}")
        for term in draft.beat.forbidden_terms:
            if term.lower() in lower:
                findings.append(f"Beat '{draft.beat.label}' contains forbidden term/span: {term}")
    return findings


def generate_scene_draft(
    plan: ScenePlan,
    *,
    store_path: Optional[Path] = None,
    contract_path: Optional[Path] = None,
    generator_fn: GeneratorFn | None = None,
    stitch_fn: StitchFn = default_stitch_scene,
    max_retries: int = 5,
    use_cache: bool = True,
    verbose: bool = True,
) -> SceneDraft:
    """Generate every beat in a scene, stitch, and run final lint checks."""
    if generator_fn is None:
        from .prose_generator import generate_scene_with_retry

        generator_fn = generate_scene_with_retry

    beat_drafts: list[BeatDraft] = []
    import inspect
    for index, beat in enumerate(plan.beats, start=1):
        previous_prose = beat_drafts[-1].prose if beat_drafts else None
        kwargs = {
            "scene_outline": render_beat_outline(plan, beat, index, previous_prose=previous_prose),
            "chapter_num": plan.chapter,
            "store_path": store_path,
            "contract_path": contract_path,
            "max_retries": max_retries,
            "use_cache": use_cache,
            "verbose": verbose,
        }
        sig = inspect.signature(generator_fn)
        has_var_keyword = any(p.kind == p.VAR_KEYWORD for p in sig.parameters.values())
        if has_var_keyword or "target_min_words" in sig.parameters:
            kwargs["target_min_words"] = beat.target_min_words
        if has_var_keyword or "target_max_words" in sig.parameters:
            kwargs["target_max_words"] = beat.target_max_words
        if has_var_keyword or "must_include_terms" in sig.parameters:
            kwargs["must_include_terms"] = beat.must_include_terms
        if has_var_keyword or "forbidden_terms" in sig.parameters:
            kwargs["forbidden_terms"] = list(set(beat.forbidden_terms + plan.forbidden_terms))

        result = generator_fn(**kwargs)
        beat_drafts.append(
            BeatDraft(
                beat=beat,
                thinking=result.get("thinking", ""),
                prose=result.get("prose", ""),
                passed=bool(result.get("passed", False)),
                attempts=int(result.get("attempts", 1)),
                lint_report=result.get("lint_report", ""),
            )
        )

    prose = stitch_fn(plan, beat_drafts)
    
    voice_lint = lint_voice(prose, use_cache=use_cache)
    if not voice_lint.passed:
        raise NarrativeFailure(
            FailureType.VOICE_FAILURE,
            f"Scene failed voice consistency check (Score Version: {voice_lint.score_version}). Failed Metrics: {', '.join(voice_lint.failed_metrics)}.",
            payload=voice_lint.model_dump()
        )
        
    final_lint = lint_prose(prose)
    contract_lint = (
        lint_contract(prose, contract_path=contract_path, use_cache=use_cache)
        if contract_path
        else None
    )
    scene_findings = _scene_findings(plan, beat_drafts, prose)
    passed = (
        all(draft.passed for draft in beat_drafts)
        and final_lint.passed
        and (contract_lint.passed if contract_lint else True)
        and not scene_findings
    )
    lint_report = final_lint.render()
    if contract_lint:
        lint_report = f"{lint_report}\n\n{contract_lint.render()}"
    if scene_findings:
        lint_report = f"{lint_report}\n\nSCENE FINDINGS:\n" + "\n".join(
            f"  - {finding}" for finding in scene_findings
        )

    return SceneDraft(
        plan=plan,
        beat_drafts=beat_drafts,
        prose=prose,
        passed=passed,
        lint_report=lint_report,
        contract_lint=contract_lint,
        scene_findings=scene_findings,
    )
