from pathlib import Path

from narrative_os.human_loop import HumanRanker


def test_external_corpus_track_exports_unmodified_samples(tmp_path: Path):
    corpus_dir = Path("control_prose")
    ranker = HumanRanker(tmp_path)

    task_paths = ranker.export_external_corpus_tasks(corpus_dir, max_pairs=2)

    assert len(task_paths) == 2
    assert all(path.exists() for path in task_paths)

    combined = "\n".join(path.read_text(encoding="utf-8") for path in task_paths)
    assert "mechanism" not in combined.lower()
    assert "causality" not in combined.lower()
    assert "trap" not in combined.lower()
