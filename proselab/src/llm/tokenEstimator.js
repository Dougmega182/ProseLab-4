// src/llm/tokenEstimator.js

export class TokenEstimator {
  /**
   * Rough token estimation without requiring a tokenizer library.
   * Uses the ~4 characters per token heuristic for English text,
   * with adjustments for code, punctuation, etc.
   */
  static estimate(text) {
    if (!text) return 0;

    // Average English: ~4 chars per token, but we account for
    // whitespace tokenization and subword splits
    const charCount = text.length;
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    // Blend character-based and word-based estimates
    const charEstimate = Math.ceil(charCount / 4);
    const wordEstimate = Math.ceil(wordCount * 1.3); // ~1.3 tokens per word average

    // Use the average of both methods
    return Math.ceil((charEstimate + wordEstimate) / 2);
  }

  static estimateMessages(messages) {
    let total = 0;
    for (const msg of messages) {
      total += 4; // message overhead tokens
      total += this.estimate(msg.content || '');
      total += this.estimate(msg.role || '');
    }
    total += 2; // conversation overhead
    return total;
  }

  static fitsInContext(text, maxTokens) {
    return this.estimate(text) <= maxTokens;
  }

  static truncateToFit(text, maxTokens) {
    if (this.fitsInContext(text, maxTokens)) return text;

    // Approximate character limit
    const maxChars = maxTokens * 3; // conservative
    return text.slice(0, maxChars) + '...';
  }
}
