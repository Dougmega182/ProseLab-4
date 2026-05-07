/**
 * Voice Calibrator Agent
 * Analyzes authorial writing samples to create a structured voice profile.
 * The profile is framed as instructions for direct use in generation prompts.
 */

export async function calibrateVoice(sampleTexts, providers) {
  // sampleTexts: array of { text, label? } — the writer's own prose samples
  
  const combinedSamples = sampleTexts
    .map((s, i) => `--- Sample ${i + 1}${s.label ? ` (${s.label})` : ''} ---\n${s.text}`)
    .join('\n\n');

  const response = await providers.callLLM({
    role: 'analysis', // Use analytical model for voice calibration
    messages: [
      {
        role: 'system',
        content: `You are a literary analyst specializing in authorial voice. Analyze writing samples to create a detailed voice profile that could guide an AI to write in a similar style.

Your analysis should cover:

1. **Sentence structure**: Average length, variety, use of fragments, compound vs complex sentences, rhythm patterns
2. **Vocabulary level**: Formal/informal, Latinate vs Anglo-Saxon word preference, jargon, neologisms
3. **Paragraph structure**: Length, density, how ideas flow between paragraphs
4. **Dialogue style**: Tag usage (said vs alternatives), dialect rendering, subtext, interruption patterns
5. **Narrative distance**: Close/distant, how deeply we enter character thoughts, free indirect discourse usage
6. **Sensory preferences**: Which senses dominate, how sensory detail is integrated
7. **Figurative language**: Metaphor density, simile style, imagery patterns, recurring motifs
8. **Pacing techniques**: Scene vs summary, time compression, white space usage
9. **Emotional register**: How emotions are conveyed, restraint vs expressiveness
10. **Distinctive quirks**: Any unusual patterns, signature moves, idiosyncrasies

Write the profile as INSTRUCTIONS — not as analysis. Frame everything as "Write with..." or "Use..." or "Prefer..." so it can be directly used as a system prompt section.

Keep it under 500 words. Be specific — avoid vague instructions like "write well." Instead: "Favor short declarative sentences for action, lengthening to complex structures during introspection. Average 12-15 words per sentence."`
      },
      {
        role: 'user',
        content: `Analyze these writing samples and create a voice profile:\n\n${combinedSamples}`
      }
    ],
    temperature: 0.4,
    max_tokens: 1500
  });

  if (!response.ok) {
    console.error('Voice calibration failed:', response.error);
    return null;
  }

  return {
    profile: response.content,
    usage: response.usage,
    calibratedAt: Date.now(),
    sampleCount: sampleTexts.length,
    sampleWordCount: sampleTexts.reduce((acc, s) => acc + s.text.split(/\s+/).length, 0)
  };
}
