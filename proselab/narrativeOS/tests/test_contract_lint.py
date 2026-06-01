from narrative_os.contract_lint import lint_contract, render_contract_for_prompt
from narrative_os.contracts import BookContract, ContractRule


def _contract() -> BookContract:
    return BookContract(
        source_path="decisions.md",
        source_hash="b" * 64,
        rules=[
            ContractRule(
                guard_id="s22.guard.no_kain_ics_misattribution",
                kind="foreclosure_guard",
                text="Never misattribute the ICS readings to Kain in prose.",
                section_ref="Section 23.8",
                severity="hard",
            ),
            ContractRule(
                guard_id="s22.signal.lighter_name_s",
                kind="permitted_signal",
                text="Prose may show the lighter; prose may not name A.S.",
                section_ref="Section 23.9",
                severity="soft",
            ),
        ],
    )


def test_known_clean_paragraph_passes_contract_lint():
    result = lint_contract(
        "Bell wrote the number beside Hayden's name and shut the folder.",
        contract=_contract(),
    )

    assert result.passed
    assert result.findings == []


def test_corrupted_ics_attribution_trips_guard_with_span():
    result = lint_contract(
        "Bell discovers Kain's ICS data in the final column.",
        contract=_contract(),
    )

    assert not result.passed
    assert result.findings[0].guard_id == "s22.guard.no_kain_ics_misattribution"
    assert result.findings[0].severity == "hard"
    assert result.findings[0].span == "Bell discovers Kain's ICS"
    assert "Kain" in result.findings[0].rationale


def test_contract_renders_for_prompt():
    rendered = render_contract_for_prompt(_contract())

    assert "s22.guard.no_kain_ics_misattribution" in rendered
    assert "Section 23.8" in rendered
