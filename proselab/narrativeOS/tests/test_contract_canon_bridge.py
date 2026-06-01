from pathlib import Path

from narrative_os.contract_canon_bridge import (
    Section22CanonMapping,
    canon_to_contract_check,
    contract_to_canon_check,
    preflight_contract_canon,
)
from narrative_os.contracts import BookContract, ContractRule
from narrative_os.decisions_parser import write_contract
from narrative_os.schemas import CanonEntry
from narrative_os.store import save


def _contract() -> BookContract:
    return BookContract(
        source_path="decisions.md",
        source_hash="d" * 64,
        rules=[
            ContractRule(
                guard_id="s22.reveal.bell_discovers_hayden_s_ics_data",
                kind="reveal",
                text="Bell discovers Hayden's ICS data, not Kain's.",
                section_ref="Section 23.8",
                severity="hard",
            )
        ],
    )


def _mapping(canon_fact_id: str = "bell.discovery") -> Section22CanonMapping:
    return Section22CanonMapping(
        guard_id="s22.guard.no_kain_ics_misattribution",
        s22_item="Bell discovers Hayden's ICS data, not Kain's.",
        canon_fact_id=canon_fact_id,
        description="Bell finds Hayden's ICS data.",
    )


def _entry(value: str, *, confidence: str = "hard_canon") -> CanonEntry:
    return CanonEntry(
        id="bell.discovery",
        namespace="plot",
        value=value,
        confidence=confidence,
        source_chapter=8,
        extracted_at_pass="seed",
    )


def test_missing_supporting_canon_fact_is_high():
    findings = canon_to_contract_check(_contract(), [], [_mapping()])

    assert findings[0].severity == "HIGH"
    assert findings[0].canon_fact_id == "bell.discovery"


def test_existing_supporting_canon_fact_passes():
    findings = canon_to_contract_check(
        _contract(),
        [_entry("Bell discovers Hayden's ICS data.")],
        [_mapping()],
    )

    assert findings == []


def test_hard_canon_contradiction_blocks():
    findings = contract_to_canon_check(
        _contract(),
        [_entry("Bell discovers Kain's ICS data.")],
        [_mapping()],
    )

    assert findings[0].severity == "HIGH"
    assert findings[0].guard_id == "s22.guard.no_kain_ics_misattribution"


def test_inferred_canon_contradiction_is_medium():
    findings = contract_to_canon_check(
        _contract(),
        [_entry("Bell discovers Kain's ICS data.", confidence="inferred")],
        [_mapping()],
    )

    assert findings[0].severity == "MEDIUM"


def test_preflight_loads_contract_store_and_mapping(tmp_path: Path):
    contract_path = write_contract(_contract(), tmp_path / "contract.json")
    store_path = tmp_path / "canon_store.json"
    save([_entry("Bell discovers Hayden's ICS data.")], store_path)
    mapping_path = tmp_path / "mapping.json"
    mapping_path.write_text(
        '{"section_22_mappings":[{'
        '"guard_id":"s22.guard.no_kain_ics_misattribution",'
        '"s22_item":"Bell discovers Hayden\'s ICS data, not Kain\'s.",'
        '"canon_fact_id":"bell.discovery",'
        '"description":"Bell finds Hayden\'s ICS data."'
        '}]}',
        encoding="utf-8",
    )

    findings = preflight_contract_canon(
        contract_path=contract_path,
        store_path=store_path,
        mapping_path=mapping_path,
    )

    assert findings == []
