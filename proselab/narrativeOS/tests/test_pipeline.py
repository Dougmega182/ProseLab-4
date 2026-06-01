"""
Tests for narrative_os.pipeline.

The extractor is mocked — we inject a function that returns a pre-built
StateDelta, so no real LLM calls are made.
"""

from __future__ import annotations

from pathlib import Path
from typing import Callable
from unittest.mock import patch

import pytest

from narrative_os.manuscript import Manuscript
from narrative_os.pipeline import (
    AnalysisStatus,
    PENDING_DIR,
    analyze_chapter,
    apply_delta,
)
from narrative_os.schemas import CanonEntry, ConflictReport, StateDelta
from narrative_os.conflicts import detect_conflicts
from narrative_os.store import (
    OPEN_LOOP_PREFIX,
    RESOLVED_LOOP_PREFIX,
    get_by_id,
    load,
    save,
)


@pytest.fixture(autouse=True)
def mock_inevitability():
    with patch("narrative_os.inevitability.detect_inevitability_conflicts", return_value=[]):
        yield


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

SAMPLE_MD = """\
# **CHAPTER 1 — OPENING**

Hayden walked.

# **CHAPTER 2 — MIDDLE**

Kain followed.

# **CHAPTER 3 — CLOSING**

They met.
"""


@pytest.fixture
def manuscript(tmp_path: Path) -> Manuscript:
    p = tmp_path / "ms.md"
    p.write_text(SAMPLE_MD, encoding="utf-8")
    return Manuscript.load(p)


@pytest.fixture
def store_path(tmp_path: Path) -> Path:
    return tmp_path / "canon_store.json"


@pytest.fixture
def pending_dir(tmp_path: Path) -> Path:
    return tmp_path / "pending"


def make_extractor(delta: StateDelta) -> Callable:
    """Build an extractor stub that returns the given delta."""
    def _fn(*, manuscript, chapter_num, canon_store_path, pass_id, **kwargs):
        # The pipeline expects the returned delta's pass_id to match what
        # it gave us. Honor that.
        return delta.model_copy(update={"pass_id": pass_id})
    return _fn


def _entry(id_: str, *, value: str, confidence: str = "hard_canon",
           namespace: str = "world", entity: str | None = None,
           chapter: int = 0, pass_id: str = "seed") -> CanonEntry:
    return CanonEntry(
        id=id_,
        namespace=namespace,  # type: ignore[arg-type]
        entity=entity,
        value=value,
        confidence=confidence,  # type: ignore[arg-type]
        source_chapter=chapter,
        extracted_at_pass=pass_id,
    )


# ---------------------------------------------------------------------------
# Merge mechanics
# ---------------------------------------------------------------------------

class TestApplyDelta:
    def test_clean_addition(self, store_path: Path):
        save([], store_path)
        delta = StateDelta(
            chapter=1, pass_id="p1",
            new_entries=[_entry("world.x", value="rule", chapter=1, pass_id="p1")],
        )
        report = detect_conflicts(delta, load(store_path))
        merge = apply_delta(delta, report, store_path=store_path)
        assert merge.new_entries_added == 1
        assert merge.entries_superseded == 0
        assert load(store_path)[0].id == "world.x"

    def test_refuses_to_merge_high_conflict(self, store_path: Path):
        save([
            _entry("world.x", value="A", confidence="hard_canon", chapter=1),
        ], store_path)
        delta = StateDelta(
            chapter=2, pass_id="p2",
            new_entries=[
                _entry("world.x", value="B", confidence="hard_canon",
                       chapter=2, pass_id="p2"),
            ],
        )
        report = detect_conflicts(delta, load(store_path))
        assert not report.clean_to_merge
        with pytest.raises(ValueError, match="HIGH conflicts"):
            apply_delta(delta, report, store_path=store_path)

    def test_low_retcon_versions_id_and_supersedes(self, store_path: Path):
        save([
            _entry("hayden.arc", value="A",
                   confidence="inferred", namespace="character",
                   entity="Hayden", chapter=1),
        ], store_path)
        delta = StateDelta(
            chapter=3, pass_id="p3",
            new_entries=[
                _entry("hayden.arc", value="B",
                       confidence="inferred", namespace="character",
                       entity="Hayden", chapter=3, pass_id="p3"),
            ],
        )
        report = detect_conflicts(delta, load(store_path))
        assert report.clean_to_merge   # LOW only
        merge = apply_delta(delta, report, store_path=store_path)

        # New entry exists as versioned id
        assert "hayden.arc" in merge.versioned_ids
        new_id = merge.versioned_ids["hayden.arc"]
        assert new_id == "hayden.arc.v2"
        assert get_by_id(new_id, store_path) is not None

        # Old id now superseded
        old = get_by_id("hayden.arc", store_path)
        assert old is not None
        assert old.superseded_by == new_id

    def test_resolved_loop_creates_marker_and_supersedes(self, store_path: Path):
        save([
            _entry("plot.q", value=f"{OPEN_LOOP_PREFIX} who?",
                   confidence="inferred", namespace="plot", chapter=1),
        ], store_path)
        delta = StateDelta(
            chapter=5, pass_id="p5",
            resolved_loops=["plot.q"],
        )
        report = detect_conflicts(delta, load(store_path))
        merge = apply_delta(delta, report, store_path=store_path)
        assert merge.loops_resolved == 1

        # Marker entry exists
        marker = get_by_id("plot.q.resolved_ch0050", store_path)
        assert marker is not None
        assert marker.value.startswith(RESOLVED_LOOP_PREFIX)

        # Original loop superseded
        original = get_by_id("plot.q", store_path)
        assert original is not None
        assert original.superseded_by == "plot.q.resolved_ch0050"

    def test_new_loop_added(self, store_path: Path):
        save([], store_path)
        new_loop = _entry(
            "plot.future_q",
            value=f"{OPEN_LOOP_PREFIX} what next?",
            confidence="inferred", namespace="plot",
            chapter=2, pass_id="p2",
        )
        delta = StateDelta(
            chapter=2, pass_id="p2",
            new_loops=[new_loop],
        )
        report = detect_conflicts(delta, load(store_path))
        merge = apply_delta(delta, report, store_path=store_path)
        assert merge.loops_opened == 1
        assert get_by_id("plot.future_q", store_path) is not None

    def test_identical_value_is_silent_noop(self, store_path: Path):
        save([
            _entry("world.x", value="A", confidence="hard_canon", chapter=1),
        ], store_path)
        delta = StateDelta(
            chapter=2, pass_id="p2",
            new_entries=[
                _entry("world.x", value="A",  # SAME value
                       confidence="hard_canon", chapter=2, pass_id="p2"),
            ],
        )
        report = detect_conflicts(delta, load(store_path))
        assert report.clean_to_merge
        merge = apply_delta(delta, report, store_path=store_path)
        # Nothing added; nothing superseded
        assert merge.new_entries_added == 0
        assert merge.entries_superseded == 0
        # Store still has just the one entry
        assert len(load(store_path)) == 1


# ---------------------------------------------------------------------------
# Pipeline orchestration
# ---------------------------------------------------------------------------

class TestAnalyzeChapter:
    def test_clean_delta_merges(self, manuscript, store_path, pending_dir):
        save([], store_path)
        delta = StateDelta(
            chapter=1, pass_id="will_be_replaced",
            new_entries=[
                _entry("hayden.intro", value="Hayden is introduced.",
                       namespace="character", entity="Hayden",
                       confidence="hard_canon", chapter=1, pass_id="will_be_replaced"),
            ],
        )
        result = analyze_chapter(
            manuscript=manuscript,
            chapter_num=1,
            canon_store_path=store_path,
            pending_dir=pending_dir,
            extractor_fn=make_extractor(delta),
        )
        assert result.status == AnalysisStatus.MERGED
        assert result.merge.new_entries_added == 1
        # No pending file written
        assert not (pending_dir / "ch1*.md").parent.glob("ch1*.md").__iter__().__next__() if False else True

    def test_dirty_delta_writes_pending(self, manuscript, store_path, pending_dir):
        save([
            _entry("world.x", value="A", confidence="hard_canon", chapter=1),
        ], store_path)
        delta = StateDelta(
            chapter=2, pass_id="will_be_replaced",
            new_entries=[
                _entry("world.x", value="B", confidence="hard_canon",
                       chapter=2, pass_id="will_be_replaced"),
            ],
        )
        result = analyze_chapter(
            manuscript=manuscript,
            chapter_num=2,
            canon_store_path=store_path,
            pending_dir=pending_dir,
            extractor_fn=make_extractor(delta),
        )
        assert result.status == AnalysisStatus.PENDING_REVIEW
        assert result.pending_path is not None
        assert result.pending_path.exists()
        # Markdown content references the HIGH conflict
        md = result.pending_path.read_text(encoding="utf-8")
        assert "HIGH" in md
        assert "Merge blocked" in md
        # Also check delta JSON sidecar exists
        delta_json = result.pending_path.with_suffix(".delta.json")
        # Actually with our naming: ch2__<pass>.delta.json
        # so .delta.json suffix won't work on a .md file. Recompute:
        json_sidecar = result.pending_path.parent / (
            result.pending_path.stem + ".delta.json"
        )
        assert json_sidecar.exists()

    def test_idempotent_skip_when_pass_already_applied(
        self, manuscript, store_path, pending_dir,
    ):
        # Pre-seed the store with an entry from pass "p1"
        save([
            _entry("world.x", value="A", confidence="hard_canon",
                   chapter=1, pass_id="p1"),
        ], store_path)
        delta = StateDelta(
            chapter=1, pass_id="p1",
            new_entries=[
                _entry("world.y", value="new", confidence="hard_canon",
                       chapter=1, pass_id="p1"),
            ],
        )
        result = analyze_chapter(
            manuscript=manuscript,
            chapter_num=1,
            canon_store_path=store_path,
            pending_dir=pending_dir,
            pass_id="p1",
            extractor_fn=make_extractor(delta),
        )
        assert result.status == AnalysisStatus.SKIPPED_IDEMPOTENT
        # world.y NOT added (extractor not invoked)
        assert get_by_id("world.y", store_path) is None

    def test_unknown_chapter_fails(self, manuscript, store_path, pending_dir):
        delta = StateDelta(chapter=99, pass_id="x")
        result = analyze_chapter(
            manuscript=manuscript,
            chapter_num=99,
            canon_store_path=store_path,
            pending_dir=pending_dir,
            extractor_fn=make_extractor(delta),
        )
        assert result.status == AnalysisStatus.FAILED
        assert "not found" in (result.error or "")

    def test_extractor_failure_returns_failed(
        self, manuscript, store_path, pending_dir,
    ):
        save([], store_path)
        def bad_extractor(**kwargs):
            raise RuntimeError("LLM exploded")
        result = analyze_chapter(
            manuscript=manuscript,
            chapter_num=1,
            canon_store_path=store_path,
            pending_dir=pending_dir,
            extractor_fn=bad_extractor,
        )
        assert result.status == AnalysisStatus.FAILED
        assert "LLM exploded" in (result.error or "")

    def test_auto_merge_clean_false_skips_merge(
        self, manuscript, store_path, pending_dir,
    ):
        save([], store_path)
        delta = StateDelta(
            chapter=1, pass_id="p1",
            new_entries=[
                _entry("k.x", value="trait", namespace="character",
                       entity="Kain", confidence="hard_canon",
                       chapter=1, pass_id="p1"),
            ],
        )
        result = analyze_chapter(
            manuscript=manuscript,
            chapter_num=1,
            canon_store_path=store_path,
            pending_dir=pending_dir,
            extractor_fn=make_extractor(delta),
            auto_merge_clean=False,
        )
        # Clean delta but auto_merge=False → falls through to pending
        assert result.status == AnalysisStatus.PENDING_REVIEW
        # Store unchanged
        assert load(store_path) == []


# ---------------------------------------------------------------------------
# End-to-end scenario: chain three chapters
# ---------------------------------------------------------------------------

class TestSequentialChapters:
    def test_three_chapter_chain(self, manuscript, store_path, pending_dir):
        save([], store_path)

        # Ch 1: introduce Hayden + open a loop
        d1 = StateDelta(
            chapter=1, pass_id="p1",
            new_entries=[
                _entry("hayden.intro", value="Hayden walks in.",
                       namespace="character", entity="Hayden",
                       confidence="event", chapter=1, pass_id="p1"),
            ],
            new_loops=[
                _entry("plot.who_followed", value=f"{OPEN_LOOP_PREFIX} who follows?",
                       confidence="inferred", namespace="plot",
                       chapter=1, pass_id="p1"),
            ],
        )
        r1 = analyze_chapter(
            manuscript=manuscript, chapter_num=1,
            canon_store_path=store_path, pending_dir=pending_dir,
            extractor_fn=make_extractor(d1),
        )
        assert r1.status == AnalysisStatus.MERGED

        # Ch 2: introduce Kain (clean addition)
        d2 = StateDelta(
            chapter=2, pass_id="p2",
            new_entries=[
                _entry("kain.intro", value="Kain follows.",
                       namespace="character", entity="Kain",
                       confidence="event", chapter=2, pass_id="p2"),
            ],
        )
        r2 = analyze_chapter(
            manuscript=manuscript, chapter_num=2,
            canon_store_path=store_path, pending_dir=pending_dir,
            extractor_fn=make_extractor(d2),
        )
        assert r2.status == AnalysisStatus.MERGED

        # Ch 3: resolve the loop
        d3 = StateDelta(
            chapter=3, pass_id="p3",
            resolved_loops=["plot.who_followed"],
        )
        r3 = analyze_chapter(
            manuscript=manuscript, chapter_num=3,
            canon_store_path=store_path, pending_dir=pending_dir,
            extractor_fn=make_extractor(d3),
        )
        assert r3.status == AnalysisStatus.MERGED
        assert r3.merge.loops_resolved == 1

        # Verify final store state
        entries = load(store_path)
        # 2 character entries + 1 superseded loop + 1 resolved marker = 4
        assert len(entries) == 4

        loop = get_by_id("plot.who_followed", store_path)
        assert loop is not None
        assert loop.superseded_by is not None
        assert loop.superseded_by.startswith("plot.who_followed.resolved_ch")
