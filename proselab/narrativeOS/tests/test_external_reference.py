from pathlib import Path

from narrative_os.external_reference import load_external_reference_slice


def test_external_reference_slice_loads_fixed_labels():
    path = Path("data/external_reference_slice.json")

    slice_ = load_external_reference_slice(path)

    assert slice_.name == "external_reference_slice"
    assert len(slice_.samples) >= 5

    first = slice_.samples[0]
    assert first.id
    assert first.outline
    assert first.passage
    assert isinstance(first.mechanism_present, bool)
    assert first.fixed_mechanism_label
    assert 1 <= first.quality_rank <= 5
