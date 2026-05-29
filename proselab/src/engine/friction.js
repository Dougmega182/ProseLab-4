// @ts-nocheck
function parseFirstJSONObject(raw) {
  const source = String(raw || '').replace(/```json|```/gi, '').trim();
  const starts = [];
  let inString = false;
  let escaped = false;

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '{') starts.push(i);
  }

  for (let s = 0; s < starts.length; s += 1) {
    const start = starts[s];
    let depth = 0;
    inString = false;
    escaped = false;

    for (let i = start; i < source.length; i += 1) {
      const ch = source[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') { inString = true; continue; }
      if (ch === '{') depth += 1;
      if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          const candidate = source.slice(start, i + 1);
          try { return JSON.parse(candidate); } catch { break; }
        }
      }
    }
  }
  return null;
}

export async function evaluateFriction(prose, heuristics, providers) {
  const systemPrompt = `You are an adversarial statistical anti-predictability layer. 
Your singular goal is to detect when prose becomes too easy to consume, mathematically probable, or emotionally flat. 
You are hunting for "AI tone"—the statistically safest next token, predictable cadences, and overly explicit transitions.
You are given hard heuristic data to anchor your evaluation. Use this data to justify your scores.

Evaluate the prose on these 5 specific axes (1-10):
1. **Predictability** (1 = highly unpredictable/original, 10 = extremely predictable/cliché). Can the reader easily predict the next sentence rhythm or thought?
2. **Interpretive Load** (1 = zero subtext/over-explained, 10 = requires heavy reader inference/subtext).
3. **Semantic Precision** (1 = vague/generic, 10 = highly specific, intentional ambiguity where present).
4. **Emotional Compression** (1 = emotion explicitly stated, 10 = emotion implied strictly through image/action).
5. **Structural Coherence** (1 = completely incoherent noise, 10 = perfectly intelligible scene). *Crucial: High friction must not destroy coherence!*

Answer the following questions explicitly:
- "Where does this prose become too easy?"
- "Where does the sentence resolve predictably?"
- "Which sentence sounds generated rather than observed?"

Respond in JSON:
{
  "scores": {
    "predictability": <1-10>,
    "interpretiveLoad": <1-10>,
    "semanticPrecision": <1-10>,
    "emotionalCompression": <1-10>,
    "structuralCoherence": <1-10>
  },
  "answers": {
    "tooEasy": "Quote and explanation",
    "resolvesPredictably": "Quote and explanation",
    "soundsGenerated": "Quote and explanation"
  },
  "overallVerdict": "PASS or FAIL (Fail if predictability > 6 OR structuralCoherence < 5 OR interpretiveLoad < 4)",
  "frictionViolations": ["List of specific phrases to rewrite for more productive tension"]
}`;

  const userContent = `## HEURISTIC DATA
Clichés Detected: ${heuristics.cliches.count} (${heuristics.cliches.matched.join(", ")})
Rhythm Variance StdDev: ${heuristics.rhythm.stdDev} (Uniform: ${heuristics.rhythm.isUniform})
Emotion Ratio (Abstract/Total): ${heuristics.emotion.ratio.toFixed(2)} (Overly Abstract: ${heuristics.emotion.isOverlyAbstract})
Dialogue Ping-Pong: ${heuristics.dialogue.isPingPong}

## SCENE PROSE
${prose}`;

  const response = await providers.callLLM({
    role: 'critique', // Using critique provider settings
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent }
    ],
    temperature: 0.2, // Low temperature for consistent adversarial grading
    max_tokens: 3000,
    response_format: { type: 'json_object' }
  });

  if (!response.ok) {
    console.error('Friction evaluation failed:', response.error);
    return {
      scores: { predictability: 1, interpretiveLoad: 10, semanticPrecision: 10, emotionalCompression: 10, structuralCoherence: 10 },
      overallVerdict: "PASS",
      frictionViolations: ["Friction engine failed to parse - defaulting to PASS"],
      error: response.error
    };
  }

  const parsed = parseFirstJSONObject(response.content);
  if (parsed) return parsed;
  
  return {
    scores: { predictability: 1, interpretiveLoad: 10, semanticPrecision: 10, emotionalCompression: 10, structuralCoherence: 10 },
    overallVerdict: "PASS",
    frictionViolations: ["Friction JSON failed to parse"],
  };
}
