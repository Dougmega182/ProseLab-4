/**
 * MECHANICAL CRITIC
 * 
 * Semi-mechanical evaluation of stylistic features.
 * Identifies 'Absolute Bans' using regex and deterministic rules.
 * This provides the 'ground truth' that exists outside LLM vibes.
 */

const ABSOLUTE_BANS = [
  {
    type: "EMOTIONAL_LABELING",
    regex: /\b(felt|sad|happy|anxious|angry|excited|nervous|worried|fearful|scared|terrified)\b/i,
    reason: "Abstract emotional labels found. Show the physical evidence instead.",
  },
  {
    type: "INTERPRETIVE_CLAUSE",
    regex: /\b(meaning that|which showed that|interpreted as|signified that|indicated that)\b/i,
    reason: "Interpreting clause found. End the sentence on the detail; do not explain the meaning.",
  },
  {
    type: "GENERIC_SENSORY",
    regex: /\b(smelled like|sounded like|looked like|felt like)\b/i,
    reason: "Vague sensory comparison. Use a specific metaphor or direct observation.",
  }
];

/**
 * Performs a mechanical sweep of the text.
 * Returns a list of failures with quotes.
 */
export function mechanicalSweep(text) {
  const failures = [];
  
  if (!text) return failures;

  for (const ban of ABSOLUTE_BANS) {
    const match = text.match(ban.regex);
    if (match) {
      failures.push({
        type: ban.type,
        reason: ban.reason,
        quote: match[0],
        mechanical: true
      });
    }
  }

  return failures;
}

/**
 * Calculates deterministic metrics for the text.
 */
export function getMechanicalMetrics(text) {
  if (!text) return { wordCount: 0, sentenceCount: 0, complexityScore: 0 };

  const words = text.trim().split(/\s+/);
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  return {
    wordCount: words.length,
    sentenceCount: sentences.length,
    avgSentenceLength: words.length / (sentences.length || 1),
    // Complexity: Ratio of words to sentences (rough proxy)
    complexityScore: (words.length / (sentences.length || 1)).toFixed(2)
  };
}
