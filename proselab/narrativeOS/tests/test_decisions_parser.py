from pathlib import Path

import pytest

from narrative_os.decisions_parser import DecisionsParseError, parse_section_22, write_contract


MINIMAL_DECISIONS = """# Decisions

## Section 22: Prose-Generation Contract (Surface)

### 1. Canonical Facts (What to show)
- Aspect is Alain Aspect. (-> Section 23.1)

### 2. Permitted Hints (What to imply)
- Reader permitted to notice Aspect's impossible age. (-> Section 23.1)

### 3. Foreclosure Guards (What tone/characterization is strictly forbidden to protect Book 3)
- Never narrate the attribution as wrong. (-> Section 23.1)

***

## Section 23: Load-Bearing Architecture (Spine)
"""


def test_parse_section_22_extracts_three_rule_buckets(tmp_path: Path):
    decisions = tmp_path / "decisions.md"
    decisions.write_text(MINIMAL_DECISIONS, encoding="utf-8")

    contract = parse_section_22(decisions)

    assert len(contract.rules) == 3
    assert [rule.kind for rule in contract.rules] == [
        "reveal",
        "permitted_signal",
        "foreclosure_guard",
    ]
    assert [rule.section_ref for rule in contract.rules] == [
        "Section 23.1",
        "Section 23.1",
        "Section 23.1",
    ]


def test_source_hash_changes_when_section_changes(tmp_path: Path):
    decisions = tmp_path / "decisions.md"
    decisions.write_text(MINIMAL_DECISIONS, encoding="utf-8")
    first = parse_section_22(decisions)

    decisions.write_text(
        MINIMAL_DECISIONS.replace("Alain Aspect", "the founder"),
        encoding="utf-8",
    )
    second = parse_section_22(decisions)

    assert first.source_hash != second.source_hash


def test_missing_section_headers_fail_clearly(tmp_path: Path):
    decisions = tmp_path / "decisions.md"
    decisions.write_text("# Decisions\n", encoding="utf-8")

    with pytest.raises(DecisionsParseError):
        parse_section_22(decisions)


def test_write_contract_creates_json(tmp_path: Path):
    decisions = tmp_path / "decisions.md"
    decisions.write_text(MINIMAL_DECISIONS, encoding="utf-8")
    contract = parse_section_22(decisions)

    out = write_contract(contract, tmp_path / "contracts" / "book1.json")

    assert out.exists()
    assert "s22.reveal.aspect_alain_aspect" in out.read_text(encoding="utf-8")


def test_parse_section_22_uses_mapping_ids_and_canon_refs(tmp_path: Path):
    decisions = tmp_path / "decisions.md"
    decisions.write_text(MINIMAL_DECISIONS, encoding="utf-8")
    mapping = tmp_path / "mapping.json"
    mapping.write_text(
        '{"section_22_mappings":[{'
        '"guard_id":"s22.guard.no_aspect_identity_reveal",'
        '"s22_item":"Aspect is Alain Aspect.",'
        '"canon_fact_id":"aspect.identity",'
        '"description":"Aspect identity support."'
        '}]}',
        encoding="utf-8",
    )

    contract = parse_section_22(decisions, mapping_path=mapping)

    assert contract.rules[0].guard_id == "s22.guard.no_aspect_identity_reveal"
    assert contract.rules[0].canon_refs == ["aspect.identity"]
