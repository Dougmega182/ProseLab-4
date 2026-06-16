"""
narrative_os.heuristic_critic -- Concrete computable metrics for prose evaluation.
"""

import re
import math
from collections import Counter

# A small proxy list of abstract words. In a full system, this would be an exhaustive lexicon.
ABSTRACT_WORDS = {
    "love", "truth", "justice", "fear", "beauty", "sadness", "joy", "anger", "thought",
    "concept", "idea", "feeling", "emotion", "theory", "democracy", "freedom", "reality",
    "illusion", "time", "destiny", "memory", "dream", "soul", "spirit", "nature",
    "humanity", "life", "death", "existence", "meaning", "essence", "significance",
    "importance", "value", "worth", "quality", "quantity", "substance", "form", "chaos",
    "order", "harmony", "discord", "peace", "war", "conflict", "resolution", "progress",
    "evolution", "history", "future", "past", "present", "moment", "eternity", "infinity"
}

def split_into_sentences(text: str) -> list[str]:
    """Splits text into sentences based on common punctuation."""
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    return [s for s in sentences if s]

def compute_rhythm_variance(text: str) -> float:
    """Calculates the standard deviation of sentence lengths (word counts)."""
    sentences = split_into_sentences(text)
    if len(sentences) < 2:
        return 0.0
    lengths = [len(re.findall(r'\b\w+\b', s)) for s in sentences]
    mean = sum(lengths) / len(lengths)
    variance = sum((l - mean) ** 2 for l in lengths) / len(lengths)
    return math.sqrt(variance)

def compute_abstraction_density(text: str) -> float:
    """Calculates the ratio of abstract words to total words."""
    words = re.findall(r'\b\w+\b', text.lower())
    if not words:
        return 0.0
    abstract_count = sum(1 for w in words if w in ABSTRACT_WORDS)
    return abstract_count / len(words)

def compute_repetition_index(text: str, n: int = 3) -> float:
    """Calculates the rate of duplicated n-grams."""
    words = re.findall(r'\b\w+\b', text.lower())
    if len(words) < n:
        return 0.0
    
    ngrams = []
    for i in range(len(words) - n + 1):
        ngrams.append(tuple(words[i:i+n]))
        
    counts = Counter(ngrams)
    total_ngrams = len(ngrams)
    duplicate_ngrams = sum(count - 1 for count in counts.values())
    return duplicate_ngrams / total_ngrams

def score_variant(text: str) -> dict[str, float]:
    """Returns a dictionary of all heuristic scores."""
    return {
        "rhythm_variance": compute_rhythm_variance(text),
        "abstraction_density": compute_abstraction_density(text),
        "repetition_index": compute_repetition_index(text)
    }

def rank_variants(variants: list[str]) -> list[tuple[int, float, dict[str, float], str]]:
    """
    Ranks a list of prose variants based on a composite heuristic score.
    Higher rhythm variance is rewarded. Abstraction density and repetition are penalized.
    Returns: list of (original_index, composite_score, scores_dict, text) sorted best to worst.
    """
    scored = []
    for i, v in enumerate(variants):
        scores = score_variant(v)
        # Simple weighted sum. In a production system, these weights would be tuned against the benchmark corpus.
        composite = scores["rhythm_variance"] - (scores["abstraction_density"] * 50) - (scores["repetition_index"] * 50)
        scored.append((i, composite, scores, v))
    
    # Sort by composite score descending (best first)
    scored.sort(key=lambda x: x[1], reverse=True)
    return scored
