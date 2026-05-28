// src/llm/clients/ollama.js

import { BaseLLMClient } from './base.js';

export class OllamaClient extends BaseLLMClient {
  constructor(config = {}) {
    super(config);
    this.baseURL = config.baseURL || 'http://127.0.0.1:11434';
  }

  async chat(messages, params = {}) {
    const merged = this.mergeParams(params);

    const body = {
      model: this.model,
      messages,
      options: {
        temperature: merged.temperature,
        num_predict: merged.maxTokens,
        top_p: merged.topP,
        repeat_penalty: 1.0 + merged.frequencyPenalty,
      },
      stream: false,
    };

    try {
      const response = await fetch(`${this.baseURL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw this.handleError(
          { message: errorData.error || response.statusText },
          response.status
        );
      }

      const data = await response.json();

      return {
        content: data.message?.content || '',
        finishReason: data.done ? 'stop' : 'length',
        usage: {
          promptTokens: data.prompt_eval_count || 0,
          completionTokens: data.eval_count || 0,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        },
      };
    } catch (error) {
      if (error.statusCode) throw error;
      throw this.handleError(error, null);
    }
  }

  async chatStream(messages, params = {}, onChunk) {
    const merged = this.mergeParams(params);

    const body = {
      model: this.model,
      messages,
      options: {
        temperature: merged.temperature,
        num_predict: merged.maxTokens,
        top_p: merged.topP,
        repeat_penalty: 1.0 + merged.frequencyPenalty,
      },
      stream: true,
    };

    try {
      const response = await fetch(`${this.baseURL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw this.handleError(
          { message: errorData.error || response.statusText },
          response.status
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';
      let usage = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const parsed = JSON.parse(line);
            const delta = parsed.message?.content || '';
            if (delta) {
              fullContent += delta;
              onChunk(delta);
            }
            if (parsed.done) {
              usage = {
                promptTokens: parsed.prompt_eval_count || 0,
                completionTokens: parsed.eval_count || 0,
                totalTokens: (parsed.prompt_eval_count || 0) + (parsed.eval_count || 0),
              };
            }
          } catch {
            // Skip malformed lines
          }
        }
      }

      return {
        content: fullContent,
        finishReason: 'stop',
        usage,
      };
    } catch (error) {
      if (error.statusCode) throw error;
      throw this.handleError(error, null);
    }
  }

  async listModels() {
    try {
      const response = await fetch(`${this.baseURL}/api/tags`);
      if (!response.ok) throw new Error('Failed to list models');
      const data = await response.json();
      return (data.models || []).map(m => ({
        id: m.name,
        name: m.name,
        size: m.size,
        modified: m.modified_at,
      }));
    } catch (error) {
      throw this.handleError(error, null);
    }
  }
}
