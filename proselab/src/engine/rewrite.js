import { callOpenAI } from "../services/llm.js";

export function buildRewritePrompt({
  original,
  instructions = [],
  voiceSpec = {},
  similarityRejection = false,
  sceneContext = null,
} = {}) {
  const style = (voiceSpec.style || []).map((item) => `- ${item}`).join("\n");
  const constraints = (voiceSpec.constraints || [])
    .map((item) => `- ${item}`)
    .join("\n");
  const banned = (voiceSpec.banned || []).map((item) => `- ${item}`).join("\n");
  const edits = instructions.map((item) => `- ${item}`).join("\n");

  const preservationBlock = similarityRejection
    ? `HARD REJECTION OVERRIDE:
The previous rewrite was rejected for excessive similarity to the original.
Do not reuse any sentence from the original. Not one.
Every sentence must be structurally different from what was there before.
You are not editing — you are replacing.`
    : `Do not preserve any sentence verbatim from the original.
Every sentence must be rewritten or replaced entirely.
Inserting new sentences between unchanged original sentences is decoration, not rewriting, and will be rejected.`;

  const contextBlock = sceneContext
    ? `SCENE CONTEXT — use only objects, locations, and physical details from this context. 
Do not invent objects not present in the scene.
${sceneContext}`
    : `No scene context provided. Use only physical details that could plausibly exist in any interior space. Do not invent dramatic objects.`;

  return `Rewrite the paragraph using the instructions below.

Keep the scene's events and what physically happens.
Make visible structural changes, not just synonym swaps.
${preservationBlock}

${contextBlock}

ABSOLUTE BANS — any sentence violating these will cause rejection:
- A sentence containing a named physical action or object must end immediately after that action or object. Do not append any clause, phrase, or word that interprets, contextualizes, or explains what the physical action means. "He blinked rapidly, the walls closing in" violates this rule. "He blinked rapidly." does not.
...
- Do not preserve any sequence of three or more consecutive words from the original text verbatim.
- Do not use weather imagery of any kind: clouds, storms, rain, fog, wind, sky.
- Do not use metaphors of any kind. Direct statement only.
- Do not use similes — no 'like' or 'as' comparisons.
- Do not explain what a physical action means emotionally. A physical action must stand alone without interpretation.
- Do not use these connective words after a physical action: betraying, revealing, showing, indicating, proving.
- Do not name abstract emotional states: unease, dread, fear, anxiety, tension, despair, grief, anger. Show the body instead.
- Do not use chest or stomach sensations described abstractly. Name the specific muscle or physical effect.

VOICE STYLE:
${style || "- Mix short and long sentences."}

VOICE CONSTRAINTS:
${constraints || "- Prefer concrete detail over abstraction."}

BANNED PATTERNS:
${banned || "- Generic emotional statements."}

REWRITE INSTRUCTIONS:
${edits || "- Increase specificity and physical detail."}

ORIGINAL TEXT:
---
${original || ""}
---`;
}

export async function generateRewrite({
  original,
  instructions,
  voiceSpec,
  key,
  temperature = 0.75,
  llmCaller = callOpenAI,
  debug = false,
  similarityRejection = false,
  sceneContext = null,
  rejectedDraft = null, // New parameter to pass stagnation draft
} = {}) {
  const rejectedDraftBlock = rejectedDraft
    ? `REJECTED DRAFT — DO NOT MIMIC THESE SENTENCE STRUCTURES:
---
${rejectedDraft}
---`
    : "";

  const prompt = `
${buildRewritePrompt({
  original,
  instructions,
  voiceSpec,
  similarityRejection,
  sceneContext,
})}

${rejectedDraftBlock}
`;

  const response = await llmCaller(key, prompt, { 
    temperature, 
    presence_penalty: similarityRejection ? 0.6 : 0, 
  });

  if (debug) {
    console.log({ prompt, response });
  }

  if (!response?.ok) {
    return {
      ok: false,
      text: original || "",
      response,
    };
  }

  const rewritten = response.content?.trim() || "";

  return {
    ok: true,
    text: rewritten || original || "",
    response,
  };
}

export function estimateSimilarity(a, b) {
  const left = String(a || "").trim().split(/\s+/).filter(Boolean);
  const rightSet = new Set(String(b || "").trim().split(/\s+/).filter(Boolean));
  if (left.length === 0) return 0;
  let overlap = 0;
  for (const token of left) {
    if (rightSet.has(token)) overlap += 1;
  }
  return overlap / left.length;
}

export function mapVoiceToPromptSpec(voice, delta = []) {
  return {
    style: [
      `Sentence Length: ${voice.length}`,
      `Fragment Tolerance: ${voice.fragments}`,
    ],
    constraints: delta,
    banned: voice.banned || [],
  };
}
