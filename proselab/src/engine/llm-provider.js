/**
 * LLM Provider Abstraction Layer
 * Handles routing, protocol normalization, and telemetry across multiple AI backends.
 */

export class LLMProvider {
  constructor(config = {}) {
    this.providers = {};
    this.defaultProvider = config.defaultProvider || 'openai';
    this.modelMap = config.modelMap || {
      generation: 'gpt-4o',
      analysis: 'gpt-4o-mini',
      utility: 'gpt-4o-mini'
    };
    this.apiKeys = config.apiKeys || {};
    this.baseUrls = config.baseUrls || {};
    this.requestLog = [];
    
    // Auto-configure from env if available
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      this.apiKeys.openai = import.meta.env.VITE_OPENAI_KEY;
      this.apiKeys.anthropic = import.meta.env.VITE_ANTHROPIC_KEY;
      this.apiKeys.google = import.meta.env.VITE_GEMINI_KEY;
      this.baseUrls.custom = import.meta.env.VITE_OLLAMA_URL || 'http://127.0.0.1:11434/v1';
    }
  }

  configure(providerName, config) {
    this.providers[providerName] = config;
    if (config.apiKey) this.apiKeys[providerName] = config.apiKey;
    if (config.baseUrl) this.baseUrls[providerName] = config.baseUrl;
    if (config.models) {
      Object.assign(this.modelMap, config.models);
    }
  }

  getModel(purpose) {
    return this.modelMap[purpose] || this.modelMap.generation;
  }

  detectProvider(model) {
    const m = model.toLowerCase();
    if (m.startsWith('gpt-') || m.startsWith('o1') || m.startsWith('o3')) return 'openai';
    if (m.startsWith('claude-')) return 'anthropic';
    if (m.startsWith('gemini-')) return 'google';
    if (m.includes(':')) return 'custom'; // Ollama or tagged models
    if (this.baseUrls.custom) return 'custom';
    return this.defaultProvider;
  }

  async callLLM(options) {
    const {
      model,
      messages,
      temperature = 0.7,
      max_tokens = 4000,
      stream = false,
      response_format,
      stop
    } = options;

    const provider = this.detectProvider(model);
    const startTime = Date.now();

    let result;

    try {
      switch (provider) {
        case 'openai':
          result = await this.callOpenAI(model, messages, { temperature, max_tokens, stream, response_format, stop });
          break;
        case 'anthropic':
          result = await this.callAnthropic(model, messages, { temperature, max_tokens, stream, stop });
          break;
        case 'google':
          result = await this.callGoogle(model, messages, { temperature, max_tokens, stream, stop });
          break;
        case 'custom':
          result = await this.callOpenAICompatible(model, messages, { temperature, max_tokens, stream, response_format, stop });
          break;
        default:
          throw new Error(`Unknown provider: ${provider}`);
      }

      // Log the request
      this.requestLog.push({
        model,
        provider,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        inputTokens: result.usage?.prompt_tokens,
        outputTokens: result.usage?.completion_tokens,
        stream,
        ok: true
      });

      // Keep log bounded
      if (this.requestLog.length > 1000) {
        this.requestLog = this.requestLog.slice(-500);
      }

      result.ok = true;
      return result;

    } catch (error) {
      console.error(`LLM Provider Error (${provider}):`, error);
      this.requestLog.push({
        model,
        provider,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        error: error.message,
        ok: false
      });
      return { ok: false, error: error.message };
    }
  }

  async callOpenAI(model, messages, options) {
    const apiKey = this.apiKeys.openai;
    if (!apiKey) throw new Error('OpenAI API key not configured');

    const baseUrl = this.baseUrls.openai || 'https://api.openai.com/v1';

    const body = {
      model,
      messages,
      temperature: options.temperature,
      max_tokens: options.max_tokens
    };

    if (options.response_format) body.response_format = options.response_format;
    if (options.stop) body.stop = options.stop;

    if (options.stream) {
      body.stream = true;
      body.stream_options = { include_usage: true };

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
        throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
      }

      return {
        stream: this.createSSEStream(response.body),
        usage: null
      };
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();

    return {
      content: data.choices[0].message.content,
      usage: data.usage,
      finishReason: data.choices[0].finish_reason
    };
  }

  async callAnthropic(model, messages, options) {
    const apiKey = this.apiKeys.anthropic;
    if (!apiKey) throw new Error('Anthropic API key not configured');

    const baseUrl = this.baseUrls.anthropic || 'https://api.anthropic.com/v1';

    const systemMessage = messages.find(m => m.role === 'system');
    const nonSystemMessages = messages.filter(m => m.role !== 'system');

    const anthropicMessages = this.normalizeMessagesForAnthropic(nonSystemMessages);

    const body = {
      model,
      max_tokens: options.max_tokens,
      temperature: options.temperature,
      messages: anthropicMessages
    };

    if (systemMessage) {
      body.system = systemMessage.content;
    }

    if (options.stop) body.stop_sequences = Array.isArray(options.stop) ? options.stop : [options.stop];

    if (options.stream) {
      body.stream = true;

      const response = await fetch(`${baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
        throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`);
      }

      return {
        stream: this.createAnthropicStream(response.body),
        usage: null
      };
    }

    const response = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();

    return {
      content: data.content[0].text,
      usage: {
        prompt_tokens: data.usage.input_tokens,
        completion_tokens: data.usage.output_tokens,
        total_tokens: data.usage.input_tokens + data.usage.output_tokens
      },
      finishReason: data.stop_reason
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

  async callGoogle(model, messages, options) {
    const apiKey = this.apiKeys.google;
    if (!apiKey) throw new Error('Google AI API key not configured');

    const systemMessage = messages.find(m => m.role === 'system');
    const nonSystemMessages = messages.filter(m => m.role !== 'system');

    const contents = nonSystemMessages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const body = {
      contents,
      generationConfig: {
        temperature: options.temperature,
        maxOutputTokens: options.max_tokens
      }
    };

    if (systemMessage) {
      body.systemInstruction = { parts: [{ text: systemMessage.content }] };
    }

    if (options.stop) {
      body.generationConfig.stopSequences = Array.isArray(options.stop) ? options.stop : [options.stop];
    }

    const endpoint = options.stream ? 'streamGenerateContent' : 'generateContent';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${endpoint}?key=${apiKey}`;

    const response = await fetch(options.stream ? `${url}&alt=sse` : url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(`Google AI API error: ${error.error?.message || response.statusText}`);
    }

    if (options.stream) {
      return {
        stream: this.createGoogleStream(response.body),
        usage: null
      };
    }

    const data = await response.json();

    return {
      content: data.candidates[0].content.parts[0].text,
      usage: {
        prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
        completion_tokens: data.usageMetadata?.candidatesTokenCount || 0,
        total_tokens: data.usageMetadata?.totalTokenCount || 0
      },
      finishReason: data.candidates[0].finishReason
    };
  }

  async callOpenAICompatible(model, messages, options) {
    const apiKey = this.apiKeys.custom || 'not-needed';
    const baseUrl = this.baseUrls.custom;
    if (!baseUrl) throw new Error('Custom provider base URL not configured');

    const body = {
      model,
      messages,
      temperature: options.temperature,
      max_tokens: options.max_tokens
    };

    if (options.response_format) body.response_format = options.response_format;
    if (options.stop) body.stop = options.stop;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(`API error: ${error.error?.message || response.statusText}`);
    }

    if (options.stream) {
      return {
        stream: this.createSSEStream(response.body),
        usage: null
      };
    }

    const data = await response.json();

    return {
      content: data.choices[0].message.content,
      usage: data.usage,
      finishReason: data.choices[0].finish_reason
    };
  }

  // --- Streaming helpers ---

  async *createSSEStream(body) {
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
            if (delta) yield { type: 'content', content: delta };

            if (parsed.usage) yield { type: 'usage', usage: parsed.usage };

            if (parsed.choices?.[0]?.finish_reason) yield { type: 'finish', reason: parsed.choices[0].finish_reason };
          } catch (e) {
            // Skip unparseable lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async *createAnthropicStream(body) {
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

          try {
            const parsed = JSON.parse(trimmed.slice(6));
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              yield { type: 'content', content: parsed.delta.text };
            }
            if (parsed.type === 'message_delta' && parsed.usage) {
              yield {
                type: 'usage',
                usage: {
                  prompt_tokens: parsed.usage.input_tokens,
                  completion_tokens: parsed.usage.output_tokens
                }
              };
            }
            if (parsed.type === 'message_stop') yield { type: 'finish', reason: 'stop' };
          } catch (e) {
            // Skip unparseable lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async *createGoogleStream(body) {
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

          try {
            const parsed = JSON.parse(trimmed.slice(6));
            const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) yield { type: 'content', content: text };

            if (parsed.usageMetadata) {
              yield {
                type: 'usage',
                usage: {
                  prompt_tokens: parsed.usageMetadata.promptTokenCount || 0,
                  completion_tokens: parsed.usageMetadata.candidatesTokenCount || 0
                }
              };
            }
            if (parsed.candidates?.[0]?.finishReason) yield { type: 'finish', reason: parsed.candidates[0].finishReason };
          } catch (e) {
            // Skip unparseable lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  getUsageStats() {
    const stats = {
      totalRequests: this.requestLog.length,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      avgDuration: 0,
      byModel: {},
      byProvider: {}
    };

    let totalDuration = 0;

    for (const entry of this.requestLog) {
      if (!entry.ok) continue;
      stats.totalInputTokens += entry.inputTokens || 0;
      stats.totalOutputTokens += entry.outputTokens || 0;
      totalDuration += entry.duration || 0;

      if (!stats.byModel[entry.model]) {
        stats.byModel[entry.model] = { requests: 0, inputTokens: 0, outputTokens: 0 };
      }
      stats.byModel[entry.model].requests++;
      stats.byModel[entry.model].inputTokens += entry.inputTokens || 0;
      stats.byModel[entry.model].outputTokens += entry.outputTokens || 0;

      if (!stats.byProvider[entry.provider]) {
        stats.byProvider[entry.provider] = { requests: 0, inputTokens: 0, outputTokens: 0 };
      }
      stats.byProvider[entry.provider].requests++;
      stats.byProvider[entry.provider].inputTokens += entry.inputTokens || 0;
      stats.byProvider[entry.provider].outputTokens += entry.outputTokens || 0;
    }

    stats.avgDuration = stats.totalRequests > 0 ? totalDuration / stats.totalRequests : 0;

    return stats;
  }
}
