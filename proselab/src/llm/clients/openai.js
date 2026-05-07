// src/llm/clients/openai.js

import { BaseLLMClient } from './base.js';

export class OpenAIClient extends BaseLLMClient {
  constructor(config = {}) {
    super(config);
    this.baseURL = config.baseURL || 'https://api.openai.com/v1';
  }

  async chat(messages, params = {}) {
    const merged = this.mergeParams(params);

    const body = {
      model: this.model,
      messages,
      temperature: merged.temperature,
      max_tokens: merged.maxTokens,
      top_p: merged.topP,
      frequency_penalty: merged.frequencyPenalty,
      presence_penalty: merged.presencePenalty,
    };

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw this.handleError(
          { message: errorData.error?.message || response.statusText },
          response.status
        );
      }

      const data = await response.json();
      const choice = data.choices?.[0];

      return {
        content: choice?.message?.content || '',
        finishReason: choice?.finish_reason,
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
      };
    } catch (error) {
      if (error.statusCode) throw error; // Already handled
      throw this.handleError(error, null);
    }
  }

  async chatStream(messages, params = {}, onChunk) {
    const merged = this.mergeParams(params);

    const body = {
      model: this.model,
      messages,
      temperature: merged.temperature,
      max_tokens: merged.maxTokens,
      top_p: merged.topP,
      frequency_penalty: merged.frequencyPenalty,
      presence_penalty: merged.presencePenalty,
      stream: true,
    };

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw this.handleError(
          { message: errorData.error?.message || response.statusText },
          response.status
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const data = trimmed.slice(6);
          if (data === '[DONE]') break;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content || '';
            if (delta) {
              fullContent += delta;
              onChunk(delta);
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }

      return {
        content: fullContent,
        finishReason: 'stop',
        usage: null, // Not available in streaming
      };
    } catch (error) {
      if (error.statusCode) throw error;
      throw this.handleError(error, null);
    }
  }
}
