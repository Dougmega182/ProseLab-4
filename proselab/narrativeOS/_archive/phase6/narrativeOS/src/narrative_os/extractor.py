"""
Continuity extractor — top-level entry point for Phase 4.

Given a manuscript and a chapter number, produces a typed StateDelta by:
    1. Loading the manuscript (cached via content hash)
    2. Retrieving the canon slice for the chapter (Phase 3)
    3. Building an LLM call with:
         - system + schema + manuscript as cached prefix
         - canon slice + chapter pointer as per-call payload
    4. Validating the response against StateDelta schema
    5. Writing both result and raw response to extraction log

Usage:
    from narrative_os.extractor import extract_delta
    from narrative_os.manuscript import Manuscript

    ms = Manuscript.load("manuscripts/quantum_shadows.md")
    delta = extract_delta(manuscript=ms, chapter_num=5)
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from .manuscript import Manuscript, Chapter
from .retriever import retrieve, render_slice_for_prompt
from .schemas import StateDelta
from .llm.router import llm_call
from .llm.cache.local import LocalCache


log = logging.getLogger(__name__)

PROMPT_PATH = Path(__file__).parent / "prompts" / "extract_delta.txt"
EXTRACTION_LOG_DIR = Path(__file__).parents[2] / "data" / "logs" / "extraction"


class ExtractionError(Exception):
    """Raised when extraction fails after retries."""


def _load_prompt(pass_id: str) -> str:
    template = PROMPT_PATH.read_text(encoding="utf-8")
    return template.replace("<PASS_ID>", pass_id)


def _build_user_message(
    chapter: Chapter,
    slice_text: str,
) -> str:
    return f"""# TASK

Analyse Chapter {chapter.display_number} ("{chapter.title}") of Quantum Shadows.

# CHAPTER TEXT (this is the source you must read)

Read this carefully. Every claim in your StateDelta must be traceable to a specific passage below. When you write the `value` of a new entry, you should be able to quote the line that establishes it.

---BEGIN CHAPTER {chapter.display_number}---

{chapter.text}

---END CHAPTER {chapter.display_number}---

# CURRENT CANON SLICE (existing entries — do NOT restate; only emit changes/additions)

{slice_text}

# OUTPUT REQUIREMENTS

Return a single JSON object matching the StateDelta schema for chapter {int(chapter.number) if chapter.number == int(chapter.number) else chapter.number}.

Hard rules:
- Every `new_entries[].value` must reflect content that is in the chapter text above.
- If a fact is in the canon slice already, do NOT add it again — the merge layer will treat it as a no-op or a retcon.
- Do NOT invent details (handedness, room layouts, object placements) that the chapter text does not state. If you want to record an inference, mark it `inferred` and base it on a specific quoted passage.
- `resolved_loops`: list ids of OPEN loops this chapter closes; you must be able to quote the closing line.
- `new_loops`: questions the chapter raises that future chapters must answer.
- CRITICAL: Be concise. Limit your output to the 25 most critical `new_entries` and 8 `new_loops`. Do not exceed this limit or the JSON payload will truncate and crash the system.

Output ONLY the JSON object. No prose, no markdown fences, no commentary.
"""


def _state_delta_schema() -> dict:
    """JSON schema for the StateDelta model — used to constrain the LLM."""
    return StateDelta.model_json_schema()


def _write_extraction_log(
    chapter: Chapter,
    pass_id: str,
    delta: Optional[StateDelta],
    raw_text: str,
    usage: dict,
    cache_hit: bool,
    log_dir: Path | str | None,
) -> None:
    log_dir = Path(log_dir) if log_dir else EXTRACTION_LOG_DIR
    log_dir.mkdir(parents=True, exist_ok=True)
    stamp = pass_id.replace(":", "-").replace("/", "-")
    fname = f"ch{int(chapter.number * 10):04d}_{stamp}.json"

    payload = {
        "chapter": chapter.display_number,
        "chapter_title": chapter.title,
        "pass_id": pass_id,
        "cache_hit": cache_hit,
        "usage": usage,
        "raw_text": raw_text,
        "delta": json.loads(delta.model_dump_json()) if delta else None,
        "logged_at": datetime.now(timezone.utc).isoformat(),
    }
    (log_dir / fname).write_text(
        json.dumps(payload, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def extract_delta(
    *,
    manuscript: Manuscript,
    chapter_num: float | int | str,
    canon_store_path: Optional[Path | str] = None,
    pass_id: Optional[str] = None,
    cache: Optional[LocalCache] = None,
    use_cache: bool = True,
    log_dir: Path | str | None = None,
    role: str = "continuity_extractor",
    tier_override: Optional[str] = None,
    max_output_tokens: int = 4096,
) -> StateDelta:
    """
    Extract a StateDelta for the given chapter.

    Args:
        manuscript:        loaded Manuscript object
        chapter_num:       chapter to analyse (1, 7.5, "PROLOGUE", etc.)
        canon_store_path:  path to canon_store.json (None = package default)
        pass_id:           identifier for logs / cache; auto-generated if None
        cache:             LocalCache instance (default if None)
        use_cache:         False = force fresh API call
        log_dir:           where to write extraction logs
        role:              LLM role from tiers.ROLE_TIERS
        tier_override:     override the role's default tier
        max_output_tokens: response budget

    Returns:
        Validated StateDelta. Caller is responsible for conflict detection
        and merge.
    """
    chapter = manuscript.chapter_by_number(chapter_num)
    if chapter is None:
        raise ExtractionError(f"Chapter {chapter_num!r} not found in manuscript.")

    if pass_id is None:
        pass_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    # 1. Retrieve canon slice (deterministic, cheap)
    slice_ = retrieve(
        chapter_text=chapter.text,
        chapter_num=int(chapter.number) if chapter.number == int(chapter.number)
                                          else int(chapter.number),
        store_path=canon_store_path,
        log_dir=None,   # extractor manages its own logging
    )
    slice_text = render_slice_for_prompt(slice_)

    # 2. Build LLM request
    system_prompt = _load_prompt(pass_id)
    schema = _state_delta_schema()

    # Cached blocks: (The manuscript is now handled by the Magica workflow file_field directly)
    cached_blocks = []

    user_message = _build_user_message(chapter, slice_text)

    # Cache key parts: any change here forces L1 miss
    cache_key_parts = [
        "extractor.v3",
        chapter.content_hash(),
        chapter.display_number,
        # Hash the slice to detect canon changes
        slice_text,
        role,
    ]

    # 3. Call LLM (L1 cache → provider with L2 cache)
    try:
        result = llm_call(
            role=role,
            system=system_prompt,
            user_message=user_message,
            cached_blocks=cached_blocks,
            schema=schema,
            cache_key_parts=cache_key_parts,
            tier_override=tier_override,
            cache=cache,
            use_cache=use_cache,
            max_output_tokens=max_output_tokens,
        )
    except Exception as e:
        raise ExtractionError(
            f"LLM call failed for chapter {chapter.display_number}: {e}"
        ) from e

    # 4. Parse + validate
    if result.parsed is None:
        # The router-level cache may have stored only `text`. Try parsing it.
        from .llm.providers.anthropic import _try_parse_json
        result.parsed = _try_parse_json(result.text)

    if result.parsed is None:
        _write_extraction_log(
            chapter, pass_id, None, result.text, result.usage,
            result.cache_hit, log_dir,
        )
        raise ExtractionError(
            f"Could not parse JSON from model output for chapter "
            f"{chapter.display_number}. Raw text saved to extraction log."
        )

    # Ensure chapter field matches (the LLM should set it; we fix if missing)
    if isinstance(result.parsed, dict):
        result.parsed.setdefault("chapter",
            int(chapter.number) if chapter.number == int(chapter.number)
                                 else int(chapter.number))
        result.parsed.setdefault("pass_id", pass_id)
        if "new_entries" in result.parsed and isinstance(result.parsed["new_entries"], list):
            for e in result.parsed["new_entries"]:
                if isinstance(e, dict):
                    e["extracted_at_pass"] = pass_id
        if "new_loops" in result.parsed and isinstance(result.parsed["new_loops"], list):
            for e in result.parsed["new_loops"]:
                if isinstance(e, dict):
                    e["extracted_at_pass"] = pass_id
                    if "id" in e and isinstance(e["id"], str) and e["id"].startswith("plot.loop"):
                        e["namespace"] = "plot"
        if "new_entries" in result.parsed and isinstance(result.parsed["new_entries"], list):
            for e in result.parsed["new_entries"]:
                if isinstance(e, dict):
                    e["extracted_at_pass"] = pass_id
                    if "namespace" in e and e["namespace"] not in ["character", "world", "plot", "craft"]:
                        if "id" in e and isinstance(e["id"], str) and "." in e["id"]:
                            prefix = e["id"].split(".")[0]
                            if prefix in ["character", "world", "plot", "craft"]:
                                e["namespace"] = prefix
                            elif prefix in ["kain", "bell", "emily", "hayden", "reyes"]:
                                e["namespace"] = "character"
        if "resolved_loops" in result.parsed and isinstance(result.parsed["resolved_loops"], list):
            flattened = []
            for item in result.parsed["resolved_loops"]:
                if isinstance(item, dict) and "id" in item:
                    flattened.append(item["id"])
                elif isinstance(item, str):
                    flattened.append(item)
            result.parsed["resolved_loops"] = flattened
    
    try:
        delta = StateDelta.model_validate(result.parsed)
    except Exception as e:
        _write_extraction_log(
            chapter, pass_id, None, result.text, result.usage,
            result.cache_hit, log_dir,
        )
        raise ExtractionError(
            f"StateDelta validation failed for chapter "
            f"{chapter.display_number}: {e}"
        ) from e

    # Defensive: force the correct pass_id onto every entry regardless of
    # what the LLM emitted. This is belt-and-braces over the prompt fix.
    delta = delta.model_copy(update={"pass_id": pass_id})
    delta.new_entries = [
        e.model_copy(update={"extracted_at_pass": pass_id})
        for e in delta.new_entries
    ]
    delta.new_loops = [
        e.model_copy(update={"extracted_at_pass": pass_id})
        for e in delta.new_loops
    ]

    # 5. Log
    _write_extraction_log(
        chapter, pass_id, delta, result.text, result.usage,
        result.cache_hit, log_dir,
    )

    return delta
