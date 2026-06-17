from pathlib import Path

from narrative_os.human_loop import HumanRanker


def test_non_mechanism_axis_exports_schema_free_dimensions(tmp_path: Path):
    ranker = HumanRanker(tmp_path)

    task_path = ranker.export_non_mechanism_task(
        outline="A brief comparison of two passages.",
        prose_a="The room held the smell of rain and old paint.",
        prose_b="Rain and old paint lingered in the room.",
        dimension="emotional_persistence",
    )

    assert task_path.exists()
    content = task_path.read_text(encoding="utf-8")
    assert "mechanism" not in content.lower()
    assert "causality" not in content.lower()
    assert "trap" not in content.lower()
    assert "emotional persistence" in content.lower()
