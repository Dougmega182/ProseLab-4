/**
 * Ollama Provider
 * Implementation for local Ollama API.
 */

import { ProviderError } from './openai.js';

export class OllamaProvider {
  constructor(config) {
    this.baseUrl = config.baseUrl || 'http://127.0.0.1:11434';
  }

  async complete({ model, messages, temperature, max_tokens, stream }) {
    const body = {
      model,
      messages,
      options: {
        temperature,
        num_predict: max_tokens
      },
      stream: !!stream
    };

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new ProviderError(
        `Ollama error: ${response.statusText}`,
        response.status
      );
    }

    if (stream) {
      return {
        stream: this.parseOllamaStream(response.body),
        usage: null
      };
    }

    const data = await response.json();
    return {
      content: data.message.content,
      usage: {
        input_tokens: data.prompt_eval_count || 0,
        output_tokens: data.eval_count || 0
      }
    };
  }

  async *parseOllamaStream(body) {
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
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.message?.content) {
              yield { type: 'content', content: parsed.message.content };
            }
            if (parsed.done && parsed.eval_count) {
              yield {
                type: 'usage',
                usage: {
                  input_tokens: parsed.prompt_eval_count || 0,
                  output_tokens: parsed.eval_count || 0
                }
              };
            }
          } catch (e) {
            // Skip malformed lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
