/**
 * LLM Adapter
 * Abstraction layer over different LLM providers with streaming support,
 * integrated rate limiting, and protocol normalization.
 */

export class LLMAdapter {
  constructor(config = {}) {
    this.provider = config.provider || 'openai';
    this.apiKey = config.apiKey || '';
    this.baseUrl = config.baseUrl || '';
    this.model = config.model || 'gpt-4o';
    this.defaultMaxTokens = config.defaultMaxTokens || 4000;

    // Per-purpose model overrides (use cheaper models for utility tasks)
    this.modelOverrides = config.modelOverrides || {
      generation: null,        // use default
      summarization: null,     // could use a cheaper model
      voice_analysis: null,
      entity_tracking: null,
      brainstorming: null
    };

    // Rate limiting
    this.requestQueue = [];
    this.activeRequests = 0;
    this.maxConcurrent = config.maxConcurrent || 3;
    this.requestsThisMinute = 0;
    this.maxRequestsPerMinute = config.maxRequestsPerMinute || 30;

    this.resetRateCounter();
  }

  resetRateCounter() {
    setInterval(() => {
      this.requestsThisMinute = 0;
    }, 60000);
  }

  getModelForPurpose(purpose) {
    return (this.modelOverrides && this.modelOverrides[purpose]) || this.model;
  }

  async chat(messages, options = {}) {
    const {
      purpose = 'generation',
      temperature = 0.7,
      max_tokens = this.defaultMaxTokens,
      stream = false,
      stop = null
    } = options;

    const model = this.getModelForPurpose(purpose);

    // Wait for rate limit clearance
    await this.waitForSlot();

    const requestBody = {
      model,
      messages,
      temperature,
      max_tokens,
      stream
    };

    if (stop) requestBody.stop = stop;

    const endpoint = this.getEndpoint();
    const headers = this.getHeaders();

    this.activeRequests++;
    this.requestsThisMinute++;

    try {
      if (stream) {
        return await this.streamRequest(endpoint, headers, requestBody);
      } else {
        return await this.blockRequest(endpoint, headers, requestBody);
      }
    } finally {
      this.activeRequests--;
      this.processQueue();
    }
  }

  async waitForSlot() {
    if (this.activeRequests < this.maxConcurrent && this.requestsThisMinute < this.maxRequestsPerMinute) {
      return;
    }

    return new Promise(resolve => {
      this.requestQueue.push(resolve);
    });
  }

  processQueue() {
    while (
      this.requestQueue.length > 0 &&
      this.activeRequests < this.maxConcurrent &&
      this.requestsThisMinute < this.maxRequestsPerMinute
    ) {
      const next = this.requestQueue.shift();
      next();
    }
  }

  getEndpoint() {
    switch (this.provider) {
      case 'openai':
        return (this.baseUrl || 'https://api.openai.com/v1') + '/chat/completions';
      case 'anthropic':
        return (this.baseUrl || 'https://api.anthropic.com/v1') + '/messages';
      case 'openrouter':
        return (this.baseUrl || 'https://openrouter.ai/api/v1') + '/chat/completions';
      case 'local':
        return (this.baseUrl || 'http://localhost:1234/v1') + '/chat/completions';
      default:
        // Assume OpenAI-compatible
        return (this.baseUrl || 'https://api.openai.com/v1') + '/chat/completions';
    }
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };

    switch (this.provider) {
      case 'anthropic':
        headers['x-api-key'] = this.apiKey;
        headers['anthropic-version'] = '2023-06-01';
        headers['anthropic-dangerous-direct-browser-access'] = 'true';
        break;
      case 'openrouter':
        headers['Authorization'] = `Bearer ${this.apiKey}`;
        headers['HTTP-Referer'] = window.location.origin;
        headers['X-Title'] = 'ProseLab';
        break;
      default:
        headers['Authorization'] = `Bearer ${this.apiKey}`;
        break;
    }

    return headers;
  }

  async blockRequest(endpoint, headers, body) {
    if (this.provider === 'anthropic') {
      return this.blockRequestAnthropic(endpoint, headers, body);
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new LLMError(`LLM request failed: ${response.status}`, response.status, errorBody);
    }

    const data = await response.json();

    return {
      content: data.choices[0].message.content,
      usage: data.usage,
      model: data.model,
      finishReason: data.choices[0].finish_reason
    };
  }

  async blockRequestAnthropic(endpoint, headers, body) {
    const anthropicBody = this.convertToAnthropicFormat(body);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(anthropicBody)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new LLMError(`Anthropic request failed: ${response.status}`, response.status, errorBody);
    }

    const data = await response.json();

    return {
      content: data.content[0].text,
      usage: {
        prompt_tokens: data.usage.input_tokens,
        completion_tokens: data.usage.output_tokens,
        total_tokens: data.usage.input_tokens + data.usage.output_tokens
      },
      model: data.model,
      finishReason: data.stop_reason
    };
  }

  convertToAnthropicFormat(body) {
    const messages = [...body.messages];
    let system = '';

    // Extract system message
    if (messages.length > 0 && messages[0].role === 'system') {
      system = messages.shift().content;
    }

    const anthropicBody = {
      model: body.model,
      messages,
      max_tokens: body.max_tokens || 4000,
      temperature: body.temperature
    };

    if (system) {
      anthropicBody.system = system;
    }

    if (body.stream) {
      anthropicBody.stream = true;
    }

    if (body.stop) {
      anthropicBody.stop_sequences = Array.isArray(body.stop) ? body.stop : [body.stop];
    }

    return anthropicBody;
  }

  async streamRequest(endpoint, headers, body) {
    if (this.provider === 'anthropic') {
      return this.streamRequestAnthropic(endpoint, headers, body);
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new LLMError(`LLM stream request failed: ${response.status}`, response.status, errorBody);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    const stream = this.createOpenAIStream(reader, decoder);

    return { stream };
  }

  async *createOpenAIStream(reader, decoder) {
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

            const finishReason = parsed.choices?.[0]?.finish_reason;
            if (finishReason) {
              yield {
                type: 'finish',
                finishReason,
                usage: parsed.usage || null
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

  async streamRequestAnthropic(endpoint, headers, body) {
    const anthropicBody = this.convertToAnthropicFormat(body);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(anthropicBody)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new LLMError(`Anthropic stream request failed: ${response.status}`, response.status, errorBody);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    const stream = this.createAnthropicStream(reader, decoder);

    return { stream };
  }

  async *createAnthropicStream(reader, decoder) {
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

          try {
            const parsed = JSON.parse(trimmed.slice(6));

            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              yield {
                type: 'content',
                content: parsed.delta.text
              };
            }

            if (parsed.type === 'message_stop') {
              yield {
                type: 'finish',
                finishReason: 'end_turn',
                usage: null
              };
            }

            if (parsed.type === 'message_delta' && parsed.usage) {
              yield {
                type: 'usage',
                usage: {
                  prompt_tokens: parsed.usage.input_tokens,
                  completion_tokens: parsed.usage.output_tokens,
                  total_tokens: (parsed.usage.input_tokens || 0) + (parsed.usage.output_tokens || 0)
                }
              };
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

  updateConfig(config) {
    if (config.provider !== undefined) this.provider = config.provider;
    if (config.apiKey !== undefined) this.apiKey = config.apiKey;
    if (config.baseUrl !== undefined) this.baseUrl = config.baseUrl;
    if (config.model !== undefined) this.model = config.model;
    if (config.modelOverrides !== undefined) this.modelOverrides = config.modelOverrides;
    if (config.maxConcurrent !== undefined) this.maxConcurrent = config.maxConcurrent;
    if (config.maxRequestsPerMinute !== undefined) this.maxRequestsPerMinute = config.maxRequestsPerMinute;
  }

  async testConnection() {
    try {
      const result = await this.chat([
        { role: 'user', content: 'Reply with exactly: CONNECTION_OK' }
      ], {
        purpose: 'generation',
        temperature: 0,
        max_tokens: 20
      });

      return {
        success: true,
        model: result.model,
        content: result.content
      };
    } catch (e) {
      return {
        success: false,
        error: e.message
      };
    }
  }
}

export class LLMError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'LLMError';
    this.status = status;
    this.body = body;
  }
}
