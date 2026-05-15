export const CREATE_PIPELINE_SUMMARY = "Galaxy AI → Critic → Gemini Challenger";

export function getChallengerRuntimeLabel(hasGeminiKey) {
  if (!hasGeminiKey) {
    return "Gemini challenger not configured.";
  }

  return "Gemini challenger is ENFORCED as a hard gate on APPROVE verdicts.";
}
