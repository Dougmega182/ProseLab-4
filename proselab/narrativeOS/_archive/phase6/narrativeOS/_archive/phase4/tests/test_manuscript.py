"""Tests for narrative_os.manuscript."""

from __future__ import annotations

from pathlib import Path

import pytest

from narrative_os.manuscript import (
    Chapter,
    Manuscript,
    PROLOGUE_NUM,
    EPILOGUE_NUM,
)


SAMPLE_MD = """\
some preamble line

# **PROLOGUE**

The reflection in the window finished tying its shoe late.

# **CHAPTER 1 — BLACK PEARL BAR**

Kain killed the engine.

# **CHAPTER 7.5 — REYES**

Reyes did the arithmetic.

# **CHAPTER 8: BELL DISCOVERS THE LIE**

Bell discovered the lie.

# **EPILOGUE — THE WAKING WORLD**

The waking world arrived.
"""


@pytest.fixture
def sample_path(tmp_path: Path) -> Path:
    p = tmp_path / "ms.md"
    p.write_text(SAMPLE_MD, encoding="utf-8")
    return p


class TestParse:
    def test_loads_all_chapters(self, sample_path: Path):
        ms = Manuscript.load(sample_path)
        assert ms.chapter_count == 5

    def test_prologue_and_epilogue_recognized(self, sample_path: Path):
        ms = Manuscript.load(sample_path)
        prologue = ms.chapter_by_number("PROLOGUE")
        epilogue = ms.chapter_by_number("EPILOGUE")
        assert prologue is not None
        assert prologue.kind == "PROLOGUE"
        assert prologue.number == PROLOGUE_NUM
        assert epilogue is not None
        assert epilogue.kind == "EPILOGUE"
        assert epilogue.number == EPILOGUE_NUM

    def test_chapter_by_number(self, sample_path: Path):
        ms = Manuscript.load(sample_path)
        ch1 = ms.chapter_by_number(1)
        assert ch1 is not None
        assert ch1.title == "BLACK PEARL BAR"

    def test_fractional_chapter(self, sample_path: Path):
        ms = Manuscript.load(sample_path)
        ch75 = ms.chapter_by_number(7.5)
        assert ch75 is not None
        assert ch75.title == "REYES"
        assert ch75.display_number == "7.5"

    def test_colon_separator(self, sample_path: Path):
        ms = Manuscript.load(sample_path)
        ch8 = ms.chapter_by_number(8)
        assert ch8 is not None
        assert ch8.title == "BELL DISCOVERS THE LIE"

    def test_string_lookup_for_numbered_chapter(self, sample_path: Path):
        ms = Manuscript.load(sample_path)
        ch1 = ms.chapter_by_number("1")
        assert ch1 is not None
        assert ch1.title == "BLACK PEARL BAR"

    def test_chapters_sorted_by_number(self, sample_path: Path):
        ms = Manuscript.load(sample_path)
        numbers = [c.number for c in ms.chapters]
        assert numbers == sorted(numbers)
        assert numbers[0] == PROLOGUE_NUM
        assert numbers[-1] == EPILOGUE_NUM

    def test_preamble_before_first_header_ignored(self, sample_path: Path):
        ms = Manuscript.load(sample_path)
        # Should NOT contain "some preamble line" in any chapter body
        for c in ms.chapters:
            assert "some preamble" not in c.text

    def test_chapter_body_excludes_header_line(self, sample_path: Path):
        ms = Manuscript.load(sample_path)
        ch1 = ms.chapter_by_number(1)
        assert ch1 is not None
        assert "**CHAPTER 1" not in ch1.text
        assert "Kain killed the engine" in ch1.text

    def test_missing_lookup_returns_none(self, sample_path: Path):
        ms = Manuscript.load(sample_path)
        assert ms.chapter_by_number(99) is None
        assert ms.chapter_by_number("not_a_chapter") is None


class TestHashing:
    def test_content_hash_stable(self, sample_path: Path):
        ms1 = Manuscript.load(sample_path)
        ms2 = Manuscript.load(sample_path)
        assert ms1.content_hash() == ms2.content_hash()

    def test_content_hash_changes_on_edit(self, sample_path: Path, tmp_path: Path):
        ms1 = Manuscript.load(sample_path)
        edited = sample_path.read_text(encoding="utf-8") + "\n# **CHAPTER 9**\n\nExtra.\n"
        new_path = tmp_path / "ms_edited.md"
        new_path.write_text(edited, encoding="utf-8")
        ms2 = Manuscript.load(new_path)
        assert ms1.content_hash() != ms2.content_hash()

    def test_chapter_hash_stable(self, sample_path: Path):
        ms = Manuscript.load(sample_path)
        ch1 = ms.chapter_by_number(1)
        ch1b = ms.chapter_by_number(1)
        assert ch1 is not None and ch1b is not None
        assert ch1.content_hash() == ch1b.content_hash()


class TestTokenEstimate:
    def test_total_tokens_positive(self, sample_path: Path):
        ms = Manuscript.load(sample_path)
        assert ms.total_tokens_estimate > 0

    def test_chapter_tokens_positive(self, sample_path: Path):
        ms = Manuscript.load(sample_path)
        for c in ms.chapters:
            assert c.token_estimate > 0


class TestRepr:
    def test_repr_contains_useful_info(self, sample_path: Path):
        ms = Manuscript.load(sample_path)
        r = repr(ms)
        assert "Manuscript" in r
        assert "chapters=5" in r


# ---------------------------------------------------------------------------
# Integration: real QS manuscript (if available)
# ---------------------------------------------------------------------------

REAL_MS_PATH = (
    Path(__file__).parents[1] / "manuscripts" / "quantum_shadows.md"
)


@pytest.mark.skipif(
    not REAL_MS_PATH.exists(),
    reason="Real QS manuscript not present in this checkout.",
)
class TestRealManuscript:
    def test_parses_qs_manuscript(self):
        ms = Manuscript.load(REAL_MS_PATH)
        # Expect 20 chapters: Prologue + Ch1–Ch16 + Ch7.5 + Ch12.5 + Epilogue
        assert ms.chapter_count == 20

    def test_qs_known_chapters(self):
        ms = Manuscript.load(REAL_MS_PATH)
        assert ms.chapter_by_number("PROLOGUE") is not None
        assert ms.chapter_by_number(1).title == "BLACK PEARL BAR"
        assert ms.chapter_by_number(4).title == "ALFRED HOSPITAL"
        assert ms.chapter_by_number(5).title == "THE APARTMENT"
        assert ms.chapter_by_number(7.5).title == "REYES"
        assert ms.chapter_by_number(10).title == "DEAD MAN'S SWITCH"
        assert ms.chapter_by_number(12).title == "THE BREACH"
        assert ms.chapter_by_number(12.5).title == "THE INSTRUMENT'S CONSENT"
        assert ms.chapter_by_number(16).title == "THE FIXED POINT"

    def test_qs_token_count_reasonable(self):
        ms = Manuscript.load(REAL_MS_PATH)
        # Roughly 80k-150k tokens for a novel of this length
        est = ms.total_tokens_estimate
        assert 50_000 < est < 200_000, f"Unexpected token estimate: {est}"
