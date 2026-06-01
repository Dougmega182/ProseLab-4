"""
narrative_os.prose_lint -- mechanical post-hoc check of generated prose
against the forbidden-pattern set.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field


HARD_BAN_PATTERNS = {
    "the_specific_X_of":   r"\bthe specific \w+ of\b",
    "not_X_but_Y":          r"\bnot \w+,?\s+but \w+",
    "in_that_moment":       r"\bin (that|this) moment\b",
    "thick_with":           r"\bthick with\b",
    "heavy_with":           r"\bheavy with\b",
    "pregnant_with":        r"\bpregnant with\b",
    "heart_emotional":      r"\bheart (pounded|swelled|hammered|raced|skipped)\b",
    "breath_hitched":       r"\bbreath (hitched|caught|stopped|stuck)\b",
    "eyes_emotional":       r"\beyes (flashed|blazed|shone|darkened|narrowed)\b",
    "chill_ran_through":    r"\bchill ran through\b",
    "warmth_spread":        r"\bwarmth (spread|bloomed|flooded)\b",
    "smile_played":         r"smile \w+ed across (his|her) lips",
}

HARD_BAN_WORDS = [
    "furthermore", "moreover", "additionally", "indeed", "crucially",
    "vibrant", "tapestry", "delve", "delving", "ethereal", "dappled",
    "labyrinthine", "cacophony",
    "remarked", "mused", "commented", "expressed", "declared",
]

SOFT_FLAG_WORDS = [
    "ozone", "hum", "intricate",
    "saw", "heard", "felt", "noticed", "watched", "observed",
    "realized", "knew", "thought",
]

SOFT_CAP_PATTERNS = {
    "kind_of":              (r"\b(kind|sort) of \w+", 3),
    "rule_of_three":        (r"\b\w+, \w+,? and \w+\b", 2),
    "as_if_simile":         (r"\bas if \w+", 2),
    "filtered_light":       (r"\bfiltered\b", 1),
}


@dataclass
class LintResult:
    hard_violations: list[tuple[str, str]] = field(default_factory=list)
    soft_flags: list[tuple[str, int]] = field(default_factory=list)
    cap_violations: list[tuple[str, int, int]] = field(default_factory=list)
    word_count: int = 0

    @property
    def passed(self) -> bool:
        return not self.hard_violations and not self.cap_violations

    def render(self) -> str:
        lines = [f"Word count: {self.word_count}", ""]
        if self.hard_violations:
            lines.append(f"HARD VIOLATIONS ({len(self.hard_violations)}):")
            for name, match in self.hard_violations:
                lines.append(f"  - {name}: '{match}'")
        else:
            lines.append("HARD VIOLATIONS: none")
        lines.append("")
        if self.cap_violations:
            lines.append(f"SOFT CAP VIOLATIONS ({len(self.cap_violations)}):")
            for name, count, cap in self.cap_violations:
                lines.append(f"  - {name}: {count} occurrences (cap: {cap})")
        else:
            lines.append("SOFT CAP VIOLATIONS: none")
        lines.append("")
        if self.soft_flags:
            lines.append("SOFT FLAGS (human-judge context):")
            for name, count in self.soft_flags:
                lines.append(f"  - {name}: {count} occurrence(s)")
        return "\n".join(lines)


def lint_prose(prose: str) -> LintResult:
    result = LintResult()
    result.word_count = len(prose.split())

    for name, pattern in HARD_BAN_PATTERNS.items():
        for m in re.finditer(pattern, prose, re.IGNORECASE):
            result.hard_violations.append((name, m.group(0)))

    for word in HARD_BAN_WORDS:
        pattern = rf"\b{re.escape(word)}\b"
        for m in re.finditer(pattern, prose, re.IGNORECASE):
            result.hard_violations.append((f"banned_word:{word}", m.group(0)))

    for word in SOFT_FLAG_WORDS:
        pattern = rf"\b{re.escape(word)}\b"
        count = len(re.findall(pattern, prose, re.IGNORECASE))
        if count > 0:
            result.soft_flags.append((word, count))

    for name, (pattern, cap) in SOFT_CAP_PATTERNS.items():
        count = len(re.findall(pattern, prose, re.IGNORECASE))
        if count > cap:
            result.cap_violations.append((name, count, cap))

    return result
