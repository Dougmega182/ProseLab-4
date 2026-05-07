/**
 * Critic Agent
 * Evaluates prose quality and craft dimensions.
 */

export async function critiqueScene(prose, sceneConfig, providers) {
  const response = await providers.callLLM({
    role: 'critique',
    messages: [
      {
        role: 'system',
        content: `You are an experienced fiction editor providing constructive critique. 
You evaluate prose on craft dimensions, not plot or continuity (those are handled separately).

Evaluate on these dimensions (score 1-10 each):
1. **Voice consistency**: Does the prose maintain a consistent narrative voice?
2. **Pacing**: Is the scene well-paced? Does it drag or rush?
3. **Dialogue**: Is dialogue natural, distinct per character, and purposeful?
4. **Sensory detail**: Does the prose engage multiple senses without over-describing?
5. **Show vs tell**: Does the prose show emotions/states through action rather than stating them?
6. **Tension/engagement**: Does the scene maintain reader interest?
7. **Prose quality**: Sentence variety, word choice, rhythm.

${sceneConfig.voiceProfile ? `\nThe target voice profile:\n${sceneConfig.voiceProfile}` : ''}

Respond in JSON:
{
  "overallScore": number (1-10),
  "dimensions": {
    "voice": { "score": number, "notes": "string" },
    "pacing": { "score": number, "notes": "string" },
    "dialogue": { "score": number, "notes": "string" },
    "sensoryDetail": { "score": number, "notes": "string" },
    "showDontTell": { "score": number, "notes": "string" },
    "tension": { "score": number, "notes": "string" },
    "proseQuality": { "score": number, "notes": "string" }
  },
  "strengths": ["string"],
  "weaknesses": ["string"],
  "specificSuggestions": [
    {
      "location": "quote or paragraph reference",
      "issue": "what's wrong",
      "suggestion": "how to improve"
    }
  ]
}`
      },
      {
        role: 'user',
        content: `${sceneConfig.sceneBeat ? `Scene purpose: ${sceneConfig.sceneBeat}\n\n` : ''}Critique this scene:\n\n${prose}`
      }
    ],
    temperature: 0.4,
    max_tokens: 2000,
    response_format: { type: 'json_object' }
  });

  if (!response.ok) {
    console.error('Critique failed:', response.error);
    return {
      feedback: { overallScore: 5, dimensions: {}, strengths: [], weaknesses: [], specificSuggestions: [] },
      usage: { inputTokens: 0, outputTokens: 0 }
    };
  }

  try {
    const feedback = JSON.parse(response.content);
    return {
      feedback,
      usage: response.usage
    };
  } catch (err) {
    console.error('Failed to parse critique response:', err);
    return {
      feedback: { overallScore: 5, dimensions: {}, strengths: [], weaknesses: [], specificSuggestions: [] },
      usage: response.usage
    };
  }
}

// Alias for backward compatibility with v1 API
export { critiqueScene as callCritic };
