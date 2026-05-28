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
import { buildPromptBudget } from "../../engine/promptBudget.js";

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

  // Duplication checks
  const beatKeys = Object.keys(beats);
  for (let i = 0; i < beatKeys.length; i++) {
    for (let j = i + 1; j < beatKeys.length; j++) {
      const keyA = beatKeys[i];
      const keyB = beatKeys[j];
      const valA = beats[keyA];
      const valB = beats[keyB];
      if (valA.toLowerCase() === valB.toLowerCase()) {
        throw new Error(
          `CREATE blocked: Critical structural beats '${keyA}' and '${keyB}' contain duplicate or near-identical text. Each beat must represent unique narrative intent.`
        );
      }
    }
  }

  return true;
}

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

export function buildSceneContext(scene) {
  return `
CHAPTER BRIEF:
Title: ${scene.title}
Chapter: ${scene.chapter}
Location: ${scene.location}
Time: ${scene.time}
Scene Goal: ${scene.goal || ""}
Scene Conflict: ${scene.conflict || ""}
Irreversible Change: ${scene.change || scene.output || ""}
Scene Stakes: ${scene.stakes || ""}
Discovery/Reveal: ${scene.reveal || ""}
Causality: ${scene.causality || ""}
Characters Present: ${scene.chars}
Props Planted: ${scene.objects}
`;
}

/**
 * Executes the narrative creation pipeline under a strict execution contract.
 * 
 * @param {object} params Orchestration params
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
  const warnings = [];

  const activeScene = preproduction.scenes?.find(
    (s) => String(s.id) === String(preflightId)
  );

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
    return {
      success: false,
      output: text,
      diagnostics: { stage: "failed", attempts: 0, verdict: "BLOCKED" },
      warnings: [e.message],
      metrics: { wordCount: text.split(/\s+/).filter(Boolean).length, durationMs: Date.now() - startTime }
    };
  }

  const rawSceneContext = buildSceneContext(activeScene);

  let attempts = 0;
  const maxAttempts = 3;
  let currentText = text;
  let currentDelta = [...delta];
  let res;
  let finalVerdict = "REWRITE";
  let finalFailures = [];
  let validationResult = null;
  let challengerResult = null;
  const traces = [];

  while (attempts < maxAttempts) {
    attempts++;
    onStage(`pipeline-attempt-${attempts}`);

    // Apply Prompt Budgeting Control
    let voiceDirectives = preproduction.voice?.compressedDirectives;
    if (!Array.isArray(voiceDirectives) || voiceDirectives.length === 0) {
      // Reconstruct default/standard voice directives from basic fields as a robust fallback
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
      rewrite: currentDelta
    });

    // Re-build budgeted voice metadata and scene context
    const budgetedVoice = {
      ...preproduction.voice,
      compressedDirectives: budgeted.voice
    };

    const sceneContext = budgeted.scene;
    const voiceSpec = mapVoiceToPromptSpec(budgetedVoice, budgeted.rewrite);

    try {
      res = await runPipeline({
        text: currentText,
        sceneIntent,
        keys,
        model: preproduction.settings?.ollamaModel,
        onStage,
        onUpdate: (data) => {
          if (data.intent) onIntent(data.intent);
          if (data.analysis) onAnalysis(data.analysis);
          if (data.delta) onDelta(data.delta);
        },
        sceneContext,
        voiceSpec,
        logTokenUsage,
        estimateTokens,
        cacheVersion,
      });
    } catch (e) {
      return {
        success: false,
        output: currentText,
        diagnostics: { stage: "failed", attempts, verdict: "ERROR" },
        warnings: [`Pipeline exception: ${e.message}`],
        metrics: { wordCount: currentText.split(/\s+/).filter(Boolean).length, durationMs: Date.now() - startTime }
      };
    }

    if (res.blocked) {
      return {
        success: false,
        output: currentText,
        diagnostics: {
          stage: "blocked",
          attempts,
          verdict: "BLOCKED",
          intent: res.intent
        },
        warnings: ["Narrative intent gate blocked completion."],
        metrics: { wordCount: currentText.split(/\s+/).filter(Boolean).length, durationMs: Date.now() - startTime }
      };
    }

    const generatedProse = res.final || res.prose || currentText;
    finalVerdict = res.critique?.verdict || "REWRITE";
    finalFailures = res.critique?.failures || [];

    // Accumulate traces
    if (res.traces && Array.isArray(res.traces)) {
      traces.push(...res.traces);
    } else {
      traces.push({
        attempt: attempts,
        draft: generatedProse,
        critique: res.critique || { verdict: finalVerdict, failures: finalFailures }
      });
    }

    // ── OUTPUT VERIFICATION LAYER (NARRATIVE COMPILER GATE) ──────────
    if (generatedProse && finalVerdict === "APPROVE") {
      onStage("output-verification");
      try {
        validationResult = await validateRewriteOutput(
          generatedProse,
          text,
          sceneIntent,
          { similarityThreshold: 0.85 },
          { openai: keys.openai }
        );

        if (!validationResult.passed) {
          finalVerdict = "REWRITE";
          finalFailures = [
            ...finalFailures,
            ...validationResult.violations.map(v => ({
              type: "VALIDATION_VIOLATION",
              reason: v
            }))
          ];
          warnings.push(`Output verification failed on attempt ${attempts}. Repair strategy: ${validationResult.repairStrategy}`);
          
          // Feed specific violations back as rewrite instructions for next attempt
          currentDelta = [
            ...currentDelta,
            ...validationResult.violations.map(v => `Fix violation: ${v}`)
          ];
          
          currentText = generatedProse;
          continue; // Trigger retry
        }
      } catch (e) {
        finalVerdict = "REWRITE";
        finalFailures = [
          ...finalFailures,
          {
            type: "VALIDATION_EXCEPTION",
            reason: `Output verification exception: ${e.message}`
          }
        ];
        warnings.push(`Output verification failed to execute on attempt ${attempts}: ${e.message}`);
        
        // Feed instruction back for next attempt
        currentDelta = [
          ...currentDelta,
          `Fix validation system failure: ensure prose meets core intent constraints.`
        ];
        
        currentText = generatedProse;
        continue; // Trigger retry
      }
    }

    // ── GEMINI CHALLENGER GATE (hard gate on APPROVE) ──────────────
    if (finalVerdict === "APPROVE" && keys.gemini) {
      onStage("challenger-gate");
      try {
        challengerResult = await runChallengerGate({
          prose: generatedProse,
          sceneIntent,
          geminiKey: keys.gemini,
          onStage,
        });

        if (!challengerResult.confirmed) {
          finalVerdict = "REWRITE";
          finalFailures = [
            ...finalFailures,
            ...challengerResult.challenger.fatal_flaws.map(f => ({
              type: "GEMINI_VETO",
              reason: f,
            })),
          ];
          warnings.push(`Adversarial Challenger vetoed draft on attempt ${attempts}.`);
          
          // Feed fatal flaws back as rewrite instructions for next attempt
          currentDelta = [
            ...currentDelta,
            ...challengerResult.challenger.fatal_flaws.map(f => `Resolve Challenger Flaw: ${f}`)
          ];
          
          currentText = generatedProse;
          continue; // Trigger retry
        }
      } catch (e) {
        warnings.push(`Challenger gate failed on attempt ${attempts}: ${e.message}`);
      }
    }

    // If verdict is REWRITE from critique, feed critique instructions back and retry
    if (finalVerdict === "REWRITE") {
      warnings.push(`Critique rejected draft on attempt ${attempts}.`);
      
      const critiqueInstructions = res.critique?.rewrite?.instructions || 
                                   finalFailures.map(f => f.reason || f.description || f) || [];
      
      currentDelta = [
        ...currentDelta,
        ...critiqueInstructions.map(i => `Critique refinement: ${i}`)
      ];
      currentText = generatedProse;
      continue;
    }

    // If it passed both and is approved, break loop
    if (finalVerdict === "APPROVE") {
      currentText = generatedProse;
      break;
    }
  }

  // SHADOW RECORDING
  try {
    ShadowManager.record({
      input: text,
      output: currentText,
      legacyResult: {
        verdict: finalVerdict,
        intent_verdict: res?.critique?.intent_verdict || res?.intent?.intent_verdict || "FAIL",
        attempts
      },
      sceneIntent,
      keys
    });
  } catch (e) {
    warnings.push(`Shadow recording failed: ${e.message}`);
  }

  const durationMs = Date.now() - startTime;
  const wordCount = currentText.split(/\s+/).filter(Boolean).length;

  return {
    success: finalVerdict === "APPROVE",
    output: currentText,
    diagnostics: {
      stage: "complete",
      attempts,
      verdict: finalVerdict,
      failures: finalFailures,
      intent: res?.intent,
      intent_verdict: res?.critique?.intent_verdict || res?.intent?.intent_verdict,
      intent_alignment: res?.critique?.intent_alignment || res?.intent?.intent_alignment,
      intent_failures: res?.critique?.intent_failures || res?.intent?.intent_failures,
      traces,
      challenger: challengerResult?.challenger || null,
      validation: validationResult,
    },
    warnings,
    metrics: {
      wordCount,
      durationMs
    }
  };
}
