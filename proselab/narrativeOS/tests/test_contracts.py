from pydantic import ValidationError
import pytest

from narrative_os.contracts import BookContract, ContractRule


def _rule(guard_id: str, severity: str = "hard") -> ContractRule:
    return ContractRule(
        guard_id=guard_id,
        kind="foreclosure_guard",
        text="Never reveal the protected fact.",
        section_ref="Section 23.1",
        severity=severity,
    )


def test_contract_round_trips_json():
    contract = BookContract(
        source_path="decisions.md",
        source_hash="a" * 64,
        rules=[_rule("s22.guard.no_reveal")],
    )

    restored = BookContract.model_validate_json(contract.model_dump_json())

    assert restored.rules[0].guard_id == "s22.guard.no_reveal"


def test_duplicate_guard_ids_rejected():
    with pytest.raises(ValidationError):
        BookContract(
            source_path="decisions.md",
            source_hash="a" * 64,
            rules=[
                _rule("s22.guard.no_reveal"),
                _rule("s22.guard.no_reveal"),
            ],
        )


def test_hard_and_soft_rules_are_filterable():
    contract = BookContract(
        source_path="decisions.md",
        source_hash="a" * 64,
        rules=[
            _rule("s22.guard.no_reveal", "hard"),
            _rule("s22.signal.allowed_hint", "soft"),
        ],
    )

    assert [rule.guard_id for rule in contract.hard_rules()] == ["s22.guard.no_reveal"]
    assert [rule.guard_id for rule in contract.soft_rules()] == ["s22.signal.allowed_hint"]
