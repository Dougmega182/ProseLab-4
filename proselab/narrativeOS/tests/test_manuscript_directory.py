import sys
import pytest
from pathlib import Path

from narrative_os.manuscript import Manuscript, Chapter

def test_load_from_directory(tmp_path: Path):
    # Create a mock directory of chapters
    ch1 = tmp_path / "01_chapter.md"
    ch1.write_text("# **CHAPTER 1 — START**\nThis is chapter 1.", encoding="utf-8")
    
    ch2 = tmp_path / "02_chapter.md"
    ch2.write_text("# **CHAPTER 2 — MIDDLE**\nThis is chapter 2.", encoding="utf-8")
    
    prologue = tmp_path / "00_prologue.md"
    prologue.write_text("# **PROLOGUE**\nThis is the prologue.", encoding="utf-8")

    epilogue = tmp_path / "99_epilogue.md"
    epilogue.write_text("# **EPILOGUE**\nThis is the epilogue.", encoding="utf-8")

    # Load from directory
    ms = Manuscript.load_from_directory(tmp_path)

    assert ms.chapter_count == 4
    
    # Check canonical ordering (PROLOGUE -> 1 -> 2 -> EPILOGUE)
    chapters = ms.chapters
    assert chapters[0].kind == "PROLOGUE"
    assert chapters[0].number == 0.0
    assert chapters[1].number == 1.0
    assert chapters[2].number == 2.0
    assert chapters[3].kind == "EPILOGUE"
    assert chapters[3].number == 999.0

def test_source_file_tracking(tmp_path: Path):
    ch1 = tmp_path / "ch1.md"
    ch1.write_text("# **CHAPTER 1**\nText.", encoding="utf-8")
    ms = Manuscript.load_from_directory(tmp_path)
    
    assert ms.chapters[0].source_file == ch1
    assert ms.chapters[0].content_hash() == "f06dce27b84e18cc"  # stable hash of "Text."

def test_missing_directory():
    with pytest.raises(NotADirectoryError):
        Manuscript.load_from_directory(Path("/does/not/exist/ever/12345"))
