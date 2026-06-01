"""
Pydantic schemas for the Quantum Shadows Narrative OS.

Three core models:
  - CanonEntry      : one atomic fact in the canon store
  - StateDelta      : output of one analysis pass over a chapter
  - ConflictReport  : output of conflict detection between a delta and the store

Design principles:
  - AI interprets, system structures, system enforces.
  - Every entry carries provenance (which chapter wrote it, which pass).
  - Confidence tiers (hard_canon / event / inferred) drive conflict semantics.
  - Supersession is explicit; we never silently overwrite.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


# ---------------------------------------------------------------------------
# Type aliases
# ---------------------------------------------------------------------------

Namespace = Literal["character", "world", "plot", "craft"]
Confidence = Literal["hard_canon", "event", "inferred"]
Severity = Literal["HIGH", "MEDIUM", "LOW"]
ConflictType = Literal[
    "TIMELINE",
    "CHARACTER_STATE",
    "CANON_VIOLATION",
    "LOOP_DOUBLE_RESOLVE",
]
SuggestedAction = Literal["block", "flag", "retcon", "merge"]


def _utcnow() -> datetime:
    """Timezone-aware UTC now. Centralized for testability."""
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# CanonEntry — one fact in the store
# ---------------------------------------------------------------------------

class CanonEntry(BaseModel):
    """
    A single atomic fact about the novel.

    The `id` is a dotted namespaced key, e.g.:
        hayden.ics_threshold
        world.fade_mechanics
        plot.aspect_identity
        craft.voice_baseline

    Convention: `{entity_or_topic}.{slug}`. Keep slugs short and stable —
    they are the primary key for supersession and conflict tracking.
    """

    id: str = Field(..., description="Namespaced dotted key, e.g. 'hayden.ics_threshold'")
    namespace: Namespace
    entity: Optional[str] = Field(
        None,
        description="Character or location name. None for world rules / craft notes.",
    )
    value: str = Field(..., min_length=1, description="The actual fact, in prose.")
    aliases: list[str] = Field(
        default_factory=list,
        description="Alternative names the entity is called in the manuscript.",
    )
    confidence: Confidence = Field(
        ...,
        description=(
            "hard_canon = world rule / established fact; "
            "event      = specific occurrence at a specific time; "
            "inferred   = interpretive reading, may change."
        ),
    )
    source_chapter: int = Field(..., ge=0, description="Chapter that established this fact.")
    extracted_at_pass: str = Field(
        ...,
        description="Pass identifier, e.g. 'ch4_2026-05-24T12:00:00'.",
    )
    created_at: datetime = Field(default_factory=_utcnow)
    superseded_by: Optional[str] = Field(
        None,
        description="Entry id that retconned this. None means still active.",
    )

    @field_validator("id")
    @classmethod
    def _id_must_be_dotted(cls, v: str) -> str:
        if "." not in v:
            raise ValueError(f"CanonEntry.id must be namespaced (contain '.'), got: {v!r}")
        if v.strip() != v or " " in v:
            raise ValueError(f"CanonEntry.id must not contain whitespace, got: {v!r}")
        return v

    @model_validator(mode="after")
    def _world_and_craft_have_no_entity(self) -> "CanonEntry":
        # World rules and craft notes typically have entity=None.
        # We allow but warn-via-validation only on namespace=="character"
        # requiring an entity to be set.
        if self.namespace == "character" and not self.entity:
            raise ValueError(
                f"CanonEntry {self.id!r}: namespace='character' requires `entity` to be set."
            )
        return self

    def is_active(self) -> bool:
        """True iff this entry has not been superseded."""
        return self.superseded_by is None

    def matches_entity(self, name: str) -> bool:
        """Case-insensitive match against entity name or any alias."""
        if not name:
            return False
        needle = name.strip().lower()
        if self.entity and self.entity.strip().lower() == needle:
            return True
        return any(a.strip().lower() == needle for a in self.aliases)


# ---------------------------------------------------------------------------
# StateDelta — output of one analysis pass
# ---------------------------------------------------------------------------

class StateDelta(BaseModel):
    """
    The structured output of running the extractor on a single chapter.

    The extractor is told:
      - here is the relevant slice of current canon
      - here is the chapter text
      - emit ONLY what is new, changed, or resolved

    Do not include re-statements of existing canon. The conflict detector
    will compare new_entries against the store and decide what to do.
    """

    chapter: int = Field(..., ge=0)
    pass_id: str = Field(..., description="Identifier for this extraction pass.")
    new_entries: list[CanonEntry] = Field(
        default_factory=list,
        description="Facts newly established or changed in this chapter.",
    )
    resolved_loops: list[str] = Field(
        default_factory=list,
        description="IDs of open-loop entries this chapter closes.",
    )
    new_loops: list[CanonEntry] = Field(
        default_factory=list,
        description="Open questions / setups introduced in this chapter.",
    )
    tone_notes: list[str] = Field(
        default_factory=list,
        description="Free-form notes about prose voice, pacing, register.",
    )
    created_at: datetime = Field(default_factory=_utcnow)

    @model_validator(mode="after")
    def _new_loops_are_plot_namespace(self) -> "StateDelta":
        for loop in self.new_loops:
            if loop.namespace != "plot":
                raise ValueError(
                    f"new_loops entry {loop.id!r} must have namespace='plot', "
                    f"got {loop.namespace!r}"
                )
        return self

    @model_validator(mode="after")
    def _chapter_matches_entries(self) -> "StateDelta":
        for e in [*self.new_entries, *self.new_loops]:
            if e.source_chapter != self.chapter:
                raise ValueError(
                    f"Entry {e.id!r} has source_chapter={e.source_chapter} "
                    f"but delta is for chapter {self.chapter}."
                )
        return self


# ---------------------------------------------------------------------------
# ConflictReport — output of conflict detection
# ---------------------------------------------------------------------------

class Conflict(BaseModel):
    """
    A single contradiction between an incoming delta and the existing store.

    `existing_*` describes the entry already in canon.
    `incoming_*` describes what the new delta is trying to assert.
    """

    severity: Severity
    type: ConflictType
    existing_entry_id: str
    existing_value: str
    existing_source: int = Field(..., ge=0, description="Chapter that wrote existing value.")
    incoming_value: str
    incoming_source: int = Field(..., ge=0, description="Chapter producing the new value.")
    suggested_action: SuggestedAction
    note: Optional[str] = Field(
        None,
        description="Human-readable explanation of why this is flagged.",
    )


class ConflictReport(BaseModel):
    """
    Aggregate result of running conflict detection on a StateDelta.

    `clean_to_merge` is True iff there are zero HIGH conflicts.
    MEDIUM/LOW conflicts are surfaced for review but do not block merge by default.
    """

    chapter: int = Field(..., ge=0)
    pass_id: str
    conflicts: list[Conflict] = Field(default_factory=list)
    clean_to_merge: bool
    created_at: datetime = Field(default_factory=_utcnow)

    @model_validator(mode="after")
    def _clean_flag_consistent(self) -> "ConflictReport":
        has_high = any(c.severity == "HIGH" for c in self.conflicts)
        if has_high and self.clean_to_merge:
            raise ValueError(
                "ConflictReport.clean_to_merge=True is inconsistent with "
                "presence of HIGH-severity conflicts."
            )
        return self

    def high(self) -> list[Conflict]:
        return [c for c in self.conflicts if c.severity == "HIGH"]

    def medium(self) -> list[Conflict]:
        return [c for c in self.conflicts if c.severity == "MEDIUM"]

    def low(self) -> list[Conflict]:
        return [c for c in self.conflicts if c.severity == "LOW"]
