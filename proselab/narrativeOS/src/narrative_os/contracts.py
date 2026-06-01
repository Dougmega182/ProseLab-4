"""Structured prose-generation contracts parsed from project decisions."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field, model_validator


RuleKind = Literal[
    "reveal",
    "permitted_signal",
    "foreclosure_guard",
    "surface_rule",
]
RuleSeverity = Literal["hard", "soft"]


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ContractRule(BaseModel):
    """One enforceable prose-surface rule from Section 22."""

    guard_id: str = Field(..., min_length=1)
    kind: RuleKind
    text: str = Field(..., min_length=1)
    section_ref: str | None = None
    severity: RuleSeverity = "hard"
    canon_refs: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def _guard_id_is_stable(self) -> "ContractRule":
        if self.guard_id.strip() != self.guard_id:
            raise ValueError("guard_id must not have leading/trailing whitespace")
        if " " in self.guard_id:
            raise ValueError("guard_id must not contain spaces")
        if "." not in self.guard_id:
            raise ValueError("guard_id must be dotted")
        return self


class BookContract(BaseModel):
    """The parsed contract for one book/project."""

    project: str = "Quantum Shadows"
    book: str = "Book 1"
    source_path: str
    source_hash: str = Field(..., min_length=16)
    rules: list[ContractRule]
    created_at: datetime = Field(default_factory=_utcnow)

    @model_validator(mode="after")
    def _guard_ids_are_unique(self) -> "BookContract":
        seen: set[str] = set()
        duplicates: list[str] = []
        for rule in self.rules:
            if rule.guard_id in seen:
                duplicates.append(rule.guard_id)
            seen.add(rule.guard_id)
        if duplicates:
            joined = ", ".join(sorted(set(duplicates)))
            raise ValueError(f"Duplicate contract guard_id(s): {joined}")
        return self

    def hard_rules(self) -> list[ContractRule]:
        return [rule for rule in self.rules if rule.severity == "hard"]

    def soft_rules(self) -> list[ContractRule]:
        return [rule for rule in self.rules if rule.severity == "soft"]
