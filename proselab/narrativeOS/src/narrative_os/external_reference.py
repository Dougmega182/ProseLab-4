from __future__ import annotations

import json
from pathlib import Path
from typing import List

from pydantic import BaseModel, Field


class ExternalReferenceSample(BaseModel):
    id: str
    source: str
    outline: str
    passage: str
    fixed_mechanism_label: str
    mechanism_present: bool
    quality_rank: int = Field(..., ge=1, le=5)
    rationale: str


class ExternalReferenceSlice(BaseModel):
    name: str
    version: int
    notes: str
    samples: List[ExternalReferenceSample]


def load_external_reference_slice(path: Path | str = Path("data/external_reference_slice.json")) -> ExternalReferenceSlice:
    """
    Load the immutable external-reference slice used as a fixed baseline.

    The slice is intentionally hand-curated and stored as static JSON so the
    benchmark can be compared against a non-generated truth anchor.
    """
    candidate = Path(path)
    if not candidate.exists():
        raise FileNotFoundError(f"External reference slice not found: {candidate}")

    payload = json.loads(candidate.read_text(encoding="utf-8"))
    return ExternalReferenceSlice.model_validate(payload)
