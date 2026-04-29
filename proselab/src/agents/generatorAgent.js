import { callOpenAI } from "../services/llm.js";

/**
 * GENERATOR AGENT (SCENE ENHANCER)
 * Role: Improve or generate missing scene descriptions based on project context.
 * Output: Structured action for the store.
 */
export async function generatorAgent({ state, openaiKey }) {
  const scenes = state.project.scenes;
  const core = state.project.core;
  
  if (!scenes || scenes.length === 0) {
    return { type: "NO_OP", reason: "No scenes to enhance." };
  }

  // Find a scene that needs work (empty or short description)
  const candidate = scenes.find(s => !s.description || s.description.length < 50) || scenes[0];

  const chars = state.project.chars;
  const rules = state.project.rules;

  const prompt = `
You are a Scene Designer. 
Your goal is to enhance a scene description while strictly adhering to the DOSSIER.

PROJECT CONTEXT:
Genre: ${core.genre}
Theme: ${core.theme}

DOSSIER:
Characters: ${JSON.stringify(chars.map(c => c.name), null, 2)}
World Rules: ${JSON.stringify(rules.map(r => r.rule), null, 2)}

SELECTED SCENE TO ENHANCE:
${JSON.stringify(candidate, null, 2)}

STRICT REQUIREMENTS:
1. DO NOT introduce new named characters.
2. DO NOT introduce unnamed actors (e.g. "a stranger", "mysterious figure"). If you need another person, they MUST be from the Dossier.
3. ADHERE to character traits and world rules.
4. Max length: 3 sentences. Physically grounded only.
5. If the description is already 10/10, return: {"type": "NO_OP", "reason": "Already matches Dossier quality."}

OUTPUT FORMAT:
Return ONLY a JSON object.
{
  "type": "GENERATE_SCENE_BLOCKS",
  "payload": {
    "id": "${candidate.id}",
    "rev": ${candidate._rev || 1},
    "blocks": {
      "phase_1_physical": "Body sensation, immediate impact, sensory sharp-cut.",
      "phase_2_confusion": "Internal disorientation, the character questioning the input.",
      "phase_3_clue": "A specific, grounded detail noticed amidst the noise.",
      "phase_4_realisation": "The moment the meaning of the clue clicks into place.",
      "phase_5_expansion": "The context opens up; the scene links to the wider world/stakes."
    }
  },
  "analysis": "Specific alignment with ${core.genre} genre and character constraints."
}
`;

  try {
    const res = await callOpenAI(openaiKey, prompt);
    if (!res.ok) throw new Error(res.error);

    const cleaned = res.content.replace(/```json|```/g, "").trim();
    const action = JSON.parse(cleaned);

    // Enforce meta for tracking
    action.meta = { agent: "generator", intent: "enhance_description" };

    return action;
  } catch (e) {
    console.error("Generator Agent failed:", e);
    return { type: "ERROR", message: e.message };
  }
}
