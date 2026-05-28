/**
 * LLM Provider Abstraction Layer
 * Handles routing, rate limiting, and standardizing responses across different LLM APIs.
 */

class RateLimiter {
  constructor() {
    this.queues = {};
    this.lastCall = {};
    this.minInterval = {
      openai: 100,      // 10 req/s
      anthropic: 200,    // 5 req/s
      openrouter: 100,
      ollama: 50
    };
  }

  async acquire(provider) {
    const interval = this.minInterval[provider] || 100;
    const now = Date.now();
    const last = this.lastCall[provider] || 0;
    const wait = Math.max(0, interval - (now - last));

    if (wait > 0) {
      await new Promise(resolve => setTimeout(resolve, wait));
    }

    this.lastCall[provider] = Date.now();
  }
}

export class LLMProvider {
  constructor(config = {}) {
    this.config = config;
    this.modelAssignments = config.modelAssignments || {};
    this.providers = {};
    this.rateLimiter = new RateLimiter();
    
    // Auto-configure from common env vars if present
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      if (import.meta.env.VITE_OPENAI_KEY) this.configure('openai', import.meta.env.VITE_OPENAI_KEY);
      if (import.meta.env.VITE_ANTHROPIC_KEY) this.configure('anthropic', import.meta.env.VITE_ANTHROPIC_KEY);
      if (import.meta.env.VITE_OLLAMA_URL) {
        this.configure('ollama', 'local', { baseUrl: import.meta.env.VITE_OLLAMA_URL });
      } else {
        this.configure('ollama', 'local', { baseUrl: 'http://127.0.0.1:11434' });
      }
    }
  }

  configure(providerName, apiKey, options = {}) {
    this.providers[providerName] = {
      apiKey,
      baseUrl: options.baseUrl || this.getDefaultBaseUrl(providerName),
      options
    };
  }

  getDefaultBaseUrl(provider) {
    switch (provider) {
      case 'openai': return 'https://api.openai.com/v1';
      case 'anthropic': return 'https://api.anthropic.com/v1';
      case 'openrouter': return 'https://openrouter.ai/api/v1';
      case 'ollama': return 'http://127.0.0.1:11434';
      default: return '';
    }
  }

  getModel(role) {
    // Role: generation, validation, critique, extraction, analysis, utility
    return this.modelAssignments[role] || this.modelAssignments.default || 'gpt-4o';
  }

  setModelAssignment(role, model) {
    this.modelAssignments[role] = model;
  }

  detectProvider(model) {
    if (model.startsWith('claude')) return 'anthropic';
    if (model.startsWith('gpt') || model.startsWith('o1') || model.startsWith('o3')) return 'openai';
    if (model.includes(':')) return 'ollama'; // Likely an Ollama model tag
    // Default to openrouter for unknown models
    if (this.providers.openrouter) return 'openrouter';
    return 'openai';
  }

  async callLLM(params) {
    const { model, messages, temperature, max_tokens, stream, response_format } = params;
    const providerName = this.detectProvider(model);
    const provider = this.providers[providerName];

    if (!provider) {
      throw new Error(`No API key configured for provider: ${providerName}. Configure it in Settings.`);
    }

    await this.rateLimiter.acquire(providerName);

    const startTime = Date.now();

    try {
      let response;
      switch (providerName) {
        case 'anthropic':
          response = await this.callAnthropic(provider, model, messages, { temperature, max_tokens, stream });
          break;
        case 'openai':
        case 'openrouter':
          response = await this.callOpenAI(provider, model, messages, { temperature, max_tokens, stream, response_format });
          break;
        case 'ollama':
          response = await this.callOllama(provider, model, messages, { temperature, max_tokens, stream });
          break;
        default:
          throw new Error(`Unsupported provider: ${providerName}`);
      }

      const elapsed = Date.now() - startTime;
      response.usage = {
        ...response.usage,
        model,
        elapsed,
        ok: true
      };
      response.ok = true;

      return response;
    } catch (error) {
      if (error.status === 429) {
        // Rate limited — wait and retry
        const retryAfter = parseInt(error.headers?.['retry-after'] || '5', 10);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        return this.callLLM(params);
      }
      console.error(`LLM Call Error (${providerName}):`, error);
      return {
        ok: false,
        error: error.message,
        content: '',
        usage: { model, elapsed: Date.now() - startTime }
      };
    }
  }

  async callOpenAI(provider, model, messages, options) {
    const body = {
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 4096
    };

    if (options.response_format) {
      body.response_format = options.response_format;
    }

    if (options.stream) {
      return this.streamOpenAI(provider, body);
    }

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`,
        ...(provider.options.headers || {})
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      const err = new Error(error.error?.message || `OpenAI API error: ${response.status}`);
      err.status = response.status;
      throw err;
    }

    const data = await response.json();
    return {
      content: data.choices[0].message.content,
      usage: {
        input_tokens: data.usage?.prompt_tokens || 0,
        output_tokens: data.usage?.completion_tokens || 0
      }
    };
  }

  async streamOpenAI(provider, body) {
    body.stream = true;

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`,
        ...(provider.options.headers || {})
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      const err = new Error(error.error?.message || `OpenAI API error: ${response.status}`);
      err.status = response.status;
      throw err;
    }

    return {
      stream: this.parseSSEStream(response.body),
      usage: { input_tokens: 0, output_tokens: 0 }
    };
  }

  async callAnthropic(provider, model, messages, options) {
    const systemMessage = messages.find(m => m.role === 'system');
    const nonSystemMessages = messages.filter(m => m.role !== 'system');

    const body = {
      model,
      max_tokens: options.max_tokens ?? 4096,
      messages: nonSystemMessages
    };

    if (systemMessage) {
      body.system = systemMessage.content;
    }

    if (options.temperature !== undefined) {
      body.temperature = options.temperature;
    }

    if (options.stream) {
      body.stream = true;
    }

    const response = await fetch(`${provider.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': provider.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        ...(provider.options.headers || {})
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      const err = new Error(error.error?.message || `Anthropic API error: ${response.status}`);
      err.status = response.status;
      throw err;
    }

    if (options.stream) {
      return {
        stream: this.parseAnthropicStream(response.body),
        usage: { input_tokens: 0, output_tokens: 0 }
      };
    }

    const data = await response.json();
    return {
      content: data.content[0].text,
      usage: {
        input_tokens: data.usage?.input_tokens || 0,
        output_tokens: data.usage?.output_tokens || 0
      }
    };
  }

  async callOllama(provider, model, messages, options) {
    const body = {
      model,
      messages,
      options: {
        temperature: options.temperature ?? 0.8,
        num_predict: options.max_tokens ?? 4096
      },
      stream: !!options.stream
    };

    const response = await fetch(`${provider.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.statusText}`);
    }

    if (options.stream) {
      return {
        stream: this.parseOllamaStream(response.body),
        usage: { input_tokens: 0, output_tokens: 0 }
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
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') return;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                yield { type: 'content', content };
              }
              if (parsed.usage) {
                yield { type: 'usage', usage: parsed.usage };
              }
            } catch (e) {
              // Skip unparseable lines
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
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
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                yield { type: 'content', content: parsed.delta.text };
              }
              if (parsed.type === 'message_delta' && parsed.usage) {
                yield { type: 'usage', usage: parsed.usage };
              }
              if (parsed.type === 'message_start' && parsed.message?.usage) {
                yield { type: 'usage', usage: parsed.message.usage };
              }
            } catch (e) {
              // Skip
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
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
            if (parsed.done) {
              yield {
                type: 'usage',
                usage: {
                  input_tokens: parsed.prompt_eval_count || 0,
                  output_tokens: parsed.eval_count || 0
                }
              };
            }
          } catch (e) {
            // Skip
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async collectStream(streamResult) {
    let fullContent = '';
    let usage = streamResult.usage || {};

    for await (const chunk of streamResult.stream) {
      if (chunk.type === 'content') {
        fullContent += chunk.content;
      }
      if (chunk.type === 'usage') {
        usage = { ...usage, ...chunk.usage };
      }
    }

    return {
      content: fullContent,
      usage,
      ok: true
    };
  }
}
