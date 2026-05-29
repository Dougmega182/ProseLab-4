// E:\Ai\ProseLabV2\proselab\src\engine\eventExtractor.js
// @ts-nocheck
import { z } from 'zod';
import { callOpenAI } from '../services/llm.js';

const EVENT_TYPES = [
  'DIRECT_TRIGGER',
  'INDIRECT_TRIGGER',
  'SUPPRESSION',
  'REINTEGRATION',
  'DISPLACEMENT',
  'ANTICIPATORY_LOAD'
];

const eventSchema = z.object({
  events: z.array(z.object({
    character: z.string(),
    type: z.enum(EVENT_TYPES),
    confidence: z.number().min(0.0).max(1.0),
    evidence: z.string()
  }))
});

/**
 * Extracts psychological participation events from generated prose.
 * The LLM acts purely as a semantic sensor, providing confidence scores.
 */
export async function extractEvents(prose, attendanceList, providers) {
  if (!providers?.validation?.provider) {
    console.warn("[eventExtractor] Missing validation provider, returning empty events.");
    return [];
  }

  const prompt = `You are an expert psychological narrative analyst. 
Your job is to scan the following prose and extract any meaningful emotional events for the characters in attendance.
DO NOT invent events. Only report what is explicitly in the text or strongly implied by the subtext.

ATTENDANCE LIST: ${attendanceList.join(', ')}

VALID EVENT TYPES:
- DIRECT_TRIGGER: Explicit interaction that causes emotional spike.
- INDIRECT_TRIGGER: Memory or environmental activation of trauma.
- SUPPRESSION: Emotional containment, swallowing feelings.
- REINTEGRATION: Emotional release, stabilization, confession, catharsis.
- DISPLACEMENT: Emotion redirected elsewhere (e.g. kicking a dog because you're mad at your boss).
- ANTICIPATORY_LOAD: Future-oriented pressure, anxiety, dread about what is to come.

PROSE:
${prose}

Return a JSON object containing an "events" array. 
For each event, specify the character, the exact type, a confidence score (0.0 to 1.0), and a brief quote as evidence.`;

  try {
    const rawResult = await callOpenAI(
      prompt,
      providers.validation.model,
      providers.keys.openai,
      1000,
      0.1, // low temp for extraction
      eventSchema
    );

    // Validate using Zod schema? The llm layer might not parse it automatically.
    // Assuming callOpenAI returns parsed JSON if we pass a schema, or we parse it here.
    let parsed;
    if (typeof rawResult === 'string') {
      const match = rawResult.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        return [];
      }
    } else {
      parsed = rawResult;
    }

    // Filter events to only include characters in the canonical attendance list
    const filteredEvents = (parsed.events || []).filter(e => attendanceList.includes(e.character));
    return filteredEvents;

  } catch (err) {
    console.error("[eventExtractor] Failed to extract events:", err);
    return [];
  }
}
