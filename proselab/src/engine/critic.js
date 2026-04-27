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

function normalizeFailures(arr) {
  if (!Array.isArray(arr)) return [];

  return arr
    .map((f) => {
      if (!f || typeof f !== "object") return null;

      const type = FAILURE_TYPES[f.type] ? f.type : null;
      const reason =
        typeof f.reason === "string" && f.reason.trim().length > 0
          ? f.reason.trim()
          : "Unspecified issue";

      if (!type) return null;

      return { type, reason };
    })
    .filter(Boolean);
}

function normalizeRewriteInstructions(rewrite, rewriteDirective) {
  const instructions = Array.isArray(rewrite?.instructions)
    ? rewrite.instructions
        .filter(
          (instruction) =>
            typeof instruction === "string" && instruction.trim().length > 0,
        )
        .map((instruction) => instruction.trim())
    : [];

  if (instructions.length > 0) {
    return { instructions };
  }

  return {
    instructions: [rewriteDirective || DEFAULT_CRITIC_RESULT.rewrite_directive],
  };
}

function buildMeta({
  valid = false,
  reason = "UNPARSEABLE",
  raw = null,
  parsed = null,
  detail = null,
  status = null,
} = {}) {
  return {
    valid,
    reason,
    raw,
    parsed,
    detail,
    status,
  };
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function deriveConfidence(verdict, score) {
  if (
    verdict === CRITIC_VERDICTS.APPROVE &&
    score.overall >= 8 &&
    score.rhythm >= 8 &&
    score.specificity >= 8 &&
    score.emotional_concreteness >= 8
  ) {
    return "high";
  }
  return "low";
}

export function buildCriticPrompt(text) {
  return `You are a strict prose critic.

Return ONLY valid JSON. No explanation.

Evaluate the text for:
- specificity
- rhythm variation
- emotional concreteness
- avoidance of generic phrasing

Rules:
- Be harsh
- Do not approve average writing
- If unsure, choose REWRITE
- Rewrite instructions must be specific and actionable
- Do NOT say "improve" or "be more descriptive"
- Each instruction must result in a visible change in the text

Return JSON:

{
  "verdict": "APPROVE" or "REWRITE",
  "score": {
    "rhythm": 0-10,
    "specificity": 0-10,
    "emotional_concreteness": 0-10,
    "overall": 0-10
  },
  "failures": [
    {
      "type": "GENERIC_LANGUAGE",
      "reason": "..."
    }
  ],
  "rewrite_directive": "One clear instruction",
  "rewrite": {
    "instructions": [
      "Replace abstract emotion with physical reaction",
      "Add one specific sensory detail",
      "Break one sentence into fragments for rhythm"
    ]
  }
}

Text:
---
${text}
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

    const verdict =
      data.verdict === CRITIC_VERDICTS.APPROVE
        ? CRITIC_VERDICTS.APPROVE
        : CRITIC_VERDICTS.REWRITE;

    const score = {
      rhythm: clampScore(data?.score?.rhythm),
      specificity: clampScore(data?.score?.specificity),
      emotional_concreteness: clampScore(
        data?.score?.emotional_concreteness,
      ),
      overall: clampScore(data?.score?.overall),
    };

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
} = {}) {
  const prompt = buildCriticPrompt(text || "");

  const response = await llmCaller(keys?.openai, prompt);

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
