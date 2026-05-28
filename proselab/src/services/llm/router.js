/**
 * LLM Provider Router
 * Centralizes provider routing, retries, capabilities matching, and model failovers.
 */

import { callGalaxy, callGemini, callOllama, CircuitBreaker } from "../llm.js";

/**
 * Routes LLM call based on target provider, with failovers and retries.
 * 
 * @param {string} preferredProvider - "galaxy" | "gemini" | "ollama"
 * @param {string} prompt - Prompt payload
 * @param {object} options - Options including model and temperature
 * @param {object} keys - API keys { openai, gemini }
 * @returns {Promise<{ok: boolean, content: string, error?: string, raw?: any}>} Unified contract
 */
export async function routeLlmCall(preferredProvider, prompt, options = {}, keys = {}) {
  const providers = [];
  
  // Build fallback order based on capability and key availability
  if (preferredProvider === "galaxy") {
    providers.push("galaxy");
    if (keys.gemini) providers.push("gemini");
    providers.push("ollama");
  } else if (preferredProvider === "gemini") {
    if (keys.gemini) providers.push("gemini");
    providers.push("galaxy");
    providers.push("ollama");
  } else {
    providers.push("ollama");
    providers.push("galaxy");
    if (keys.gemini) providers.push("gemini");
  }

  // Deduplicate and filter list
  const fallbackChain = [...new Set(providers)];

  let lastError = null;

  for (const provider of fallbackChain) {
    console.log(`[LLM ROUTER] Attempting provider: [${provider.toUpperCase()}]`);

    try {
      if (provider === "galaxy") {
        if (CircuitBreaker.isOpen()) {
          console.warn("[LLM ROUTER] Galaxy Circuit Breaker is OPEN. Skipping.");
          lastError = new Error("CIRCUIT_BREAKER_OPEN");
          continue;
        }

        const res = await callGalaxy(keys.openai, prompt, options);
        if (res.ok) {
          console.log("[LLM ROUTER] Galaxy invocation completed successfully.");
          return res;
        }
        lastError = new Error(res.error || "Galaxy invocation failed");
      }

      if (provider === "gemini") {
        if (!keys.gemini) {
          console.warn("[LLM ROUTER] Gemini requested but VITE_GEMINI_KEY is missing. Skipping.");
          lastError = new Error("MISSING_GEMINI_KEY");
          continue;
        }

        const res = await callGemini(keys.gemini, prompt, {
          model: options.model || "gemini-2.5-flash",
          temperature: options.temperature || 0.7
        });
        if (res.ok) {
          console.log("[LLM ROUTER] Gemini fallback completed successfully.");
          return res;
        }
        lastError = new Error(res.error || "Gemini invocation failed");
      }

      if (provider === "ollama") {
        const ollamaModel = options.ollamaModel || options.model || "llama3";
        const res = await callOllama(ollamaModel, prompt);
        if (res.ok) {
          console.log("[LLM ROUTER] Ollama fallback completed successfully.");
          return {
            ok: true,
            status: 200,
            content: res.content,
            raw: res
          };
        }
        lastError = new Error(res.error || "Ollama invocation failed");
      }
    } catch (e) {
      console.error(`[LLM ROUTER] Provider [${provider.toUpperCase()}] threw exception:`, e);
      lastError = e;
    }
  }

  // Entire fallback chain exhausted
  console.error("[LLM ROUTER] All LLM providers in fallback chain exhausted.");
  return {
    ok: false,
    content: "",
    error: lastError ? lastError.message : "All providers failed",
    raw: null
  };
}
