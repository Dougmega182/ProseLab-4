// @ts-check
/**
 * Centralized Orchestration Runner
 * Implements standard bounded retry logic, exponential backoff, tracing,
 * and semantic drift reversion safeguards.
 */

import { estimateSimilarity } from "../../engine/rewrite.js";

/**
 * Sleeps for the specified number of milliseconds.
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Standardized JSDoc Types
 * @typedef {object} ValidationResult
 * @property {boolean} passed - Whether validation passed
 * @property {number} score - Semantic score (0.0 to 1.0)
 * @property {string[]} violations - List of specific intent/style violations
 * @property {"intent_repair" | "style_refinement" | "none"} repairStrategy - Recommended repair direction
 * 
 * @typedef {object} RunnerOutput
 * @property {string} output - The generated prose draft
 * @property {number} duration - Total elapsed time in milliseconds
 * @property {number} passes - Number of execution cycles performed
 * @property {boolean} approved - Final validation approval state
 * @property {string[]} warnings - Any system warnings or errors
 * @property {ValidationResult} [diagnostics] - Narrative validation metrics
 */

/**
 * Runs the generation and critique pipeline with a bounded retry state machine.
 * 
 * @param {object} params - Input parameters
 * @param {string} params.originalText - The baseline/original prose text
 * @param {function} params.generateFn - Generation function: `(repairDirectives: string[]) => Promise<{ output: string, error?: string }>`
 * @param {function} params.validateFn - Critique/validation function: `(output: string) => Promise<ValidationResult>`
 * @param {number} [params.maxRetries] - Hard retry threshold
 * @param {number} [params.initialDelayMs] - Base delay for exponential backoff (default: 1000ms)
 * @returns {Promise<RunnerOutput>} Orchestrated final run telemetry
 */
export async function runWithRetry({
  originalText,
  generateFn,
  validateFn,
  maxRetries = 3,
  initialDelayMs = 1000
}) {
  const startTime = Date.now();
  const warnings = [];
  let currentText = originalText;
  /** @type {string[]} */
  let activeRepairDirectives = [];
  let passes = 0;
  let approved = false;
  /** @type {ValidationResult | undefined} */
  let lastDiagnostics;

  while (passes < maxRetries) {
    passes++;
    console.log(`[ORCHESTRATION RUNNER] Executing pass ${passes}/${maxRetries}...`);

    let generatedOutput = "";
    let networkRetry = 0;
    const maxNetworkRetries = 3;

    // A. Bounded Network Request Loop with Exponential Backoff + Jitter
    while (networkRetry < maxNetworkRetries) {
      try {
        const genResult = await generateFn(activeRepairDirectives);
        if (genResult.error) {
          throw new Error(genResult.error);
        }
        generatedOutput = genResult.output;
        break; // Success!
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        networkRetry++;
        console.warn(`[ORCHESTRATION RUNNER] Generation exception on pass ${passes} (Attempt ${networkRetry}/${maxNetworkRetries}): ${errorMsg}`);

        if (networkRetry >= maxNetworkRetries) {
          warnings.push(`Generation permanently failed after ${maxNetworkRetries} network attempts on pass ${passes}: ${errorMsg}`);
          return {
            output: currentText,
            duration: Date.now() - startTime,
            passes,
            approved: false,
            warnings,
            diagnostics: lastDiagnostics
          };
        }

        // Exponential backoff with random jitter
        const delay = initialDelayMs * Math.pow(2, networkRetry - 1) * (0.5 + Math.random());
        console.log(`[ORCHESTRATION RUNNER] Sleeping for ${Math.round(delay)}ms before retry...`);
        await sleep(delay);
      }
    }

    if (!generatedOutput || !generatedOutput.trim()) {
      warnings.push(`Generation returned empty prose on pass ${passes}.`);
      continue;
    }

    // B. Severe Drift Reversion Check
    if (originalText && originalText.trim()) {
      const similarity = estimateSimilarity(originalText, generatedOutput);
      if (similarity < 0.05) {
        console.warn(`[ORCHESTRATION RUNNER] Severe drift detected (Similarity: ${(similarity * 100).toFixed(1)}% < 5%). Resetting draft to original text.`);
        warnings.push(`Severe semantic drift detected on pass ${passes}. Reverted text to prevent compounding hallucinations.`);
        
        // Throw away the drifted generation and force a repair attempt directly on originalText
        generatedOutput = originalText;
      }
    }

    currentText = generatedOutput;

    // C. Validation Critique
    try {
      const validationResult = await validateFn(currentText);
      lastDiagnostics = validationResult;

      if (validationResult.passed) {
        approved = true;
        break; // Passed critique successfully!
      }

      console.log(`[ORCHESTRATION RUNNER] Pass ${passes} failed validation. Violations:\n`, validationResult.violations);

      // Accumulate repair instructions dynamically inside the "repair" budget
      activeRepairDirectives = [
        ...activeRepairDirectives,
        ...validationResult.violations.map((/** @type {string} */ v) => `Fix violation: ${v}`)
      ];
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[ORCHESTRATION RUNNER] Validation exception on pass ${passes}:`, errorMsg);
      warnings.push(`Validation threw an exception on pass ${passes}: ${errorMsg}`);
      
      // If validation crashes, treat it as a temporary failure and let it proceed to next pass
      activeRepairDirectives.push(`Fix compilation warning: Validation exception was encountered.`);
    }
  }

  const duration = Date.now() - startTime;
  console.log(`[ORCHESTRATION RUNNER] Run complete. Approved: ${approved}, Passes: ${passes}, Duration: ${duration}ms`);

  return {
    output: currentText,
    duration,
    passes,
    approved,
    warnings,
    diagnostics: lastDiagnostics
  };
}
