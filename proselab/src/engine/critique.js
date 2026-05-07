/**
 * Critique Agent
 * Evaluates prose quality and literary craft dimensions.
 */

export async function critiqueScene(prose, context, providers) {
  const systemPrompt = `You are a professional fiction editor and writing coach. You provide constructive, specific critique of prose. You evaluate craft, not content — the writer decides what happens, you evaluate how well it's executed.

Evaluate on these dimensions:
1. **Prose Quality** (1-10): Sentence-level craft, word choice, rhythm, clarity
2. **Dialogue** (1-10): Naturalness, subtext, character voice differentiation
3. **Pacing** (1-10): Scene rhythm, tension management, balance of action/reflection
4. **Sensory Detail** (1-10): Engagement of senses, grounding in physical reality
5. **Emotional Resonance** (1-10): Reader emotional engagement, character interiority
6. **Show vs Tell** (1-10): Dramatization vs exposition ratio
7. **Scene Structure** (1-10): Opening hook, escalation, turning point, exit momentum

Respond in JSON:
{
  "scores": {
    "proseQuality": <1-10>,
    "dialogue": <1-10>,
    "pacing": <1-10>,
    "sensoryDetail": <1-10>,
    "emotionalResonance": <1-10>,
    "showVsTell": <1-10>,
    "sceneStructure": <1-10>
  },
  "overallScore": <1-10>,
  "topStrengths": ["specific strength with quote example", ...],
  "topWeaknesses": ["specific weakness with quote example and suggestion", ...],
  "lineEdits": [
    {
      "original": "quoted text from prose",
      "suggested": "improved version",
      "reason": "why this is better"
    }
  ],
  "overallNotes": "2-3 sentence overall assessment"
}`;

  let userContent = `## SCENE PROSE\n\n${prose}`;

  if (context.sceneBeat) {
    userContent += `\n\n## SCENE INTENT\n${context.sceneBeat}`;
  }

  if (context.voiceProfile) {
    userContent += `\n\n## TARGET VOICE PROFILE\n${context.voiceProfile}`;
  }

  const response = await providers.callLLM({
    role: 'critique',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent }
    ],
    temperature: 0.3,
    max_tokens: 3000,
    response_format: { type: 'json_object' }
  });

  if (!response.ok) {
    console.error('Critique failed:', response.error);
    return { overallScore: 0, overallNotes: 'Critique failed' };
  }

  try {
    return JSON.parse(response.content);
  } catch (e) {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return {
      scores: {},
      overallScore: 0,
      topStrengths: [],
      topWeaknesses: [],
      lineEdits: [],
      overallNotes: 'Critique failed to parse'
    };
  }
}
