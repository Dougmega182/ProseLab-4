/**
 * OpenAI Provider
 * Standard implementation for OpenAI Chat Completions API.
 */

export class OpenAIProvider {
  constructor(config) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
  }

  async complete({ model, messages, temperature, max_tokens, response_format, stream }) {
    const body = {
      model,
      messages,
      temperature,
      max_tokens,
    };

    if (response_format) {
      body.response_format = response_format;
    }

    if (stream) {
      body.stream = true;
      return this.streamComplete(body);
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new ProviderError(
        `OpenAI API error: ${error.error?.message || response.statusText}`,
        response.status,
        error
      );
    }

    const data = await response.json();
    return {
      content: data.choices[0].message.content,
      usage: data.usage
    };
  }

  async streamComplete(body) {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new ProviderError(
        `OpenAI API error: ${error.error?.message || response.statusText}`,
        response.status,
        error
      );
    }

    return {
      stream: this.parseSSEStream(response.body),
      usage: null // Usage comes at the end of stream
    };
  }

  async *parseSSEStream(body) {
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
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          
          const data = trimmed.slice(6);
          if (data === '[DONE]') return;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              yield {
                type: 'content',
                content: delta
              };
            }
            // Capture usage from the final chunk if available
            if (parsed.usage) {
              yield {
                type: 'usage',
                usage: parsed.usage
              };
            }
          } catch (e) {
            // Skip malformed JSON chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

export class ProviderError extends Error {
  constructor(message, status, raw) {
    super(message);
    this.name = 'ProviderError';
    this.status = status;
    this.raw = raw;
  }
}
