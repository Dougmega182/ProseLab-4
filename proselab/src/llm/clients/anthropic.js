// src/llm/clients/anthropic.js

import { BaseLLMClient } from './base.js';

export class AnthropicClient extends BaseLLMClient {
  constructor(config = {}) {
    super(config);
    this.baseURL = config.baseURL || 'https://api.anthropic.com/v1';
    this.anthropicVersion = config.anthropicVersion || '2023-06-01';
  }

  async chat(messages, params = {}) {
    const merged = this.mergeParams(params);

    // Anthropic separates system prompt
    const system = messages.find(m => m.role === 'system')?.content;
    const userMessages = messages.filter(m => m.role !== 'system');

    const body = {
      model: this.model,
      system,
      messages: userMessages,
      max_tokens: merged.maxTokens,
      temperature: merged.temperature,
      top_p: merged.topP,
    };

    try {
      const response = await fetch(`${this.baseURL}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': this.anthropicVersion,
          'anthropic-dangerous-direct-browser-access': 'true',
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
      return {
        content: data.content?.[0]?.text || '',
        finishReason: data.stop_reason,
        usage: {
          promptTokens: data.usage?.input_tokens || 0,
          completionTokens: data.usage?.output_tokens || 0,
          totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        },
      };
    } catch (error) {
      if (error.statusCode) throw error;
      throw this.handleError(error, null);
    }
  }

  async chatStream(messages, params = {}, onChunk) {
    const merged = this.mergeParams(params);

    const system = messages.find(m => m.role === 'system')?.content;
    const userMessages = messages.filter(m => m.role !== 'system');

    const body = {
      model: this.model,
      system,
      messages: userMessages,
      max_tokens: merged.maxTokens,
      temperature: merged.temperature,
      top_p: merged.topP,
      stream: true,
    };

    try {
      const response = await fetch(`${this.baseURL}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': this.anthropicVersion,
          'anthropic-dangerous-direct-browser-access': 'true',
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
      let usage = null;

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

          try {
            const parsed = JSON.parse(data);

            if (parsed.type === 'content_block_delta') {
              const delta = parsed.delta?.text || '';
              if (delta) {
                fullContent += delta;
                onChunk(delta);
              }
            } else if (parsed.type === 'message_delta') {
              if (parsed.usage) {
                usage = {
                  promptTokens: 0,
                  completionTokens: parsed.usage.output_tokens || 0,
                  totalTokens: parsed.usage.output_tokens || 0,
                };
              }
            }
          } catch {
            // Skip malformed JSON
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
}
