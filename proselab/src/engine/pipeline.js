import { callOllama } from "../services/llm.js";
import { callCritic } from "./critic.js";
import { generateRewrite, estimateSimilarity } from "./rewrite.js";
import { analyze, buildDelta } from "./analysis.js";
import { cachedInference, shouldCacheInference } from "../services/inferenceCache.js";

export const INFERENCE_CACHE_CONTEXT_VERSION = "voice-lock-v1";

function normalize(str) { return str.trim().replace(/\s+/g, " "); }

export async function runPipeline({ 
  text, 
  keys, 
  model, 
  onStage, 
  onUpdate,
  sceneContext = null,
  voiceSpec = {},
  logTokenUsage = () => {},
  estimateTokens = (t) => Math.ceil((t || "").length / 4),
  cacheVersion = "voice-lock-v1",
}) {
  onStage("analysis");
  const analysis = await cachedInference({
    name: "analysis",
    input: text,
    context: { version: cacheVersion },
    fn: async () => analyze(text),
    enabled: shouldCacheInference("analysis"),
  });
  if (onUpdate) onUpdate({ analysis });

  onStage("delta");
  const delta = await cachedInference({
    name: "delta",
    input: JSON.stringify(analysis),
    context: { version: cacheVersion },
    fn: async () => buildDelta(analysis),
    enabled: shouldCacheInference("delta"),
  });
  if (onUpdate) onUpdate({ delta });

  const initialInstruction = normalize(`Rewrite this paragraph with these constraints:\n${delta.join("\n")}\n\n${text}`);

  onStage("ollama");
  const ollamaRes = await callOllama(model, initialInstruction);
  const draft1 = ollamaRes.ok ? ollamaRes.content : "";
  const safeDraft1 = draft1?.trim() ? draft1 : text;
  
  if (ollamaRes.ok) {
    logTokenUsage("ollama", estimateTokens(initialInstruction), estimateTokens(draft1));
  }

  onStage("openai-refinement");
  const rewriteResult = await generateRewrite({
    original: safeDraft1,
    instructions: delta,
    voiceSpec,
    sceneContext,
    key: keys.openai,
    temperature: 0.75,
  });

  const currentDraft = rewriteResult.ok ? rewriteResult.text : safeDraft1;
  if (rewriteResult.ok && rewriteResult.response?.usage) {
    logTokenUsage("openai::gpt-4o-mini", rewriteResult.response.usage.prompt_tokens, rewriteResult.response.usage.completion_tokens);
  }

  onStage("critic");
  const critique = await callCritic({
    text: currentDraft,
    keys,
    sceneContext
  });

  onStage("done");
  return { 
    analysis, 
    delta, 
    draft: safeDraft1,
    refined: currentDraft,
    final: currentDraft,
    critique,
    attempts: 1,
    traces: [{ draft: currentDraft, critique }]
  };
}
