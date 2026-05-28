/**
 * LLM Adapter
 * High-level abstraction for multiple LLM providers with integrated rate limiting,
 * protocol normalization, and telemetry.
 */

export class LLMAdapter {
  constructor(config = {}) {
    this.providers = {};
    this.modelMap = {
      generation: null,
      analysis: null,
      summary: null
    };
    this.defaultProvider = null;
    this.requestLog = [];
    this.rateLimiter = new RateLimiter();

    if (config.providers) {
      for (const [name, providerConfig] of Object.entries(config.providers)) {
        this.addProvider(name, providerConfig);
      }
    }

    if (config.modelMap) {
      this.modelMap = { ...this.modelMap, ...config.modelMap };
    }
  }

  addProvider(name, config) {
    const { type, apiKey, baseUrl, models, defaultModel } = config;

    this.providers[name] = {
      type,
      apiKey,
      baseUrl: baseUrl || this.getDefaultBaseUrl(type),
      models: models || [],
      defaultModel
    };

    if (!this.defaultProvider) {
      this.defaultProvider = name;
    }
  }

  getDefaultBaseUrl(type) {
    switch (type) {
      case 'openai': return 'https://api.openai.com/v1';
      case 'anthropic': return 'https://api.anthropic.com/v1';
      case 'openrouter': return 'https://openrouter.ai/api/v1';
      case 'ollama': return 'http://127.0.0.1:11434/v1'; // Standardized to v1 for compatibility
      case 'custom': return null;
      default: return null;
    }
  }

  getModel(purpose) {
    if (this.modelMap[purpose]) return this.modelMap[purpose];
    const provider = this.providers[this.defaultProvider];
    return provider?.defaultModel || 'gpt-4o';
  }

  setModelForPurpose(purpose, model) {
    this.modelMap[purpose] = model;
  }

  async chat(messages, options = {}) {
    const {
      purpose = 'generation',
      temperature = 0.7,
      max_tokens = 4000,
      stream = false,
      response_format = null,
      provider: providerName = null
    } = options;

    const currentProviderName = providerName || this.defaultProvider;
    const provider = this.providers[currentProviderName];
    if (!provider) throw new Error(`LLM provider "${currentProviderName}" not configured`);

    const model = options.model || this.getModel(purpose);

    await this.rateLimiter.acquire(currentProviderName);

    const startTime = Date.now();

    try {
      let result;

      switch (provider.type) {
        case 'openai':
        case 'openrouter':
        case 'custom':
          result = await this.chatOpenAICompatible(provider, model, messages, {
            temperature, max_tokens, stream, response_format
          });
          break;
        case 'anthropic':
          result = await this.chatAnthropic(provider, model, messages, {
            temperature, max_tokens, stream
          });
          break;
        case 'ollama':
          // Attempting OpenAI compatible route first if using v1 endpoint, otherwise fallback to ollama native
          if (provider.baseUrl.includes('/v1')) {
            result = await this.chatOpenAICompatible(provider, model, messages, {
              temperature, max_tokens, stream, response_format
            });
          } else {
            result = await this.chatOllama(provider, model, messages, {
              temperature, max_tokens, stream
            });
          }
          break;
        default:
          throw new Error(`Unknown provider type: ${provider.type}`);
      }

      this.requestLog.push({
        timestamp: new Date().toISOString(),
        provider: currentProviderName,
        model,
        purpose,
        duration: Date.now() - startTime,
        inputTokens: result.usage?.prompt_tokens || 0,
        outputTokens: result.usage?.completion_tokens || 0,
        stream,
        ok: true
      });

      return result;
    } catch (error) {
      this.requestLog.push({
        timestamp: new Date().toISOString(),
        provider: currentProviderName,
        model,
        purpose,
        duration: Date.now() - startTime,
        error: error.message,
        stream,
        ok: false
      });
      throw error;
    }
  }

  async chatOpenAICompatible(provider, model, messages, options) {
    const { temperature, max_tokens, stream, response_format } = options;

    const body = {
      model,
      messages,
      temperature,
      max_tokens
    };

    if (response_format) {
      body.response_format = response_format;
    }

    if (stream) {
      return this.streamOpenAICompatible(provider, body);
    }

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`,
        ...(provider.type === 'openrouter' ? {
          'HTTP-Referer': 'https://proselab.app',
          'X-Title': 'ProseLab'
        } : {})
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`LLM API error ${response.status}: ${errorBody}`);
    }

    const data = await response.json();

    return {
      content: data.choices[0].message.content,
      usage: data.usage,
      model: data.model
    };
  }

  async streamOpenAICompatible(provider, body) {
    body.stream = true;
    body.stream_options = { include_usage: true };

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`LLM API error ${response.status}: ${errorBody}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    async function* generateChunks() {
      let buffer = '';
      let totalContent = '';
      let usage = null;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === 'data: [DONE]') continue;
            if (!trimmed.startsWith('data: ')) continue;

            try {
              const data = JSON.parse(trimmed.slice(6));
              const delta = data.choices?.[0]?.delta?.content;
              if (delta) {
                totalContent += delta;
                yield { type: 'content', content: delta };
              }
              if (data.usage) {
                usage = data.usage;
              }
            } catch (e) {
              // Skip malformed chunks
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      yield { type: 'usage', usage: usage || { prompt_tokens: 0, completion_tokens: 0 } };
      yield { type: 'done', content: totalContent };
    }

    return { stream: generateChunks() };
  }

  async chatAnthropic(provider, model, messages, options) {
    const { temperature, max_tokens, stream } = options;

    const systemMessage = messages.find(m => m.role === 'system');
    const nonSystemMessages = messages.filter(m => m.role !== 'system');

    const body = {
      model,
      max_tokens,
      temperature,
      messages: this.normalizeMessagesForAnthropic(nonSystemMessages)
    };

    if (systemMessage) {
      body.system = systemMessage.content;
    }

    if (stream) {
      return this.streamAnthropic(provider, body);
    }

    const response = await fetch(`${provider.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': provider.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${errorBody}`);
    }

    const data = await response.json();

    return {
      content: data.content[0].text,
      usage: {
        prompt_tokens: data.usage?.input_tokens || 0,
        completion_tokens: data.usage?.output_tokens || 0
      },
      model: data.model
    };
  }

  normalizeMessagesForAnthropic(messages) {
    const normalized = [];
    let lastRole = null;

    for (const msg of messages) {
      if (msg.role === lastRole) {
        normalized[normalized.length - 1].content += '\n\n' + msg.content;
      } else {
        normalized.push({ role: msg.role, content: msg.content });
        lastRole = msg.role;
      }
    }

    if (normalized.length > 0 && normalized[0].role !== 'user') {
      normalized.unshift({ role: 'user', content: 'Begin.' });
    }

    return normalized;
  }

  async streamAnthropic(provider, body) {
    body.stream = true;

    const response = await fetch(`${provider.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': provider.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${errorBody}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    async function* generateChunks() {
      let buffer = '';
      let totalContent = '';
      let usage = null;

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
              const data = JSON.parse(trimmed.slice(6));

              if (data.type === 'content_block_delta' && data.delta?.text) {
                totalContent += data.delta.text;
                yield { type: 'content', content: data.delta.text };
              } else if (data.type === 'message_delta' && data.usage) {
                usage = {
                  prompt_tokens: usage?.prompt_tokens || 0,
                  completion_tokens: data.usage.output_tokens || 0
                };
              } else if (data.type === 'message_start' && data.message?.usage) {
                usage = {
                  prompt_tokens: data.message.usage.input_tokens || 0,
                  completion_tokens: 0
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

      yield { type: 'usage', usage: usage || { prompt_tokens: 0, completion_tokens: 0 } };
      yield { type: 'done', content: totalContent };
    }

    return { stream: generateChunks() };
  }

  async chatOllama(provider, model, messages, options) {
    const { temperature, max_tokens, stream } = options;

    const body = {
      model,
      messages,
      options: {
        temperature,
        num_predict: max_tokens
      },
      stream: false
    };

    if (stream) {
      return this.streamOllama(provider, body);
    }

    const response = await fetch(`${provider.baseUrl}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Ollama API error ${response.status}: ${errorBody}`);
    }

    const data = await response.json();

    return {
      content: data.message.content,
      usage: {
        prompt_tokens: data.prompt_eval_count || 0,
        completion_tokens: data.eval_count || 0
      },
      model: data.model
    };
  }

  async streamOllama(provider, body) {
    body.stream = true;

    const response = await fetch(`${provider.baseUrl}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Ollama API error ${response.status}: ${errorBody}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    async function* generateChunks() {
      let buffer = '';
      let totalContent = '';
      let usage = null;

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
              const data = JSON.parse(line);

              if (data.message?.content) {
                totalContent += data.message.content;
                yield { type: 'content', content: data.message.content };
              }

              if (data.done) {
                usage = {
                  prompt_tokens: data.prompt_eval_count || 0,
                  completion_tokens: data.eval_count || 0
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

      yield { type: 'usage', usage: usage || { prompt_tokens: 0, completion_tokens: 0 } };
      yield { type: 'done', content: totalContent };
    }

    return { stream: generateChunks() };
  }

  getUsageStats() {
    const stats = {
      totalRequests: this.requestLog.length,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalDuration: 0,
      errors: 0,
      byPurpose: {},
      byProvider: {},
      byModel: {}
    };

    for (const entry of this.requestLog) {
      stats.totalInputTokens += entry.inputTokens || 0;
      stats.totalOutputTokens += entry.outputTokens || 0;
      stats.totalDuration += entry.duration || 0;
      if (!entry.ok) stats.errors++;

      // By purpose
      if (!stats.byPurpose[entry.purpose]) {
        stats.byPurpose[entry.purpose] = { requests: 0, tokens: 0 };
      }
      stats.byPurpose[entry.purpose].requests++;
      stats.byPurpose[entry.purpose].tokens += (entry.inputTokens || 0) + (entry.outputTokens || 0);

      // By provider
      if (!stats.byProvider[entry.provider]) {
        stats.byProvider[entry.provider] = { requests: 0, tokens: 0 };
      }
      stats.byProvider[entry.provider].requests++;
      stats.byProvider[entry.provider].tokens += (entry.inputTokens || 0) + (entry.outputTokens || 0);

      // By model
      if (!stats.byModel[entry.model]) {
        stats.byModel[entry.model] = { requests: 0, tokens: 0 };
      }
      stats.byModel[entry.model].requests++;
      stats.byModel[entry.model].tokens += (entry.inputTokens || 0) + (entry.outputTokens || 0);
    }

    return stats;
  }

  clearLog() {
    this.requestLog = [];
  }
}

class RateLimiter {
  constructor() {
    this.windows = {};
  }

  async acquire(provider) {
    if (!this.windows[provider]) {
      this.windows[provider] = {
        tokens: 10,
        maxTokens: 10,
        refillRate: 2, // tokens per second
        lastRefill: Date.now()
      };
    }

    const window = this.windows[provider];

    const now = Date.now();
    const elapsed = (now - window.lastRefill) / 1000;
    window.tokens = Math.min(window.maxTokens, window.tokens + elapsed * window.refillRate);
    window.lastRefill = now;

    if (window.tokens < 1) {
      const waitTime = ((1 - window.tokens) / window.refillRate) * 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      window.tokens = 0;
      window.lastRefill = Date.now();
    } else {
      window.tokens -= 1;
    }
  }
}
