/**
 * Anthropic Provider
 * Implementation for Anthropic Messages API (Claude).
 */

import { ProviderError } from './openai.js';

export class AnthropicProvider {
  constructor(config) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com/v1';
  }

  async complete({ model, messages, temperature, max_tokens, response_format, stream }) {
    // Anthropic uses a different message format — system is separate
    const systemMessage = messages.find(m => m.role === 'system');
    const nonSystemMessages = messages.filter(m => m.role !== 'system');

    const body = {
      model,
      max_tokens: max_tokens || 4096,
      temperature,
      messages: nonSystemMessages
    };

    if (systemMessage) {
      body.system = systemMessage.content;
    }

    if (stream) {
      body.stream = true;
    }

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new ProviderError(
        `Anthropic API error: ${error.error?.message || response.statusText}`,
        response.status,
        error
      );
    }

    if (stream) {
      return {
        stream: this.parseAnthropicStream(response.body),
        usage: null
      };
    }

    const data = await response.json();
    return {
      content: data.content[0].text,
      usage: {
        input_tokens: data.usage.input_tokens,
        output_tokens: data.usage.output_tokens
      }
    };
  }

  async *parseAnthropicStream(body) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const parsed = JSON.parse(trimmed.slice(6));
            
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              yield { type: 'content', content: parsed.delta.text };
            }
            
            if (parsed.type === 'message_delta' && parsed.usage) {
              yield { type: 'usage', usage: parsed.usage };
            }
          } catch (e) {
            // Skip malformed chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
