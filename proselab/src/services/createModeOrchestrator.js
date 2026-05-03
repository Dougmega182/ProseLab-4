import { runPipeline } from "../engine/pipeline.js";
import { mapVoiceToPromptSpec } from "../engine/rewrite.js";
import { ShadowManager } from "../engine/shadowLayer.js";

function buildSceneIntent(scene) {
  const requiredFields = [scene.output, scene.causality, scene.stakes];
  if (requiredFields.some((f) => !String(f || "").trim())) {
    throw new Error(
      "CREATE blocked: selected scene is missing required intent fields (output, causality, stakes)."
    );
  }
  return {
    objective: String(scene.output || "").trim(),
    success_state: String(scene.output || "").trim(),
    failure_state: `Scene fails to produce required output: ${String(scene.output || "").trim()}`,
    irreversible_change: String(scene.causality || "").trim(),
    story_delta: String(scene.stakes || "").trim(),
  };
}

function buildSceneContext(scene) {
  return `
CHAPTER BRIEF:
Title: ${scene.title}
Chapter: ${scene.chapter}
Location: ${scene.location}
Causality: ${scene.causality}
Required Output: ${scene.output}
Stakes: ${scene.stakes}
Characters Present: ${scene.chars}
`;
}

export async function runCreateModeOrchestrator({
  text,
  preproduction,
  preflightId,
  delta,
  keys,
  cacheVersion,
  logTokenUsage,
  estimateTokens,
  onStage,
  onIntent,
  onAnalysis,
  onDelta,
  onBlocked,
  onComplete,
  onError,
}) {
  const activeScene = preproduction.scenes.find(
    (s) => s.id === parseInt(preflightId)
  );

  if (!activeScene) {
    onError(
      new Error(
        "CREATE blocked: select a scene before running the pipeline. Scene intent is mandatory."
      )
    );
    return;
  }

  let sceneIntent;
  try {
    sceneIntent = buildSceneIntent(activeScene);
  } catch (e) {
    onError(e);
    return;
  }

  const sceneContext = buildSceneContext(activeScene);
  const voiceSpec = mapVoiceToPromptSpec(preproduction.voice, delta);

  let res;
  try {
    res = await runPipeline({
      text,
      sceneIntent,
      keys,
      model: preproduction.settings.ollamaModel,
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
    onError(e);
    return;
  }

  // SHADOW RECORDING
  ShadowManager.record({
      input: text,
      output: res.final,
      legacyResult: {
          verdict: res.critique?.verdict || "REWRITE",
          intent_verdict: res.intent?.intent_verdict || "FAIL",
          attempts: res.attempts
      },
      sceneIntent,
      keys
  });

  if (res.blocked) {
    onBlocked({
      intent: res.intent,
      fallbackText: text,
    });
    return;
  }

  onComplete({
    analysis: res.analysis,
    delta: res.delta,
    draft: res.traces?.[0]?.draft || "",
    final: res.final,
    critique: {
      verdict: res.critique?.verdict,
      score: res.critique?.score,
      failures: res.critique?.failures,
      intent: res.intent,
      intent_verdict: res.critique?.intent_verdict,
      intent_alignment: res.critique?.intent_alignment,
      intent_failures: res.critique?.intent_failures,
      attempts: res.attempts,
      traces: res.traces,
    },
  });
}

export { buildSceneIntent, buildSceneContext };
