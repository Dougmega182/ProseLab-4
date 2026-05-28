import { callOpenAI } from "../services/llm.js";
import { validateOutputContract } from "./guards.js";
import { compileInstructionBudget } from "./budget.js";

export const ALLOWED_TRANSFORMATIONS = {
  PHYSICAL_SUBSTITUTION: "Replace abstract labels with physical actions or sensory observations.",
  RYHTHM_VARIATION: "Break or join sentences to create a varied structure (Short-Medium-Long).",
  SPECIFIC_MAPPING: "Map generic nouns to specific objects from the scene context.",
  INTENT_INJECTION: "Insert a specific physical action that makes a scene requirement visible.",
};

export function buildRewritePrompt({
  original,
  instructions = [],
  voiceSpec = {},
  similarityRejection = false,
  sceneContext = null,
  mode = "style-refinement",
  sceneIntent = null,
  failingSpan = null,
  reason = null,
} = {}) {
  const style = (voiceSpec.style || []).join(", ");
  const constraints = (voiceSpec.constraints || []).join(", ");
  const banned = (voiceSpec.banned || []).join(", ");
  const edits = instructions.join(", ");

  const preservationBlock = similarityRejection
    ? `Do not reuse or mimic any sentence from original or previous draft. Replace entirely.`
    : `Do not preserve sentences verbatim. Every sentence must be rewritten or replaced.`;

  const contextBlock = sceneContext
    ? `Context: ${sceneContext}`
    : `No context provided. Use plausible details. Do not invent dramatic objects.`;

  const intentBlock = sceneIntent
    ? `Intent: ${JSON.stringify(sceneIntent)}`
    : "";

  const bansBlock = `CRITICAL BANS (Rejects run if violated):
1. No emotional labels or states (unease, anxiety, felt, sad). Show body reaction.
2. Sentences with actions must end immediately. Do not interpret meaning.
3. No metaphors, similes (like/as), weather imagery, or abstract chest/stomach sensations.
4. Do not copy 3+ consecutive words verbatim from original.
5. No post-action emotional connectives (betraying, revealing, showing, indicating).`;

  if (mode === "intent-repair") {
    return `You are a precision rewriter fixing a narrative logic failure. Modify the text to satisfy the scene intent.

1. Goals:
- Achieve the 'objective' so that the 'expected_outcome' is physically visible.
- Make the SMALLEST change necessary. Provide clear, sensory evidence (no abstract labels).
- Return ONLY the rewritten scene prose. No comments, metadata, or JSON.

2. Context & Intent:
${contextBlock}
${intentBlock}

3. Instructions:
- Transformations: Physical substitution, Rhythm variation, Specific mapping, Intent injection.
- Repair: ${edits || "Ensure events from intent are present and causally linked."}

Original Text:
---
${original || ""}
---`;
  }

  if (mode === "surgical") {
    return `You are a precision surgical rewriter. Replace the specific failing span of text.

Failing Span: "${failingSpan}"
Failure Reason: ${reason}

Rules:
1. Replace with physical, sensory interaction that confirms the intent without abstract labels.
2. Maintain approximately same length as the original span.
3. Return ONLY replacement text. No explanation.

${contextBlock}
${intentBlock}

Original Context:
---
${original || ""}
---`;
  }

  return `You are a precision rewriter. Rewrite the paragraph applying only these rules:

1. Guidelines:
- Apply allowed transformations: Physical substitution, Rhythm variation, Specific mapping, Intent injection.
- ${preservationBlock}
- Improve style/flow only; do not change outcomes, facts, or break scene intent.

2. ${bansBlock}

3. Context & Intent:
${contextBlock}
${intentBlock}

4. Voice & Edits:
- Voice Style: ${style || "Mix short and long sentences."}
- Voice Constraints: ${constraints || "Concrete details."}
- Banned Patterns: ${banned || "No generic emotional statements."}
- Rewrite Instructions: ${edits || "Increase specificity."}

Original Text:
---
${original || ""}
---
Return ONLY the rewritten prose. No explanation or meta-text.`;
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
  rejectedDraft = null,
  mode = "style-refinement",
  sceneIntent = null,
  failingSpan = null,
  reason = null,
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
  mode,
  sceneIntent,
  failingSpan,
  reason,
})}

${rejectedDraftBlock}
`;

  const response = await llmCaller(key, prompt, { 
    temperature, 
    presence_penalty: similarityRejection ? 0.6 : 0, 
  });

  console.log("generateRewrite RAW RESPONSE:", JSON.stringify(response, null, 2));

  if (debug) {
    console.log({ prompt, response });
  }

  if (!response?.ok) {
    const res = {
      ok: false,
      text: original || "",
      error: response?.error || "Underlying LLM caller returned a failed status without an error description.",
      response,
    };
    console.log("[REWRITE PIPELINE RESULT]", res);
    return res;
  }

  const rewritten = response.content?.trim() || "";

  // DETERMINISTIC CONTRACT ENFORCEMENT
  const validation = validateOutputContract(rewritten);
  if (!validation.valid && !rejectedDraft) {
      // Retry once with corrective instruction if we haven't already retried
      if (debug) console.log("CONTRACT VIOLATION DETECTED, RETRYING...", validation.violations);
      return generateRewrite({
          original,
          instructions: [...instructions, `CRITICAL: Your previous output contained meta-language (${validation.violations.join(", ")}). Return ONLY pure prose. No brackets, no comments, no preambles.`],
          voiceSpec,
          key,
          temperature: 0.4, // Lower temp for strictness on retry
          llmCaller,
          debug,
          similarityRejection,
          sceneContext,
          rejectedDraft: rewritten,
          mode,
          sceneIntent,
          failingSpan,
          reason
      });
  }

  const res = {
    ok: true,
    text: rewritten || original || "",
    response,
  };
  console.log("[REWRITE PIPELINE RESULT]", res);
  return res;
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
  if (!voice) return { style: [], constraints: delta, banned: [] };
  
  const style = [];
  const fp = voice.fingerprint || {};

  // Retrieve fingerprint metrics
  const avgSentenceLength = fp.avgSentenceLength || voice.length;
  const fragmentRate = fp.fragmentRate || voice.fragments;
  const metaphorDensity = fp.metaphorDensity || voice.metaphor;
  const dialogueStyle = fp.dialogueStyle || voice.dialogue;

  if (avgSentenceLength) style.push(`Sentence Length: ${avgSentenceLength}`);
  if (fragmentRate) style.push(`Fragment Tolerance: ${fragmentRate}`);
  if (metaphorDensity) style.push(`Metaphor Frequency: ${metaphorDensity}`);
  if (dialogueStyle) style.push(`Dialogue Style: ${dialogueStyle}`);

  // Retrieve arrays/strings for habits & patterns
  const rawPunc = fp.punctuationHabits || voice.punctuationHabits;
  if (rawPunc) {
    const puncStr = Array.isArray(rawPunc) ? rawPunc.join(", ") : String(rawPunc);
    style.push(`Punctuation Habits: ${puncStr}`);
  }

  const rawLex = fp.lexicalPatterns || voice.lexicalPatterns;
  if (rawLex) {
    const lexStr = Array.isArray(rawLex) ? rawLex.join(", ") : String(rawLex);
    style.push(`Lexical Patterns: ${lexStr}`);
  }

  // Iterate over compressedDirectives and budget them
  const directives = voice.compressedDirectives || [];
  if (directives.length > 0) {
    const budgeted = compileInstructionBudget(directives);
    style.push("Style Directives:\n" + budgeted.map(d => `- ${d}`).join("\n"));
  } else if (voice.profile || voice.profileMarkdown) {
    style.push(`Style Guide:\n${voice.profile || voice.profileMarkdown}`);
  }

  return {
    style,
    constraints: delta,
    banned: voice.banned || [],
  };
}
