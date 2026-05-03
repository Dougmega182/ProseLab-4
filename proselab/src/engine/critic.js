import {
  CRITIC_VERDICTS,
  INTENT_VERDICTS,
  FAILURE_TYPES,
  DEFAULT_CRITIC_RESULT,
} from "./criticSchema.js";
import { callOpenAI } from "../services/llm.js";
import { EVENT_SCHEMA_PROMPT, EVENT_CATEGORIES } from "./eventSchema.js";
import { parseIntentContract, validateIntentChain } from "./intentRules.js";
import { DISAGREEMENT_CLASSES } from "./truthProtocol.js";
import { analyzeProseStyle } from "./proseStyle.js";
import { evaluatePolicy } from "./policyLayer.js";
import { mechanicalSweep } from "./mechanicalCritic.js";
import { STYLE_EXEMPLARS } from "./exemplars.js";
import { robustParseJSON } from "../services/normalizer.js";

/**
 * Classifies why two critic models disagree on a verdict.
 */
export function classifyDisagreement(primary, challenger) {
  if (primary.verdict === challenger.verdict) return null;

  // 1. Entity Check
  const pEntities = new Set(Object.values(primary.evidence || {}).flatMap(e => e.map(i => i.event_id)));
  const cEntities = new Set(Object.values(challenger.evidence || {}).flatMap(e => e.map(i => i.event_id)));
  const intersection = new Set([...pEntities].filter(x => cEntities.has(x)));
  if (intersection.size < Math.min(pEntities.size, cEntities.size) * 0.5) {
    return DISAGREEMENT_CLASSES.ENTITY_MISMATCH;
  }

  // 2. Intent Check
  if (primary.intent_verdict !== challenger.intent_verdict) {
    return DISAGREEMENT_CLASSES.DELIVERY_AMBIGUITY;
  }

  // 3. Score Check
  if (Math.abs((primary.score?.overall || 0) - (challenger.score?.overall || 0)) > 2) {
    return DISAGREEMENT_CLASSES.SCORE_VARIANCE;
  }

  return DISAGREEMENT_CLASSES.LOGIC_CONFLICT;
}

function clampScore(n) {
  if (typeof n !== "number" || Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(10, n));
}

function clampAlignment(n) {
  if (typeof n !== "number" || Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
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

function normalizeIntentFailures(failures) {
  if (!Array.isArray(failures)) return [];
  return failures.filter((item) => typeof item === "string" && item.trim().length > 0);
}

function normalizeIntentChecks(checks) {
  const normalized = {};
  if (!checks || typeof checks !== "object") return normalized;
  for (const [key, val] of Object.entries(checks)) {
    normalized[key] = val === "PASS" ? "PASS" : "FAIL";
  }
  return normalized;
}

function normalizeIntentEvidence(evidence) {
  const normalized = {};
  if (!evidence || typeof evidence !== "object") return normalized;
  for (const [key, items] of Object.entries(evidence)) {
    if (!Array.isArray(items)) {
        normalized[key] = [];
        continue;
    }
    normalized[key] = items
      .map((item) => {
        if (!isRecord(item)) return null;
        const eventId = typeof item.event_id === "string" ? item.event_id.trim() : null;
        const quote = typeof item.quote === "string" ? item.quote.trim() : "";
        if (!eventId && !quote) return null;
        return { event_id: eventId, quote };
      })
      .filter(Boolean);
  }
  return normalized;
}

function validateEvidenceSpans(evidence, draft, events = []) {
  if (!Array.isArray(evidence) || evidence.length === 0) return false;
  if (typeof draft !== "string" || !draft.length) return false;

  return evidence.every((entry) => {
    const event = events.find(e => e.id === entry.event_id);
    if (!event) return false;

    const components = [
      event.trigger, 
      event.roles?.source?.span, 
      event.roles?.target?.span, 
      event.roles?.instrument?.span, 
      event.roles?.content?.span
    ].filter(Boolean);
    
    return components.every(comp => {
      if (typeof comp.start !== "number" || typeof comp.end !== "number") return false;
      const actualText = draft.slice(comp.start, comp.end);
      return actualText === comp.text;
    });
  });
}

function isRecord(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function buildMeta({ valid, reason, raw, parsed, detail, status, style }) {
  return {
    valid: !!valid,
    reason: reason || null,
    raw: raw || null,
    parsed: parsed || null,
    detail: detail || null,
    status: status || null,
    style: style || null
  };
}

function normalizeMinimalFix(minimalFix, fallbackInstruction) {
  const instruction =
    typeof minimalFix?.instruction === "string" && minimalFix.instruction.trim().length > 0
      ? minimalFix.instruction.trim()
      : fallbackInstruction;

  return {
    instruction: instruction || "",
    strategy: minimalFix?.strategy || "GENERAL_FIX",
    forbidden: minimalFix?.forbidden || []
  };
}

export function buildIntentPrompt(text, sceneIntent, events = [], contract = null) {
  const eventsBlock = events.length > 0
    ? `VERIFIED EVENTS (Grounded in text):
${JSON.stringify(events, null, 2)}
`
    : "";

  const contractBlock = contract 
    ? `STRUCTURED INTENT CONTRACT (DSL):
${JSON.stringify(contract, null, 2)}
`
    : "";

  return `You are an intent validator. Return ONLY valid JSON.

SCENE INTENT (Original):
${JSON.stringify(sceneIntent, null, 2)}

${contractBlock}

TEXT TO EVALUATE:
---
${text ?? ""}
---

${eventsBlock}

${EVENT_SCHEMA_PROMPT}

EVALUATION RULES:
- A field is PASS ONLY if it is supported by a chain of VERIFIED EVENTS.
- Implied satisfaction is FAIL.
- For every PASS check, name the event_id(s) and the exact quote from the text.
- reasoning: Provide a step-by-step logic chain.

Return JSON:
{
  "checks": { "objective": "PASS|FAIL", "success_state": "PASS|FAIL", "irreversible_change": "PASS|FAIL", "story_delta": "PASS|FAIL" },
  "reasoning": { "objective": "...", "success_state": "...", "irreversible_change": "...", "story_delta": "..." },
  "evidence": { "objective": [{ "event_id": "E1", "quote": "..." }], ... },
  "intent_verdict": "PASS|FAIL",
  "intent_failures": ["..."],
  "minimal_fix": { "instruction": "..." }
}`;
}

export function normalizeIntentOutput(raw, context = {}) {
  try {
    if (context.reason) throw new Error(context.reason);

    const data = (raw && typeof raw === "object") ? raw : robustParseJSON(raw);
    if (!data || !isRecord(data)) {
        return {
            verdict: INTENT_VERDICTS.FAIL,
            score: 0,
            intent_verdict: INTENT_VERDICTS.FAIL,
            intent_alignment: 0,
            intent_failures: ["MALFORMED_RESPONSE"],
            minimal_fix: { instruction: "Clarify the narrative intent." },
            meta: { valid: false, reason: "INVALID_SHAPE" }
        };
    }
    
    const draftText = typeof context.draft === "string" ? context.draft : "";
    const checks = normalizeIntentChecks(data.checks);
    const evidence = normalizeIntentEvidence(data.evidence);
    const intentAlignment = clampAlignment(data.intent_alignment);
    let intentFailures = normalizeIntentFailures(data.intent_failures);

    for (const [key, status] of Object.entries(checks)) {
      if (status === "PASS" && !validateEvidenceSpans(evidence[key], draftText, context.events)) {
        checks[key] = "FAIL";
        intentFailures.push(`${key} marked PASS without valid evidence span`);
      }
    }

    // POLICY DELEGATION
    const dResult = context.deterministicResult || { result: "FAIL", confidence: 0 };
    const styleResult = context.styleResult || { score: 1.0, issues: [] };
    
    const policy = evaluatePolicy(dResult, styleResult);

    const result = {
      result: policy.tier,
      confidence: policy.scores.logic,
      primary_failure: dResult.primary_failure || (policy.tier === "STYLE_FAIL" ? "STYLE_VIOLATION" : null),
      secondary_failures: policy.issues,
      checks,
      evidence,
      intent_alignment: policy.scores.logic,
      intent_verdict: (policy.verdict === "APPROVE" ? INTENT_VERDICTS.PASS : INTENT_VERDICTS.FAIL),
      minimal_fix: policy.actionable_feedback,
      meta: buildMeta({
        valid: true,
        reason: null,
        raw: context.raw ?? (typeof raw === "string" ? raw : null),
        parsed: data,
        style: styleResult
      }),
    };

    return result;
  } catch (e) {
    console.error("normalizeIntentOutput Error:", e.message);
    return {
      intent_alignment: 0,
      intent_verdict: INTENT_VERDICTS.FAIL,
      intent_failures: [context.reason || "PARSE_ERROR"],
      minimal_fix: { instruction: DEFAULT_CRITIC_RESULT.minimal_fix.instruction },
      meta: buildMeta({
        valid: false,
        reason: context.reason || "PARSE_ERROR",
        raw: context.raw ?? (typeof raw === "string" ? raw : null),
        parsed: null,
      }),
    };
  }
}

export function buildCriticPrompt(text, sceneContext = null, sceneIntent = null, events = []) {
  const formattedContext =
    typeof sceneContext === "object" && sceneContext !== null
      ? JSON.stringify(sceneContext, null, 2)
      : sceneContext;

  const contextBlock = formattedContext
    ? `SCENE CONTEXT - anchor all replacement instructions in these objects and details:
${formattedContext}
`
    : "";

  const eventsBlock = events.length > 0
    ? `VERIFIED EVENTS (Extracted from text):
${JSON.stringify(events, null, 2)}
`
    : "";

  const intentBlock = sceneIntent
    ? `SCENE INTENT CONTRACT - authoritative, overrides stylistic evaluation:
${JSON.stringify(sceneIntent, null, 2)}

Intent enforcement rules - these are hard constraints:
- Every field in the scene intent contract is mandatory.
- objective must be visibly achieved in the text. Implied achievement is FAIL.
- success_state must be directly observable. Inferred outcomes are FAIL.
- irreversible_change must occur explicitly and must causally produce the success_state. Adjacent or implied actions are FAIL.
- story_delta must be established explicitly. Restating the start is FAIL.
- PASS rules: A check is PASS only if it maps to a VERIFIED EVENT listed above.
- If ANY intent field is missing or only implied, intent_verdict MUST be "FAIL".
- Every PASS check must include the corresponding event_id and the quote.
- The 'quote' MUST be the 'verifiable_span' of the corresponding VERIFIED EVENT. Do not use the event 'content' as the quote.
- Paraphrased evidence is forbidden.
- If intent_verdict is "PASS": intent_failures MUST be [], and minimal_fix.instruction MUST be empty.
- If intent_verdict is "FAIL": minimal_fix.instruction MUST name the exact missing action and exact wording needed.
- If intent is failing, prioritize intent repair in rewrite instructions before any style notes.
`
    : "";

  return `You are an Objective Prose Analyst.
CURRENT DATE: ${new Date().toISOString()}

Return ONLY valid JSON. No explanation.

QUALITY ANCHORS (Use these to calibrate your scores):
${STYLE_EXEMPLARS.map(ex => `BAD: "${ex.bad}"\nGOOD: "${ex.good}"\nREASON: ${ex.reason}`).join("\n\n")}

Evaluate the text for:
- Physical Grounding (0-10): 10 = Zero abstract labels, zero metaphors, zero weather imagery.
- Specificity (0-10): 10 = Every noun has a specific source or modifier from the scene context.
- Rhythm (0-10): 10 = Varied sentence lengths and structures.

SCORING RUBRIC:
- 10: Pure physical action/observation. (e.g. "He opened the metal latch.")
- 5: Mix of physical and abstract. (e.g. "He opened the latch, feeling relieved.")
- 1: Purely abstract or cliche. (e.g. "He felt a weight lift from his shoulders.")

${contextBlock}
${eventsBlock}

${EVENT_SCHEMA_PROMPT}

${intentBlock}

Rules:
- If a sentence uses an abstract emotional label (felt, sad, happy, anxious), the score must be below 5.
- Grounded mechanical or physiological metaphors (e.g. "tasted copper", "diesel animal") are permitted.
- Abstract psychological metaphors (e.g. "weight lift from his shoulders", "darkness in his heart") must be rejected with a low score.
- Similes ("like a...", "as if...") must be strictly rejected if they are not purely physical scale comparisons.
- Restatement must be rejected. If a sentence summarizes or restates the physical action of the previous sentences, fail it with the RESTATEMENT failure type.
- Each instruction must name the exact failing phrase and specify a physical replacement.
- If any intent requirement remains unresolved, mark the relevant checks FAIL.
- If all checks are PASS, minimal_fix must be empty.
- If any check is FAIL, prioritize intent repair over style repair.

Return JSON:
{
  "score": {
    "rhythm": 0-10,
    "specificity": 0-10,
    "physical_grounding": 0-10,
    "overall": 0-10
  },
  "checks": {
    "objective": "PASS" | "FAIL",
    "key_action": "PASS" | "FAIL",
    "expected_outcome": "PASS" | "FAIL"
  },
  "evidence": {
    "objective": [{ "event_id": "E1", "quote": "exact verifiable_span from event" }],
    "key_action": [{ "event_id": "E1", "quote": "exact verifiable_span from event" }],
    "expected_outcome": [{ "event_id": "E1", "quote": "exact verifiable_span from event" }]
  },
  "causal_link": "...",
  "intent_alignment": 0.0,
  "intent_failures": ["..."],
  "confidence": 0.9,
  "minimal_fix": {
    "strategy": "...",
    "instruction": "..."
  },
  "failures": [
    { 
      "type": "GENERIC_LANGUAGE", 
      "reason": "...", 
      "quote": "exact phrase from the text that failed" 
    }
  ],
  "rewrite_directive": "...",
  "rewrite": {
    "instructions": [
      "Targeting 'quote': Replace with specific physical detail."
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
    if (context.reason) throw new Error(context.reason);

    const data = typeof raw === "string" ? robustParseJSON(raw) : raw;
    if (!data || !isRecord(data)) throw new Error("INVALID_SHAPE");
    
    const draftText = typeof context.draft === "string" ? context.draft : "";
    const score = {
      rhythm: clampScore(data?.score?.rhythm),
      specificity: clampScore(data?.score?.specificity),
      physical_grounding: clampScore(data?.score?.physical_grounding),
      overall: clampScore(data?.score?.overall),
    };
    const checks = normalizeIntentChecks(data.checks);
    const evidence = normalizeIntentEvidence(data.evidence);
    let intentFailures = normalizeIntentFailures(data.intent_failures);
    let minimalFix = normalizeMinimalFix(data.minimal_fix, "");

    for (const [key, status] of Object.entries(checks)) {
      if (status === "PASS" && !validateEvidenceSpans(evidence[key], draftText, context.events)) {
        checks[key] = "FAIL";
        intentFailures.push(`${key} marked PASS without valid evidence span`);
      }
    }

    const rawConfidence = data?.confidence;
    const numConfidence = typeof rawConfidence === "number" ? rawConfidence : (rawConfidence === "high" ? 0.9 : 0.5);
    const confidence = numConfidence >= 0.75 ? "high" : "low";

    const mechanicalFailures = mechanicalSweep(draftText);
    const llmFailures = normalizeFailures(data.failures);
    const allFailures = [...mechanicalFailures, ...llmFailures];

    let intentVerdict = Object.values(checks).every(v => v === "PASS") ? INTENT_VERDICTS.PASS : INTENT_VERDICTS.FAIL;
    let finalScore = score.overall;
    
    // Mechanical Penalty: Hard ceiling if absolute bans are violated.
    if (mechanicalFailures.length > 0) {
      finalScore = Math.min(finalScore, 4); 
    }

    const verdict = (intentVerdict === INTENT_VERDICTS.PASS && finalScore >= 8 && mechanicalFailures.length === 0) 
      ? CRITIC_VERDICTS.APPROVE 
      : CRITIC_VERDICTS.REWRITE;

    return {
      verdict,
      score: { ...score, overall: finalScore },
      checks,
      evidence,
      confidence,
      intent_verdict: intentVerdict,
      intent_alignment: intentVerdict === INTENT_VERDICTS.PASS ? 1.0 : 0.0,
      phase_scores: {
        logic: intentVerdict === INTENT_VERDICTS.PASS ? 10 : 0,
        style: finalScore
      },
      intent_failures: intentFailures,
      minimal_fix: minimalFix,
      failures: allFailures,
      rewrite_directive: data.rewrite_directive || (mechanicalFailures.length > 0 ? "Fix mechanical violations" : "Improve prose"),
      rewrite: { 
        instructions: [
          ...mechanicalFailures.map(f => `Fix ${f.type}: Remove '${f.quote}' and show the physical interaction.`),
          ...(data.rewrite?.instructions || [])
        ]
      },
      meta: buildMeta({ 
        valid: true, 
        raw: context.raw, 
        parsed: data
      }),
    };
  } catch (err) {
    console.error("CRITIC_PARSE_FAILURE:", err.message);
    return {
      ...DEFAULT_CRITIC_RESULT,
      meta: buildMeta({ valid: false, reason: "PARSE_ERROR", detail: err.message }),
    };
  }
}

export async function callCritic({
  text,
  keys,
  debug = false,
  llmCaller = callOpenAI,
  sceneContext = null,
  sceneIntent = null,
  events = [],
} = {}) {
  if (!keys?.openai) throw new Error("CRITIC_FAILURE: Missing OpenAI API key.");

  const prompt = buildCriticPrompt(text ?? "", sceneContext, sceneIntent, events);
  const response = await llmCaller(keys.openai, prompt);

  if (!response?.ok) {
    return normalizeCriticOutput(null, { reason: "LLM_CALL_FAILED" });
  }

  return normalizeCriticOutput(response.content, { 
    raw: response.content, 
    draft: text, 
    events
  });
}

export async function callIntentValidator({
  text,
  sceneIntent,
  keys,
  debug = false,
  llmCaller = callOpenAI,
  events = [],
} = {}) {
  if (!keys?.openai) throw new Error("INTENT_FAILURE: Missing OpenAI API key.");
  if (!sceneIntent) throw new Error("INTENT_FAILURE: Missing scene intent contract.");

  const contract = await parseIntentContract(sceneIntent, keys);
  let bestResult = { result: "FAIL", reason: "No matching pattern" };
  if (contract) {
    bestResult = validateIntentChain(contract, events);
  }

  const styleResult = analyzeProseStyle(text);

  const prompt = buildIntentPrompt(text ?? "", sceneIntent, events, contract);
  const response = await llmCaller(keys.openai, prompt);

  const ctx = {
    raw: response?.content,
    draft: text,
    events,
    deterministicResult: bestResult,
    styleResult
  };

  if (!response?.ok) {
    return normalizeIntentOutput(null, { ...ctx, reason: "LLM_CALL_FAILED" });
  }

  return normalizeIntentOutput(response.content, ctx);
}

export { clampScore, normalizeFailures };
