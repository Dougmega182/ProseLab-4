// @ts-check
/**
 * Rewrite Mode Orchestrator
 * Manages targeted rewrites and quick spark rewrites under strict execution contracts.
 */

import { generateRewrite } from "../../engine/rewrite.js";
import { runChallengerGate } from "../../engine/challengerGate.js";
import { callOpenAI } from "../llm.js";
import { PERSONAS } from "../../engine/editorial.js";
import { buildPromptBudget } from "../../engine/promptBudget.js";
import { runWithRetry } from "./orchestrationRunner.js";

/**
 * Runs a targeted rewrite and returns a strict Execution Contract.
 * 
 * @param {object} params Orchestration parameters
 * @param {string} params.text - Original text to rewrite
 * @param {any[]} params.scenes - Scene preproduction list
 * @param {string | number} params.selectedSceneId - Selected scene context
 * @param {object} params.modeFeedback - Editorial feedback mapping
 * @param {string} params.openaiKey - OpenAI Key
 * @param {string | null} [params.geminiKey] - optional Gemini Key
 * @param {any[]} [params.draftTree] - Draft tree hierarchy
 * @param {function} params.createChapter
 * @param {function} params.createScene
 * @param {function} [params.onStage]
 * @returns {Promise<{
 *   success: boolean,
 *   output: string,
 *   diagnostics: object,
 *   warnings: string[],
 *   metrics: { wordCount: number, durationMs: number }
 * }>} Standard Execution Contract
 */
export async function runTargetedRewriteOrchestration({
  text,
  scenes,
  selectedSceneId,
  modeFeedback,
  openaiKey,
  geminiKey = null,
  draftTree = [],
  createChapter,
  createScene,
  onStage = () => {},
}) {
  const startTime = Date.now();
  const warnings = /** @type {string[]} */ ([]);
  onStage("editorial-rewrite");

  try {
    const activeScene = /** @type {any} */ (scenes.find((s) => String(s.id) === String(selectedSceneId)));
    const sceneIntent = /** @type {any} */ (activeScene
      ? {
          objective: activeScene.output,
          success_state: activeScene.output,
          failure_state: `Failed to fulfill: ${activeScene.output}`,
          irreversible_change: activeScene.causality,
          story_delta: activeScene.stakes,
        }
      : null);

    /** @type {string[]} */
    let allFeedback = [];
    Object.keys(modeFeedback).forEach((mode) => {
      Object.entries(/** @type {any} */ (modeFeedback)[mode] || {}).forEach(([pKey, feedback]) => {
        const feedbackText = typeof feedback === "string" ? feedback : feedback?.rawFeedback || feedback?.summary || "";
        if (feedbackText.trim()) {
          allFeedback.push(`[${/** @type {any} */ (PERSONAS)[pKey]?.name || pKey}]: ${feedbackText}`);
        }
      });
    });

    if (allFeedback.length === 0) {
      return {
        success: false,
        output: text,
        diagnostics: { stage: "failed", verdict: "ERROR" },
        warnings: ["No editorial feedback available to apply."],
        metrics: {
          wordCount: text.split(/\s+/).filter(Boolean).length,
          durationMs: Date.now() - startTime
        }
      };
    }

    /**
     * Modular generation function for runWithRetry.
     * @param {string[]} repairDirectives - Dynamic repairs
     */
    const generateFn = async (repairDirectives) => {
      const budgeted = buildPromptBudget({
        rewrite: allFeedback,
        repair: repairDirectives
      });

      const combinedInstructions = [
        ...budgeted.rewrite,
        ...budgeted.repair
      ];

      const res = /** @type {any} */ (await generateRewrite(/** @type {any} */ ({
        original: text, // Always rewrite relative to original baseline text
        instructions: combinedInstructions,
        sceneIntent,
        mode: "intent-repair",
        llmCaller: callOpenAI,
        key: openaiKey,
      })));

      if (res.ok && res.text) {
        return { output: res.text };
      } else {
        return { output: "", error: res.error || "Rewrite failed to produce content." };
      }
    };

    /**
     * Critique validation function for runWithRetry.
     * @param {string} generatedProse - generated draft
     */
    const validateFn = async (generatedProse) => {
      let passVerdict = "APPROVE";
      /** @type {string[]} */
      let passViolations = [];

      if (geminiKey && sceneIntent) {
        onStage("gemini-challenger");
        try {
          const challenger = /** @type {any} */ (await runChallengerGate({
            prose: generatedProse,
            sceneIntent,
            geminiKey,
            onStage,
          }));

          const challengerResult = challenger.challenger;
          if (challengerResult?.verdict === "VETO") {
            passVerdict = "REWRITE";
            passViolations = challengerResult.fatal_flaws.map((/** @type {string} */ f) => f);
          }
        } catch (e) {
          const err = e instanceof Error ? e : new Error(String(e));
          warnings.push(`Challenger gate failed: ${err.message}`);
        }
      }

      return {
        passed: passVerdict === "APPROVE",
        score: passVerdict === "APPROVE" ? 1.0 : 0.5,
        violations: passViolations,
        repairStrategy: passVerdict === "APPROVE" ? "none" : "intent_repair"
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

    onStage("saving-draft");
    let targetChapterId = draftTree?.find((c) => c.title === "Editorial Drafts")?.id;
    if (!targetChapterId) {
      const newChap = await createChapter({ title: "Editorial Drafts", isDraft: true });
      targetChapterId = newChap.id;
    }
    await createScene({
      chapterId: targetChapterId,
      title: `Draft: ${activeScene?.title || "Rewrite"}`,
      text: runnerResult.output,
      isDraft: true,
    });

    const durationMs = Date.now() - startTime;
    const wordCount = runnerResult.output.split(/\s+/).filter(Boolean).length;

    return {
      success: runnerResult.approved,
      output: runnerResult.output,
      diagnostics: {
        stage: "complete",
        verdict: runnerResult.approved ? "APPROVE" : "REWRITE",
        failures: runnerResult.diagnostics?.violations.map(v => ({ type: "GEMINI_VETO", reason: v })) || [],
        attempts: runnerResult.passes,
        traces: [],
        intent: null,
        challenger: runnerResult.diagnostics || null,
      },
      warnings: [...warnings, ...runnerResult.warnings],
      metrics: {
        wordCount,
        durationMs
      }
    };
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    return {
      success: false,
      output: text,
      diagnostics: { stage: "failed", verdict: "ERROR" },
      warnings: [`Rewrite exception: ${err.message}`],
      metrics: {
        wordCount: text.split(/\s+/).filter(Boolean).length,
        durationMs: Date.now() - startTime
      }
    };
  }
}

/**
 * Runs a quick Spark rewrite and returns a strict Execution Contract.
 * 
 * @param {object} params Spark orchestration params
 * @param {string} params.text - Original text input
 * @param {any[]} params.scenes - Preproduction scenes
 * @param {string | number} params.selectedSceneId - Selected scene ID
 * @param {any} params.spark - Spark configuration
 * @param {string} params.openaiKey - OpenAI Key
 * @param {function} [params.onStage]
 * @returns {Promise<{
 *   success: boolean,
 *   output: string,
 *   diagnostics: object,
 *   warnings: string[],
 *   metrics: { wordCount: number, durationMs: number }
 * }>} Standard Execution Contract
 */
export async function runSparkOrchestration({
  text,
  scenes,
  selectedSceneId,
  spark,
  openaiKey,
  onStage = () => {},
}) {
  const startTime = Date.now();
  onStage(`spark-${spark.id}`);

  try {
    const activeScene = /** @type {any} */ (scenes.find((s) => String(s.id) === String(selectedSceneId)));
    const sceneIntent = /** @type {any} */ (activeScene
      ? {
          objective: activeScene.output,
          success_state: activeScene.output,
          failure_state: `Failed to fulfill: ${activeScene.output}`,
          irreversible_change: activeScene.causality,
          story_delta: activeScene.stakes,
        }
      : null);

    const res = /** @type {any} */ (await generateRewrite(/** @type {any} */ ({
      original: text,
      instructions: [spark.prompt],
      sceneIntent,
      mode: "intent-repair",
      llmCaller: callOpenAI,
      key: openaiKey,
    })));

    if (res.ok && res.text) {
      const durationMs = Date.now() - startTime;
      const wordCount = res.text.split(/\s+/).filter(Boolean).length;

      return {
        success: true,
        output: res.text,
        diagnostics: { stage: "complete", verdict: "APPROVE" },
        warnings: [],
        metrics: {
          wordCount,
          durationMs
        }
      };
    } else {
      throw new Error(res.error || "Spark rewrite failed.");
    }
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    return {
      success: false,
      output: text,
      diagnostics: { stage: "failed", verdict: "ERROR" },
      warnings: [`Spark exception: ${err.message}`],
      metrics: {
        wordCount: text.split(/\s+/).filter(Boolean).length,
        durationMs: Date.now() - startTime
      }
    };
  }
}

