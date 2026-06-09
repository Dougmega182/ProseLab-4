"""
narrative_os.prose_lint -- mechanical post-hoc check of generated prose
against the forbidden-pattern set.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field


HARD_BAN_PATTERNS = {
    "the_specific_X_of":      r"\bthe specific \w+ of\b",
    "not_X_but_Y":             (
        r"\bnot \w+,?\s+but \w+|\bwas(?:n't| not) \w+\.\s+It was \w+|\bit(?:'s| is) not just \w+,?\s+it(?:'s| is) \w+|\bNo \w+\.\s+Just \w+|\b\w+\s+is not about \w+,?\s+it(?:'s| is) about \w+"
    ),
    "in_that_moment":          r"\bin (that|this) moment\b|\bit was in (that|this) moment\b",
    "thick_with":              r"\bthick with\b",
    "heavy_with":              r"\bheavy with\b",
    "pregnant_with":           r"\bpregnant with\b",
    "heart_emotional":         r"\bheart (pounded|swelled|hammered|raced|skipped)\b|\bheart skipped a beat\b",
    "breath_hitched":          r"\bbreath (hitched|caught|stopped|stuck)\b",
    "eyes_emotional":          r"\beyes (flashed|blazed|shone|darkened|narrowed|widened)\b",
    "chill_ran_through":       r"\bchill ran through\b",
    "warmth_spread":           r"\bwarmth (spread|bloomed|flooded)\b",
    "smile_played":            r"smile \w+ed across (his|her) lips",
    "worn_smooth":             r"\bworn smooth\b",
    "cognitive_architecture":  r"\bcognitive architecture\b",
    "whispering_forests":      r"\bwhispering (forests|trees)\b",
    "ethereal_glow":           r"\bethereal glow\b",
    "tracing_lazy_circles":    r"\btrac(?:e|ed|ing)\s+lazy\s+circles\b|\blazy\s+circles\b",
    "forehead_touch":          r"\btouch(?:e|ed|ing)\s+(?:his|her|their)\s+forehead\b|\bforehead\s+touch\b",
    "s22_term":                r"\bAlain\s+Aspect\b|\bN\.K\.\b",
    "as_decoding":             r"\bAlain\s+and\s+Solis\b",
    "impossible_deduction":    r"\blubricant\s+viscosity\b",
    "felt_emotion":            r"\bfelt\s+(fear|sadness|anger|joy|unease|uneasy|shame|pride|guilt|grief|love|hate|hope|despair|boredom|confusion|surprise|anxiety)\b",
    "furrowed_brow":           r"\bfurrow(?:ed)?\s+(?:his|her|their)?\s*brow\b",
    "jaw_clenched":            r"\bjaw\s+(clenched|tightened)\b",
    "single_tear":             r"\bsingle\s+tear\b",
    "butterflies_stomach":     r"\bbutterflies\s+in\s+stomach\b",
    "rhetorical_question":     r"\?\s+[A-Z][^.?]*\.",
    "colon_fragment_list":     r":\s*\w+,\s*\w+(?:,\s*\w+)?\.?|:\s*\w+,\s*\w+,\s*(?:and\s+)?\w+\.?",
    "ta_da_phrases":           r"\b(?:but\s+)?here's\s+(?:the\s+truth|what\s+nobody's\s+saying)\b",
}

HARD_BAN_WORDS = [
    # General vocabulary bans
    "vibrant", "tapestry", "delve", "delving", "ethereal", "dappled", "filtered",
    "furthermore", "moreover", "additionally", "indeed", "crucially", "absolutely", "certainly",
    "labyrinthine", "cacophony", "shards", "symphony", "fractured", "fractals",
    "etched", "palpable", "tangible", "testament", "kaleidoscope", "myriad", "plethora", "profound", "nuanced",
    "unlock", "unleash", "elevate", "embark", "transformative", "revolutionary", "cutting-edge", "paradigm shift",
    # Filter verbs
    "saw", "heard", "felt", "noticed", "watched", "observed", "realized", "knew", "thought",
    "remarked", "mused", "commented", "expressed", "declared", "noted",
]

SOFT_FLAG_WORDS = [
    "ozone", "hum", "intricate",
]

SOFT_CAP_PATTERNS = {
    "kind_of":              (r"\b(?:kind|sort|type) of \w+", 3),
    "rule_of_three":        (r"\b\w+,\s+\w+,\s+(?:and\s+|or\s+)?\w+\b", 2),
    "as_if_simile":         (r"\bas if \w+", 2),
    "underwriting_absence": (r"\b(?:did not feel|wasn't that he|was not that he)\b", 1),
    "pulse_heartbeat":      (r"\bpulse\b|\bheartbeat\b", 1),
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


def detect_anaphora_chains(prose: str) -> int:
    """Detect the maximum number of consecutive sentences starting with the same word."""
    # Split prose into sentences using simple boundaries
    sentences = re.split(r'[.!?]+', prose)
    sentences = [s.strip() for s in sentences if s.strip()]
    if len(sentences) < 3:
        return 0

    first_words = []
    for s in sentences:
        match = re.match(r'^[a-zA-Z\']+', s)
        if match:
            first_words.append(match.group(0).lower())
        else:
            first_words.append("")

    max_chain = 0
    current_chain = 1
    for i in range(1, len(first_words)):
        if first_words[i] and first_words[i] == first_words[i - 1]:
            current_chain += 1
        else:
            if current_chain >= 3:
                max_chain = max(max_chain, current_chain)
            current_chain = 1
    if current_chain >= 3:
        max_chain = max(max_chain, current_chain)

    return max_chain


def lint_prose(prose: str) -> LintResult:
    result = LintResult()
    result.word_count = len(prose.split())

    # 1. Hard Ban Patterns
    for name, pattern in HARD_BAN_PATTERNS.items():
        for m in re.finditer(pattern, prose, re.IGNORECASE):
            result.hard_violations.append((name, m.group(0)))

    # 2. Hard Ban Words / Filter Verbs
    for word in HARD_BAN_WORDS:
        pattern = rf"\b{re.escape(word)}\b"
        for m in re.finditer(pattern, prose, re.IGNORECASE):
            result.hard_violations.append((f"filter_word" if word in ["saw", "heard", "felt", "noticed", "watched", "observed", "realized", "knew", "thought"] else f"banned_word:{word}", m.group(0)))

    # 3. Em-dash dramatic pause detection:
    # If a sentence contains exactly one em-dash, flag it as dramatic.
    sentences = re.split(r'[.!?]+', prose)
    for s in sentences:
        if not s.strip():
            continue
        # Count em-dashes in this sentence
        dashes = s.count('—') + s.count('--')
        if dashes == 1:
            # Locate the dash for reporting
            dash_match = re.search(r'—|--', s)
            if dash_match:
                result.hard_violations.append(("em_dash_dramatic", dash_match.group(0)))

    # 4. Soft flags
    for word in SOFT_FLAG_WORDS:
        pattern = rf"\b{re.escape(word)}\b"
        count = len(re.findall(pattern, prose, re.IGNORECASE))
        if count > 0:
            result.soft_flags.append((word, count))

    # 5. Soft Caps
    for name, (pattern, cap) in SOFT_CAP_PATTERNS.items():
        count = len(re.findall(pattern, prose, re.IGNORECASE))
        if count > cap:
            result.cap_violations.append((name, count, cap))

    # 6. Anaphora chain soft cap check (max length: 2)
    anaphora_len = detect_anaphora_chains(prose)
    if anaphora_len >= 3:
        result.cap_violations.append(("anaphora_chain", anaphora_len, 2))

    return result
