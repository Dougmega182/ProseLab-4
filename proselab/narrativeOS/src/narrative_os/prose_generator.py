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

from .retriever import retrieve, render_slice_for_prompt
from .store import get_by_namespace
from .llm.router import llm_call
from .project import get_project
from .dna import NovelDNA

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
        lines = [f"- [{r.severity.upper()}] {r.kind}: {r.text}" for r in contract.rules]
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
    temperature: float = 0.7
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
    
    result = llm_call(
        role="prose_rewriting", # Use T2_premium for generation
        system=SYSTEM_PROMPT,
        user_message=user_message,
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
