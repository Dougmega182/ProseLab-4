"""
narrative_os.markup_parser -- Parse plain markdown feedback markup into structured FeedbackNotes.
"""
from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Optional
from pydantic import BaseModel, Field
from .llm.router import llm_call

class FeedbackRoute(str, Enum):
    CONTRACT_AMENDMENT = "contract_amendment"
    CANON_CORRECTION = "canon_correction"
    PROMPT_TUNING = "prompt_tuning"
    LOCAL_REWRITE = "local_rewrite"

class FeedbackNote(BaseModel):
    route: FeedbackRoute
    original_span: Optional[str] = None
    note: str
    context_before: Optional[str] = None
    context_after: Optional[str] = None

def parse_markup(text: str) -> tuple[str, list[FeedbackNote]]:
    """
    Parses feedback markup in the text.
    Supported tags:
      - Span-specific: [original text]{#route: feedback message}
      - Block/Inline comment: {#route: feedback message}

    Returns a tuple of (clean_text, list_of_feedback_notes).
    """
    # Pattern to match:
    # Optional [span]: (?:\[([^\]]+)\])?
    # Followed by {#route: note}: \{#([a-z_]+):\s*([^\}]+)\}
    pattern = re.compile(r'(?:\[([^\]]+)\])?\{#([a-z_]+):\s*([^\}]+)\}')
    
    notes: list[FeedbackNote] = []
    matches = list(pattern.finditer(text))
    
    for match in matches:
        span_text = match.group(1)
        route_str = match.group(2)
        note_str = match.group(3).strip()
        
        try:
            route = FeedbackRoute(route_str)
        except ValueError:
            raise ValueError(f"Unknown feedback route: {route_str!r}")
            
        start_idx = match.start()
        end_idx = match.end()
        
        ctx_start = max(0, start_idx - 100)
        ctx_end = min(len(text), end_idx + 100)
        
        context_before = text[ctx_start:start_idx]
        context_after = text[end_idx:ctx_end]
        
        notes.append(FeedbackNote(
            route=route,
            original_span=span_text,
            note=note_str,
            context_before=context_before,
            context_after=context_after
        ))
        
    # Build clean text
    clean_parts: list[str] = []
    last_idx = 0
    for match in matches:
        clean_parts.append(text[last_idx:match.start()])
        span_text = match.group(1)
        if span_text is not None:
            clean_parts.append(span_text)
        last_idx = match.end()
    clean_parts.append(text[last_idx:])
    
    clean_text = "".join(clean_parts)
    return clean_text, notes

def log_amendment(
    note: FeedbackNote,
    source: str,
    replacement: Optional[str] = None,
    log_path: str = "data/contracts/amendments.log.jsonl"
) -> None:
    """
    Appends an amendment log entry to amendments.log.jsonl.
    """
    os.makedirs(os.path.dirname(os.path.abspath(log_path)), exist_ok=True)
    
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source": source,
        "route": note.route.value,
        "original_span": note.original_span,
        "note": note.note,
        "replacement": replacement
    }
    
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")

def _detect_chapter_num(filename: str) -> float | int:
    match = re.search(r"(?:ch|chapter|pass)[-_]?(\d+(?:\.\d+)?)", filename, re.IGNORECASE)
    if match:
        val = float(match.group(1))
        return int(val) if val == int(val) else val
    return 1

def apply_prompt_tuning(note: FeedbackNote, prompt_tuning_path: Path) -> None:
    prompt_tuning_path.parent.mkdir(parents=True, exist_ok=True)
    existing_lines = []
    if prompt_tuning_path.exists():
        existing_lines = [
            line.strip()
            for line in prompt_tuning_path.read_text(encoding="utf-8").splitlines()
            if line.strip()
        ]
    
    new_rule = note.note.strip()
    if new_rule not in existing_lines:
        existing_lines.append(new_rule)
        prompt_tuning_path.write_text("\n".join(existing_lines) + "\n", encoding="utf-8")
        print(f"Added prompt tuning rule: {new_rule!r}")

def apply_contract_amendment(
    note: FeedbackNote,
    decisions_path: Path,
    use_cache: bool = True
) -> None:
    if not decisions_path.exists():
        print(f"Warning: decisions.md not found at {decisions_path}. Skipping automatic contract amendment.")
        return
        
    decisions_text = decisions_path.read_text(encoding="utf-8")
    
    # Extract Section 22 text
    start_header = "## Section 22: Prose-Generation Contract (Surface)"
    end_header = "## Section 23: Load-Bearing Architecture (Spine)"
    
    start_idx = decisions_text.find(start_header)
    if start_idx == -1:
        print("Warning: Section 22 header not found in decisions.md. Skipping contract amendment.")
        return
    end_idx = decisions_text.find(end_header, start_idx)
    if end_idx == -1:
        print("Warning: Section 23 header not found in decisions.md. Skipping contract amendment.")
        return
        
    section_22_text = decisions_text[start_idx:end_idx]
    
    system_prompt = (
        "You are an expert system architect and editor for the novel \"Quantum Shadows\".\n"
        "Your task is to amend the Section 22 Markdown contract based on a human feedback note.\n"
        "You must output ONLY the complete, updated Section 22 markdown text. No explanations, no markdown fences."
    )
    user_msg = (
        f"Here is Section 22 of the contract:\n\n{section_22_text}\n\n"
        f"Here is the feedback note to apply:\n\"{note.note}\"\n\n"
        f"Decide which subsection the feedback falls under:\n"
        f"1. \"### 1. Canonical Facts (What to show)\"\n"
        f"2. \"### 2. Permitted Hints (What to imply)\"\n"
        f"3. \"### 3. Foreclosure Guards (What tone/characterization is strictly forbidden to protect Book 3)\"\n\n"
        f"Formulate a new bullet point to add to that subsection. Add it to the end of that subsection. "
        f"If the feedback relates to one of the existing Section 23 rules, reference it (e.g. `(→ §23.1)`). If not, do not add any reference.\n"
        f"Ensure you preserve all existing bullet points exactly. Only add the new bullet point.\n"
        f"Provide the complete updated Section 22 markdown block starting with \"{start_header}\"."
    )
    
    print(f"Amending decisions.md Section 22 for note: {note.note!r}...")
    llm_result = llm_call(
        role="prose_rewriting",
        system=system_prompt,
        user_message=user_msg,
        use_cache=use_cache,
        temperature=0.1
    )
    new_section_22 = llm_result.text.strip()
    
    # Strip markdown fences if LLM accidentally output them
    if new_section_22.startswith("```markdown"):
        new_section_22 = new_section_22[len("```markdown"):].strip()
    if new_section_22.startswith("```"):
        new_section_22 = new_section_22[3:].strip()
    if new_section_22.endswith("```"):
        new_section_22 = new_section_22[:-3].strip()
        
    if start_header not in new_section_22:
        print("Warning: LLM response did not include Section 22 header. Rejecting replacement.")
        return
        
    updated_decisions_text = decisions_text[:start_idx] + new_section_22 + "\n\n" + decisions_text[end_idx:]
    decisions_path.write_text(updated_decisions_text, encoding="utf-8")
    print(f"Successfully amended {decisions_path.name}.")
    
    # Rebuild the contract JSON
    try:
        from .decisions_parser import parse_section_22, write_contract
        print("Rebuilding book1_contract.json...")
        mapping_file = decisions_path.parent / "data" / "contracts" / "s22_canon_mapping.json"
        contract = parse_section_22(
            decisions_path,
            project="Quantum Shadows",
            book="Book 1",
            mapping_path=mapping_file if mapping_file.exists() else None
        )
        write_contract(contract, decisions_path.parent / "data" / "contracts" / "book1_contract.json")
        print("Successfully rebuilt book1_contract.json.")
    except Exception as e:
        print(f"Warning: Failed to automatically rebuild contract JSON: {e}")

def apply_canon_correction(
    note: FeedbackNote,
    store_path: Path,
    source_chapter: float | int,
    pass_id: str,
    use_cache: bool = True
) -> None:
    from .store import load, save, supersede, append
    from .schemas import CanonEntry, Namespace, Confidence
    
    # Load store entries
    entries = load(store_path)
    active_entries = [e for e in entries if e.is_active()]
    
    # Render active entries for context
    rendered_context = "\n".join(
        f"- {e.id}: namespace={e.namespace} | entity={e.entity or ''} | value={e.value}"
        for e in active_entries
    )
    
    system_prompt = (
        "You are a narrative consistency auditor for the novel \"Quantum Shadows\".\n"
        "Your task is to parse a human feedback correction note and output a structured JSON plan to update the canon store.\n"
        "You must output ONLY a valid JSON object. No explanations, no markdown fences."
    )
    user_msg = (
        f"We need to correct the canon store based on this human feedback:\n"
        f"\"{note.note}\"\n\n"
        f"Here are the active canon entries in the store:\n"
        f"{rendered_context}\n\n"
        f"Your task is to return a JSON object with the following fields:\n"
        f"- \"action\": \"supersede\" or \"append\"\n"
        f"- \"old_id\": (string, required if action is 'supersede', the id of the entry to replace)\n"
        f"- \"new_entry\": (object, the corrected or new entry to insert)\n"
        f"  - \"id\": (string, dotted dotted namespaced key, e.g. 'entity.slug'. Make sure it has namespace prefix)\n"
        f"  - \"namespace\": (string, one of: 'character', 'world', 'plot', 'craft')\n"
        f"  - \"entity\": (string or null, character/location name, must be set if namespace is 'character')\n"
        f"  - \"value\": (string, the corrected fact value in prose)\n"
        f"  - \"aliases\": (array of strings, optional)\n"
        f"  - \"confidence\": (string, one of: 'hard_canon', 'event', 'inferred')\n\n"
        f"If the feedback note is pointing out an error in an existing entry, return action='supersede' and the old_id.\n"
        f"If the feedback note is a brand new fact to be added, return action='append'.\n"
        f"For the new entry ID, use dotted notation. If replacing, you can append a suffix (e.g. '_v2') or use a descriptive slug.\n"
        f"Return ONLY the raw JSON object."
    )
    
    print(f"Generating canon correction plan for note: {note.note!r}...")
    llm_result = llm_call(
        role="prose_rewriting",
        system=system_prompt,
        user_message=user_msg,
        use_cache=use_cache,
        temperature=0.1
    )
    plan_text = llm_result.text.strip()
    
    if plan_text.startswith("```json"):
        plan_text = plan_text[len("```json"):].strip()
    if plan_text.startswith("```"):
        plan_text = plan_text[3:].strip()
    if plan_text.endswith("```"):
        plan_text = plan_text[:-3].strip()
        
    try:
        plan = json.loads(plan_text)
    except Exception as e:
        print(f"Warning: Failed to parse LLM canon correction plan JSON: {e}. Raw response:\n{plan_text}")
        return
        
    action = plan.get("action")
    new_entry_dict = plan.get("new_entry")
    if not action or not new_entry_dict:
        print("Warning: Malformed canon correction plan (missing action or new_entry).")
        return
        
    try:
        new_entry = CanonEntry(
            id=new_entry_dict["id"],
            namespace=new_entry_dict["namespace"],
            entity=new_entry_dict.get("entity"),
            value=new_entry_dict["value"],
            aliases=new_entry_dict.get("aliases") or [],
            confidence=new_entry_dict["confidence"],
            source_chapter=source_chapter,
            extracted_at_pass=pass_id
        )
    except Exception as e:
        print(f"Warning: Failed to validate new CanonEntry: {e}")
        return
        
    if action == "append":
        print(f"Appending new canon entry {new_entry.id!r}: {new_entry.value}")
        append(new_entry, store_path)
    elif action == "supersede":
        old_id = plan.get("old_id")
        if not old_id:
            print("Warning: Action is 'supersede' but 'old_id' is missing from plan.")
            return
        existing_old = next((e for e in entries if e.id == old_id), None)
        if not existing_old:
            print(f"Warning: Old entry {old_id!r} not found in store.")
            return
            
        print(f"Superseding canon entry {old_id!r} with {new_entry.id!r}: {new_entry.value}")
        append(new_entry, store_path)
        supersede(old_id, new_entry.id, store_path)
    else:
        print(f"Warning: Unknown action {action!r} in canon correction plan.")

def apply_feedback(
    text: str,
    use_cache: bool = True,
    log_path: str = "data/contracts/amendments.log.jsonl",
    source: str = "draft",
    decisions_path: Optional[Path | str] = None,
    store_path: Optional[Path | str] = None,
    prompt_tuning_path: Optional[Path | str] = None,
) -> tuple[str, list[FeedbackNote]]:
    """
    Parses feedback, calls LLM to regenerate local_rewrite spans,
    strips other feedback tags, writes amendments to the audit log,
    and returns the final updated clean text.
    """
    pattern = re.compile(r'(?:\[([^\]]+)\])?\{#([a-z_]+):\s*([^\}]+)\}')
    matches = list(pattern.finditer(text))
    
    replacements = {}
    
    for match in matches:
        span_text = match.group(1)
        route_str = match.group(2)
        note_str = match.group(3).strip()
        
        try:
            route = FeedbackRoute(route_str)
        except ValueError:
            raise ValueError(f"Unknown feedback route: {route_str!r}")
            
        start_idx = match.start()
        end_idx = match.end()
        
        ctx_start = max(0, start_idx - 100)
        ctx_end = min(len(text), end_idx + 100)
        
        context_before = text[ctx_start:start_idx]
        context_after = text[end_idx:ctx_end]
        
        note = FeedbackNote(
            route=route,
            original_span=span_text,
            note=note_str,
            context_before=context_before,
            context_after=context_after
        )
        
        replacement = None
        if route == FeedbackRoute.LOCAL_REWRITE and span_text:
            system_prompt = (
                "You are a premium editor working on the novel \"Quantum Shadows\".\n"
                "You must perform targeted rewrites on specified spans of text based on the feedback provided.\n"
                "You must output ONLY the replacement text for the target span.\n"
                "Never include any explanations, thinking tags, or surrounding context. Output ONLY the final replacement text."
            )
            user_msg = (
                f"We need to rewrite a specific span of prose in the draft.\n\n"
                f"Context before:\n\"\"\"{context_before}\"\"\"\n\n"
                f"Original span to replace:\n\"{span_text}\"\n\n"
                f"Context after:\n\"\"\"{context_after}\"\"\"\n\n"
                f"Feedback / Directive:\n\"{note_str}\"\n\n"
                f"Provide the replacement text for \"{span_text}\" that fits seamlessly into the context and fulfills the feedback."
            )
            
            print(f"Regenerating span {span_text!r} via LLM with note: {note_str!r}...")
            llm_result = llm_call(
                role="prose_rewriting",
                system=system_prompt,
                user_message=user_msg,
                use_cache=use_cache,
                temperature=0.2
            )
            replacement = llm_result.text.strip()
            if replacement.startswith('"') and replacement.endswith('"'):
                replacement = replacement[1:-1].strip()
            print(f"Replacement: {replacement!r}")
        else:
            replacement = span_text or ""
            
        replacements[match] = replacement
        log_amendment(note, source=source, replacement=replacement, log_path=log_path)
        
        # Route non-rewrite notes to their destinations
        if route == FeedbackRoute.PROMPT_TUNING and prompt_tuning_path:
            apply_prompt_tuning(note, Path(prompt_tuning_path))
        elif route == FeedbackRoute.CONTRACT_AMENDMENT and decisions_path:
            apply_contract_amendment(note, Path(decisions_path), use_cache=use_cache)
        elif route == FeedbackRoute.CANON_CORRECTION and store_path:
            source_chapter = _detect_chapter_num(source)
            timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
            pass_id = f"human_feedback_{timestamp}"
            apply_canon_correction(note, Path(store_path), source_chapter, pass_id, use_cache=use_cache)
        
    # Reconstruct text from right to left using the replacements
    sorted_matches = sorted(matches, key=lambda m: m.start(), reverse=True)
    current_text = text
    for match in sorted_matches:
        start_idx = match.start()
        end_idx = match.end()
        rep = replacements[match]
        current_text = current_text[:start_idx] + rep + current_text[end_idx:]
        
    return current_text, [
        FeedbackNote(
            route=FeedbackRoute(m.group(2)),
            original_span=m.group(1),
            note=m.group(3).strip(),
            context_before=text[max(0, m.start() - 100):m.start()],
            context_after=text[m.end():min(len(text), m.end() + 100)]
        ) for m in matches
    ]

