from pathlib import Path
from narrative_os.contract_lint import lint_contract, render_contract_for_prompt, load_contract
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


def test_chapter_3_prose_fixtures_against_real_contract():
    contract_path = Path(__file__).parent.parent / "data" / "contracts" / "book1_contract.json"
    real_contract = load_contract(contract_path)

    # 1. Clean Chapter 3 prose fixture
    clean_prose = (
        "Aspect — the name was a designation, not a surname, the kind of "
        "single-word identifier the QSA assigned to personnel whose operational "
        "role required a layer of institutional distance between their function "
        "and their person — was perhaps sixty, with the lean, careful build "
        "of someone who had spent decades in environments where excess was a liability."
    )
    result = lint_contract(clean_prose, contract=real_contract)
    assert result.passed
    assert not result.findings

    # 2. Corrupted reveal: directly naming Alain Aspect
    corrupted_reveal = (
        "The man beside it was not what Kain had expected. Aspect was Alain Aspect."
    )
    result_reveal = lint_contract(corrupted_reveal, contract=real_contract)
    assert not result_reveal.passed
    assert any(f.guard_id == "s22.guard.no_aspect_identity_reveal" for f in result_reveal.findings)

    # 3. Corrupted wrong attribution: stating Aspect was not a title
    corrupted_wrong_attribution = (
        "Kain reasoned that Aspect was not a title, but rather the name of the original founder."
    )
    result_wrong = lint_contract(corrupted_wrong_attribution, contract=real_contract)
    assert not result_wrong.passed
    assert any(f.guard_id == "s22.guard.no_aspect_identity_reveal" for f in result_wrong.findings)

