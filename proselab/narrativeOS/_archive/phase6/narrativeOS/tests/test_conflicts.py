"""Tests for narrative_os.conflicts."""

from __future__ import annotations

import pytest

from narrative_os.conflicts import (
    detect_conflicts,
    render_report_markdown,
    values_differ_substantively,
)
from narrative_os.schemas import (
    CanonEntry,
    ConflictReport,
    StateDelta,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _e(id_: str, *, value: str, confidence: str = "hard_canon",
       namespace: str = "world", entity: str | None = None,
       chapter: int = 0, superseded_by: str | None = None) -> CanonEntry:
    return CanonEntry(
        id=id_,
        namespace=namespace,  # type: ignore[arg-type]
        entity=entity,
        value=value,
        confidence=confidence,  # type: ignore[arg-type]
        source_chapter=chapter,
        extracted_at_pass="seed",
        superseded_by=superseded_by,
    )


def _delta(chapter: int = 5, *, new_entries=None, resolved_loops=None,
           new_loops=None) -> StateDelta:
    return StateDelta(
        chapter=chapter,
        pass_id=f"ch{chapter}_v1",
        new_entries=new_entries or [],
        resolved_loops=resolved_loops or [],
        new_loops=new_loops or [],
    )


# ---------------------------------------------------------------------------
# Value normalization
# ---------------------------------------------------------------------------

class TestValueNormalization:
    def test_identical_strings_dont_differ(self):
        assert not values_differ_substantively("Hello world.", "Hello world.")

    def test_whitespace_doesnt_count(self):
        assert not values_differ_substantively("a  b\n c", "a b c")

    def test_case_doesnt_count(self):
        assert not values_differ_substantively("Hello", "HELLO")

    def test_punctuation_doesnt_count(self):
        assert not values_differ_substantively("Hello, world.", "Hello world")

    def test_real_difference_detected(self):
        assert values_differ_substantively("ICS ceiling is 3.", "ICS ceiling is 5.")

    def test_empty_strings_match(self):
        assert not values_differ_substantively("", "")


# ---------------------------------------------------------------------------
# Hard canon violations
# ---------------------------------------------------------------------------

class TestHardCanonViolations:
    def test_hard_canon_same_id_different_value_is_high(self):
        existing = _e("world.ics", value="ICS ceiling is 3.",
                      confidence="hard_canon", chapter=4)
        incoming = _e("world.ics", value="ICS ceiling is 5.",
                      confidence="hard_canon", chapter=12)
        report = detect_conflicts(_delta(12, new_entries=[incoming]), [existing])
        assert len(report.high()) == 1
        assert report.high()[0].type == "CANON_VIOLATION"
        assert report.high()[0].suggested_action == "block"
        assert report.clean_to_merge is False

    def test_hard_canon_same_value_no_conflict(self):
        existing = _e("world.ics", value="ICS ceiling is 3.",
                      confidence="hard_canon", chapter=4)
        incoming = _e("world.ics", value="ICS ceiling is 3.",
                      confidence="hard_canon", chapter=12)
        report = detect_conflicts(_delta(12, new_entries=[incoming]), [existing])
        assert report.conflicts == []
        assert report.clean_to_merge is True


# ---------------------------------------------------------------------------
# Event timeline conflicts
# ---------------------------------------------------------------------------

class TestEventConflicts:
    def test_event_value_change_is_medium(self):
        existing = _e("plot.ch4_event", value="Hayden transitions at 09:00.",
                      confidence="event", namespace="plot", chapter=4)
        incoming = _e("plot.ch4_event", value="Hayden transitions at 14:00.",
                      confidence="event", namespace="plot", chapter=4)
        report = detect_conflicts(_delta(4, new_entries=[incoming]), [existing])
        assert len(report.medium()) == 1
        assert report.medium()[0].type == "TIMELINE"
        assert report.medium()[0].suggested_action == "flag"
        # MEDIUM does not block merge
        assert report.clean_to_merge is True


# ---------------------------------------------------------------------------
# Inferred (interpretive) reinterpretations
# ---------------------------------------------------------------------------

class TestInferredReinterpretations:
    def test_inferred_character_change_is_low(self):
        existing = _e("hayden.arc", value="Hayden is unaware of his Fade.",
                      confidence="inferred", namespace="character",
                      entity="Hayden", chapter=2)
        incoming = _e("hayden.arc", value="Hayden suspects his own Fade but suppresses it.",
                      confidence="inferred", namespace="character",
                      entity="Hayden", chapter=5)
        report = detect_conflicts(_delta(5, new_entries=[incoming]), [existing])
        assert len(report.low()) == 1
        assert report.low()[0].type == "CHARACTER_STATE"
        assert report.low()[0].suggested_action == "retcon"
        assert report.clean_to_merge is True

    def test_inferred_plot_change_classified_as_timeline(self):
        existing = _e("plot.aspect_theory", value="Aspect operates within QSA.",
                      confidence="inferred", namespace="plot", chapter=3)
        incoming = _e("plot.aspect_theory", value="Aspect operates outside QSA control.",
                      confidence="inferred", namespace="plot", chapter=8)
        report = detect_conflicts(_delta(8, new_entries=[incoming]), [existing])
        assert len(report.low()) == 1
        assert report.low()[0].type == "TIMELINE"


# ---------------------------------------------------------------------------
# Loop resolution validation
# ---------------------------------------------------------------------------

class TestLoopResolution:
    def test_resolving_known_open_loop_is_clean(self):
        loop = _e("plot.who_did_it", value="OPEN: who sabotaged the engine?",
                  confidence="inferred", namespace="plot", chapter=2)
        report = detect_conflicts(
            _delta(5, resolved_loops=["plot.who_did_it"]),
            [loop],
        )
        assert report.conflicts == []
        assert report.clean_to_merge is True

    def test_resolving_unknown_loop_is_high(self):
        report = detect_conflicts(
            _delta(5, resolved_loops=["plot.totally_made_up"]),
            [],
        )
        assert len(report.high()) == 1
        assert report.high()[0].type == "LOOP_DOUBLE_RESOLVE"
        assert "unknown" in (report.high()[0].note or "").lower()

    def test_resolving_already_superseded_loop_is_medium(self):
        loop = _e("plot.q", value="OPEN: question",
                  confidence="inferred", namespace="plot",
                  chapter=2, superseded_by="plot.q_resolved")
        report = detect_conflicts(
            _delta(5, resolved_loops=["plot.q"]),
            [loop],
        )
        assert len(report.medium()) == 1
        assert "already superseded" in (report.medium()[0].note or "").lower()

    def test_resolving_non_open_entry_is_medium(self):
        # Entry exists, active, but isn't an OPEN: loop — it's a regular fact
        not_a_loop = _e("plot.event_x", value="The dog barked.",
                        confidence="event", namespace="plot", chapter=2)
        report = detect_conflicts(
            _delta(5, resolved_loops=["plot.event_x"]),
            [not_a_loop],
        )
        assert len(report.medium()) == 1
        assert "isn't an open loop" in (report.medium()[0].note or "").lower()


# ---------------------------------------------------------------------------
# new_loops well-formedness
# ---------------------------------------------------------------------------

class TestNewLoopFormat:
    def test_new_loop_without_open_prefix_is_low(self):
        bad_loop = _e("plot.dangling", value="Something will happen.",
                      confidence="inferred", namespace="plot", chapter=5)
        report = detect_conflicts(_delta(5, new_loops=[bad_loop]), [])
        assert len(report.low()) == 1
        assert "open:" in (report.low()[0].note or "").lower()

    def test_well_formed_new_loop_is_clean(self):
        good_loop = _e("plot.future_q", value="OPEN: will it work?",
                       confidence="inferred", namespace="plot", chapter=5)
        report = detect_conflicts(_delta(5, new_loops=[good_loop]), [])
        assert report.conflicts == []


# ---------------------------------------------------------------------------
# Clean additions
# ---------------------------------------------------------------------------

class TestCleanAdditions:
    def test_new_id_with_no_existing_is_clean(self):
        incoming = _e("kain.new_trait", value="Drinks black coffee.",
                      namespace="character", entity="Kain",
                      confidence="hard_canon", chapter=5)
        report = detect_conflicts(_delta(5, new_entries=[incoming]), [])
        assert report.conflicts == []
        assert report.clean_to_merge is True

    def test_empty_delta_is_clean(self):
        report = detect_conflicts(_delta(5), [])
        assert report.conflicts == []
        assert report.clean_to_merge is True


# ---------------------------------------------------------------------------
# Superseded id reuse
# ---------------------------------------------------------------------------

class TestSupersededIdReuse:
    def test_writing_to_superseded_id_is_low_flag(self):
        old = _e("hayden.v1", value="old trait",
                 confidence="inferred", namespace="character",
                 entity="Hayden", chapter=2,
                 superseded_by="hayden.v2")
        incoming = _e("hayden.v1", value="trying to revive",
                      confidence="inferred", namespace="character",
                      entity="Hayden", chapter=5)
        report = detect_conflicts(_delta(5, new_entries=[incoming]), [old])
        assert len(report.low()) == 1
        assert "superseded id" in (report.low()[0].note or "").lower()


# ---------------------------------------------------------------------------
# Aggregate / multi-conflict
# ---------------------------------------------------------------------------

class TestAggregate:
    def test_mixed_severities_aggregated(self):
        hard = _e("world.x", value="A", confidence="hard_canon", chapter=1)
        ev = _e("plot.y", value="B", confidence="event",
                namespace="plot", chapter=2)
        inf = _e("z.arc", value="C", confidence="inferred",
                 namespace="character", entity="Z", chapter=3)

        # All three conflict on incoming values
        delta = _delta(5, new_entries=[
            _e("world.x", value="A_NEW", confidence="hard_canon", chapter=5),
            _e("plot.y", value="B_NEW", confidence="event",
               namespace="plot", chapter=5),
            _e("z.arc", value="C_NEW", confidence="inferred",
               namespace="character", entity="Z", chapter=5),
        ])
        report = detect_conflicts(delta, [hard, ev, inf])

        assert len(report.high()) == 1
        assert len(report.medium()) == 1
        assert len(report.low()) == 1
        assert report.clean_to_merge is False   # has HIGH


# ---------------------------------------------------------------------------
# Markdown rendering
# ---------------------------------------------------------------------------

class TestMarkdownRender:
    def test_clean_report_renders(self):
        report = detect_conflicts(_delta(5), [])
        md = render_report_markdown(report)
        assert "Chapter 5" in md
        assert "Clean" in md

    def test_high_conflict_renders_with_block_action(self):
        existing = _e("world.ics", value="3.", confidence="hard_canon", chapter=4)
        incoming = _e("world.ics", value="5.", confidence="hard_canon", chapter=12)
        report = detect_conflicts(_delta(12, new_entries=[incoming]), [existing])
        md = render_report_markdown(report)
        assert "HIGH" in md
        assert "Merge blocked" in md
        assert "block" in md
        assert "world.ics" in md
        # Existing source chapter shown
        assert "Ch 4" in md
        assert "Ch 12" in md

    def test_delta_summary_included_when_provided(self):
        existing = _e("plot.q", value="OPEN: question",
                      confidence="inferred", namespace="plot", chapter=2)
        new_loop = _e("plot.q2", value="OPEN: another question",
                      confidence="inferred", namespace="plot", chapter=5)
        delta = _delta(5,
                       resolved_loops=["plot.q"],
                       new_loops=[new_loop])
        delta = StateDelta(
            chapter=5,
            pass_id=delta.pass_id,
            resolved_loops=["plot.q"],
            new_loops=[new_loop],
            tone_notes=["Voice tightens during interrogation."],
        )
        report = detect_conflicts(delta, [existing])
        md = render_report_markdown(report, delta=delta)
        assert "Delta summary" in md
        assert "resolved loops: 1" in md
        assert "new loops: 1" in md
        assert "Voice tightens" in md


# ---------------------------------------------------------------------------
# QS-flavored integration scenario
# ---------------------------------------------------------------------------

class TestQSScenario:
    """Realistic scenario based on the actual QS canon shape."""

    def test_ics_canon_violation_in_ch12(self):
        # Existing canon: ICS ceiling 3 (from Ch 4 seeded data)
        canon = [
            _e("world.ics_scale",
               value="ICS ceiling is 3; exceeding causes cascade collapse.",
               confidence="hard_canon", chapter=4),
        ]
        # Hypothetical bad extraction: Ch 12 says ICS ceiling is 28
        bad_delta = _delta(12, new_entries=[
            _e("world.ics_scale",
               value="ICS reaches 28 at Alfred Crescent without collapse.",
               confidence="hard_canon", chapter=12),
        ])
        report = detect_conflicts(bad_delta, canon)
        assert not report.clean_to_merge
        assert len(report.high()) == 1
        assert report.high()[0].type == "CANON_VIOLATION"
        # This is exactly the kind of contradiction the system exists to catch
        md = render_report_markdown(report)
        assert "Merge blocked" in md

    def test_aspect_inference_evolves_cleanly(self):
        # Aspect started as inferred; Ch 10 updates the reading
        canon = [
            _e("aspect.identity",
               value="Aspect appears to be a rogue QSA agent.",
               confidence="inferred", namespace="character",
               entity="Aspect", chapter=3),
        ]
        delta = _delta(10, new_entries=[
            _e("aspect.identity",
               value="Aspect is an entity operating with QSA support, not against it.",
               confidence="inferred", namespace="character",
               entity="Aspect", chapter=10),
        ])
        report = detect_conflicts(delta, canon)
        assert report.clean_to_merge is True
        assert len(report.low()) == 1
        assert report.low()[0].suggested_action == "retcon"
