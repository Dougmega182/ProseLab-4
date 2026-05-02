/**
 * PROSE STYLE ANALYZER
 * Measures statistical distributions of literary quality.
 * Goal: Detect ungrounded, decorative, or "AI-slop" prose.
 */

export function analyzeProseStyle(text) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length === 0) return { score: 1.0, issues: [] };

  const signals = {
    syntactic_monotony: scoreSentenceVariance(sentences),
    abstract_emotion: measureAbstractEmotionRatio(text),
    cliche_density: detectCliches(text)
  };

  const issues = [];
  if (signals.syntactic_monotony < 0.4) issues.push("High syntactic monotony detected (uniform sentence lengths).");
  if (signals.abstract_emotion < 0.5) issues.push("Emotion is labeled rather than embodied (high abstract emotion ratio).");
  if (signals.cliche_density < 0.6) issues.push("High cliché/template density detected.");

  // Weighted sum
  const score = (signals.syntactic_monotony * 0.3) + 
                (signals.abstract_emotion * 0.4) + 
                (signals.cliche_density * 0.3);

  return { score, signals, issues };
}

function scoreSentenceVariance(sentences) {
  if (sentences.length < 3) return 0.8; // Not enough data
  const lengths = sentences.map(s => s.trim().split(/\s+/).length);
  const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / lengths.length;
  const stdDev = Math.sqrt(variance);
  
  // Normalized: stdDev of 5+ words is "good" variance (score 1.0)
  return Math.min(1.0, stdDev / 6);
}

function measureAbstractEmotionRatio(text) {
  const ABSTRACT_EMOTIONS = [
    "felt", "thought", "realized", "sad", "happy", "angry", "furious", 
    "desperate", "lonely", "excited", "nervous", "anxious", "scared", "afraid",
    "wondered", "pondered", "believed"
  ];
  const words = text.toLowerCase().split(/\s+/);
  const hits = words.filter(w => ABSTRACT_EMOTIONS.includes(w)).length;
  
  // Ratio of abstract words to total words
  const ratio = hits / words.length;
  // Penalty starts if ratio > 0.03 (3% of text is abstract labels)
  return Math.max(0, 1.0 - (ratio * 10));
}

function detectCliches(text) {
  const CLICHES = [
    "a testament to", "the sun began to", "shimmering", "ethereal",
    "the weight of the", "secrets simmer", "shadows danced", "ticking time bomb",
    "unspoken words", "eyes glinting", "shrouded in", "the heart of the city"
  ];
  const lowText = text.toLowerCase();
  const hits = CLICHES.filter(c => lowText.includes(c)).length;
  
  // Penalty starts after 1 cliché per 50 words
  const wordCount = text.split(/\s+/).length;
  const threshold = Math.max(1, Math.floor(wordCount / 50));
  
  if (hits <= threshold) return 1.0;
  return Math.max(0, 1.0 - ((hits - threshold) * 0.2));
}
