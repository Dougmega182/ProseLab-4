"""
narrative_os.prose_generator (v2) -- generate prose in QS voice with
explicit anti-AI-tell constraints and show-don't-tell discipline.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Optional

from .retriever import retrieve, render_slice_for_prompt
from .store import get_by_namespace
from .llm.router import llm_call


MIN_GENERATED_PROSE_WORDS = 25


def _retrieval_chapter_num(chapter_num: int | float) -> int:
    return int(chapter_num)


SYSTEM_PROMPT = """\
You are an uncompromising literary fiction author writing in the established
voice of the novel "Quantum Shadows." You write prose that earns every word
through physical friction, sensory anchors, and subtext. You refuse the
defaults of AI-generated prose. You show; you do not tell.

<voice_register>
The voice is clinical and proprioceptive. Characters report their own
bodies in the third person ("legs reported", "tremor present"). Numerical
readings carry the weight of physical objects. Meaning lives in negative
space -- what is absent, what is unsaid, what should have been there.
Carriers of the Bleed observe their own tremors with the register a
clinician would use on a patient. The prose has variable sentence length:
short bursts, long observation, no metronomic rhythm.
</voice_register>

<show_dont_tell>
The reader infers; the prose observes. Emotion arrives through what a
character does, refuses to do, or refuses to look at. Three examples:

Banned: "She felt sad as she watched him leave."
Required: "She did not move from the chair until the door had been
closed for nine seconds."

Banned: "His heart pounded with anticipation."
Required: "He counted to six before standing."

Banned: "The room was tense."
Required: "Nobody had moved a chair in eleven minutes."

Show the reader. Trust the reader. Tell nothing.
</show_dont_tell>

<forbidden_patterns>
These patterns are banned. Treat each as a hard rule. Rewrite rather
than emit.

<constructions>
- "the specific [noun] of [situation]" -- this construction was overused
  in prior chapters and is now permanently banned
- "not X, but Y" contrastive structures (including "It wasn't X. It was Y.")
- "in that moment" / "it was in this moment"
- Em-dash used for dramatic pause or emphasis (em-dash used for genuine
  parenthetical interruption is permitted)
- "Furthermore", "Moreover", "Additionally", "Indeed", "Crucially",
  "It is worth noting"
</constructions>

<filter_words>
Banned in filter form: saw, heard, felt, noticed, watched, observed,
realized, knew, thought. If the prose says "He felt the tram shudder",
rewrite to "The tram shuddered." Tactile "felt" like "the lighter felt
warm" is allowed; the filter ban applies to perceptual interposition only.
</filter_words>

<dialogue_tags>
Banned: remarked, observed, noted, commented, expressed, declared, mused.
Default to "said" or omit the tag entirely.
</dialogue_tags>

<vocabulary>
Banned outright (AI defaults): vibrant, tapestry, delve, delving,
navigate (non-literal), resonate (non-literal), rich (as descriptor),
intricate, ethereal, dappled, filtered (light), labyrinthine, cacophony,
shards (metaphorical), symphony (non-musical), fractured (metaphorical),
fractals (metaphorical).

Banned unless literal/technical: ozone (only if genuinely electrical or
quantum-coherent); hum (only of a specific identified source).

Banned phrases: "thick with [X]", "heavy with [X]", "pregnant with [X]",
"a [adjective] smile played across [his/her] lips".
</vocabulary>

<emotional_crutches>
Banned: heart swelled / pounded / hammered / raced; breath hitched /
caught / stopped; eyes flashed / blazed / shone / darkened / narrowed;
"a chill ran through [her/him]"; "warmth spread / bloomed / flooded";
"he/she felt [emotion]" in any direct form.
</emotional_crutches>
</forbidden_patterns>

<soft_caps>
Each cap is per-scene. Exceeding a cap is a quality failure.

- Anaphora chains: max 2
- "Kind of [X]" / "sort of [X]": max 3
- Pulse-count / heartbeat references: max 1 (unless plot-load-bearing)
- Underwriting-by-naming-absence ("he did not have a strong feeling
  about this"): max 1
- Rule of three ("A, B, and C"): max 2 (deliberate environmental listing
  like "Three sodium lights. One dead, one cycling, one steady" counts
  as one use and is permitted)
- "As if [X]" similes: max 2
</soft_caps>

<sensory_grounding>
AI defaults to generic atmospheric senses. This prose refuses that.

- A scent must be named specifically and motivated by the scene's actual
  physical environment. No "ozone" unless literally electrical.
- A sound must be located in space: directional, with distance and source.
  No "humming machinery" as wallpaper.
- A light source must be tied to time of day and physical fixture. No
  "dappled", no "filtered", no "ethereal."
- A texture must be specific. "Worn brass" not "old metal."
</sensory_grounding>

<emotional_grounding>
Emotional content arrives through one of three channels and only these:

(a) An observable physical action, or the conspicuous refusal of one
(b) A specific count, measurement, or duration
(c) A negative-space observation (what is NOT there, NOT said, NOT
    retrieved from memory)

NOT through: direct naming of feelings, cardiac/respiratory/vascular
tells, generalised body reactions, internal monologue about feeling-states.

When the emotion is significant, under-write it. The reader will
calibrate. (Underwriting-by-absence is itself capped at one per scene.)
</emotional_grounding>

<trope_governance>
Recognisable tropes are permitted but must be earned. If you deploy a
trope, ground it in:
(a) Specific canon facts (entity IDs, established events, named places)
(b) Friction or subversion -- not played straight; the predictable shape
    of the trope must be visibly refused inside the prose

In the <thinking> block, name any tropes you use and confirm their
grounding.
</trope_governance>
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
of "Quantum Shadows." Honor every fact in <canon_slice>. Do not
contradict canon.

Before writing prose, you MUST open a <thinking> block:

1. Identify three predictable cliches a hack writer would make in this
   scene. For each, state how the voice rules and canon facts make it
   impossible. Reference at least one canon entry by id.

2. State what the scene's NEGATIVE SPACE is -- what is being NOT said
   that carries the meaning.

3. Identify any tropes you are deploying and how they are grounded per
   <trope_governance>.

4. Draft the scene internally, then review against <forbidden_patterns>.
   Confirm zero forbidden patterns appear. If you catch one, rewrite
   before emitting <prose_output>.

5. Count and report (each cap is per-scene):
   - Anaphora chains used
   - "Kind of [X]" / "sort of [X]" used
   - Pulse-count references used
   - Underwriting-by-absence used
   - Rule-of-three used
   - "As if" similes used
   Confirm all are within the soft caps.

6. For each sensory detail, name its specific grounding source per
   <sensory_grounding>.

Close </thinking>.

After thinking, open <prose_output> and write the scene. Plain prose
only -- no headings, no markdown, no commentary. Close </prose_output>
when done.
</task>
"""


REPAIR_PROMPT_TEMPLATE = """\
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

<previous_attempt>
<thinking>
{previous_thinking}
</thinking>
<prose_output>
{previous_prose}
</prose_output>
</previous_attempt>

<lint_failures>
{lint_failures}
</lint_failures>

<task>
The previous attempt failed our mechanical linting checks. Rewrite the scene to resolve all listed <lint_failures>.

Rules for rewriting:
1. Do NOT introduce any new lint violations or exceed soft caps.
2. Maintain the established clinical and proprioceptive voice of "Quantum Shadows."
3. Do not contradict or omit any facts from <canon_slice>.

Before writing the new prose, you MUST open a <thinking> block:
1. Specifically identify why the previous attempt triggered each of the listed <lint_failures>.
2. Plan how you will restructure or rewrite those specific lines to eliminate the failures.
3. Review your plan against <forbidden_patterns> to ensure zero new violations.
Close </thinking>.

After thinking, open <prose_output> and write the revised scene. Plain prose only -- no headings, no markdown, no commentary. Close </prose_output> when done.
</task>
"""


def _extract_voice_rules(store_path: Optional[Path] = None) -> str:
    craft = get_by_namespace("craft", path=store_path)
    return "\n".join(f"- {e.id}: {e.value}" for e in craft)


def _extract_contract_rules(contract_path: Optional[Path] = None) -> str:
    if not contract_path or not contract_path.exists():
        return "No explicit Section 22 contract provided."
    import json
    from .contracts import BookContract
    try:
        data = json.loads(contract_path.read_text(encoding="utf-8"))
        contract = BookContract.model_validate(data)
        lines = []
        for r in contract.rules:
            sev = r.severity.upper()
            kind = r.kind.replace("_", " ").title()
            lines.append(f"- [{sev}] {kind}: {r.text} ({r.guard_id})")
        return "\n".join(lines)
    except Exception as e:
        return f"Error loading contract: {e}"


def _extract_tag(text: str, tag: str) -> str:
    match = re.search(rf"<{tag}>(.*?)</{tag}>", text, re.DOTALL)
    return match.group(1).strip() if match else ""


def generate_scene(
    scene_outline: str,
    chapter_num: int | float = 1,
    store_path: Optional[Path] = None,
    contract_path: Optional[Path] = None,
    use_cache: bool = True,
) -> dict:
    """Generate a scene. Returns {thinking, prose, raw, slice_token_estimate}."""
    slice_ = retrieve(
        chapter_text=scene_outline,
        chapter_num=_retrieval_chapter_num(chapter_num),
        store_path=store_path,
        log_dir=None,
    )
    user_message = PROMPT_TEMPLATE.format(
        voice_rules=_extract_voice_rules(store_path),
        contract_rules=_extract_contract_rules(contract_path),
        canon_slice=render_slice_for_prompt(slice_),
        scene_outline=scene_outline,
    )
    result = llm_call(
        role="prose_rewriting",
        system=SYSTEM_PROMPT,
        user_message=user_message,
        cached_blocks=[],
        schema=None,
        cache_key_parts=["prose_generator.v2", scene_outline, chapter_num],
        use_cache=use_cache,
        max_output_tokens=4096,
    )
    return {
        "thinking": _extract_tag(result.text, "thinking"),
        "prose": _extract_tag(result.text, "prose_output"),
        "raw": result.text,
        "slice_token_estimate": slice_.token_estimate,
    }


def generate_scene_with_retry(
    scene_outline: str,
    chapter_num: int | float = 1,
    store_path: Optional[Path] = None,
    contract_path: Optional[Path] = None,
    max_retries: int = 5,
    use_cache: bool = True,
    verbose: bool = True,
) -> dict:
    """
    Generate a scene, running a mechanical lint check on the output and
    triggering repair loops if there are hard or soft cap violations.
    """
    from .prose_lint import lint_prose
    from .contract_lint import lint_contract

    # 1. Run the initial pass (may hit cache if enabled)
    result = generate_scene(
        scene_outline=scene_outline,
        chapter_num=chapter_num,
        store_path=store_path,
        contract_path=contract_path,
        use_cache=use_cache,
    )
    
    prose = result["prose"]
    thinking = result["thinking"]
    raw = result["raw"]
    
    lint = lint_prose(prose)
    if len(prose.split()) < MIN_GENERATED_PROSE_WORDS:
        lint.hard_violations.append(("missing_or_short_prose_output", prose[:80]))
    c_lint = (
        lint_contract(prose, contract_path=contract_path, use_cache=use_cache)
        if contract_path
        else None
    )
    
    passed = lint.passed and (c_lint.passed if c_lint else True)
    
    def _build_lint_report() -> str:
        rep = lint.render()
        if c_lint and not c_lint.passed:
            rep += "\n\n=== CONTRACT LINT FAILURES ===\n"
            for f in c_lint.findings:
                rep += f"\n[{f.severity}] {f.guard_id}\n  Span: {f.span}\n  Rationale: {f.rationale}\n"
        return rep
    
    history = [{
        "attempt": 1,
        "thinking": thinking,
        "prose": prose,
        "lint": {
            "passed": passed,
            "word_count": lint.word_count,
            "hard_violations": lint.hard_violations,
            "cap_violations": lint.cap_violations,
            "soft_flags": lint.soft_flags,
            "contract_findings": [f.model_dump() for f in c_lint.findings] if c_lint else [],
            "report": _build_lint_report(),
        }
    }]
    
    attempt = 1
    
    while not passed and attempt < max_retries:
        attempt += 1
        current_report = _build_lint_report()
        if verbose:
            print(f"\n[RETRY] Lint check failed on attempt {attempt - 1}:")
            print(current_report)
            print(f"Starting repair attempt {attempt} of {max_retries}...")
            
        # Extract details for repair prompt
        slice_ = retrieve(
            chapter_text=scene_outline,
            chapter_num=_retrieval_chapter_num(chapter_num),
            store_path=store_path,
            log_dir=None,
        )
        
        violations = []
        for name, match in lint.hard_violations:
            violations.append(f"- HARD VIOLATION: {name} (matched '{match}')")
        for name, count, cap in lint.cap_violations:
            violations.append(f"- SOFT CAP VIOLATION: {name} was used {count} times (cap is {cap})")
        if c_lint:
            for f in c_lint.findings:
                violations.append(f"- CONTRACT {f.severity} VIOLATION ({f.guard_id}): {f.rationale}. Offending span: '{f.span}'")
                
        lint_failures_str = "\n".join(violations)
        
        repair_user_message = REPAIR_PROMPT_TEMPLATE.format(
            voice_rules=_extract_voice_rules(store_path),
            contract_rules=_extract_contract_rules(contract_path),
            canon_slice=render_slice_for_prompt(slice_),
            scene_outline=scene_outline,
            previous_thinking=thinking,
            previous_prose=prose,
            lint_failures=lint_failures_str,
        )
        
        # We MUST bypass L1 cache on repair attempts
        llm_result = llm_call(
            role="prose_rewriting",
            system=SYSTEM_PROMPT,
            user_message=repair_user_message,
            cached_blocks=[],
            schema=None,
            cache_key_parts=["prose_generator_repair.v2", scene_outline, chapter_num, attempt],
            use_cache=False,
            max_output_tokens=4096,
        )
        
        raw = llm_result.text
        thinking = _extract_tag(raw, "thinking")
        prose = _extract_tag(raw, "prose_output")
        lint = lint_prose(prose)
        if len(prose.split()) < MIN_GENERATED_PROSE_WORDS:
            lint.hard_violations.append(("missing_or_short_prose_output", prose[:80]))
        c_lint = (
            lint_contract(prose, contract_path=contract_path, use_cache=False)
            if contract_path
            else None
        )
        passed = lint.passed and (c_lint.passed if c_lint else True)
        
        history.append({
            "attempt": attempt,
            "thinking": thinking,
            "prose": prose,
            "lint": {
                "passed": passed,
                "word_count": lint.word_count,
                "hard_violations": lint.hard_violations,
                "cap_violations": lint.cap_violations,
                "soft_flags": lint.soft_flags,
                "contract_findings": [f.model_dump() for f in c_lint.findings] if c_lint else [],
                "report": _build_lint_report(),
            }
        })

    return {
        "thinking": thinking,
        "prose": prose,
        "raw": raw,
        "passed": passed,
        "attempts": attempt,
        "lint_report": _build_lint_report(),
        "history": history,
        "slice_token_estimate": result.get("slice_token_estimate", 0),
    }


if __name__ == "__main__":
    scene = sys.argv[1] if len(sys.argv) > 1 else (
        "Kain returns to the Black Pearl bar three months after Ch 1. "
        "Emily is not there. He notices something specific about the "
        "space that wasn't there before. The scene runs approximately "
        "200 words."
    )
    chapter = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    out = generate_scene_with_retry(scene, chapter)
    print(f"\nCanon slice tokens: ~{out['slice_token_estimate']}\n")
    print("=" * 70)
    print(f"THINKING (Attempts: {out['attempts']}, Passed Lint: {out['passed']}):")
    print("=" * 70)
    print(out["thinking"])
    print()
    print("=" * 70)
    print("PROSE:")
    print("=" * 70)
    print(out["prose"])
    print()
    print("=" * 70)
    print("LINT REPORT:")
    print("=" * 70)
    print(out["lint_report"])
