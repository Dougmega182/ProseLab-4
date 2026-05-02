import { runEditorialMode } from "../engine/editorial.js";

export async function runEditorialModeOrchestrator({
  activeMode,
  text,
  modeFeedback,
  voiceSpec,
  openaiKey,
  logTokenUsage,
  onStage,
  onFeedback,
  onComplete,
  onError,
}) {
  try {
    await runEditorialMode({
      activeMode,
      text,
      modeFeedback,
      voiceSpec,
      openaiKey,
      onStage,
      onFeedbackUpdate: onFeedback,
      onComplete,
      logTokenUsage,
    });
  } catch (e) {
    onError(e);
  }
}
