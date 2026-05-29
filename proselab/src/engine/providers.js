// @ts-nocheck
/**
 * Providers Bridge
 * Normalizes calls to different LLM services (OpenAI, Ollama, Gemini) 
 * for the engine's consumption.
 */

import { callOpenAI, callOllama, callGemini } from '../services/llm.js';

export class Providers {
  constructor(keys, models) {
    this.keys = keys; // { openai, gemini }
    this.models = models; // { generation, validation, critique, lore }
  }

  /**
   * Main entry point for LLM calls within the engine.
   * @param {Object} options - Call configuration
   * @param {string} options.role - The engine role (generation, validation, etc.)
   * @param {Array} options.messages - Array of {role, content}
   * @param {number} options.temperature - Sampling temperature
   * @param {number} options.max_tokens - Max tokens to generate
   */
  async callLLM(options) {
    const { role, messages, temperature, max_tokens } = options;
    const modelConfig = this.models[role] || this.models.generation;

    // Convert messages to single prompt for legacy handlers if needed
    const prompt = messages.map(m => `[${m.role.toUpperCase()}]\n${m.content}`).join('\n\n');

    if (modelConfig.provider === 'openai') {
      const res = await callOpenAI(this.keys.openai, prompt, {
        model: modelConfig.model,
        temperature,
        max_tokens
      });
      return res;
    }

    if (modelConfig.provider === 'ollama') {
      const res = await callOllama(modelConfig.model, prompt);
      // Normalize Ollama output to match OpenAI-style response object
      return {
        ok: res.ok,
        content: res.content,
        error: res.error,
        usage: null // Ollama doesn't return usage in the simple call
      };
    }

    if (modelConfig.provider === 'gemini') {
      const res = await callGemini(this.keys.gemini, prompt, {
        model: modelConfig.model,
        temperature
      });
      return res;
    }

    throw new Error(`Unsupported provider: ${modelConfig.provider}`);
  }

  getModel(role) {
    return this.models[role] || this.models.generation;
  }
}
