import {
  CRITIC_VERDICTS,
  FAILURE_TYPES,
  DEFAULT_CRITIC_RESULT,
} from "./criticSchema.js";
import { callOpenAI } from "../services/llm.js";

function clampScore(n) {
  if (typeof n !== "number" || Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(10, n));
}

function normalizeFailures(failures) {
  if (!Array.isArray(failures)) return [];
  return failures
    .map((f) => {
      if (typeof f === "string") {
        return { type: FAILURE_TYPES.GENERIC_LANGUAGE, reason: f };
      }
      if (typeof f === "object" && f !== null) {
        return {
          type: f.type || FAILURE_TYPES.GENERIC_LANGUAGE,
          reason: f.reason || "Unspecified quality failure",
        };
      }
      return null;
    })
    .filter(Boolean);
}

function normalizeRewriteInstructions(rewrite, defaultDirective) {
  const instructions = Array.isArray(rewrite?.instructions)
    ? rewrite.instructions.filter((i) => typeof i === "string")
    : [];

  return {
    instructions:
      instructions.length > 0
        ? instructions
        : [defaultDirective || "Improve prose specificity and rhythm"],
  };
}

function isRecord(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function buildMeta({ valid, reason, raw, parsed, detail, status }) {
  return {
    valid: !!valid,
    reason: reason || null,
    raw: raw || null,
    parsed: parsed || null,
    detail: detail || null,
    status: status || null,
  };
}

function deriveConfidence(verdict, score) {
  if (verdict === CRITIC_VERDICTS.APPROVE && score.overall >= 8) {
    return "high";
  }
  if (
    verdict === CRITIC_VERDICTS.REWRITE &&
    score.specificity <= 3 &&
    score.physical_grounding <= 3
  ) {
    return "high";
  }
  return "low";
}

export function buildCriticPrompt(text, sceneContext = null) {
  const formattedContext =
    typeof sceneContext === "object" && sceneContext !== null
      ? JSON.stringify(sceneContext, null, 2)
      : sceneContext;

  const contextBlock = formattedContext
    ? `SCENE CONTEXT — anchor all replacement instructions in these objects and details:
${formattedContext}
`
    : "";

  return `You are an Objective Prose Analyst. 

Return ONLY valid JSON. No explanation.

Evaluate the text for:
- Physical Grounding (0-10): 10 = Zero abstract labels, zero metaphors, zero weather imagery.
- Specificity (0-10): 10 = Every noun has a specific source or modifier from the scene context.
- Rhythm (0-10): 10 = Varied sentence lengths and structures.

SCORING RUBRIC:
- 10: Pure physical action/observation. (e.g. "He opened the metal latch.")
- 5: Mix of physical and abstract. (e.g. "He opened the latch, feeling relieved.")
- 1: Purely abstract or cliché. (e.g. "He felt a weight lift from his shoulders.")

${contextBlock}

Rules:
- If a sentence uses an abstract emotional label (felt, sad, happy, anxious), the score must be below 5.
- Grounded mechanical or physiological metaphors (e.g. "tasted copper", "diesel animal") are PERMITTED.
- Abstract psychological metaphors (e.g. "weight lift from his shoulders", "darkness in his heart") must be REJECTED with a low score.
- Each instruction must name the exact failing phrase and specify a physical replacement.

CALIBRATION (What to APPROVE):
A score of 7-10 is for prose that is 100% physically grounded.
Example 1: "When her father said the house was sold, Vera smiled first, out of habit, then tasted the copper where she'd bitten the inside of her cheek too hard."
- Overall: 9 (APPROVE)
Example 2: "The generator coughed awake under the floorboards, a diesel animal clearing its throat, and the lights came back one strip at a time along the corridor."
- Overall: 9 (APPROVE) (Note: Mechanical metaphors like 'diesel animal' are PERMITTED because they enhance physical source detail.)

CALIBRATION (What to REWRITE):
A score of 1-4 is given to any text using abstract emotional labels or "AI-filler."
Example: "He felt overwhelming sadness as he sat at the desk thinking about his failures."
- Overall: 2 (REWRITE)

Return JSON:

{
  "score": {
    "rhythm": 0-10,
    "specificity": 0-10,
    "physical_grounding": 0-10,
    "overall": 0-10
  },
  "failures": [
    { "type": "GENERIC_LANGUAGE", "reason": "..." }
  ],
  "rewrite_directive": "...",
  "rewrite": {
    "instructions": [
      "Replace 'phrase' with [Category] and end the sentence on the detail."
    ]
  }
}

Text:
---
${text ?? ""}
---`;
}

export function normalizeCriticOutput(raw, context = {}) {
  try {
    if (context.reason) {
      throw new Error(context.reason);
    }

    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!isRecord(data)) {
      throw new Error("INVALID_SHAPE");
    }

    const score = {
      rhythm: clampScore(data?.score?.rhythm),
      specificity: clampScore(data?.score?.specificity),
      physical_grounding: clampScore(data?.score?.physical_grounding),
      overall: clampScore(data?.score?.overall),
    };

    const verdict =
      score.overall >= 7 &&
      score.physical_grounding >= 6 &&
      score.specificity >= 6
        ? CRITIC_VERDICTS.APPROVE
        : CRITIC_VERDICTS.REWRITE;

    const failures = normalizeFailures(data.failures);

    const rewriteDirective =
      typeof data.rewrite_directive === "string" &&
      data.rewrite_directive.trim().length > 0
        ? data.rewrite_directive.trim()
        : DEFAULT_CRITIC_RESULT.rewrite_directive;
    const rewrite = normalizeRewriteInstructions(
      data.rewrite,
      rewriteDirective,
    );

    return {
      verdict,
      confidence: deriveConfidence(verdict, score),
      score,
      failures,
      rewrite_directive: rewriteDirective,
      rewrite,
      meta: buildMeta({
        valid: true,
        reason: null,
        raw: context.raw ?? (typeof raw === "string" ? raw : null),
        parsed: data,
      }),
    };
  } catch {
    return {
      ...DEFAULT_CRITIC_RESULT,
      score: { ...DEFAULT_CRITIC_RESULT.score },
      failures: [...DEFAULT_CRITIC_RESULT.failures],
      meta: buildMeta({
        valid: false,
        reason: context.reason || "PARSE_ERROR",
        raw: context.raw ?? (typeof raw === "string" ? raw : null),
        parsed: context.parsed ?? null,
        detail: context.detail ?? null,
        status: context.status ?? null,
      }),
    };
  }
}

export async function callCritic({
  text,
  keys,
  debug = false,
  llmCaller = callOpenAI,
  sceneContext = null,
} = {}) {
  if (!keys?.openai) {
    throw new Error("CRITIC_FAILURE: Missing OpenAI API key.");
  }

  const prompt = buildCriticPrompt(text ?? "", sceneContext);

  const response = await llmCaller(keys.openai, prompt);

  if (!response?.ok) {
    const normalized = normalizeCriticOutput(null, {
      reason: "LLM_CALL_FAILED",
      raw: response?.raw ?? null,
      parsed: null,
      detail: response?.error ?? "Unknown provider failure",
      status: response?.status ?? null,
    });
    if (debug) {
      console.log({ prompt, response, parsed: null, normalized });
    }
    return normalized;
  }

  const raw = response.content;
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }

  const normalized = normalizeCriticOutput(parsed, {
    reason: parsed ? null : "PARSE_ERROR",
    raw,
    parsed,
    detail: parsed ? null : "Critic returned non-JSON content",
    status: response.status ?? null,
  });

  if (debug) {
    console.log({ prompt, response, raw, parsed, normalized });
  }

  return normalized;
}

export { clampScore, normalizeFailures };
