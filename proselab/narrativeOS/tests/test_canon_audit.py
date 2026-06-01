"""Tests for narrative_os.canon_audit and the CLI integration."""

from __future__ import annotations

import json
from pathlib import Path
import pytest

from narrative_os.schemas import CanonEntry
from narrative_os.store import save, load
from narrative_os.canon_audit import (
    audit_fake_pass_ids,
    audit_contamination,
    snapshot_canon,
    SENTINEL,
)


@pytest.fixture
def temp_store_path(tmp_path: Path) -> Path:
    return tmp_path / "canon_store.json"


def _entry(id_: str, namespace: str, entity: str | None, extracted_at_pass: str, superseded_by: str | None = None) -> CanonEntry:
    return CanonEntry(
        id=id_,
        namespace=namespace,  # type: ignore[arg-type]
        entity=entity,
        value="A narrative fact",
        confidence="hard_canon",
        source_chapter=1,
        extracted_at_pass=extracted_at_pass,
        superseded_by=superseded_by,
    )


class TestAuditFakePassIds:
    def test_detect_fake_pass_ids(self, temp_store_path: Path):
        entries = [
            _entry("world.rule_ok", "world", None, "20260524T131730Z"),
            _entry("hayden.fact_fake", "character", "Hayden", "ch0_2025-07-08T12:00:00"),
            _entry("kain.fact_fake_another", "character", "Kain", "ch5_2024-06-01T00:00:00"),
            _entry("world.already_lost", "world", None, SENTINEL),
        ]
        save(entries, temp_store_path)

        res = audit_fake_pass_ids(temp_store_path, clean=False)
        assert res["fake_count"] == 2
        assert res["cleaned_count"] == 0
        assert set(res["fake_ids"]) == {"hayden.fact_fake", "kain.fact_fake_another"}

    def test_clean_fake_pass_ids(self, temp_store_path: Path):
        entries = [
            _entry("world.rule_ok", "world", None, "20260524T131730Z"),
            _entry("hayden.fact_fake", "character", "Hayden", "ch0_2025-07-08T12:00:00"),
            _entry("kain.fact_fake_another", "character", "Kain", "ch5_2024-06-01T00:00:00"),
        ]
        save(entries, temp_store_path)

        res = audit_fake_pass_ids(temp_store_path, clean=True)
        assert res["fake_count"] == 2
        assert res["cleaned_count"] == 2

        # Verify on disk
        updated = load(temp_store_path)
        by_id = {e.id: e for e in updated}
        assert by_id["world.rule_ok"].extracted_at_pass == "20260524T131730Z"
        assert by_id["hayden.fact_fake"].extracted_at_pass == SENTINEL
        assert by_id["kain.fact_fake_another"].extracted_at_pass == SENTINEL


class TestAuditContamination:
    def test_contamination_detection(self, temp_store_path: Path):
        entries = [
            # Active seed-Hayden entry -> Contamination violation
            _entry("hayden.identity", "character", "Hayden", "seed"),
            # Superseded seed-Hayden entry -> Not contamination
            _entry("hayden.old_fact", "character", "Hayden", "seed", superseded_by="hayden.new_fact"),
            _entry("hayden.new_fact", "character", "Hayden", "reconciliation_pass_b_hayden_20260525"),
            # Active seed-Kain entry allowed exception -> Allowed, no violation
            _entry("kain.investigation_method", "character", "Kain", "seed"),
            # Active seed-Kain entry not allowed -> Contamination violation
            _entry("kain.identity", "character", "Kain", "seed"),
        ]
        save(entries, temp_store_path)

        # Audit Hayden
        hayden_res = audit_contamination(temp_store_path, "Hayden")
        assert hayden_res["contamination_count"] == 1
        assert hayden_res["violation_count"] == 1
        assert "hayden.identity" in hayden_res["violations"]

        # Audit Kain
        kain_res = audit_contamination(temp_store_path, "Kain")
        # kain.investigation_method and kain.identity are matching contamination entries
        assert kain_res["contamination_count"] == 2
        # only kain.identity is a violation
        assert kain_res["violation_count"] == 1
        assert "kain.identity" in kain_res["violations"]
        assert "kain.investigation_method" not in kain_res["violations"]


class TestSnapshotCanon:
    def test_snapshot_writes_exact_payload(self, temp_store_path: Path, tmp_path: Path):
        entries = [
            _entry("world.rule", "world", None, "seed"),
            _entry("hayden.identity", "character", "Hayden", "reconciliation_pass"),
        ]
        save(entries, temp_store_path)

        out_path = tmp_path / "canon.phase8_clean.json"
        snapshot_canon(temp_store_path, out_path)

        # Verify that output file exists and has identical content
        assert out_path.exists()
        original_data = json.loads(temp_store_path.read_text(encoding="utf-8"))
        snapshot_data = json.loads(out_path.read_text(encoding="utf-8"))
        assert original_data == snapshot_data
