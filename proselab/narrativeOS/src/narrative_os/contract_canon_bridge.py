"""Bridge checks between Section 22 contracts and the canon store."""

from __future__ import annotations

import json
from pathlib import Path

from pydantic import BaseModel, Field

from .contract_lint import load_contract
from .contracts import BookContract, ContractRule
from .schemas import CanonEntry
from .store import load


DEFAULT_MAPPING_PATH = Path(__file__).parents[2] / "data" / "contracts" / "s22_canon_mapping.json"


class Section22CanonMapping(BaseModel):
    guard_id: str
    s22_item: str
    canon_fact_id: str
    description: str = ""


class BridgeFinding(BaseModel):
    guard_id: str
    severity: str
    canon_fact_id: str
    message: str = Field(..., min_length=1)


def load_mapping(path: Path | str | None = None) -> list[Section22CanonMapping]:
    mapping_path = Path(path) if path else DEFAULT_MAPPING_PATH
    data = json.loads(mapping_path.read_text(encoding="utf-8"))
    return [
        Section22CanonMapping.model_validate(item)
        for item in data.get("section_22_mappings", [])
    ]


def _active_by_id(entries: list[CanonEntry]) -> dict[str, CanonEntry]:
    return {entry.id: entry for entry in entries if entry.is_active()}


def _entry_by_id(entries: list[CanonEntry]) -> dict[str, CanonEntry]:
    return {entry.id: entry for entry in entries}


def _resolve_active_entry(
    canon_fact_id: str,
    entries_by_id: dict[str, CanonEntry],
) -> CanonEntry | None:
    entry = entries_by_id.get(canon_fact_id)
    seen: set[str] = set()
    while entry is not None and entry.superseded_by:
        if entry.id in seen:
            return None
        seen.add(entry.id)
        entry = entries_by_id.get(entry.superseded_by)
    if entry is None or not entry.is_active():
        return None
    return entry


def _rule_for_mapping(
    mapping: Section22CanonMapping,
    contract: BookContract,
) -> ContractRule | None:
    normalized_item = mapping.s22_item.strip().lower()
    for rule in contract.rules:
        if rule.guard_id == mapping.guard_id:
            return rule
        if rule.text.strip().lower() == normalized_item:
            return rule
    return None


def _contradicts_mapping(mapping: Section22CanonMapping, entry: CanonEntry) -> str | None:
    value = entry.value.lower()
    item = mapping.s22_item.lower()

    if "bell discovers hayden's ics data, not kain's" in item:
        if "kain" in value and "ics" in value and "hayden" not in value:
            return "Canon appears to attribute the ICS discovery to Kain without Hayden."
    if "solis is b-734 residue" in item:
        if "solis" in value and any(marker in value for marker in ["living architect", "alive architect", "human flesh"]):
            return "Canon appears to describe Solis as physically alive/human."
    if "aspect is alain aspect" in item:
        if "aspect" in value and "not alain" in value:
            return "Canon appears to deny Aspect's Alain Aspect identity."
    if "chen was replaced" in item:
        if "chen" in value and "not replaced" in value:
            return "Canon appears to deny Chen's replacement."
    if "varn's operation contradicts official qsa records" in item:
        if "varn" in value and "records are accurate" in value:
            return "Canon appears to assert Varn's official records are accurate."
    if "hayden executed 412 transitions" in item:
        if "hayden" in value and "412" not in value and "transition" in value:
            return "Canon mentions Hayden's transitions without the required 412 hard number."

    return None


def canon_to_contract_check(
    contract: BookContract,
    store_entries: list[CanonEntry],
    mappings: list[Section22CanonMapping],
) -> list[BridgeFinding]:
    """Verify every mapped Section 22 item has an active supporting canon fact."""
    by_id = _entry_by_id(store_entries)
    findings: list[BridgeFinding] = []

    for mapping in mappings:
        if _rule_for_mapping(mapping, contract) is None:
            findings.append(
                BridgeFinding(
                    guard_id=mapping.guard_id,
                    severity="MEDIUM",
                    canon_fact_id=mapping.canon_fact_id,
                    message=f"Mapped Section 22 item is not present in the contract: {mapping.s22_item}",
                )
            )
            continue
        if _resolve_active_entry(mapping.canon_fact_id, by_id) is None:
            findings.append(
                BridgeFinding(
                    guard_id=mapping.guard_id,
                    severity="HIGH",
                    canon_fact_id=mapping.canon_fact_id,
                    message=f"Missing active supporting canon fact: {mapping.canon_fact_id}",
                )
            )

    return findings


def contract_to_canon_check(
    contract: BookContract,
    store_entries: list[CanonEntry],
    mappings: list[Section22CanonMapping],
) -> list[BridgeFinding]:
    """Flag active hard-canon facts that contradict mapped Section 22 items."""
    del contract
    by_id = _entry_by_id(store_entries)
    findings: list[BridgeFinding] = []

    for mapping in mappings:
        entry = _resolve_active_entry(mapping.canon_fact_id, by_id)
        if entry is None:
            continue
        contradiction = _contradicts_mapping(mapping, entry)
        if contradiction:
            findings.append(
                BridgeFinding(
                    guard_id=mapping.guard_id,
                    severity="HIGH" if entry.confidence == "hard_canon" else "MEDIUM",
                    canon_fact_id=mapping.canon_fact_id,
                    message=contradiction,
                )
            )

    return findings


def preflight_contract_canon(
    *,
    contract_path: Path | str,
    store_path: Path | str | None = None,
    mapping_path: Path | str | None = None,
) -> list[BridgeFinding]:
    contract = load_contract(contract_path)
    entries = load(store_path)
    mappings = load_mapping(mapping_path)
    return [
        *canon_to_contract_check(contract, entries, mappings),
        *contract_to_canon_check(contract, entries, mappings),
    ]
