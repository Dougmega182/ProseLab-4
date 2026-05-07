// src/llm/llmClients.js

export class LLMClientFactory {
  static create(provider, config) {
    switch (provider) {
      case 'openai':
        return new OpenAIClient(config);
      case 'anthropic':
        return new AnthropicClient(config);
      case 'google':
        return new GoogleAIClient(config);
      case 'openrouter':
        return new OpenRouterClient(config);
      case 'local':
        return new LocalLLMClient(config);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }
}

class BaseLLMClient {
  constructor(config) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl;
    this.model = config.model;
    this.defaultParams = {
      temperature: config.temperature ?? 0.7,
      max_tokens: config.maxOutputTokens ?? 4096,
    };
  }

  async chat(messages, params = {}) {
    throw new Error('chat() must be implemented by subclass');
  }

  async chatStream(messages, params = {}, onChunk) {
    throw new Error('chatStream() must be implemented by subclass');
  }

  mergeParams(params) {
    return { ...this.defaultParams, ...params };
  }

  async handleResponse(response) {
    if (!response.ok) {
      let errorBody;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = await response.text();
      }

      const message = errorBody?.error?.message
        || errorBody?.message
        || (typeof errorBody === 'string' ? errorBody : JSON.stringify(errorBody));

      const error = new Error(`LLM API Error (${response.status}): ${message}`);
      error.status = response.status;
      error.body = errorBody;

      if (response.status === 429) {
        error.retryable = true;
        error.retryAfter = parseInt(response.headers.get('retry-after') || '5', 10);
      }
      if (response.status >= 500) {
        error.retryable = true;
      }

      throw error;
    }
  }
}

class OpenAIClient extends BaseLLMClient {
  constructor(config) {
    super(config);
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    this.model = config.model || 'gpt-4o';
  }

  async chat(messages, params = {}) {
    const merged = this.mergeParams(params);

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: merged.temperature,
        max_tokens: merged.max_tokens,
        top_p: merged.top_p,
        frequency_penalty: merged.frequency_penalty,
        presence_penalty: merged.presence_penalty,
        stop: merged.stop,
      }),
    });

    await this.handleResponse(response);
    const data = await response.json();

    return {
      content: data.choices[0]?.message?.content || '',
      finishReason: data.choices[0]?.finish_reason,
      usage: {
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
        totalTokens: data.usage?.total_tokens,
      },
      raw: data,
    };
  }

  async chatStream(messages, params = {}, onChunk) {
    const merged = this.mergeParams(params);

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: merged.temperature,
        max_tokens: merged.max_tokens,
        top_p: merged.top_p,
        frequency_penalty: merged.frequency_penalty,
        presence_penalty: merged.presence_penalty,
        stop: merged.stop,
        stream: true,
      }),
    });

    await this.handleResponse(response);
    return this.processSSEStream(response.body, onChunk);
  }

  async processSSEStream(body, onChunk) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';

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
          if (data === '[DONE]') {
            onChunk({ done: true, content: fullContent });
            return { content: fullContent, finishReason: 'stop' };
          }

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content || '';
            const finishReason = parsed.choices?.[0]?.finish_reason;

            if (delta) {
              fullContent += delta;
              onChunk({ done: false, delta, content: fullContent });
            }

            if (finishReason) {
              onChunk({ done: true, content: fullContent, finishReason });
              return { content: fullContent, finishReason };
            }
          } catch (e) {
            // Skip malformed JSON lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    onChunk({ done: true, content: fullContent });
    return { content: fullContent, finishReason: 'stop' };
  }
}

class AnthropicClient extends BaseLLMClient {
  constructor(config) {
    super(config);
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com/v1';
    this.model = config.model || 'claude-sonnet-4-20250514';
    this.apiVersion = config.apiVersion || '2023-06-01';
  }

  async chat(messages, params = {}) {
    const merged = this.mergeParams(params);

    // Anthropic uses a separate system parameter
    const systemMessage = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');

    const body = {
      model: this.model,
      messages: chatMessages,
      max_tokens: merged.max_tokens,
      temperature: merged.temperature,
    };

    if (systemMessage) {
      body.system = systemMessage.content;
    }

    if (merged.stop) body.stop_sequences = Array.isArray(merged.stop) ? merged.stop : [merged.stop];
    if (merged.top_p) body.top_p = merged.top_p;

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': this.apiVersion,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });

    await this.handleResponse(response);
    const data = await response.json();

    const content = data.content
      ?.filter(block => block.type === 'text')
      .map(block => block.text)
      .join('') || '';

    return {
      content,
      finishReason: data.stop_reason,
      usage: {
        promptTokens: data.usage?.input_tokens,
        completionTokens: data.usage?.output_tokens,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      },
      raw: data,
    };
  }

  async chatStream(messages, params = {}, onChunk) {
    const merged = this.mergeParams(params);

    const systemMessage = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');

    const body = {
      model: this.model,
      messages: chatMessages,
      max_tokens: merged.max_tokens,
      temperature: merged.temperature,
      stream: true,
    };

    if (systemMessage) {
      body.system = systemMessage.content;
    }

    if (merged.stop) body.stop_sequences = Array.isArray(merged.stop) ? merged.stop : [merged.stop];

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': this.apiVersion,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });

    await this.handleResponse(response);
    return this.processAnthropicStream(response.body, onChunk);
  }

  async processAnthropicStream(body, onChunk) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';

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

          try {
            const parsed = JSON.parse(data);

            if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
              const delta = parsed.delta.text || '';
              fullContent += delta;
              onChunk({ done: false, delta, content: fullContent });
            }

            if (parsed.type === 'message_stop') {
              onChunk({ done: true, content: fullContent, finishReason: 'stop' });
              return { content: fullContent, finishReason: 'stop' };
            }

            if (parsed.type === 'message_delta' && parsed.delta?.stop_reason) {
              onChunk({ done: true, content: fullContent, finishReason: parsed.delta.stop_reason });
              return { content: fullContent, finishReason: parsed.delta.stop_reason };
            }
          } catch (e) {
            // Skip malformed lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    onChunk({ done: true, content: fullContent });
    return { content: fullContent, finishReason: 'stop' };
  }
}

class GoogleAIClient extends BaseLLMClient {
  constructor(config) {
    super(config);
    this.baseUrl = config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
    this.model = config.model || 'gemini-2.5-flash';
  }

  async chat(messages, params = {}) {
    const merged = this.mergeParams(params);

    // Convert from OpenAI message format to Google's format
    const systemInstruction = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');

    const contents = chatMessages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    const body = {
      contents,
      generationConfig: {
        temperature: merged.temperature,
        maxOutputTokens: merged.max_tokens,
        topP: merged.top_p,
        stopSequences: merged.stop ? (Array.isArray(merged.stop) ? merged.stop : [merged.stop]) : undefined,
      },
    };

    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction.content }] };
    }

    const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify(body),
    });

    await this.handleResponse(response);
    const data = await response.json();

    const content = data.candidates?.[0]?.content?.parts
      ?.map(p => p.text)
      .join('') || '';

    return {
      content,
      finishReason: data.candidates?.[0]?.finishReason,
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount,
        completionTokens: data.usageMetadata?.candidatesTokenCount,
        totalTokens: data.usageMetadata?.totalTokenCount,
      },
      raw: data,
    };
  }

  async chatStream(messages, params = {}, onChunk) {
    const merged = this.mergeParams(params);

    const systemInstruction = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');

    const contents = chatMessages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    const body = {
      contents,
      generationConfig: {
        temperature: merged.temperature,
        maxOutputTokens: merged.max_tokens,
        topP: merged.top_p,
      },
    };

    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction.content }] };
    }

    const url = `${this.baseUrl}/models/${this.model}:streamGenerateContent?alt=sse&key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    await this.handleResponse(response);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';

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

          try {
            const parsed = JSON.parse(data);
            const text = parsed.candidates?.[0]?.content?.parts
              ?.map(p => p.text)
              .join('') || '';

            if (text) {
              fullContent += text;
              onChunk({ done: false, delta: text, content: fullContent });
            }

            const finishReason = parsed.candidates?.[0]?.finishReason;
            if (finishReason && finishReason !== 'STOP') {
              // Still streaming
            }
          } catch (e) {
            // Skip malformed lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    onChunk({ done: true, content: fullContent });
    return { content: fullContent, finishReason: 'stop' };
  }
}

class OpenRouterClient extends BaseLLMClient {
  constructor(config) {
    super(config);
    this.baseUrl = config.baseUrl || 'https://openrouter.ai/api/v1';
    this.model = config.model || 'anthropic/claude-sonnet-4-20250514';
    this.siteUrl = config.siteUrl || '';
    this.siteName = config.siteName || 'Quill';
  }

  async chat(messages, params = {}) {
    const merged = this.mergeParams(params);

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };

    if (this.siteUrl) headers['HTTP-Referer'] = this.siteUrl;
    if (this.siteName) headers['X-Title'] = this.siteName;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: merged.temperature,
        max_tokens: merged.max_tokens,
        top_p: merged.top_p,
        frequency_penalty: merged.frequency_penalty,
        presence_penalty: merged.presence_penalty,
        stop: merged.stop,
      }),
    });

    await this.handleResponse(response);
    const data = await response.json();

    return {
      content: data.choices[0]?.message?.content || '',
      finishReason: data.choices[0]?.finish_reason,
      usage: {
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
        totalTokens: data.usage?.total_tokens,
      },
      raw: data,
    };
  }

  async chatStream(messages, params = {}, onChunk) {
    const merged = this.mergeParams(params);

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };

    if (this.siteUrl) headers['HTTP-Referer'] = this.siteUrl;
    if (this.siteName) headers['X-Title'] = this.siteName;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: merged.temperature,
        max_tokens: merged.max_tokens,
        top_p: merged.top_p,
        frequency_penalty: merged.frequency_penalty,
        presence_penalty: merged.presence_penalty,
        stop: merged.stop,
        stream: true,
      }),
    });

    await this.handleResponse(response);
    // OpenRouter uses the same SSE format as OpenAI
    return OpenAIClient.prototype.processSSEStream.call(this, response.body, onChunk);
  }
}

class LocalLLMClient extends BaseLLMClient {
  constructor(config) {
    super(config);
    this.baseUrl = config.baseUrl || 'http://localhost:1234/v1';
    this.model = config.model || 'local-model';
  }

  async chat(messages, params = {}) {
    const merged = this.mergeParams(params);

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: merged.temperature,
        max_tokens: merged.max_tokens,
        top_p: merged.top_p,
        stop: merged.stop,
      }),
    });

    await this.handleResponse(response);
    const data = await response.json();

    return {
      content: data.choices[0]?.message?.content || '',
      finishReason: data.choices[0]?.finish_reason,
      usage: {
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
        totalTokens: data.usage?.total_tokens,
      },
      raw: data,
    };
  }

  async chatStream(messages, params = {}, onChunk) {
    const merged = this.mergeParams(params);

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: merged.temperature,
        max_tokens: merged.max_tokens,
        top_p: merged.top_p,
        stop: merged.stop,
        stream: true,
      }),
    });

    await this.handleResponse(response);
    return OpenAIClient.prototype.processSSEStream.call(this, response.body, onChunk);
  }
}
