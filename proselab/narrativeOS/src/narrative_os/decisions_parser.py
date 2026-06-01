"""Parse Section 22 of decisions.md into a BookContract."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any

from .contracts import BookContract, ContractRule, RuleKind


SECTION_22_HEADER = "## Section 22:"
SECTION_23_HEADER = "## Section 23:"

BUCKETS: dict[str, tuple[RuleKind, str, str]] = {
    "canonical facts": ("reveal", "s22.reveal", "hard"),
    "permitted hints": ("permitted_signal", "s22.signal", "soft"),
    "foreclosure guards": ("foreclosure_guard", "s22.guard", "hard"),
}

SLUG_STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "be",
    "book",
    "by",
    "can",
    "does",
    "for",
    "from",
    "have",
    "in",
    "is",
    "it",
    "may",
    "must",
    "never",
    "no",
    "not",
    "of",
    "on",
    "or",
    "past",
    "prose",
    "reader",
    "reads",
    "reading",
    "show",
    "strictly",
    "the",
    "to",
    "what",
    "with",
}


class DecisionsParseError(ValueError):
    """Raised when decisions.md does not contain the expected contract block."""


def _source_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _section_22_text(text: str) -> str:
    start = text.find(SECTION_22_HEADER)
    if start == -1:
        raise DecisionsParseError("Could not find Section 22 header.")
    end = text.find(SECTION_23_HEADER, start)
    if end == -1:
        raise DecisionsParseError("Could not find Section 23 header after Section 22.")
    return text[start:end]


def _bucket_key(line: str) -> str | None:
    lower = line.lower()
    for key in BUCKETS:
        if key in lower:
            return key
    return None


def _section_ref(line: str) -> str | None:
    match = re.search(r"23\.(\d+)", line)
    if not match:
        return None
    return f"Section 23.{match.group(1)}"


def _strip_ref(line: str) -> str:
    return re.sub(r"\s*\([^)]*23\.\d+[^)]*\)\s*$", "", line).strip()


def _slug(text: str, existing: set[str]) -> str:
    words = re.findall(r"[a-z0-9]+", text.lower())
    kept = [word for word in words if word not in SLUG_STOPWORDS]
    base = "_".join(kept[:6]) or "rule"
    candidate = base
    n = 2
    while candidate in existing:
        candidate = f"{base}_{n}"
        n += 1
    existing.add(candidate)
    return candidate


def _mapping_by_item(mapping_path: Path | str | None) -> dict[str, dict[str, Any]]:
    if mapping_path is None:
        return {}
    path = Path(mapping_path)
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    return {
        item["s22_item"].strip().lower(): item
        for item in data.get("section_22_mappings", [])
        if isinstance(item, dict) and "s22_item" in item
    }


def parse_section_22(
    decisions_path: Path | str,
    *,
    project: str = "Quantum Shadows",
    book: str = "Book 1",
    mapping_path: Path | str | None = None,
) -> BookContract:
    """Parse Section 22 from a decisions file."""
    path = Path(decisions_path)
    text = path.read_text(encoding="utf-8")
    section = _section_22_text(text)
    mappings = _mapping_by_item(mapping_path)

    current_bucket: str | None = None
    rules: list[ContractRule] = []
    existing_slugs: set[str] = set()

    for raw_line in section.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith("###"):
            current_bucket = _bucket_key(line)
            continue
        if not line.startswith("- ") or current_bucket is None:
            continue

        kind, prefix, severity = BUCKETS[current_bucket]
        body = _strip_ref(line[2:].strip())
        slug = _slug(body, existing_slugs)
        mapping = mappings.get(body.strip().lower())
        rules.append(
            ContractRule(
                guard_id=mapping["guard_id"] if mapping else f"{prefix}.{slug}",
                kind=kind,
                text=body,
                section_ref=_section_ref(line),
                severity=severity,
                canon_refs=[mapping["canon_fact_id"]] if mapping else [],
            )
        )

    if not rules:
        raise DecisionsParseError("Section 22 contained no parseable contract rules.")

    return BookContract(
        project=project,
        book=book,
        source_path=str(path),
        source_hash=_source_hash(section),
        rules=rules,
    )


def write_contract(contract: BookContract, out_path: Path | str) -> Path:
    """Write a parsed contract as stable JSON."""
    path = Path(out_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.loads(contract.model_dump_json())
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    return path
