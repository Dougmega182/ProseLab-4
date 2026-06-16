from pathlib import Path

import pytest

from narrative_os.scene_generator import (
    Beat,
    ScenePlan,
    generate_scene_draft,
    render_beat_outline,
)


@pytest.fixture(autouse=True)
def mock_providers():
    from narrative_os.llm.router import clear_providers, register_provider
    from .test_router import MockProvider
    clear_providers()
    galaxy = MockProvider(name="galaxy")
    google = MockProvider(name="google")
    # For voice_linter.py which decodes json with VoiceCriticPayload fields
    google.next_response = {"text": '{"lexical_density": 1.0, "rhythm_delta": 1.0, "sentence_variance": 1.0, "forbidden_drift": 1.0, "rationale": "mock pass"}'}
    register_provider("galaxy", galaxy)
    register_provider("google", google)
    yield (galaxy, google)
    clear_providers()



def _plan() -> ScenePlan:
    return ScenePlan(
        title="Solis Apartment - Scene Fixture",
        chapter=9,
        pov="Kain",
        location="Solis's Apartment",
        global_constraints=[
            "Do not name Alain Aspect.",
            "Do not prove Solis is human flesh.",
        ],
        forbidden_terms=["No one was home."],
        beats=[
            Beat(
                label="Entry",
                outline="Kain enters the apartment without authorization.",
                required_facts=["solis.identity"],
                forbidden_terms=["lubricant viscosity"],
                target_min_words=5,
                target_max_words=30,
                pov_constraints=["Kain can observe objects, not know Solis's true nature."],
            ),
            Beat(
                label="Journals",
                outline="The journals establish early insertion trial records.",
                required_facts=["solis.journals"],
                target_min_words=5,
                target_max_words=30,
            ),
            Beat(
                label="Mug",
                outline="Kain sees the deep blue mug with gold A&S lettering.",
                required_facts=["world.aspect_designation"],
                must_include_terms=["A&S"],
                target_min_words=5,
                target_max_words=30,
                pov_constraints=["Kain registers the mug as anomalous but does not decode it."],
            ),
        ],
    )


def test_scene_plan_requires_three_to_eight_beats():
    with pytest.raises(ValueError):
        ScenePlan(
            title="Too short",
            chapter=1,
            pov="Kain",
            location="Black Pearl",
            beats=[Beat(label="Only", outline="One beat.")],
        )


def test_render_beat_outline_includes_context_and_constraints():
    plan = _plan()
    outline = render_beat_outline(plan, plan.beats[0], 1)

    assert "Scene: Solis Apartment - Scene Fixture" in outline
    assert "POV: Kain" in outline
    assert "solis.identity" in outline
    assert "Kain can observe objects" in outline


def test_generate_scene_draft_preserves_required_facts_across_beats():
    outputs = [
        "The lock yielded. Kain entered. Solis was absent; the room kept her residue.",
        "Three journals lay open under a dead desk lamp.",
        "The deep blue mug showed two gold letters: A&S.",
    ]
    received_outlines = []

    def fake_generator(**kwargs):
        received_outlines.append(kwargs.get("scene_outline", ""))
        prose = outputs.pop(0)
        return {
            "thinking": "mock",
            "prose": prose,
            "passed": True,
            "attempts": 1,
            "lint_report": "mock pass",
        }

    draft = generate_scene_draft(
        _plan(),
        generator_fn=fake_generator,
        use_cache=False,
        verbose=False,
    )

    assert draft.passed
    assert "Solis was absent" in draft.prose
    assert "Three journals" in draft.prose
    assert "A&S" in draft.prose
    assert len(draft.beat_drafts) == 3

    # Beat 1 outline should not have previous_prose
    assert "Prose from the immediately preceding beat" not in received_outlines[0]
    # Beat 2 outline should include Beat 1 prose
    assert "Prose from the immediately preceding beat" in received_outlines[1]
    assert "The lock yielded. Kain entered." in received_outlines[1]
    # Beat 3 outline should include Beat 2 prose
    assert "Prose from the immediately preceding beat" in received_outlines[2]
    assert "Three journals lay open" in received_outlines[2]


def test_stitch_pass_does_not_delete_beat_output():
    plan = _plan()
    generated = []

    def fake_generator(**kwargs):
        outline = kwargs["scene_outline"]
        generated.append(outline)
        return {
            "thinking": "mock",
            "prose": f"Beat prose {len(generated)}.",
            "passed": True,
            "attempts": 1,
            "lint_report": "mock pass",
        }

    draft = generate_scene_draft(plan, generator_fn=fake_generator, verbose=False)

    assert draft.prose == "Beat prose 1.\n\nBeat prose 2.\n\nBeat prose 3."
    assert "Kain registers the mug as anomalous" in generated[2]


def test_solis_apartment_scene_plan_fixture_validates():
    fixture = Path("data/prose_test/solis_apartment_scene_plan.json")

    plan = ScenePlan.model_validate_json(fixture.read_text(encoding="utf-8"))

    assert plan.title == "Solis Apartment - Scene Fixture"
    assert plan.chapter == 9
    assert plan.pov == "Kain"
    assert plan.target_min_words == 700
    assert plan.target_max_words == 890
    assert [beat.label for beat in plan.beats] == [
        "The Entry",
        "The Journals",
        "The A&S Mug",
    ]
    assert plan.beats[0].target_min_words == 180
    assert plan.beats[0].target_max_words == 230
    assert any("Do not name Alain Aspect" in item for item in plan.global_constraints)


def test_scene_draft_fails_when_required_beat_term_missing():
    outputs = [
        "Kain entered the apartment and counted the door contacts.",
        "The journals filled the shelves.",
        "The mug sat beside the lamp.",
    ]

    def fake_generator(**kwargs):
        del kwargs
        return {
            "thinking": "mock",
            "prose": outputs.pop(0),
            "passed": True,
            "attempts": 1,
            "lint_report": "mock pass",
        }

    draft = generate_scene_draft(_plan(), generator_fn=fake_generator, verbose=False)

    assert not draft.passed
    assert "missing required term: A&S" in draft.lint_report


def test_scene_draft_fails_on_scene_and_beat_forbidden_terms():
    outputs = [
        "The lock turned based on lubricant viscosity.",
        "The journals filled the shelves.",
        "The A&S mug sat beside the lamp. No one was home.",
    ]

    def fake_generator(**kwargs):
        del kwargs
        return {
            "thinking": "mock",
            "prose": outputs.pop(0),
            "passed": True,
            "attempts": 1,
            "lint_report": "mock pass",
        }

    draft = generate_scene_draft(_plan(), generator_fn=fake_generator, verbose=False)

    assert not draft.passed
    assert "contains forbidden term/span: No one was home." in draft.lint_report
    assert "Beat 'Entry' contains forbidden term/span: lubricant viscosity" in draft.lint_report


def test_scene_draft_reports_beat_word_budget_failures():
    outputs = [
        "Short.",
        "The journals filled the shelves with dates and subject numbers.",
        "The A&S mug sat beside the lamp and Kain left without touching it.",
    ]

    def fake_generator(**kwargs):
        del kwargs
        return {
            "thinking": "mock",
            "prose": outputs.pop(0),
            "passed": True,
            "attempts": 1,
            "lint_report": "mock pass",
        }

    draft = generate_scene_draft(_plan(), generator_fn=fake_generator, verbose=False)

    assert not draft.passed
    assert "Beat 'Entry' is under target length" in draft.lint_report
