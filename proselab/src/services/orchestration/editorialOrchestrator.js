/**
 * Editorial Mode Orchestrator
 * Manages multi-persona editorial critiques and enforces execution contracts.
 */

import { runEditorialMode } from "../../engine/editorial.js";

/**
 * Runs the editorial persona critique pipeline under a strict execution contract.
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
export async function runEditorialOrchestration({
  activeMode,
  text,
  modeFeedback,
  voiceSpec,
  openaiKey,
  geminiKey = null,
  sceneIntent = null,
  onStage = () => {},
}) {
  const startTime = Date.now();
  const warnings = [];
  let feedbackResult = null;

  try {
    await runEditorialMode({
      activeMode,
      text,
      modeFeedback,
      voiceSpec,
      openaiKey,
      geminiKey,
      sceneIntent,
      onStage,
      onFeedbackUpdate: (mode, feedback) => {
        feedbackResult = feedback;
      },
      onComplete: () => {},
      logTokenUsage: () => {},
    });
  } catch (e) {
    return {
      success: false,
      output: text,
      diagnostics: { stage: "failed", verdict: "ERROR" },
      warnings: [`Editorial run exception: ${e.message}`],
      metrics: {
        wordCount: text.split(/\s+/).filter(Boolean).length,
        durationMs: Date.now() - startTime
      }
    };
  }

  const durationMs = Date.now() - startTime;
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  // Evaluate success based on persona approval
  const hasVeto = feedbackResult && Object.values(feedbackResult).some(
    (f) => f.verdict === "REWRITE"
  );

  return {
    success: !hasVeto,
    output: text,
    diagnostics: {
      stage: "complete",
      verdict: hasVeto ? "REWRITE" : "APPROVED",
      feedback: feedbackResult
    },
    warnings,
    metrics: {
      wordCount,
      durationMs
    }
  };
}
