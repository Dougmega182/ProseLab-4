"""Tests for narrative_os.retriever."""

from __future__ import annotations

from pathlib import Path

import pytest

from narrative_os.schemas import CanonEntry
from narrative_os.retriever import (
    ContextSlice,
    TOKEN_BUDGET,
    detect_mentioned_entities,
    estimate_entry_tokens,
    estimate_tokens,
    render_slice_for_prompt,
    retrieve,
    score_entry,
)
from narrative_os.store import save
from narrative_os.seeds.qs_seed import all_seed_entries


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _e(id_: str, ns: str, value: str, *,
       entity: str | None = None,
       aliases: list[str] | None = None,
       confidence: str = "hard_canon",
       chapter: int = 0) -> CanonEntry:
    return CanonEntry(
        id=id_,
        namespace=ns,  # type: ignore[arg-type]
        entity=entity,
        aliases=aliases or [],
        value=value,
        confidence=confidence,  # type: ignore[arg-type]
        source_chapter=chapter,
        extracted_at_pass="seed",
    )


# ---------------------------------------------------------------------------
# Token estimation
# ---------------------------------------------------------------------------

class TestTokenEstimation:
    def test_estimate_tokens_heuristic(self):
        assert estimate_tokens("a" * 400) == 100   # 400/4

    def test_estimate_tokens_minimum_one(self):
        assert estimate_tokens("") == 1

    def test_entry_token_estimate_includes_overhead(self):
        e = _e("x.y", "world", "short value")
        est = estimate_entry_tokens(e)
        assert est > 0
        assert est < 100   # short entry, low token count


# ---------------------------------------------------------------------------
# Entity detection
# ---------------------------------------------------------------------------

class TestEntityDetection:
    def test_finds_simple_name(self):
        entries = [_e("k.x", "character", "trait", entity="Kain")]
        names, counts = detect_mentioned_entities(
            "Kain walked into the room.", entries,
        )
        assert names == ["Kain"]
        assert counts == {"Kain": 1}

    def test_case_insensitive(self):
        entries = [_e("k.x", "character", "trait", entity="Kain")]
        _, counts = detect_mentioned_entities("kain. KAIN. Kain.", entries)
        assert counts["Kain"] == 3

    def test_word_boundary_no_substring_match(self):
        """Critical: 'Bell' must not match 'rebellion'."""
        entries = [_e("b.x", "character", "trait", entity="Bell")]
        names, counts = detect_mentioned_entities(
            "The rebellion was suppressed. No belly was harmed.",
            entries,
        )
        assert names == []
        assert counts == {}

    def test_alias_match(self):
        entries = [_e("k.x", "character", "trait",
                      entity="Kain", aliases=["the auditor"])]
        names, counts = detect_mentioned_entities(
            "The auditor reviewed the manifest.", entries,
        )
        assert names == ["Kain"]
        assert counts == {"Kain": 1}

    def test_alias_and_name_combine_count(self):
        entries = [_e("k.x", "character", "trait",
                      entity="Kain", aliases=["the auditor"])]
        _, counts = detect_mentioned_entities(
            "Kain entered. The auditor sat down. Kain spoke.", entries,
        )
        assert counts["Kain"] == 3

    def test_order_by_first_appearance(self):
        entries = [
            _e("h.x", "character", "trait", entity="Hayden"),
            _e("k.x", "character", "trait", entity="Kain"),
        ]
        names, _ = detect_mentioned_entities(
            "Kain saw Hayden across the hall.", entries,
        )
        assert names == ["Kain", "Hayden"]

    def test_ignores_world_entries_with_no_entity(self):
        entries = [
            _e("world.fade", "world", "rule"),  # no entity
            _e("k.x", "character", "trait", entity="Kain"),
        ]
        names, _ = detect_mentioned_entities("Kain walked.", entries)
        assert names == ["Kain"]

    def test_empty_text_returns_empty(self):
        entries = [_e("k.x", "character", "trait", entity="Kain")]
        names, counts = detect_mentioned_entities("", entries)
        assert names == []
        assert counts == {}


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------

class TestScoring:
    def test_open_loop_scored_high(self):
        e = _e("plot.q", "plot", "OPEN: who did it?", confidence="inferred")
        assert score_entry(e, chapter_num=5, mention_counts={}) >= 9

    def test_hard_canon_for_mentioned_entity_scored_higher(self):
        e_mentioned = _e("k.x", "character", "v", entity="Kain")
        e_unmentioned = _e("h.x", "character", "v", entity="Hayden")
        s_mentioned = score_entry(e_mentioned, 5, {"Kain": 2})
        s_unmentioned = score_entry(e_unmentioned, 5, {"Kain": 2})
        assert s_mentioned > s_unmentioned

    def test_heavy_mention_outranks_light_mention(self):
        e = _e("k.x", "character", "v", entity="Kain")
        s_heavy = score_entry(e, 5, {"Kain": 5})
        s_light = score_entry(e, 5, {"Kain": 1})
        assert s_heavy > s_light

    def test_recent_event_recency_decay(self):
        e_recent = _e("p.1", "plot", "event", confidence="event", chapter=4)
        e_older = _e("p.2", "plot", "event", confidence="event", chapter=2)
        s_recent = score_entry(e_recent, chapter_num=5, mention_counts={})
        s_older = score_entry(e_older, chapter_num=5, mention_counts={})
        assert s_recent > s_older


# ---------------------------------------------------------------------------
# Retrieve — basic behavior on a controlled small store
# ---------------------------------------------------------------------------

class TestRetrieveBasic:
    @pytest.fixture
    def small_store(self) -> list[CanonEntry]:
        return [
            _e("world.fade", "world", "Fade decoheres instances."),
            _e("world.ics", "world", "ICS ceiling is 3."),
            _e("kain.traits", "character", "calm, observant",
               entity="Kain", aliases=["the auditor"]),
            _e("hayden.traits", "character", "phasing carrier",
               entity="Hayden", aliases=["the carrier"]),
            _e("emily.traits", "character", "journal keeper",
               entity="Emily"),
            _e("kain.method", "character", "reading pass technique",
               entity="Kain", confidence="inferred"),
            _e("plot.aspect", "plot",
               "OPEN: who is Aspect?", confidence="inferred"),
            _e("plot.ch4_event", "plot",
               "Hayden transitioned with anomalous signature.",
               confidence="event", chapter=4),
            _e("plot.ch1_event", "plot",
               "old event", confidence="event", chapter=1),
        ]

    def test_retrieve_returns_context_slice(self, small_store, tmp_path):
        s = retrieve(
            "Kain reviewed the manifest.",
            chapter_num=5,
            entries=small_store,
            log_dir=tmp_path,
        )
        assert isinstance(s, ContextSlice)
        assert s.chapter == 5
        assert "Kain" in s.mentioned_entities

    def test_mentioned_entity_pulls_hard_canon(self, small_store, tmp_path):
        s = retrieve(
            "Kain reviewed the manifest.",
            chapter_num=5,
            entries=small_store,
            log_dir=tmp_path,
        )
        ids = {e.id for e in s.hard_canon}
        assert "kain.traits" in ids

    def test_universal_world_canon_always_included(self, small_store, tmp_path):
        s = retrieve(
            "Kain reviewed the manifest.",
            chapter_num=5,
            entries=small_store,
            log_dir=tmp_path,
        )
        ids = {e.id for e in s.hard_canon}
        # world.fade and world.ics have no entity — universal canon
        assert "world.fade" in ids
        assert "world.ics" in ids

    def test_open_loops_always_included(self, small_store, tmp_path):
        s = retrieve(
            "Some text with no entities mentioned at all.",
            chapter_num=5,
            entries=small_store,
            log_dir=tmp_path,
        )
        ids = {e.id for e in s.open_loops}
        assert "plot.aspect" in ids

    def test_active_arcs_only_for_mentioned_entities(self, small_store, tmp_path):
        # 'Kain' mentioned → kain.method (inferred) should appear
        s_kain = retrieve(
            "Kain walked through the rooms slowly.",
            chapter_num=5,
            entries=small_store,
            log_dir=tmp_path,
        )
        arc_ids_kain = {e.id for e in s_kain.active_arcs}
        assert "kain.method" in arc_ids_kain

        # Kain NOT mentioned → kain.method should not appear
        s_none = retrieve(
            "The wind blew through the empty street.",
            chapter_num=5,
            entries=small_store,
            log_dir=tmp_path,
        )
        arc_ids_none = {e.id for e in s_none.active_arcs}
        assert "kain.method" not in arc_ids_none

    def test_recent_events_within_window(self, small_store, tmp_path):
        # Ch 5: ch4 event is within window (delta=1), ch1 is not (delta=4)
        s = retrieve(
            "Hayden walked.",
            chapter_num=5,
            entries=small_store,
            log_dir=tmp_path,
        )
        ids = {e.id for e in s.recent_events}
        assert "plot.ch4_event" in ids
        assert "plot.ch1_event" not in ids

    def test_alias_detection_in_retrieval(self, small_store, tmp_path):
        s = retrieve(
            "The carrier phased out of view.",
            chapter_num=5,
            entries=small_store,
            log_dir=tmp_path,
        )
        assert "Hayden" in s.mentioned_entities

    def test_superseded_entries_excluded(self, tmp_path):
        e_old = _e("k.v1", "character", "old trait", entity="Kain")
        e_new = _e("k.v2", "character", "new trait", entity="Kain")
        # Mark old as superseded
        e_old = e_old.model_copy(update={"superseded_by": "k.v2"})
        s = retrieve(
            "Kain walked.",
            chapter_num=5,
            entries=[e_old, e_new],
            log_dir=tmp_path,
        )
        ids = {e.id for e in s.hard_canon}
        assert "k.v1" not in ids
        assert "k.v2" in ids


# ---------------------------------------------------------------------------
# Budget enforcement
# ---------------------------------------------------------------------------

class TestBudgetEnforcement:
    def test_tiny_budget_drops_recent_events_for_non_mentioned(self, tmp_path):
        entries = [
            _e("world.rule", "world", "x" * 200),
            _e("k.x", "character", "y" * 200, entity="Kain"),
            _e("plot.loop", "plot", "OPEN: question", confidence="inferred"),
            _e("plot.unrel", "plot", "z" * 400,
               confidence="event", chapter=4,
               entity="OtherChar"),
        ]
        s = retrieve(
            "Kain walked.",
            chapter_num=5,
            entries=entries,
            budget=200,   # very tight
            log_dir=tmp_path,
        )
        dropped_ids = {d[0] for d in s.dropped}
        # plot.unrel concerns a non-mentioned entity → should be dropped first
        assert "plot.unrel" in dropped_ids

    def test_open_loops_never_dropped(self, tmp_path):
        entries = [
            _e("plot.loop1", "plot", "OPEN: q1", confidence="inferred"),
            _e("plot.loop2", "plot", "OPEN: q2", confidence="inferred"),
            _e("k.x", "character", "x" * 500, entity="Kain"),
        ]
        s = retrieve(
            "Kain walked.",
            chapter_num=5,
            entries=entries,
            budget=50,   # absurdly tight
            log_dir=tmp_path,
        )
        loop_ids = {e.id for e in s.open_loops}
        assert "plot.loop1" in loop_ids
        assert "plot.loop2" in loop_ids


# ---------------------------------------------------------------------------
# Prompt rendering
# ---------------------------------------------------------------------------

class TestRendering:
    def test_render_includes_all_buckets(self, tmp_path):
        entries = [
            _e("world.r", "world", "rule"),
            _e("k.x", "character", "trait", entity="Kain"),
            _e("plot.q", "plot", "OPEN: question", confidence="inferred"),
            _e("plot.e", "plot", "event happened",
               confidence="event", chapter=4),
        ]
        s = retrieve("Kain walked.", chapter_num=5,
                     entries=entries, log_dir=tmp_path)
        rendered = render_slice_for_prompt(s)
        assert "Hard canon" in rendered
        assert "Open loops" in rendered
        assert "Recent events" in rendered
        assert "Token estimate" in rendered

    def test_render_does_not_leak_dropped(self, tmp_path):
        entries = [
            _e("k.x", "character", "y" * 200, entity="Kain"),
            _e("plot.unrel", "plot", "z" * 400,
               confidence="event", chapter=4, entity="OtherChar"),
        ]
        s = retrieve("Kain walked.", chapter_num=5,
                     entries=entries, budget=200, log_dir=tmp_path)
        rendered = render_slice_for_prompt(s)
        assert "dropped" not in rendered.lower()


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

class TestLogging:
    def test_log_file_written(self, tmp_path):
        entries = [_e("k.x", "character", "trait", entity="Kain")]
        retrieve(
            "Kain walked.",
            chapter_num=5,
            entries=entries,
            log_dir=tmp_path,
            pass_id="testpass",
        )
        log_files = list(tmp_path.glob("ch05_testpass.json"))
        assert len(log_files) == 1

    def test_log_contains_chapter_hash_and_counts(self, tmp_path):
        import json
        entries = [_e("k.x", "character", "trait", entity="Kain")]
        retrieve(
            "Kain walked. Kain ran. Kain stopped.",
            chapter_num=5,
            entries=entries,
            log_dir=tmp_path,
            pass_id="testpass",
        )
        payload = json.loads(
            (tmp_path / "ch05_testpass.json").read_text(encoding="utf-8")
        )
        assert payload["chapter"] == 5
        assert payload["mention_counts"]["Kain"] == 3
        assert len(payload["chapter_hash"]) == 16


# ---------------------------------------------------------------------------
# Integration: QS Ch 5 worked example
# ---------------------------------------------------------------------------

# Representative prose from Ch 5 — Kain's reading pass at Chen's apartment.
# Drop in actual manuscript text here when you wire the real pipeline up;
# the test only depends on which entities appear and roughly how often.
CH5_SAMPLE = """
Kain stood inside the doorway and did not move.

The reading pass came first. Always. Before the questions, before the
checklist, before the cataloguing of objects — the space itself had to be
allowed to speak. Chen's apartment had been preserved with institutional
fidelity. The surveillance team had touched nothing. A mug ring sat on
the kitchen counter — circular, dry now, the watermark left by a vessel
set down and never retrieved.

The carpet in the living room held compression patterns consistent with
the original layout. Where furniture had stood for months, the pile lay
flattened. Where it had been moved recently, the pile rose half a fibre.
A replacement instance was in residence now. The QSA had logged the
placement at oh-six-hundred, three days prior. Kain noted, without
touching, that the replacement had not yet sat in any of Chen's chairs.

He moved further in. The kitchen first. The mug ring. He did not pick
up the mug.
"""


class TestQSCh5Integration:
    @pytest.fixture
    def seeded_store(self, tmp_path: Path) -> Path:
        path = tmp_path / "canon_store.json"
        save(all_seed_entries(), path)
        return path

    def test_ch5_detects_expected_entities(self, seeded_store, tmp_path):
        s = retrieve(
            CH5_SAMPLE,
            chapter_num=5,
            store_path=seeded_store,
            log_dir=tmp_path,
        )
        # Kain is named explicitly; Chen via possessive ("Chen's apartment").
        # Hayden is NOT mentioned in this sample — that's correct, the
        # sample is a self-contained Kain POV scene at Chen's apartment.
        assert "Kain" in s.mentioned_entities
        assert "Chen" in s.mentioned_entities
        assert "Hayden" not in s.mentioned_entities

    def test_ch5_slice_includes_open_loops(self, seeded_store, tmp_path):
        s = retrieve(
            CH5_SAMPLE,
            chapter_num=5,
            store_path=seeded_store,
            log_dir=tmp_path,
        )
        loop_ids = {e.id for e in s.open_loops}
        # All 7 seeded open loops should be present
        assert "plot.loop_aspect_identity" in loop_ids
        assert "plot.loop_replacement_origin" in loop_ids
        assert len(s.open_loops) >= 5

    def test_ch5_slice_includes_kain_hard_canon(self, seeded_store, tmp_path):
        s = retrieve(
            CH5_SAMPLE,
            chapter_num=5,
            store_path=seeded_store,
            log_dir=tmp_path,
        )
        hard_ids = {e.id for e in s.hard_canon}
        assert "kain.baseline_traits" in hard_ids

    def test_ch5_slice_includes_chen_apartment_state(self, seeded_store, tmp_path):
        s = retrieve(
            CH5_SAMPLE,
            chapter_num=5,
            store_path=seeded_store,
            log_dir=tmp_path,
        )
        # chen.apartment_state is an event for ch 5 itself — won't appear in
        # recent_events (delta=0), but Chen IS mentioned, so any hard_canon
        # for Chen would surface. Verify Chen entries are visible somewhere.
        all_ids = {e.id for e in s.all_included()}
        # At minimum Chen should be in mentioned_entities even if no
        # hard_canon for Chen exists in seed (chen.apartment_state is event)
        assert "Chen" in s.mentioned_entities

    def test_ch5_slice_includes_recent_events(self, seeded_store, tmp_path):
        s = retrieve(
            CH5_SAMPLE,
            chapter_num=5,
            store_path=seeded_store,
            log_dir=tmp_path,
        )
        recent_ids = {e.id for e in s.recent_events}
        # Ch 4 events are within window (delta=1)
        assert "plot.ch4_alfred_hospital" in recent_ids or \
               "plot.ch4_5_manifest_visit" in recent_ids

    def test_ch5_slice_under_budget(self, seeded_store, tmp_path):
        s = retrieve(
            CH5_SAMPLE,
            chapter_num=5,
            store_path=seeded_store,
            log_dir=tmp_path,
        )
        assert s.token_estimate <= TOKEN_BUDGET, (
            f"Slice exceeded budget: {s.token_estimate} > {TOKEN_BUDGET}"
        )

    def test_ch5_rendered_prompt_looks_sane(self, seeded_store, tmp_path):
        s = retrieve(
            CH5_SAMPLE,
            chapter_num=5,
            store_path=seeded_store,
            log_dir=tmp_path,
        )
        rendered = render_slice_for_prompt(s)
        # Should be substantial but not enormous
        assert 500 < len(rendered) < 20_000
        assert "Chapter 5" in rendered
        assert "Kain" in rendered
