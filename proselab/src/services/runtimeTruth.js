export const CREATE_PIPELINE_SUMMARY = "Ollama -> OpenAI -> Critic";

export function getChallengerRuntimeLabel(hasGeminiKey) {
  if (!hasGeminiKey) {
    return "Gemini challenger not configured.";
  }

  return "Gemini challenger is configured, but it is not enforced in the main CREATE loop.";
}
