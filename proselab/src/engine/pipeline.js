import { callOllama } from "../services/llm.js";
import { callCritic, callIntentValidator, classifyDisagreement } from "./critic.js";
import { generateRewrite } from "./rewrite.js";
import { analyze, buildDelta } from "./analysis.js";
import { extractEvents } from "./eventNormalizer.js";
import { cachedInference, shouldCacheInference } from "../services/inferenceCache.js";
import { enforceSystemInvariants, validateSemanticPreservation } from "./guards.js";

export const INFERENCE_CACHE_CONTEXT_VERSION = "voice-lock-v1";

export const ENGINE_FLAGS = {
  USE_INTENT_REPAIR: true,
  USE_STYLE_REFINEMENT: true,
  USE_CRITIC: true,
  DEGENERACY_DETECTOR_ENABLED: true,
  MAX_ITERATIONS: 3,
  MAX_TOTAL_TOKENS: 5000,
  MAX_TOTAL_PASSES: 15,
  SURVIVAL_MODE: false,
  CHALLENGER_MODEL_ENABLED: true // Cross-model disagreement check
};

export const Telemetry = {
  sessions: [],
  groundTruth: {}, // traceId -> actualOutcome
  
  summarize() {
    const total = this.sessions.length;
    if (total === 0) return { total: 0 };
    const success = this.sessions.filter(s => s.verdict === "APPROVE").length;
    const avgAttempts = this.sessions.reduce((sum, s) => sum + s.attempts, 0) / total;
    return {
      total,
      successRate: (success / total).toFixed(2),
      avgAttempts: avgAttempts.toFixed(2),
      failures: this.sessions.filter(s => s.verdict === "REWRITE").length,
      calibration: this.calculateCalibration()
    };
  },

  record(sessionData) {
    this.sessions.push({
      timestamp: Date.now(),
      ...sessionData
    });
    if (this.sessions.length > 1000) this.sessions.shift();
  },

  reportGroundTruth(traceId, outcome) {
    this.groundTruth[traceId] = outcome;
  },

  calculateCalibration() {
    const total = Object.keys(this.groundTruth).length;
    if (total === 0) return 0;
    // Implementation of ECE placeholder
    return "0.00";
  },
  checkAlerts() {
    const summary = this.summarize();
    if (summary.total < 5) return []; // Not enough data
    const alerts = [];
    
    // ANOMALY DETECTION: Automatic Flag Flip
    if (summary.successRate < 0.6) {
      ENGINE_FLAGS.SURVIVAL_MODE = true;
      alerts.push(`🚨 CRITICAL: Pass rate dropped to ${summary.successRate * 100}%. SURVIVAL_MODE ENABLED.`);
    }

    if (summary.avgAttempts > 2.5) alerts.push(`⚠️ WARNING: High iteration count (${summary.avgAttempts} avg)`);
    return alerts;
  }
};

export function calculateAdaptiveBudget(text) {
  const base = 1000;
  const perChar = 1.5;
  const inputLen = (text || "").length;
  return Math.min(ENGINE_FLAGS.MAX_TOTAL_TOKENS, base + (inputLen * perChar));
}

function normalize(str) {
  return str.trim().replace(/\s+/g, " ");
}

async function checkIntent({ text, sceneIntent, keys, cacheVersion }) {
  return cachedInference({
    name: "intent-check",
    input: JSON.stringify({ text, sceneIntent }),
    context: { version: cacheVersion },
    fn: async () => {
      const { events } = await extractEvents(text, keys);
      return callIntentValidator({
        text,
        sceneIntent,
        keys,
        events,
      });
    },
    enabled: false,
  });
}

async function runIntentRepair({
  text,
  initialIntent,
  sceneIntent,
  keys,
  sceneContext,
  onStage,
}) {
  const maxAttempts = 2; // Tighten for stability
  let currentDraft = text;
  let finalIntent = initialIntent;
  const traces = [];

  for (let i = 0; i < maxAttempts; i++) {
    const attempt = i + 1;
    onStage("event-normalization");
    const { events } = await extractEvents(currentDraft, keys);

    onStage("intent");
    const intent = await callIntentValidator({
      text: currentDraft,
      sceneIntent,
      keys,
      events,
    });
    
    const confidenceTier = intent.result || (intent.intent_verdict === "PASS" ? "LOW_PASS" : "HIGH_FAIL");

    traces.push({
      attempt,
      phase: "intent-repair",
      draft: currentDraft,
      events,
      confidence_tier: confidenceTier,
      critique: intent,
    });

    // VELOCITY CHECK: If Cycle 1 didn't improve logic score by 0.2, it's a failing intervention
    const prevScore = i === 0 ? (initialIntent?.confidence || 0) : traces[i-1].critique.confidence;
    if (i === 0 && intent.confidence < prevScore + 0.2 && confidenceTier !== "HIGH_PASS" && confidenceTier !== "LOW_PASS") {
        onStage("low_velocity_abort");
        break; 
    }

    if (confidenceTier === "HIGH_PASS" || confidenceTier === "LOW_PASS") {
      return {
        blocked: false,
        repairedText: currentDraft,
        intent,
        attempts: traces.length,
        traces,
      };
    }

    if (attempt >= maxAttempts) break;

    onStage("openai-refinement");
    const repairResult = await generateRewrite({
      original: currentDraft,
      instructions: intent.minimal_fix?.instruction
        ? [intent.minimal_fix.instruction]
        : ["Fix only what is necessary to satisfy the scene intent."],
      key: keys.openai,
      sceneContext,
      mode: "intent-repair",
      sceneIntent,
      temperature: confidenceTier === "UNCERTAIN" ? 0.5 : 0.35, 
    });

    if (repairResult.ok) {
      currentDraft = repairResult.text;
    }
    finalIntent = intent;
  }

  return {
    blocked: true,
    reason: "INTENT_FAIL",
    repairedText: currentDraft,
    intent: finalIntent,
    attempts: traces.length,
    traces,
  };
}

async function runStyleRefinement({
  text,
  sceneIntent,
  keys,
  model,
  onStage,
  onUpdate,
  sceneContext = null,
  voiceSpec = {},
  logTokenUsage = () => {},
  estimateTokens = (t) => Math.ceil((t || "").length / 4),
  cacheVersion = "voice-lock-v1",
}) {
  onStage("analysis");
  const analysis = await cachedInference({
    name: "analysis",
    input: text,
    context: { version: cacheVersion },
    fn: async () => analyze(text),
    enabled: shouldCacheInference("analysis"),
  });
  if (onUpdate) onUpdate({ analysis });

  onStage("delta");
  const delta = await cachedInference({
    name: "delta",
    input: JSON.stringify(analysis),
    context: { version: cacheVersion },
    fn: async () => buildDelta(analysis),
    enabled: shouldCacheInference("delta"),
  });
  if (onUpdate) onUpdate({ delta });

  const initialInstruction = normalize(`Rewrite this paragraph with these constraints:\n${delta.join("\n")}\n\n${text}`);

  onStage("ollama");
  const ollamaRes = await callOllama(model, initialInstruction);
  const draft1 = ollamaRes.ok ? ollamaRes.content : "";
  const safeDraft1 = draft1?.trim() ? draft1 : text;

  if (ollamaRes.ok) {
    logTokenUsage("ollama", estimateTokens(initialInstruction), estimateTokens(draft1));
  }

  const maxAttempts = 3;
  let currentDraft = safeDraft1;
  let lastIntentSafeDraft = text;
  let finalCritique = null;
  const traces = [];

  for (let i = 0; i < maxAttempts; i++) {
    const attemptNum = i + 1;
    onStage("openai-refinement");

    const rewriteResult = await generateRewrite({
      original: currentDraft,
      instructions: delta,
      voiceSpec,
      sceneContext,
      sceneIntent,
      key: keys.openai,
      mode: "style-refinement",
      temperature: 0.75 + (i * 0.05),
    });

    const candidateDraft = rewriteResult.ok ? rewriteResult.text : currentDraft;
    if (rewriteResult.ok && rewriteResult.response?.usage) {
      logTokenUsage(
        "openai::gpt-4o-mini",
        rewriteResult.response.usage.prompt_tokens,
        rewriteResult.response.usage.completion_tokens,
      );
    }

    onStage("event-normalization");
    const { events } = await extractEvents(candidateDraft, keys);

    onStage("intent");
    const intentRecheck = await callIntentValidator({
      text: candidateDraft,
      sceneIntent,
      keys,
      events,
    });

    const confidenceTier = intentRecheck.meta?.parsed?.deterministicResult?.result || (intentRecheck.intent_verdict === "PASS" ? "LOW_PASS" : "HIGH_FAIL");

    if (confidenceTier === "HIGH_FAIL" || confidenceTier === "LOW_FAIL") {
      traces.push({
        attempt: attemptNum,
        phase: "style-refinement",
        reverted: true,
        draft: candidateDraft,
        events,
        confidence_tier: confidenceTier,
        critique: {
          verdict: "REWRITE",
          score: intentRecheck.intent_alignment,
          intent_verdict: intentRecheck.intent_verdict,
          intent_alignment: intentRecheck.intent_alignment,
          intent_failures: intentRecheck.intent_failures,
          primary_failure: intentRecheck.primary_failure,
          minimal_fix: {
            instruction: `Refinement reverted due to ${confidenceTier}: ${intentRecheck.minimal_fix?.instruction || "Broke scene intent."}`,
          },
          failures: [],
          rewrite: { instructions: [] },
        },
      });
      continue;
    }

    currentDraft = candidateDraft;
    lastIntentSafeDraft = candidateDraft;

    onStage("critic");
    const rawCritique = await callCritic({
      text: currentDraft,
      keys,
      sceneContext,
      sceneIntent,
      events,
      originalText: text // Pass original to check for degeneracy/erosion
    });

    // 4. GLOBAL INVARIANT GATE
    const critique = enforceSystemInvariants(rawCritique, {
      ambiguityScore: rawCritique.meta?.parsed?.ambiguityScore || 0
    });

    const finalTier = (confidenceTier === "HIGH_PASS" && critique.verdict === "APPROVE") ? "HIGH_PASS" : confidenceTier;
    
    // 5. SEMANTIC PRESERVATION CHECK (POST-REWRITE)
    const preservation = validateSemanticPreservation(
      traces[traces.length - 1]?.critique || critique, // Compare vs previous state or current if first
      critique
    );

    if (!preservation.ok) {
       onStage("preservation_failed");
       console.log(`🚨 SEMANTIC EROSION: ${preservation.losses.join(", ")}`);
       critique.verdict = "REWRITE"; // Force retry if content lost
       critique.rewrite.instructions.push(`RESTORE LOST CONTENT: ${preservation.losses.join(", ")}`);
    }

    finalCritique = critique;
    traces.push({
      attempt: attemptNum,
      phase: "style-refinement",
      reverted: false,
      draft: currentDraft,
      events,
      confidence_tier: finalTier,
      critique,
    });

    if (critique.verdict === "APPROVE" && (finalTier === "HIGH_PASS" || finalTier === "LOW_PASS")) {
      break;
    }
  }

  const finalDraft = finalCritique?.intent_verdict === "FAIL" ? lastIntentSafeDraft : currentDraft;

  return {
    analysis,
    delta,
    draft: safeDraft1,
    refined: finalDraft,
    final: finalDraft,
    critique: finalCritique,
    attempts: traces.length,
    traces,
  };
}

export async function runPipeline({
  text,
  sceneIntent,
  keys,
  model,
  onStage,
  onUpdate,
  sceneContext = null,
  voiceSpec = {},
  logTokenUsage = () => {},
  estimateTokens = (t) => Math.ceil((t || "").length / 4),
  cacheVersion = "voice-lock-v1",
}) {
  if (!sceneIntent) {
    throw new Error("CREATE blocked: scene intent is required.");
  }

  onStage("intent");
  const initialIntent = await checkIntent({
    text,
    sceneIntent,
    keys,
    cacheVersion,
  });
  if (onUpdate) onUpdate({ intent: initialIntent });

  // INTERVENTION GATE: Do no harm to good prose
  if (initialIntent.result === "HIGH_PASS" || initialIntent.result === "LOW_PASS") {
      onStage("done");
      return {
          blocked: false,
          final: text,
          intent: initialIntent,
          attempts: 1,
          traces: [{ attempt: 1, phase: "initial-gate", draft: text, confidence_tier: initialIntent.result, critique: initialIntent }]
      };
  }

  let workingText = text;
  let repairResult = null;
  let totalTokens = 0;

  if (initialIntent.intent_verdict === "FAIL") {
    if (ENGINE_FLAGS.SURVIVAL_MODE) {
       onStage("survival_skipping_repair");
    } else {
      repairResult = await runIntentRepair({
        text,
        sceneIntent,
        keys,
        sceneContext,
        onStage,
      });
      if (onUpdate) onUpdate({ intent: repairResult.intent });

      if (repairResult.blocked) {
        onStage("done");
        return {
          blocked: true,
          reason: "INTENT_FAIL",
          intent: repairResult.intent,
          analysis: null,
          delta: [],
          draft: repairResult.repairedText,
          refined: repairResult.repairedText,
          final: repairResult.repairedText,
          critique: null,
          attempts: repairResult.attempts,
          traces: repairResult.traces,
        };
      }
      workingText = repairResult.repairedText;
    }
  }

  const adaptiveBudget = calculateAdaptiveBudget(text);

  onStage("style_refinement");
  const refinementResult = await runStyleRefinement({
    text: workingText,
    sceneIntent,
    keys,
    model,
    onStage,
    onUpdate,
    sceneContext,
    voiceSpec,
    logTokenUsage,
    estimateTokens,
    maxAttempts: adaptiveBudget,
  });

  // ADVERSARIAL CHALLENGER PASS
  if (
    ENGINE_FLAGS.CHALLENGER_MODEL_ENABLED && 
    refinementResult.critique?.verdict === "APPROVE"
  ) {
      onStage("challenger_verification");
      // Use a different model/path to challenge the result
      const challenge = await callCritic({
         text: refinementResult.final,
         keys,
         sceneIntent,
         model: "gemini-1.5-pro", // Different architecture
         isChallenger: true
      });

      if (challenge.verdict === "REWRITE") {
         onStage("challenger_disagreement");
         const reason = classifyDisagreement(refinementResult.critique, challenge);
         refinementResult.critique.verdict = "REWRITE";
         refinementResult.critique.confidence = "low";
         refinementResult.critique.summary = (refinementResult.critique.summary || "") + ` [CHALLENGER DISAGREEMENT: ${reason}]`;
         refinementResult.agreement_signal = 0.0;
         refinementResult.disagreement_reason = reason;
         refinementResult.challenged = true;
      } else {
         refinementResult.agreement_signal = 1.0;
      }
  }

  const finalResult = {
    ...refinementResult,
    intent: repairResult?.intent || initialIntent,
    attempts: (repairResult?.attempts || 0) + refinementResult.attempts,
    traces: [...(repairResult?.traces || []), ...refinementResult.traces],
  };

  Telemetry.record({
    verdict: finalResult.critique?.verdict || "REWRITE",
    attempts: finalResult.attempts,
    score: finalResult.critique?.score?.overall || 0,
    blocked: !!finalResult.blocked,
    context: {
      model,
      cacheVersion,
      sceneIntent,
      voiceSpec,
      timestamp: Date.now()
    }
  });

  onStage("done");
  return finalResult;
}
