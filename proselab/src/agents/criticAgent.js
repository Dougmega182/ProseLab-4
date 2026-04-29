import { callOpenAI } from "../services/llm.js";
import { normalizeIntents } from "../services/normalizer.js";

/**
 * CRITIC AGENT (STORY STRUCTURE ANALYST)
 * Role: Identify weak scene titles or missing causality in the Preproduction domain.
 * Output: Structured action for the store.
 */
export async function criticAgent({ state, openaiKey, contextPatch = null }) {
  const scenes = state.project.scenes;
  const chars = state.project.chars;
  const rules = state.project.rules;
  
  if (!scenes || scenes.length === 0) {
    return { type: "NO_OP", reason: "No scenes to analyze." };
  }

  // Pre-process scenes through the Normalizer for the Critic
  const normalizedScenes = scenes.map(s => {
    const { intents, signals } = normalizeIntents(s.description || "");
    return {
      id: s.id,
      title: s.title,
      intents,
      signals
    };
  });

  const prompt = `
You are a Story Structure Critic. 
Analyze the following scenes against the DOSSIER.

NORMALIZED CONTEXT:
${JSON.stringify(normalizedScenes, null, 2)}

${contextPatch ? `ADVERSARIAL CONTEXT: A Generator has proposed the following patch.
NORMALIZED DATA: ${JSON.stringify(normalizeIntents(JSON.stringify(contextPatch)), null, 2)}
PROPOSED PATCH: ${JSON.stringify(contextPatch, null, 2)}` : ''}

DOSSIER:
Characters: ${JSON.stringify(chars.map(c => ({ 
    name: c.name, 
    role: c.role, 
    wound: c.wound,
    falseBelief: c.falseBelief,
    constraints: c.constraints // These are the enforceable behavioral rules
  })), null, 2)}
World Rules: ${JSON.stringify(rules.map(r => r.rule), null, 2)}

SCENES:
${JSON.stringify(scenes, null, 2)}

SEMANTIC ENFORCEMENT STEPS:
1. For each character action in the scenes:
   - Map the action to a behavior category (e.g., "grips knife" -> "threatens violence").
   - Compare against character constraints and world rules.
2. PATTERN ANCHORING:
   - "grips weapon" / "tightens grip" -> "threatens violence" or "prepares for violence".
   - "lunges" / "steps closer" -> "initiates conflict".
3. FLAG VIOLATIONS: If an action matches a forbidden behavior (e.g. a pacifist preparing for violence), you MUST flag it.

STRICT REQUIREMENTS:
1. ONLY reference IDs and Characters from the Dossier.
2. No commentary or generic advice.
3. Patch MUST fix the violation or return NO_OP.
4. YOU MUST RETURN THE "rev" EXACTLY AS IT APPEARS IN THE SCENE DATA. DO NOT INCREMENT IT.

OUTPUT FORMAT:
Return ONLY a JSON object.
{
  "type": "UPDATE_SCENE_PHASE",
  "payload": {
    "id": "existing_scene_id",
    "rev": 123,
    "phase": "phase_3_clue",
    "text": "..."
  },
  "phase_scores": {
    "physical": 8,
    "confusion": 6,
    "clue": 5,
    "realisation": 4,
    "expansion": 7
  },
  "confidence": 0.85,
  "risk_flags": [],
  "intent_alignment": 0.90,
  "intent_failures": [],
  "analysis": "Specific structural or dossier violation identified.",
  "rewrite": {
    "target_phase": "phase_4_realisation",
    "instruction": "Make the realisation indirect and triggered by sensory detail."
  }
}

CONFIDENCE GUIDELINES:
- > 0.90: Deterministic fix, no style drift, high structural alignment.
- 0.70 - 0.89: Good fix, minor stylistic risk, or subjective improvement.
- < 0.70: Experimental, high risk of drift, or low structural certainty.

NARRATIVE INTENT EVALUATION:
You must compare the proposed action against the SCENE INTENT (Objective, Tension, Reveal).
- intent_alignment 1.0: Action perfectly advances the scene objective.
- intent_alignment < 0.7: Action stalls the story, dilutes the reveal, or fails the tension target.

RISK FLAGS:
- "minor redundancy"
- "phase leakage"
- "style drift"
- "potential bloat"
- "vague trigger"
- "intent dilution"
`;

  try {
    const res = await callOpenAI(openaiKey, prompt);
    if (!res.ok) throw new Error(res.error);

    // Basic cleaning in case of markdown blocks
    const cleaned = res.content.replace(/```json|```/g, "").trim();
    const action = JSON.parse(cleaned);

    return action;
  } catch (e) {
    console.error("Critic Agent failed:", e);
    return { type: "ERROR", message: e.message };
  }
}
