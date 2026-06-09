import hashlib
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


def chunk_text(text: str, max_words: int = 1500) -> list[str]:
    """Split text on paragraph boundaries and group them into chunks of at most max_words."""
    paragraphs = text.split("\n\n")
    chunks = []
    current_chunk = []
    current_word_count = 0

    for para in paragraphs:
        word_count = len(para.split())
        if current_word_count + word_count > max_words and current_chunk:
            chunks.append("\n\n".join(current_chunk))
            current_chunk = [para]
            current_word_count = word_count
        else:
            current_chunk.append(para)
            current_word_count += word_count

    if current_chunk:
        chunks.append("\n\n".join(current_chunk))

    return chunks


def _build_user_message(
    chapter: Chapter,
    slice_text: str,
    chunk_text_content: Optional[str] = None,
    chunk_idx: Optional[int] = None,
    total_chunks: Optional[int] = None,
) -> str:
    text_to_show = chunk_text_content if chunk_text_content is not None else chapter.text

    if chunk_idx is not None and total_chunks is not None and total_chunks > 1:
        chapter_heading = f"# CHAPTER TEXT SECTION (Part {chunk_idx + 1} of {total_chunks} of this chapter)"
        chapter_bounds_begin = f"---BEGIN CHAPTER {chapter.display_number} SECTION (Part {chunk_idx + 1} of {total_chunks})---"
        chapter_bounds_end = f"---END CHAPTER {chapter.display_number} SECTION (Part {chunk_idx + 1} of {total_chunks})---"
    else:
        chapter_heading = "# CHAPTER TEXT (this is the source you must read)"
        chapter_bounds_begin = f"---BEGIN CHAPTER {chapter.display_number}---"
        chapter_bounds_end = f"---END CHAPTER {chapter.display_number}---"

    limit_rule = (
        "- CRITICAL: Be concise. Limit your output to the 15 most critical `new_entries` and 5 `new_loops` for this section. Do not exceed this limit or the JSON payload will truncate."
        if (total_chunks is not None and total_chunks > 1)
        else "- CRITICAL: Be concise. Limit your output to the 25 most critical `new_entries` and 8 `new_loops`. Do not exceed this limit or the JSON payload will truncate and crash the system."
    )

    return f"""# TASK

Analyse Chapter {chapter.display_number} ("{chapter.title}") of Quantum Shadows.

{chapter_heading}

Read this carefully. Every claim in your StateDelta must be traceable to a specific passage below. When you write the `value` of a new entry, you should be able to quote the line that establishes it.

{chapter_bounds_begin}

{text_to_show}

{chapter_bounds_end}

# CURRENT CANON SLICE (existing entries from older chapters — do NOT restate; only emit changes/additions)

{slice_text}

# OUTPUT REQUIREMENTS

Return a single JSON object matching the StateDelta schema for chapter {int(chapter.number) if chapter.number == int(chapter.number) else chapter.number}.

Hard rules:
- Every `new_entries[].value` must reflect content that is in the chapter text section above.
- If a fact is in the canon slice already, do NOT add it again — the merge layer will treat it as a no-op or a retcon.
- Do NOT invent details (handedness, room layouts, object placements) that the chapter text does not state. If you want to record an inference, mark it `inferred` and base it on a specific quoted passage.
- `resolved_loops`: list ids of OPEN loops this chapter section closes; you must be able to quote the closing line.
- `new_loops`: questions the chapter section raises that future chapters must answer.
{limit_rule}

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

    from .store import load as store_load
    store_entries = store_load(canon_store_path) if canon_store_path else store_load()

    chunks = chunk_text(chapter.text, max_words=1500)
    total_chunks = len(chunks)

    accumulated_entries = []
    accumulated_loops = []
    accumulated_resolved_loops = []
    accumulated_tone_notes = []

    for idx, chunk_text_content in enumerate(chunks):
        # 1. Retrieve canon slice using the entries accumulated so far
        current_entries = store_entries + accumulated_entries + accumulated_loops
        slice_ = retrieve(
            chapter_text=chunk_text_content,
            chapter_num=int(chapter.number) if chapter.number == int(chapter.number)
                                              else int(chapter.number),
            store_path=canon_store_path,
            entries=current_entries,
            log_dir=None,   # extractor manages its own logging
        )
        slice_text = render_slice_for_prompt(slice_)

        # 2. Build prompts and schemas
        system_prompt = _load_prompt(pass_id)
        schema = _state_delta_schema()
        cached_blocks = []

        user_message = _build_user_message(
            chapter,
            slice_text,
            chunk_text_content if total_chunks > 1 else None,
            idx if total_chunks > 1 else None,
            total_chunks if total_chunks > 1 else None,
        )

        chunk_hash = hashlib.sha256(chunk_text_content.encode("utf-8")).hexdigest()[:16]
        cache_key_parts = [
            "extractor.v4",
            chunk_hash,
            f"{chapter.display_number}_part_{idx + 1}_of_{total_chunks}",
            slice_text,
            role,
        ]

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
                f"LLM call failed for chapter {chapter.display_number} (part {idx + 1}/{total_chunks}): {e}"
            ) from e

        raw_text = result.text

        # Parse + validate the response
        if result.parsed is None:
            from .llm.providers.anthropic import _try_parse_json
            result.parsed = _try_parse_json(result.text)

        if result.parsed is None:
            usage = {
                "prompt_tokens": result.usage.get("prompt_tokens", 0) if result.usage else 0,
                "completion_tokens": result.usage.get("completion_tokens", 0) if result.usage else 0,
            }
            pass_label = f"{pass_id}_part_{idx + 1}" if total_chunks > 1 else pass_id
            _write_extraction_log(chapter, pass_label, None, raw_text, usage, result.cache_hit, log_dir)
            raise ExtractionError(
                f"Could not parse JSON from model output for chapter {chapter.display_number} (part {idx + 1}/{total_chunks}). Raw text saved."
            )

        # Clean/normalize dict
        if isinstance(result.parsed, dict):
            result.parsed["chapter"] = int(chapter.number) if chapter.number == int(chapter.number) else int(chapter.number)
            result.parsed["pass_id"] = pass_id
            if "new_entries" in result.parsed and isinstance(result.parsed["new_entries"], list):
                for e in result.parsed["new_entries"]:
                    if isinstance(e, dict):
                        e["extracted_at_pass"] = pass_id
                        e.pop("created_at", None)
                        e.pop("updated_at", None)
                        if "namespace" in e and e["namespace"] not in ["character", "world", "plot", "craft"]:
                            if "id" in e and isinstance(e["id"], str) and "." in e["id"]:
                                prefix = e["id"].split(".")[0]
                                if prefix in ["character", "world", "plot", "craft"]:
                                    e["namespace"] = prefix
                                elif prefix in ["kain", "bell", "emily", "hayden", "reyes"]:
                                    e["namespace"] = "character"
            if "new_loops" in result.parsed and isinstance(result.parsed["new_loops"], list):
                for e in result.parsed["new_loops"]:
                    if isinstance(e, dict):
                        e["extracted_at_pass"] = pass_id
                        e.pop("created_at", None)
                        e.pop("updated_at", None)
                        if "id" in e and isinstance(e["id"], str) and e["id"].startswith("plot.loop"):
                            e["namespace"] = "plot"
            if "resolved_loops" in result.parsed and isinstance(result.parsed["resolved_loops"], list):
                flattened = []
                for item in result.parsed["resolved_loops"]:
                    if isinstance(item, dict) and "id" in item:
                        flattened.append(item["id"])
                    elif isinstance(item, str):
                        flattened.append(item)
                result.parsed["resolved_loops"] = flattened

        try:
            delta_chunk = StateDelta.model_validate(result.parsed)
        except Exception as e:
            usage = {
                "prompt_tokens": result.usage.get("prompt_tokens", 0) if result.usage else 0,
                "completion_tokens": result.usage.get("completion_tokens", 0) if result.usage else 0,
            }
            pass_label = f"{pass_id}_part_{idx + 1}" if total_chunks > 1 else pass_id
            _write_extraction_log(chapter, pass_label, None, raw_text, usage, result.cache_hit, log_dir)
            raise ExtractionError(
                f"StateDelta validation failed for chapter {chapter.display_number} (part {idx + 1}/{total_chunks}): {e}"
            ) from e

        usage = {
            "prompt_tokens": result.usage.get("prompt_tokens", 0) if result.usage else 0,
            "completion_tokens": result.usage.get("completion_tokens", 0) if result.usage else 0,
            "total_tokens": result.usage.get("total_tokens", 0) if result.usage else 0,
        }
        pass_label = f"{pass_id}_part_{idx + 1}" if total_chunks > 1 else pass_id
        _write_extraction_log(chapter, pass_label, delta_chunk, raw_text, usage, result.cache_hit, log_dir)

        accumulated_entries.extend(delta_chunk.new_entries)
        accumulated_loops.extend(delta_chunk.new_loops)
        accumulated_resolved_loops.extend(delta_chunk.resolved_loops)
        accumulated_tone_notes.extend(delta_chunk.tone_notes)

    # 4. Programmatically deduplicate and merge all chunks into a final StateDelta
    # Deduplicate entries by ID, keeping the latest one
    seen_entries = {}
    for entry in accumulated_entries:
        seen_entries[entry.id] = entry
    final_new_entries = list(seen_entries.values())

    # Deduplicate loops by ID, keeping the latest one
    seen_loops = {}
    for loop in accumulated_loops:
        seen_loops[loop.id] = loop
    final_new_loops = list(seen_loops.values())

    # Deduplicate resolved loop IDs
    final_resolved_loops = list(dict.fromkeys(accumulated_resolved_loops))

    # Deduplicate tone notes
    final_tone_notes = list(dict.fromkeys(accumulated_tone_notes))

    final_delta = StateDelta(
        chapter=int(chapter.number) if chapter.number == int(chapter.number) else int(chapter.number),
        pass_id=pass_id,
        new_entries=final_new_entries,
        resolved_loops=final_resolved_loops,
        new_loops=final_new_loops,
        tone_notes=final_tone_notes,
    )

    return final_delta
