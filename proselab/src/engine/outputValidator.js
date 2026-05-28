/**
 * Output Verification Engine (Narrative Compiler)
 * Performs hybrid verification checks (deterministic rules + semantic LLM evaluation)
 * on generated prose to guarantee narrative alignment and prevent regressions.
 */

import { estimateSimilarity } from "./rewrite.js";
import { callOpenAI } from "../services/llm.js";

// Abstract emotional labels that represent weak style or AI-clean tell signs
const BANNED_EMOTIONS = [
  "unease", "anxiety", "felt", "sad", "angry", "scared", "fear", "happy", "gloom",
  "dread", "terror", "remorse", "despair", "melancholy", "joy", "grief"
];

/**
 * Validates the generated prose against the scene intent and original text.
 * 
 * @param {string} output - The generated prose draft
 * @param {string} originalText - The original scene prose input
 * @param {object} sceneIntent - The structured narrative beats
 * @param {object} options - Validation options (thresholds)
 * @param {object} keys - API keys { openai }
 * @returns {Promise<{
 *   passed: boolean,
 *   score: number,
 *   violations: string[],
 *   repairStrategy: "intent_repair" | "style_refinement" | "none"
 * }>}
 */
export async function validateRewriteOutput(output, originalText, sceneIntent, options = {}, keys = {}) {
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

  // 2. Deterministic Tone & Emotion checks
  const outputLower = output.toLowerCase();
  const foundEmotions = BANNED_EMOTIONS.filter(e => {
    const regex = new RegExp(`\\b${e}\\b`, "i");
    return regex.test(outputLower);
  });

  if (foundEmotions.length > 0) {
    violations.push(`Tone violation: Found abstract emotional labels: ${foundEmotions.join(", ")}. Convert these to physical observations or bodily tells.`);
    score -= 0.15 * foundEmotions.length;
  }

  // 3. Optional Semantic LLM Check (Narrative Alignment)
  if (keys.openai && sceneIntent) {
    const evaluationPrompt = `You are a rigorous narrative compiler. Evaluate whether the generated prose satisfies the specified scene intent.

Scene Intent:
${JSON.stringify(sceneIntent, null, 2)}

Generated Prose:
---
${output}
---

Provide your analysis in EXACTLY this JSON structure:
{
  "goal_achieved": true | false,
  "conflict_acknowledged": true | false,
  "change_occurred": true | false,
  "violations": ["list of reasons why beats were not met or hallucinated details were introduced"],
  "score": 0.0 to 1.0
}`;

    try {
      const response = await callOpenAI(keys.openai, evaluationPrompt, {
        temperature: 0.1, // High consistency for scoring
      });

      if (response && response.ok) {
        const rawContent = response.content;
        const first = rawContent.indexOf("{");
        const last = rawContent.lastIndexOf("}");
        if (first !== -1 && last !== -1 && last > first) {
          const parsed = JSON.parse(rawContent.slice(first, last + 1));
          
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
            parsed.violations.forEach(v => {
              if (!violations.includes(v)) violations.push(v);
            });
          }

          if (parsed.score !== undefined) {
            score = Math.min(score, parsed.score);
          }
        }
      }
    } catch (e) {
      console.warn("[OUTPUT VALIDATOR] Semantic evaluation LLM call exception:", e);
      violations.push(`Semantic check could not complete: ${e.message}`);
    }
  }

  // Normalize final score bound
  const finalScore = Math.max(0, Math.min(1.0, score));
  const passed = finalScore >= 0.70 && violations.length === 0;

  // Determine repair strategy
  let repairStrategy = "none";
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
