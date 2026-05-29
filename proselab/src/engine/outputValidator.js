// @ts-check
/**
 * Output Verification Engine (Narrative Compiler)
 * Performs hybrid verification checks (deterministic rules + semantic LLM evaluation)
 * on generated prose to guarantee narrative alignment and prevent regressions.
 */

import { estimateSimilarity } from "./rewrite.js";
import { callOpenAI } from "../services/llm.js";

/**
 * Validates the generated prose against the scene intent and original text.
 * 
 * @param {string} output - The generated prose draft
 * @param {string} originalText - The original scene prose input
 * @param {object} sceneIntent - The structured narrative beats
 * @param {object} [options] - Validation options (thresholds)
 * @param {number} [options.similarityThreshold] - Maximum similarity threshold (default: 0.85)
 * @param {object} [keys] - API keys
 * @param {string} [keys.openai] - The OpenAI API key
 * @returns {Promise<{
 *   passed: boolean,
 *   score: number,
 *   violations: string[],
 *   repairStrategy: "intent_repair" | "style_refinement" | "none"
 * }>}
 */
export async function validateRewriteOutput(output, originalText, sceneIntent, options = {}, keys = {}) {
  /** @type {string[]} */
  const violations = [];
  let score = 1.0;
  const similarityThreshold = options.similarityThreshold || 0.85;

  if (!output || !output.trim()) {
    return {
      passed: false,
      score: 0,
      violations: ["Output is empty or blank."],
      repairStrategy: "intent_repair"
    };
  }

  // 1. Deterministic Delta/Similarity Check
  if (originalText && originalText.trim()) {
    const similarity = estimateSimilarity(originalText, output);
    if (similarity > similarityThreshold) {
      violations.push(`Prose is too similar to the original text (Similarity: ${(similarity * 100).toFixed(0)}% > ${(similarityThreshold * 100).toFixed(0)}%). Sentences must be actively rewritten.`);
      score -= 0.2;
    }
    if (similarity < 0.05) {
      violations.push(`Prose is too divergent from the original text (Similarity: ${(similarity * 100).toFixed(0)}% < 5%). It likely completely rewrote facts or missed scene context.`);
      score -= 0.15;
    }
  }

  // 2. Semantic LLM Check (Narrative Alignment)
  if (keys.openai && sceneIntent) {
    const evaluationPrompt = `You are a rigorous narrative compiler. Evaluate whether the generated prose satisfies the specified scene intent.

Scene Intent:
${JSON.stringify(sceneIntent, null, 2)}

Generated Prose:
---
${output}
---`;

    try {
      const response = await callOpenAI(keys.openai, evaluationPrompt, {
        temperature: 0.1, // High consistency for scoring
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "narrative_alignment",
            strict: true,
            schema: {
              type: "object",
              properties: {
                goal_achieved: { type: "boolean" },
                conflict_acknowledged: { type: "boolean" },
                change_occurred: { type: "boolean" },
                violations: {
                  type: "array",
                  items: { type: "string" }
                },
                score: { type: "number" }
              },
              required: ["goal_achieved", "conflict_acknowledged", "change_occurred", "violations", "score"],
              additionalProperties: false
            }
          }
        }
      });

      if (response && response.ok && response.content) {
        const parsed = JSON.parse(response.content);
        
        if (!parsed.goal_achieved) {
          violations.push("Goal not physically achieved: The protagonist did not achieve their scene objective.");
          score -= 0.3;
        }
        if (!parsed.conflict_acknowledged) {
          violations.push("Conflict not legibly acknowledged: The obstacle or friction was bypassed.");
          score -= 0.2;
        }
        if (!parsed.change_occurred) {
          violations.push("Irreversible change not legibly verified: Status quo did not shift by the end.");
          score -= 0.2;
        }

        if (parsed.violations && Array.isArray(parsed.violations)) {
          parsed.violations.forEach((/** @type {string} */ v) => {
            if (!violations.includes(v)) violations.push(v);
          });
        }

        if (parsed.score !== undefined) {
          score = Math.min(score, parsed.score);
        }
      } else {
        violations.push(`Semantic check API call failed: ${response?.error || "Unknown network failure"}`);
      }
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      console.warn("[OUTPUT VALIDATOR] Semantic evaluation exception:", err);
      violations.push(`Semantic check could not complete due to parse or call error: ${err.message}`);
    }
  }

  // Normalize final score bound
  const finalScore = Math.max(0, Math.min(1.0, score));
  const passed = finalScore >= 0.70 && violations.length === 0;

  // Determine repair strategy
  let repairStrategy = /** @type {"intent_repair" | "style_refinement" | "none"} */ ("none");
  if (!passed) {
    const hasIntentFail = violations.some(v => v.includes("Goal") || v.includes("Conflict") || v.includes("change"));
    repairStrategy = hasIntentFail ? "intent_repair" : "style_refinement";
  }

  return {
    passed,
    score: Math.round(finalScore * 100) / 100,
    violations,
    repairStrategy
  };
}

