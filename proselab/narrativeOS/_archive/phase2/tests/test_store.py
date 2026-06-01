"""Tests for narrative_os.store."""

from __future__ import annotations

from pathlib import Path

import pytest

from schemas import CanonEntry
from store import (
    CanonStoreError,
    append,
    append_many,
    get_by_entity,
    get_by_id,
    get_by_namespace,
    get_open_loops,
    load,
    save,
    stats,
    supersede,
)


# ---------------------------------------------------------------------------
# Helpers / fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def store_path(tmp_path: Path) -> Path:
    return tmp_path / "canon_store.json"


def _world(id_: str, value: str = "x", confidence: str = "hard_canon") -> CanonEntry:
    return CanonEntry(
        id=id_,
        namespace="world",
        value=value,
        confidence=confidence,  # type: ignore[arg-type]
        source_chapter=0,
        extracted_at_pass="seed",
    )


def _char(id_: str, entity: str, aliases: list[str] | None = None,
          confidence: str = "hard_canon") -> CanonEntry:
    return CanonEntry(
        id=id_,
        namespace="character",
        entity=entity,
        aliases=aliases or [],
        value="trait",
        confidence=confidence,  # type: ignore[arg-type]
        source_chapter=0,
        extracted_at_pass="seed",
    )


def _open_loop(id_: str, value: str) -> CanonEntry:
    return CanonEntry(
        id=id_,
        namespace="plot",
        value=f"OPEN: {value}",
        confidence="inferred",
        source_chapter=0,
        extracted_at_pass="seed",
    )


# ---------------------------------------------------------------------------
# Basic IO
# ---------------------------------------------------------------------------

class TestStoreIO:
    def test_load_empty_when_file_missing(self, store_path: Path):
        assert load(store_path) == []

    def test_save_and_load_round_trip(self, store_path: Path):
        entries = [_world("world.a"), _world("world.b")]
        save(entries, store_path)
        restored = load(store_path)
        assert len(restored) == 2
        assert {e.id for e in restored} == {"world.a", "world.b"}

    def test_save_rejects_duplicate_ids(self, store_path: Path):
        with pytest.raises(CanonStoreError, match="Duplicate"):
            save([_world("world.a"), _world("world.a")], store_path)

    def test_save_writes_atomically(self, store_path: Path, tmp_path: Path):
        # Pre-existing valid file; a save should replace it cleanly.
        save([_world("world.a")], store_path)
        save([_world("world.b")], store_path)
        restored = load(store_path)
        assert [e.id for e in restored] == ["world.b"]
        # No leftover tmp files
        leftovers = list(tmp_path.glob(".canon_store.*.tmp"))
        assert leftovers == []


# ---------------------------------------------------------------------------
# Queries
# ---------------------------------------------------------------------------

class TestQueries:
    @pytest.fixture
    def seeded(self, store_path: Path) -> Path:
        save(
            [
                _world("world.fade"),
                _world("world.ics"),
                _char("kain.traits", "Kain", aliases=["Kain J.", "the auditor"]),
                _char("hayden.traits", "Hayden", aliases=["the carrier"]),
                _open_loop("plot.aspect", "Who is Aspect?"),
                _open_loop("plot.fade_cause", "What triggered the divergence?"),
            ],
            store_path,
        )
        return store_path

    def test_get_by_id_hit(self, seeded: Path):
        e = get_by_id("kain.traits", seeded)
        assert e is not None
        assert e.entity == "Kain"

    def test_get_by_id_miss(self, seeded: Path):
        assert get_by_id("nope.nada", seeded) is None

    def test_get_by_entity_exact(self, seeded: Path):
        results = get_by_entity("Kain", path=seeded)
        assert len(results) == 1
        assert results[0].id == "kain.traits"

    def test_get_by_entity_case_insensitive(self, seeded: Path):
        results = get_by_entity("kain", path=seeded)
        assert len(results) == 1

    def test_get_by_entity_alias_match(self, seeded: Path):
        results = get_by_entity("the auditor", path=seeded)
        assert len(results) == 1
        assert results[0].id == "kain.traits"

    def test_get_by_entity_alias_disabled(self, seeded: Path):
        results = get_by_entity("the auditor", include_aliases=False, path=seeded)
        assert results == []

    def test_get_by_namespace(self, seeded: Path):
        worlds = get_by_namespace("world", path=seeded)
        chars = get_by_namespace("character", path=seeded)
        assert len(worlds) == 2
        assert len(chars) == 2

    def test_get_open_loops(self, seeded: Path):
        loops = get_open_loops(seeded)
        assert len(loops) == 2
        assert {l.id for l in loops} == {"plot.aspect", "plot.fade_cause"}


# ---------------------------------------------------------------------------
# Mutation
# ---------------------------------------------------------------------------

class TestMutation:
    def test_append_new(self, store_path: Path):
        save([_world("world.a")], store_path)
        append(_world("world.b"), store_path)
        assert {e.id for e in load(store_path)} == {"world.a", "world.b"}

    def test_append_duplicate_rejected(self, store_path: Path):
        save([_world("world.a")], store_path)
        with pytest.raises(CanonStoreError, match="already exists"):
            append(_world("world.a"), store_path)

    def test_append_many_atomic_on_duplicate(self, store_path: Path):
        save([_world("world.a")], store_path)
        with pytest.raises(CanonStoreError):
            append_many([_world("world.b"), _world("world.a")], store_path)
        # store unchanged
        assert {e.id for e in load(store_path)} == {"world.a"}

    def test_supersede_marks_old_inactive(self, store_path: Path):
        save([_world("world.v1"), _world("world.v2")], store_path)
        supersede("world.v1", "world.v2", store_path)
        old = get_by_id("world.v1", store_path)
        assert old is not None
        assert old.superseded_by == "world.v2"
        assert old.is_active() is False

    def test_supersede_missing_old_rejected(self, store_path: Path):
        save([_world("world.v2")], store_path)
        with pytest.raises(CanonStoreError, match="old_id"):
            supersede("world.v1", "world.v2", store_path)

    def test_supersede_missing_new_rejected(self, store_path: Path):
        save([_world("world.v1")], store_path)
        with pytest.raises(CanonStoreError, match="new_id"):
            supersede("world.v1", "world.v2", store_path)

    def test_supersede_already_superseded_rejected(self, store_path: Path):
        save(
            [_world("world.v1"), _world("world.v2"), _world("world.v3")],
            store_path,
        )
        supersede("world.v1", "world.v2", store_path)
        with pytest.raises(CanonStoreError, match="already superseded"):
            supersede("world.v1", "world.v3", store_path)

    def test_superseded_entries_hidden_by_default(self, store_path: Path):
        save([_world("world.v1"), _world("world.v2")], store_path)
        supersede("world.v1", "world.v2", store_path)
        active = get_by_namespace("world", path=store_path)
        assert {e.id for e in active} == {"world.v2"}
        all_ = get_by_namespace("world", include_superseded=True, path=store_path)
        assert {e.id for e in all_} == {"world.v1", "world.v2"}


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

class TestStats:
    def test_stats_on_empty_store(self, store_path: Path):
        s = stats(store_path)
        assert s["total"] == 0
        assert s["active"] == 0
        assert s["open_loops"] == 0

    def test_stats_counts_by_namespace_and_confidence(self, store_path: Path):
        save(
            [
                _world("world.a"),
                _world("world.b", confidence="event"),
                _char("kain.x", "Kain"),
                _open_loop("plot.q", "open question"),
            ],
            store_path,
        )
        s = stats(store_path)
        assert s["total"] == 4
        assert s["active"] == 4
        assert s["by_namespace"]["world"] == 2
        assert s["by_namespace"]["character"] == 1
        assert s["by_namespace"]["plot"] == 1
        assert s["by_confidence"]["hard_canon"] == 2
        assert s["by_confidence"]["event"] == 1
        assert s["by_confidence"]["inferred"] == 1
        assert s["open_loops"] == 1


# ---------------------------------------------------------------------------
# QS Seed integration
# ---------------------------------------------------------------------------

class TestQSSeed:
    def test_seed_loads_cleanly(self, store_path: Path):
        from seeds.qs_seed import all_seed_entries

        entries = all_seed_entries()
        # Sanity: no duplicate ids in the seed itself
        ids = [e.id for e in entries]
        assert len(ids) == len(set(ids)), "Seed has duplicate ids"

        save(entries, store_path)
        s = stats(store_path)
        assert s["total"] >= 40, f"Expected ≥40 seed entries, got {s['total']}"
        assert s["total"] <= 70, f"Seed grew unexpectedly: {s['total']}"
        # All four namespaces present
        for ns in ("world", "character", "plot", "craft"):
            assert s["by_namespace"].get(ns, 0) > 0, f"No entries for namespace {ns}"
        # Open loops seeded
        assert s["open_loops"] >= 5, f"Expected ≥5 open loops, got {s['open_loops']}"

    def test_seed_known_entities_retrievable(self, store_path: Path):
        from seeds.qs_seed import all_seed_entries

        save(all_seed_entries(), store_path)
        for name in ("Kain", "Hayden", "Emily", "Bell", "Reyes", "Solis"):
            results = get_by_entity(name, path=store_path)
            assert results, f"No seed entries found for {name!r}"

    def test_seed_kain_alias_works(self, store_path: Path):
        from seeds.qs_seed import all_seed_entries

        save(all_seed_entries(), store_path)
        via_alias = get_by_entity("the auditor", path=store_path)
        via_name = get_by_entity("Kain", path=store_path)
        assert via_alias
        # Both should surface kain.baseline_traits
        assert any(e.id == "kain.baseline_traits" for e in via_alias)
        assert any(e.id == "kain.baseline_traits" for e in via_name)
