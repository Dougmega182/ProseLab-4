import { callOpenAI } from "../services/llm.js";

export function buildRewritePrompt({
  original,
  instructions = [],
  voiceSpec = {},
} = {}) {
  const style = (voiceSpec.style || []).map((item) => `- ${item}`).join("\n");
  const constraints = (voiceSpec.constraints || [])
    .map((item) => `- ${item}`)
    .join("\n");
  const banned = (voiceSpec.banned || []).map((item) => `- ${item}`).join("\n");
  const edits = instructions.map((item) => `- ${item}`).join("\n");

  return `Rewrite the paragraph using the instructions below.

Keep the underlying meaning and scene intent.
Make visible structural changes, not just synonym swaps.
Use the original text as the source of truth.

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
} = {}) {
  const prompt = buildRewritePrompt({
    original,
    instructions,
    voiceSpec,
  });

  const response = await llmCaller(key, prompt, { temperature });

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
