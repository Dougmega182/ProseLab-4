/**
 * Rewrite Mode Orchestrator
 * Manages targeted rewrites and quick spark rewrites under strict execution contracts.
 */

import { generateRewrite } from "../../engine/rewrite.js";
import { runChallengerGate } from "../../engine/challengerGate.js";
import { callOpenAI } from "../llm.js";
import { PERSONAS } from "../../engine/editorial.js";

/**
 * Runs a targeted rewrite and returns a strict Execution Contract.
 * 
 * @param {object} params Orchestration parameters
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
  const warnings = [];
  onStage("editorial-rewrite");

  try {
    const activeScene = scenes.find((s) => String(s.id) === String(selectedSceneId));
    const sceneIntent = activeScene
      ? {
          objective: activeScene.output,
          success_state: activeScene.output,
          failure_state: `Failed to fulfill: ${activeScene.output}`,
          irreversible_change: activeScene.causality,
          story_delta: activeScene.stakes,
        }
      : null;

    let allFeedback = [];
    Object.keys(modeFeedback).forEach((mode) => {
      Object.entries(modeFeedback[mode] || {}).forEach(([pKey, feedback]) => {
        const feedbackText = typeof feedback === "string" ? feedback : feedback?.rawFeedback || feedback?.summary || "";
        if (feedbackText.trim()) {
          allFeedback.push(`[${PERSONAS[pKey]?.name || pKey}]: ${feedbackText}`);
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

    const res = await generateRewrite({
      original: text,
      instructions: allFeedback,
      sceneIntent,
      mode: "intent-repair",
      llmCaller: callOpenAI,
      key: openaiKey,
    });

    if (res.ok && res.text) {
      let challengerResult = null;
      if (geminiKey && sceneIntent) {
        onStage("gemini-challenger");
        try {
          const challenger = await runChallengerGate({
            prose: res.text,
            sceneIntent,
            geminiKey,
            onStage,
          });
          challengerResult = challenger.challenger;
        } catch (e) {
          warnings.push(`Challenger gate failed: ${e.message}`);
        }
      }

      onStage("saving-draft");
      let targetChapterId = draftTree?.find((c) => c.title === "Editorial Drafts")?.id;
      if (!targetChapterId) {
        const newChap = await createChapter({ title: "Editorial Drafts", isDraft: true });
        targetChapterId = newChap.id;
      }
      await createScene({
        chapterId: targetChapterId,
        title: `Draft: ${activeScene?.title || "Rewrite"}`,
        text: res.text,
        isDraft: true,
      });

      const verdict = challengerResult?.verdict === "VETO" ? "REWRITE" : "APPROVE";
      const durationMs = Date.now() - startTime;
      const wordCount = res.text.split(/\s+/).filter(Boolean).length;

      return {
        success: verdict === "APPROVE",
        output: res.text,
        diagnostics: {
          stage: "complete",
          verdict,
          failures: challengerResult?.verdict === "VETO"
            ? challengerResult.fatal_flaws.map((f) => ({ type: "GEMINI_VETO", reason: f }))
            : [],
          attempts: 1,
          traces: [],
          intent: null,
          challenger: challengerResult,
        },
        warnings,
        metrics: {
          wordCount,
          durationMs
        }
      };
    } else {
      const errorDetail = res.error || "Rewrite failed to produce content.";
      throw new Error(errorDetail);
    }
  } catch (e) {
    return {
      success: false,
      output: text,
      diagnostics: { stage: "failed", verdict: "ERROR" },
      warnings: [`Rewrite exception: ${e.message}`],
      metrics: {
        wordCount: text.split(/\s+/).filter(Boolean).length,
        durationMs: Date.now() - startTime
      }
    };
  }
}

/**
 * Runs a quick Spark rewrite and returns a strict Execution Contract.
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
    const activeScene = scenes.find((s) => String(s.id) === String(selectedSceneId));
    const sceneIntent = activeScene
      ? {
          objective: activeScene.output,
          success_state: activeScene.output,
          failure_state: `Failed to fulfill: ${activeScene.output}`,
          irreversible_change: activeScene.causality,
          story_delta: activeScene.stakes,
        }
      : null;

    const res = await generateRewrite({
      original: text,
      instructions: [spark.prompt],
      sceneIntent,
      mode: "intent-repair",
      llmCaller: callOpenAI,
      key: openaiKey,
    });

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
    return {
      success: false,
      output: text,
      diagnostics: { stage: "failed", verdict: "ERROR" },
      warnings: [`Spark exception: ${e.message}`],
      metrics: {
        wordCount: text.split(/\s+/).filter(Boolean).length,
        durationMs: Date.now() - startTime
      }
    };
  }
}
