export class VoiceAnalyzer {
  constructor(aiService) {
    this.aiService = aiService;
  }

  async analyzeVoice(sampleText, projectId) {
    if (!this.aiService.isConfigured()) {
      throw new Error('AI not configured');
    }

    const systemPrompt = `You are an expert literary analyst specializing in prose style and authorial voice. Analyze the provided writing sample and produce a detailed voice profile.

Your analysis must cover:

1. **Sentence Structure**: Average length, variation patterns, use of fragments, compound/complex preferences
2. **Diction**: Vocabulary level, word choice tendencies, formality register, recurring word patterns
3. **Rhythm & Cadence**: Prose rhythm, use of repetition, parallel structure, pacing patterns
4. **Narrative Distance**: Close/distant, level of interiority, psychic distance shifts
5. **Sensory Preferences**: Which senses dominate, how description is integrated
6. **Dialogue Style**: Tag usage, beat patterns, subtext approach, dialect/voice distinction
7. **Figurative Language**: Metaphor density, simile patterns, imagery preferences
8. **Tense & POV**: Tense used, POV consistency, any shifts
9. **Paragraph Structure**: Length patterns, transition approaches, white space usage
10. **Emotional Tone**: Default register, how emotion is conveyed, restraint vs expressiveness

Output your analysis as a structured voice profile that could be used as instructions for matching this writing style. Be specific — quote examples from the text. End with a concise "Voice Summary" paragraph that captures the essence of this voice in 3-4 sentences.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Analyze the voice and style of this writing sample:\n\n---\n\n${sampleText}\n\n---`
      }
    ];

    const result = await this.aiService.client.chat(messages, {
      temperature: 0.3,
      max_tokens: 3000
    });

    return this.parseVoiceAnalysis(result.content, sampleText);
  }

  parseVoiceAnalysis(analysisText, sampleText) {
    // Extract the voice summary if present
    let voiceSummary = '';
    const summaryMatch = analysisText.match(/voice summary[:\s]*\n*([\s\S]*?)$/i);
    if (summaryMatch) {
      voiceSummary = summaryMatch[1].trim();
    }

    return {
      fullAnalysis: analysisText,
      voiceSummary: voiceSummary || analysisText.slice(0, 500),
      sampleExcerpt: sampleText.slice(0, 2000),
      analyzedAt: Date.now()
    };
  }

  async generateStyleGuide(voiceAnalysis, projectId) {
    if (!this.aiService.isConfigured()) {
      throw new Error('AI not configured');
    }

    const messages = [
      {
        role: 'system',
        content: `You are an expert writing coach. Convert the following voice analysis into a concise, actionable style guide that an AI writing assistant can follow to match this voice. Use imperative instructions. Be specific about DO and DON'T patterns. Keep it under 500 words.`
      },
      {
        role: 'user',
        content: `Convert this voice analysis into a style guide:\n\n${voiceAnalysis}`
      }
    ];

    const result = await this.aiService.client.chat(messages, {
      temperature: 0.3,
      max_tokens: 1500
    });

    return result.content;
  }

  // Lightweight heuristic analysis that doesn't require AI
  analyzeBasicMetrics(text) {
    if (!text || text.trim().length === 0) {
      return null;
    }

    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);

    // Sentence length stats
    const sentenceLengths = sentences.map(s => s.trim().split(/\s+/).length);
    const avgSentenceLength = sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length;
    const maxSentenceLength = Math.max(...sentenceLengths);
    const minSentenceLength = Math.min(...sentenceLengths);

    // Sentence length variance
    const variance = sentenceLengths.reduce((sum, len) => {
      return sum + Math.pow(len - avgSentenceLength, 2);
    }, 0) / sentenceLengths.length;
    const sentenceLengthStdDev = Math.sqrt(variance);

    // Paragraph length stats
    const paragraphLengths = paragraphs.map(p => p.split(/\s+/).length);
    const avgParagraphLength = paragraphLengths.reduce((a, b) => a + b, 0) / paragraphLengths.length;

    // Word length stats
    const wordLengths = words.map(w => w.replace(/[^a-zA-Z]/g, '').length);
    const avgWordLength = wordLengths.reduce((a, b) => a + b, 0) / wordLengths.length;

    // Dialogue ratio
    const dialogueMatches = text.match(/[""\u201C\u201D][^""\u201C\u201D]*[""\u201C\u201D]/g) || [];
    const dialogueWords = dialogueMatches.join(' ').split(/\s+/).length;
    const dialogueRatio = dialogueWords / words.length;

    // Question frequency
    const questions = text.split('?').length - 1;
    const questionRatio = questions / sentences.length;

    // Exclamation frequency
    const exclamations = text.split('!').length - 1;
    const exclamationRatio = exclamations / sentences.length;

    // Em-dash and semicolon usage
    const emDashes = (text.match(/[—–]/g) || []).length;
    const semicolons = (text.match(/;/g) || []).length;

    // Contraction usage
    const contractions = (text.match(/\w+'\w+/g) || []).length;
    const contractionRatio = contractions / words.length;

    // Adverb density (rough heuristic: words ending in -ly)
    const adverbs = words.filter(w => /ly$/i.test(w) && w.length > 3);
    const adverbRatio = adverbs.length / words.length;

    // Fragment detection (sentences under 5 words)
    const fragments = sentenceLengths.filter(len => len <= 4).length;
    const fragmentRatio = fragments / sentences.length;

    return {
      totalWords: words.length,
      totalSentences: sentences.length,
      totalParagraphs: paragraphs.length,
      avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
      maxSentenceLength,
      minSentenceLength,
      sentenceLengthStdDev: Math.round(sentenceLengthStdDev * 10) / 10,
      avgParagraphLength: Math.round(avgParagraphLength * 10) / 10,
      avgWordLength: Math.round(avgWordLength * 10) / 10,
      dialogueRatio: Math.round(dialogueRatio * 100) / 100,
      questionRatio: Math.round(questionRatio * 100) / 100,
      exclamationRatio: Math.round(exclamationRatio * 100) / 100,
      emDashesPerSentence: Math.round((emDashes / sentences.length) * 100) / 100,
      semicolonsPerSentence: Math.round((semicolons / sentences.length) * 100) / 100,
      contractionRatio: Math.round(contractionRatio * 100) / 100,
      adverbRatio: Math.round(adverbRatio * 100) / 100,
      fragmentRatio: Math.round(fragmentRatio * 100) / 100
    };
  }
}
