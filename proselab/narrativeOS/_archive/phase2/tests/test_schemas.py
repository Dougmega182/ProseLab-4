"""
Tests for narrative_os.schemas.

Run with:  pytest narrative_os/tests/test_schemas.py -v
"""

from __future__ import annotations

import json

import pytest
from pydantic import ValidationError

from schemas import (
    CanonEntry,
    Conflict,
    ConflictReport,
    StateDelta,
)


# ---------------------------------------------------------------------------
# CanonEntry
# ---------------------------------------------------------------------------

class TestCanonEntry:
    def test_minimal_world_rule_validates(self):
        e = CanonEntry(
            id="world.ics_scale",
            namespace="world",
            value="ICS cannot exceed 3 without cascade collapse.",
            confidence="hard_canon",
            source_chapter=4,
            extracted_at_pass="ch4_seed",
        )
        assert e.is_active() is True
        assert e.entity is None
        assert e.aliases == []

    def test_character_entry_validates(self):
        e = CanonEntry(
            id="hayden.fade_status",
            namespace="character",
            entity="Hayden",
            aliases=["Hayden D.", "the carrier"],
            value="Body phasing intermittently; right hand visible 3s in baseline.",
            confidence="inferred",
            source_chapter=12,
            extracted_at_pass="ch12_v1",
        )
        assert e.matches_entity("Hayden") is True
        assert e.matches_entity("hayden d.") is True
        assert e.matches_entity("the carrier") is True
        assert e.matches_entity("Kain") is False
        assert e.matches_entity("") is False

    def test_round_trip_json(self):
        original = CanonEntry(
            id="world.fade_mechanics",
            namespace="world",
            value="The Fade escalates with each unauthorized transition.",
            confidence="hard_canon",
            source_chapter=1,
            extracted_at_pass="seed",
        )
        as_json = original.model_dump_json()
        restored = CanonEntry.model_validate_json(as_json)
        assert restored == original

    def test_id_must_be_dotted(self):
        with pytest.raises(ValidationError, match="namespaced"):
            CanonEntry(
                id="no_dot_here",
                namespace="world",
                value="x",
                confidence="hard_canon",
                source_chapter=0,
                extracted_at_pass="seed",
            )

    def test_id_must_not_contain_whitespace(self):
        with pytest.raises(ValidationError, match="whitespace"):
            CanonEntry(
                id="bad id.foo",
                namespace="world",
                value="x",
                confidence="hard_canon",
                source_chapter=0,
                extracted_at_pass="seed",
            )

    def test_character_namespace_requires_entity(self):
        with pytest.raises(ValidationError, match="requires `entity`"):
            CanonEntry(
                id="someone.trait",
                namespace="character",
                entity=None,
                value="x",
                confidence="hard_canon",
                source_chapter=1,
                extracted_at_pass="seed",
            )

    def test_value_cannot_be_empty(self):
        with pytest.raises(ValidationError):
            CanonEntry(
                id="world.x",
                namespace="world",
                value="",
                confidence="hard_canon",
                source_chapter=0,
                extracted_at_pass="seed",
            )

    def test_source_chapter_non_negative(self):
        with pytest.raises(ValidationError):
            CanonEntry(
                id="world.x",
                namespace="world",
                value="x",
                confidence="hard_canon",
                source_chapter=-1,
                extracted_at_pass="seed",
            )

    def test_supersession_marks_inactive(self):
        e = CanonEntry(
            id="hayden.ics_threshold",
            namespace="character",
            entity="Hayden",
            value="ICS ceiling 3.",
            confidence="hard_canon",
            source_chapter=4,
            extracted_at_pass="ch4_seed",
            superseded_by="hayden.ics_threshold_v2",
        )
        assert e.is_active() is False


# ---------------------------------------------------------------------------
# StateDelta
# ---------------------------------------------------------------------------

class TestStateDelta:
    def _make_entry(self, id_: str, chapter: int, namespace: str = "plot",
                    entity: str | None = None) -> CanonEntry:
        return CanonEntry(
            id=id_,
            namespace=namespace,
            entity=entity,
            value="some value",
            confidence="event",
            source_chapter=chapter,
            extracted_at_pass=f"ch{chapter}_v1",
        )

    def test_empty_delta_validates(self):
        d = StateDelta(chapter=5, pass_id="ch5_v1")
        assert d.new_entries == []
        assert d.resolved_loops == []
        assert d.new_loops == []

    def test_delta_with_entries_validates(self):
        d = StateDelta(
            chapter=5,
            pass_id="ch5_v1",
            new_entries=[self._make_entry("plot.docks_incident", 5)],
            resolved_loops=["plot.who_sabotaged_engine"],
            new_loops=[self._make_entry("plot.aspect_identity", 5)],
            tone_notes=["Voice tightens in the interrogation scene."],
        )
        assert len(d.new_entries) == 1
        assert len(d.new_loops) == 1

    def test_new_loops_must_be_plot_namespace(self):
        bad_loop = CanonEntry(
            id="hayden.something",
            namespace="character",
            entity="Hayden",
            value="x",
            confidence="inferred",
            source_chapter=5,
            extracted_at_pass="ch5_v1",
        )
        with pytest.raises(ValidationError, match="namespace='plot'"):
            StateDelta(chapter=5, pass_id="ch5_v1", new_loops=[bad_loop])

    def test_entry_chapter_must_match_delta_chapter(self):
        mismatched = self._make_entry("plot.x", chapter=7)
        with pytest.raises(ValidationError, match="source_chapter=7"):
            StateDelta(chapter=5, pass_id="ch5_v1", new_entries=[mismatched])

    def test_round_trip_json(self):
        d = StateDelta(
            chapter=5,
            pass_id="ch5_v1",
            new_entries=[self._make_entry("plot.x", 5)],
        )
        restored = StateDelta.model_validate_json(d.model_dump_json())
        assert restored == d


# ---------------------------------------------------------------------------
# Conflict / ConflictReport
# ---------------------------------------------------------------------------

class TestConflict:
    def _make_conflict(self, severity: str = "HIGH") -> Conflict:
        return Conflict(
            severity=severity,  # type: ignore[arg-type]
            type="CANON_VIOLATION",
            existing_entry_id="world.ics_scale",
            existing_value="ICS cannot exceed 3.",
            existing_source=4,
            incoming_value="Hayden sustained ICS 5 for 40 minutes.",
            incoming_source=12,
            suggested_action="block",
            note="Hard canon contradiction.",
        )

    def test_conflict_validates(self):
        c = self._make_conflict()
        assert c.severity == "HIGH"

    def test_report_clean_when_no_conflicts(self):
        r = ConflictReport(chapter=5, pass_id="ch5_v1", conflicts=[], clean_to_merge=True)
        assert r.clean_to_merge is True
        assert r.high() == []

    def test_report_rejects_clean_flag_with_high_conflict(self):
        with pytest.raises(ValidationError, match="inconsistent"):
            ConflictReport(
                chapter=5,
                pass_id="ch5_v1",
                conflicts=[self._make_conflict("HIGH")],
                clean_to_merge=True,
            )

    def test_report_allows_clean_flag_with_low_conflict(self):
        c = self._make_conflict("LOW")
        r = ConflictReport(
            chapter=5,
            pass_id="ch5_v1",
            conflicts=[c],
            clean_to_merge=True,
        )
        assert r.clean_to_merge is True
        assert len(r.low()) == 1
        assert r.high() == []

    def test_severity_partition(self):
        confs = [
            self._make_conflict("HIGH"),
            self._make_conflict("MEDIUM"),
            self._make_conflict("LOW"),
            self._make_conflict("MEDIUM"),
        ]
        r = ConflictReport(
            chapter=5,
            pass_id="ch5_v1",
            conflicts=confs,
            clean_to_merge=False,
        )
        assert len(r.high()) == 1
        assert len(r.medium()) == 2
        assert len(r.low()) == 1

    def test_round_trip_json(self):
        r = ConflictReport(
            chapter=5,
            pass_id="ch5_v1",
            conflicts=[self._make_conflict("MEDIUM")],
            clean_to_merge=False,
        )
        restored = ConflictReport.model_validate_json(r.model_dump_json())
        assert restored == r


# ---------------------------------------------------------------------------
# Worked example: the "ICS scale" seed entry, as advertised in the plan
# ---------------------------------------------------------------------------

def test_ics_scale_seed_entry_round_trips():
    entry = CanonEntry(
        id="world.ics_scale",
        namespace="world",
        value=(
            "ICS (Instance Coherence Scale) measures structural integrity of an "
            "instance during transition. Threshold 3 is the documented ceiling; "
            "exceeding it without cascade-suppression protocols results in "
            "catastrophic decoherence."
        ),
        confidence="hard_canon",
        source_chapter=4,
        extracted_at_pass="seed",
    )
    as_dict = json.loads(entry.model_dump_json())
    assert as_dict["id"] == "world.ics_scale"
    assert as_dict["confidence"] == "hard_canon"
    assert as_dict["superseded_by"] is None
    restored = CanonEntry.model_validate(as_dict)
    assert restored == entry
