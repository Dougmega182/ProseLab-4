"""
Manuscript loader and parser.

Parses a markdown manuscript file with chapter headers of the form:
    # **PROLOGUE**
    # **CHAPTER 1 — BLACK PEARL BAR**
    # **CHAPTER 7.5 — REYES**
    # **CHAPTER 8: BELL DISCOVERS THE LIE**
    # **EPILOGUE — THE WAKING WORLD**

Provides:
    - Chapter slicing by number (int or float for 7.5, 12.5, etc.)
    - Content hashing (drives cache invalidation downstream)
    - Token estimation (heuristic)
    - Iteration in canonical order

Design notes:
    - Parser is forgiving: handles em-dash (—), regular dash (-), and colon (:)
      as separators between number and title.
    - PROLOGUE → chapter_num = 0
    - EPILOGUE → chapter_num = 999 (sorts last)
    - Numeric chapters: 1, 7.5, 12.5, etc. as float-or-int.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterator, Optional


# ---------------------------------------------------------------------------
# Header pattern
# ---------------------------------------------------------------------------

# Matches: # **PROLOGUE**, # **CHAPTER 1 — TITLE**, # **CHAPTER 7.5 — TITLE**,
#          # **CHAPTER 8: TITLE**, # **EPILOGUE — TITLE**
# Captures:
#   1. The "kind" token (PROLOGUE / EPILOGUE / CHAPTER)
#   2. The number (only for CHAPTER, optional)
#   3. The title (everything after the separator, optional)
_HEADER_RE = re.compile(
    r"""^\#\s*           # H1
        \*\*             # opening bold
        (?P<kind>PROLOGUE|EPILOGUE|CHAPTER)
        (?:\s+(?P<num>\d+(?:\.\d+)?))?         # optional number
        (?:\s*[—\-:]\s*(?P<title>[^*]+?))?     # optional separator + title
        \s*\*\*          # closing bold
        \s*$""",
    re.VERBOSE | re.IGNORECASE,
)

PROLOGUE_NUM = 0.0
EPILOGUE_NUM = 999.0


# ---------------------------------------------------------------------------
# Data class
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Chapter:
    """One parsed chapter."""
    number: float                # 0 = prologue, 999 = epilogue, else 1, 7.5, etc.
    title: str                   # "BLACK PEARL BAR" or "PROLOGUE"
    kind: str                    # "PROLOGUE" | "CHAPTER" | "EPILOGUE"
    text: str                    # body (header excluded)
    start_line: int              # 1-indexed line in manuscript
    end_line: int                # 1-indexed; inclusive
    source_file: Optional[Path] = None # Path to the file this chapter came from

    @property
    def display_number(self) -> str:
        if self.kind == "PROLOGUE":
            return "PROLOGUE"
        if self.kind == "EPILOGUE":
            return "EPILOGUE"
        # Drop trailing .0 for integer chapters
        if self.number == int(self.number):
            return str(int(self.number))
        return str(self.number)

    @property
    def char_count(self) -> int:
        return len(self.text)

    @property
    def token_estimate(self) -> int:
        return max(1, self.char_count // 4)

    def content_hash(self) -> str:
        """Stable hash of the chapter body. Drives cache invalidation."""
        return hashlib.sha256(self.text.encode("utf-8")).hexdigest()[:16]


# ---------------------------------------------------------------------------
# Manuscript
# ---------------------------------------------------------------------------

class Manuscript:
    """A parsed manuscript. Immutable after construction."""

    def __init__(self, path: Path | str, chapters: list[Chapter], raw: str):
        self.path = Path(path)
        self._chapters: list[Chapter] = sorted(chapters, key=lambda c: c.number)
        self._raw = raw

    # --- Factory -----------------------------------------------------------

    @classmethod
    def load(cls, path: Path | str) -> "Manuscript":
        p = Path(path)
        if not p.exists():
            raise FileNotFoundError(f"Manuscript not found: {p}")
        raw = p.read_text(encoding="utf-8")
        chapters = _parse_chapters(raw, source_file=p)
        return cls(path=p, chapters=chapters, raw=raw)

    @classmethod
    def load_from_directory(cls, dir_path: Path | str, pattern: str = "*.md") -> "Manuscript":
        p = Path(dir_path)
        if not p.is_dir():
            raise NotADirectoryError(f"Directory not found: {p}")
        
        all_chapters = []
        raw_parts = []
        for file_path in sorted(p.glob(pattern)):
            raw = file_path.read_text(encoding="utf-8")
            raw_parts.append(raw)
            # Try to parse chapters based on H1 headers
            chapters = _parse_chapters(raw, source_file=file_path)
            
            # If a file has no H1 chapter header, we might want to treat the whole file as a chapter
            # However, for now we will rely on _parse_chapters which requires a header.
            # If the user separated them, they likely kept the `# **CHAPTER...` headers.
            all_chapters.extend(chapters)
            
        full_raw = "\n\n".join(raw_parts)
        return cls(path=p, chapters=all_chapters, raw=full_raw)

    # --- Properties --------------------------------------------------------

    @property
    def raw_text(self) -> str:
        return self._raw

    @property
    def chapters(self) -> list[Chapter]:
        return list(self._chapters)

    @property
    def chapter_count(self) -> int:
        return len(self._chapters)

    @property
    def total_chars(self) -> int:
        return sum(c.char_count for c in self._chapters)

    @property
    def total_tokens_estimate(self) -> int:
        return sum(c.token_estimate for c in self._chapters)

    def content_hash(self) -> str:
        """
        Stable hash of the entire manuscript content.
        Used as the manuscript_hash in cache keys downstream.
        """
        return hashlib.sha256(self._raw.encode("utf-8")).hexdigest()[:16]

    # --- Lookup ------------------------------------------------------------

    def chapter_by_number(self, num: float | int | str) -> Optional[Chapter]:
        """
        Look up a chapter by its number.
        Accepts: 5, 5.0, 7.5, "5", "7.5", "PROLOGUE", "EPILOGUE".
        """
        if isinstance(num, str):
            up = num.strip().upper()
            if up == "PROLOGUE":
                return next((c for c in self._chapters if c.kind == "PROLOGUE"), None)
            if up == "EPILOGUE":
                return next((c for c in self._chapters if c.kind == "EPILOGUE"), None)
            try:
                num = float(num)
            except ValueError:
                return None
        target = float(num)
        return next((c for c in self._chapters if c.number == target), None)

    def __iter__(self) -> Iterator[Chapter]:
        return iter(self._chapters)

    def __len__(self) -> int:
        return self.chapter_count

    def __repr__(self) -> str:
        return (
            f"Manuscript(path={self.path.name!r}, "
            f"chapters={self.chapter_count}, "
            f"chars={self.total_chars}, "
            f"tokens~{self.total_tokens_estimate})"
        )


# ---------------------------------------------------------------------------
# Parser
# ---------------------------------------------------------------------------

def _parse_chapters(raw: str, source_file: Optional[Path] = None) -> list[Chapter]:
    """
    Split raw markdown into chapters using the H1 bold-header pattern.

    Content between two headers belongs to the earlier header.
    Content before the first header is ignored (it'd be cover matter).
    """
    lines = raw.splitlines()
    headers: list[tuple[int, str, Optional[float], str]] = []  # (line, kind, num, title)

    for i, line in enumerate(lines):
        m = _HEADER_RE.match(line)
        if not m:
            continue
        kind = m.group("kind").upper()
        num_str = m.group("num")
        title = (m.group("title") or "").strip()

        if kind == "PROLOGUE":
            num = PROLOGUE_NUM
            if not title:
                title = "PROLOGUE"
        elif kind == "EPILOGUE":
            num = EPILOGUE_NUM
            if not title:
                title = "EPILOGUE"
        else:  # CHAPTER
            if num_str is None:
                # Malformed chapter header, skip
                continue
            num = float(num_str)

        headers.append((i, kind, num, title))

    chapters: list[Chapter] = []
    for idx, (line_no, kind, num, title) in enumerate(headers):
        end_line = (
            headers[idx + 1][0] - 1 if idx + 1 < len(headers) else len(lines) - 1
        )
        # Body excludes the header line itself
        body = "\n".join(lines[line_no + 1 : end_line + 1]).strip()
        if num is None:
            continue
        chapters.append(
            Chapter(
                number=num,
                title=title,
                kind=kind,
                text=body,
                start_line=line_no + 1,   # 1-indexed
                end_line=end_line + 1,
                source_file=source_file,
            )
        )

    return chapters
