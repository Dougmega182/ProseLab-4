from __future__ import annotations

import re
from pathlib import Path
from typing import Iterable

from .corpus import CorpusExerpt, CorpusOracle


TOKEN_RE = re.compile(r"[A-Za-z][A-Za-z'-]{1,}")


def _tokenize(text: str) -> set[str]:
    return {token.lower() for token in TOKEN_RE.findall(text)}


def _shared_terms(left: str, right: str, limit: int = 6) -> list[str]:
    left_tokens = _tokenize(left)
    right_tokens = _tokenize(right)
    shared = sorted(left_tokens & right_tokens)
    return shared[:limit]


def _overlap_ratio(left: str, right: str) -> float:
    left_tokens = _tokenize(left)
    right_tokens = _tokenize(right)
    if not left_tokens or not right_tokens:
        return 0.0
    return len(left_tokens & right_tokens) / min(len(left_tokens), len(right_tokens))


def build_contrast_brief(
    variant_text: str,
    exemplars: Iterable[CorpusExerpt],
    *,
    limit: int = 3,
) -> str:
    """
    Build a deterministic contrast brief from concrete exemplar passages.

    This intentionally avoids score axes and mechanism labels. It focuses on
    what a draft actually echoes in the exemplar set and how that differs
    from the target passage.
    """
    exemplar_list = list(exemplars)[:limit]
    if not exemplar_list:
        return "No exemplar anchors available."

    lines = ["# Contrast memory brief", ""]
    for idx, exemplar in enumerate(exemplar_list, start=1):
        overlap = _overlap_ratio(variant_text, exemplar.text)
        shared = _shared_terms(variant_text, exemplar.text)
        shared_text = ", ".join(shared) if shared else "(no strong lexical overlap)"
        lines.append(
            f"{idx}. Anchor: {exemplar.author} — {exemplar.source}\n"
            f"   Shared texture: {shared_text}\n"
            f"   Contrast signal: {'closer to the exemplar' if overlap >= 0.1 else 'more distant from the exemplar'}"
        )
    return "\n".join(lines)


def retrieve_exemplars(query: str, corpus_path: Path | str, limit: int = 3) -> list[CorpusExerpt]:
    """
    Retrieve exemplar passages by concrete lexical overlap with the query,
    not by forced axis labels.
    """
    oracle = CorpusOracle(Path(corpus_path))
    return oracle.get_relevant_exemplars(query, limit=limit)
