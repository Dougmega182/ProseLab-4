// @ts-check
/**
 * Create Mode Orchestrator
 * Controls the bounded generate -> critique -> retry narrative state machine.
 * Enforces standard execution contract responses, prompt budgeting, and output verification.
 */

import { runPipeline } from "../../engine/pipeline.js";
import { mapVoiceToPromptSpec } from "../../engine/rewrite.js";
import { ShadowManager } from "../../engine/shadowLayer.js";
import { runChallengerGate } from "../../engine/challengerGate.js";
import { validateRewriteOutput } from "../../engine/outputValidator.js";
import { buildPromptBudget, truncateText } from "../../engine/promptBudget.js";
import { runWithRetry } from "./orchestrationRunner.js";

/**
 * Validates the scene intent structure for necessary beating coverage.
 * 
 * @param {any} scene - Scene preproduction configuration
 * @returns {boolean} Whether valid
 */
export function validateSceneIntent(scene) {
  if (!scene) {
    throw new Error("Scene is undefined or null.");
  }

  const beats = {
    goal: String(scene.goal || "").trim(),
    conflict: String(scene.conflict || "").trim(),
    change: String(scene.change || scene.output || "").trim(),
    stakes: String(scene.stakes || "").trim(),
    reveal: String(scene.reveal || "").trim(),
    causality: String(scene.causality || "").trim(),
  };

  const minLength = 10;
  const placeholders = [
    "placeholder", "tbd", "to be decided", "none", "n/a", "not set", "todo", "todo:",
    "insert here", "draft", "lorem ipsum", "empty", "null", "undefined", "tbc"
  ];

  const missingBeats = [];
  const placeholderBeats = [];

  for (const [key, value] of Object.entries(beats)) {
    if (!value) {
      missingBeats.push(key);
      continue;
    }

    if (value.length < minLength) {
      missingBeats.push(`${key} (too short, min ${minLength} chars)`);
      continue;
    }

    const valueLower = value.toLowerCase();
    if (placeholders.some(p => valueLower === p || valueLower.startsWith(p + " ") || valueLower.includes("lorem ipsum"))) {
      placeholderBeats.push(key);
    }
  }

  if (missingBeats.length > 0) {
    throw new Error(
      `CREATE blocked: Scene is missing or has insufficient description for critical structural beats: ${missingBeats.join(", ")}. Minimum length is ${minLength} characters.`
    );
  }

  if (placeholderBeats.length > 0) {
    throw new Error(
      `CREATE blocked: Placeholder detected in critical structural beats: ${placeholderBeats.join(", ")}. Please enter real narrative details.`
    );
  }

  // Set-based Duplication checks (resilient to empty fields)
  const validBeats = Object.values(beats).filter(Boolean).map(v => v.toLowerCase());
  const uniqueBeats = new Set(validBeats);
  if (uniqueBeats.size !== validBeats.length) {
    throw new Error(
      "CREATE blocked: Critical structural beats contain duplicate or near-identical text. Each beat must represent unique narrative intent."
    );
  }

  return true;
}

/**
 * Builds the structured scene intent parameters.
 * 
 * @param {any} scene - Scene configuration
 * @returns {any} Scene intent
 */
export function buildSceneIntent(scene) {
  validateSceneIntent(scene);

  const goal = String(scene.goal || "").trim();
  const conflict = String(scene.conflict || "").trim();
  const change = String(scene.change || scene.output || "").trim();
  const stakes = String(scene.stakes || "").trim();
  const reveal = String(scene.reveal || "").trim();
  const causality = String(scene.causality || "").trim();

  return {
    objective: goal,
    success_state: `Protagonist achieves physical objective: ${goal}`,
    failure_state: `Protagonist fails objective (${goal}) due to conflict: ${conflict}`,
    irreversible_change: change,
    story_delta: stakes,
    conflict,
    reveal,
    causality,
  };
}

/**
 * Builds scene context briefing safely budgeted via line truncation.
 * 
 * @param {any} scene - Active scene configurations
 * @returns {string} Safe Brief
 */
export function buildSceneContext(scene) {
  return `
CHAPTER BRIEF:
Title: ${scene.title}
Chapter: ${scene.chapter}
Location: ${scene.location}
Time: ${scene.time}
Scene Goal: ${truncateText(scene.goal || "", 15)}
Scene Conflict: ${truncateText(scene.conflict || "", 15)}
Irreversible Change: ${truncateText(scene.change || scene.output || "", 15)}
Scene Stakes: ${truncateText(scene.stakes || "", 15)}
Discovery/Reveal: ${truncateText(scene.reveal || "", 15)}
Causality: ${truncateText(scene.causality || "", 15)}
Characters Present: ${truncateText(scene.chars || "", 10)}
Props Planted: ${truncateText(scene.objects || "", 10)}
`;
}

/**
 * Executes the narrative creation pipeline under a strict execution contract.
 * 
 * @param {object} params Orchestration params
 * @param {string} params.text - Baseline prose input
 * @param {any} params.preproduction - Preproduction context
 * @param {string | number} params.preflightId - ID of active scene context
 * @param {string[]} [params.delta] - Static user instruction deltas
 * @param {object} [params.keys] - API authorization keys
 * @param {string} [params.keys.openai] - OpenAI Key
 * @param {string} [params.keys.gemini] - Gemini Key
 * @param {string} [params.cacheVersion] - Optional version tag
 * @param {function} [params.logTokenUsage]
 * @param {function} [params.estimateTokens]
 * @param {function} [params.onStage]
 * @param {function} [params.onIntent]
 * @param {function} [params.onAnalysis]
 * @param {function} [params.onDelta]
 * @returns {Promise<{
 *   success: boolean,
 *   output: string,
 *   diagnostics: object,
 *   warnings: string[],
 *   metrics: { wordCount: number, durationMs: number }
 * }>} Standard Execution Contract
 */
export async function runCreateOrchestration({
  text,
  preproduction,
  preflightId,
  delta = [],
  keys = {},
  cacheVersion,
  logTokenUsage = () => {},
  estimateTokens = () => 0,
  onStage = () => {},
  onIntent = () => {},
  onAnalysis = () => {},
  onDelta = () => {},
}) {
  const startTime = Date.now();
  const warnings = /** @type {string[]} */ ([]);

  const activeScene = /** @type {any} */ (preproduction.scenes?.find(
    (/** @type {any} */ s) => String(s.id) === String(preflightId)
  ));

  if (!activeScene) {
    return {
      success: false,
      output: text,
      diagnostics: { stage: "failed", attempts: 0, verdict: "BLOCKED" },
      warnings: ["No active scene selected."],
      metrics: { wordCount: text.split(/\s+/).filter(Boolean).length, durationMs: Date.now() - startTime }
    };
  }

  let sceneIntent;
  try {
    sceneIntent = buildSceneIntent(activeScene);
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    return {
      success: false,
      output: text,
      diagnostics: { stage: "failed", attempts: 0, verdict: "BLOCKED" },
      warnings: [err.message],
      metrics: { wordCount: text.split(/\s+/).filter(Boolean).length, durationMs: Date.now() - startTime }
    };
  }

  const rawSceneContext = buildSceneContext(activeScene);

  /**
   * Encapsulates the modular generation step for runWithRetry.
   * @param {string[]} repairDirectives - Dynamic repairs
   */
  const generateFn = async (repairDirectives) => {
    let voiceDirectives = preproduction.voice?.compressedDirectives;
    if (!Array.isArray(voiceDirectives) || voiceDirectives.length === 0) {
      voiceDirectives = [
        `Length constraint: ${preproduction.voice?.length || "Medium"}`,
        `Sentence fragments usage: ${preproduction.voice?.fragments || "Occasional"}`,
        `Metaphor density: ${preproduction.voice?.metaphor || "Moderate"}`,
        `Dialogue delivery style: ${preproduction.voice?.dialogue || "Direct"}`
      ];
      if (preproduction.voice?.profile || preproduction.voice?.profileMarkdown) {
        voiceDirectives.push(`Voice profile cues: ${preproduction.voice.profile || preproduction.voice.profileMarkdown}`);
      }
    }

    const budgeted = buildPromptBudget({
      voice: voiceDirectives,
      scene: rawSceneContext,
      rewrite: delta,
      repair: repairDirectives
    });

    const budgetedVoice = {
      ...preproduction.voice,
      compressedDirectives: budgeted.voice
    };

    const sceneContext = budgeted.scene;
    const voiceSpec = mapVoiceToPromptSpec(budgetedVoice, [
      ...budgeted.rewrite,
      ...budgeted.repair
    ]);

    const res = /** @type {any} */ (await runPipeline({
      text: text,
      sceneIntent,
      keys,
      model: preproduction.settings?.ollamaModel,
      onStage,
      onUpdate: (/** @type {any} */ data) => {
        const d = /** @type {any} */ (data);
        if (d.intent) onIntent(d.intent);
        if (d.analysis) onAnalysis(d.analysis);
        if (d.delta) onDelta(d.delta);
      },
      sceneContext,
      voiceSpec,
      logTokenUsage,
      estimateTokens,
      cacheVersion,
    }));

    if (res.blocked) {
      throw new Error("CREATE blocked: Narrative intent gate blocked completion.");
    }

    const generatedProse = res.final || res.prose || text;
    
    // Check if pipeline critic vetoed the quality
    if (res.critique && res.critique.verdict === "REWRITE") {
      const critiqueInstructions = res.critique.rewrite?.instructions || 
                                   res.critique.failures?.map((/** @type {any} */ f) => f.reason || f.description || f) || [];
      throw new Error(`CRITIQUE_REJECTION: ${critiqueInstructions.join(" | ")}`);
    }

    return { output: generatedProse };
  };

  /**
   * Encapsulates the semantic critique and validation steps for runWithRetry.
   * @param {string} generatedProse - output draft
   */
  const validateFn = async (generatedProse) => {
    // 1. Core Output Verification (Narrative Compiler Gate)
    onStage("output-verification");
    const valResult = await validateRewriteOutput(
      generatedProse,
      text,
      sceneIntent,
      { similarityThreshold: 0.85 },
      { openai: keys.openai }
    );

    if (!valResult.passed) {
      return valResult;
    }

    // 2. Adversarial Challenger Gate (Gemini Adjudication)
    if (keys.gemini) {
      onStage("challenger-gate");
      const challengerResult = /** @type {any} */ (await runChallengerGate({
        prose: generatedProse,
        sceneIntent,
        geminiKey: keys.gemini,
        onStage,
      }));

      if (!challengerResult.confirmed) {
        return {
          passed: false,
          score: 0.5,
          violations: challengerResult.challenger.fatal_flaws.map((/** @type {any} */ f) => `Resolve Challenger Flaw: ${f}`),
          repairStrategy: "intent_repair"
        };
      }
    }

    return {
      passed: true,
      score: valResult.score,
      violations: [],
      repairStrategy: "none"
    };
  };

  // Run the orchestration retry loop natively and robustly!
  const runnerResult = await runWithRetry({
    originalText: text,
    generateFn,
    validateFn,
    maxRetries: 3,
    initialDelayMs: 1000
  });

  // Shadow Recording
  try {
    ShadowManager.record({
      input: text,
      output: runnerResult.output,
      legacyResult: {
        verdict: runnerResult.approved ? "APPROVE" : "REWRITE",
        intent_verdict: runnerResult.approved ? "PASS" : "FAIL",
        attempts: runnerResult.passes
      },
      sceneIntent,
      keys
    });
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    warnings.push(`Shadow recording failed: ${err.message}`);
  }

  const durationMs = Date.now() - startTime;
  const wordCount = runnerResult.output.split(/\s+/).filter(Boolean).length;

  return {
    success: runnerResult.approved,
    output: runnerResult.output,
    diagnostics: {
      stage: "complete",
      attempts: runnerResult.passes,
      verdict: runnerResult.approved ? "APPROVE" : "REWRITE",
      failures: runnerResult.diagnostics?.violations.map(v => ({ type: "VALIDATION_VIOLATION", reason: v })) || [],
      traces: [],
      validation: runnerResult.diagnostics || null,
      warnings: runnerResult.warnings
    },
    warnings: [...warnings, ...runnerResult.warnings],
    metrics: {
      wordCount,
      durationMs
    }
  };
}

