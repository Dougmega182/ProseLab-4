/**
 * LLM Client
 * Abstraction layer supporting multiple providers (OpenAI, Anthropic, local/Ollama).
 * Features exponential backoff, protocol normalization, and unified streaming support.
 */

export class LLMClient {
  constructor(config = {}) {
    this.provider = config.provider || 'openai';
    this.apiKey = config.apiKey || '';
    this.baseUrl = config.baseUrl || '';
    this.model = config.model || 'gpt-4o';
    this.maxRetries = config.maxRetries || 3;
    this.timeout = config.timeout || 120000;

    // Model-specific defaults
    this.modelDefaults = {
      'gpt-4o': { contextWindow: 128000, maxOutput: 16384 },
      'gpt-4o-mini': { contextWindow: 128000, maxOutput: 16384 },
      'claude-sonnet-4-20250514': { contextWindow: 200000, maxOutput: 8192 },
      'claude-3-5-sonnet-20241022': { contextWindow: 200000, maxOutput: 8192 },
      'claude-3-haiku-20240307': { contextWindow: 200000, maxOutput: 4096 },
    };
  }

  getModelInfo() {
    return this.modelDefaults[this.model] || {
      contextWindow: 8000,
      maxOutput: 4096
    };
  }

  async chat(messages, options = {}) {
    const {
      temperature = 0.7,
      max_tokens,
      signal
    } = options;

    const modelInfo = this.getModelInfo();
    const resolvedMaxTokens = max_tokens || modelInfo.maxOutput;

    let lastError;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        switch (this.provider) {
          case 'openai':
            return await this.chatOpenAI(messages, {
              temperature,
              max_tokens: resolvedMaxTokens,
              signal
            });
          case 'anthropic':
            return await this.chatAnthropic(messages, {
              temperature,
              max_tokens: resolvedMaxTokens,
              signal
            });
          case 'ollama':
            return await this.chatOllama(messages, {
              temperature,
              max_tokens: resolvedMaxTokens,
              signal
            });
          case 'openai-compatible':
            return await this.chatOpenAI(messages, {
              temperature,
              max_tokens: resolvedMaxTokens,
              signal
            });
          default:
            throw new Error(`Unknown provider: ${this.provider}`);
        }
      } catch (error) {
        lastError = error;

        if (error.name === 'AbortError') throw error;

        // Don't retry on auth errors
        if (error.status === 401 || error.status === 403) throw error;

        // Don't retry on context length errors
        if (error.status === 400 && error.message?.includes('context')) throw error;

        // Wait before retrying with exponential backoff
        if (attempt < this.maxRetries - 1) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  async chatOpenAI(messages, options) {
    const url = this.baseUrl
      ? `${this.baseUrl}/v1/chat/completions`
      : 'https://api.openai.com/v1/chat/completions';

    const body = {
      model: this.model,
      messages,
      temperature: options.temperature,
      max_tokens: options.max_tokens
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(body),
      signal: options.signal
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      const error = new Error(`OpenAI API error: ${response.status} ${errorBody}`);
      error.status = response.status;
      throw error;
    }

    const data = await response.json();
    const choice = data.choices?.[0];

    return {
      content: choice?.message?.content || '',
      finishReason: choice?.finish_reason,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      },
      model: data.model
    };
  }

  async chatAnthropic(messages, options) {
    const url = this.baseUrl || 'https://api.anthropic.com/v1/messages';

    // Anthropic uses a different format — separate system from messages
    let systemPrompt = '';
    const anthropicMessages = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemPrompt += (systemPrompt ? '\n\n' : '') + msg.content;
      } else {
        anthropicMessages.push({
          role: msg.role,
          content: msg.content
        });
      }
    }

    // Ensure messages alternate properly for Anthropic
    const cleanedMessages = this.ensureAlternatingRoles(anthropicMessages);

    const body = {
      model: this.model,
      max_tokens: options.max_tokens,
      temperature: options.temperature,
      messages: cleanedMessages
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(body),
      signal: options.signal
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      const error = new Error(`Anthropic API error: ${response.status} ${errorBody}`);
      error.status = response.status;
      throw error;
    }

    const data = await response.json();

    return {
      content: data.content?.[0]?.text || '',
      finishReason: data.stop_reason,
      usage: {
        promptTokens: data.usage?.input_tokens || 0,
        completionTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
      },
      model: data.model
    };
  }

  async chatOllama(messages, options) {
    const url = this.baseUrl || 'http://127.0.0.1:11434';

    const body = {
      model: this.model,
      messages,
      stream: false,
      options: {
        temperature: options.temperature,
        num_predict: options.max_tokens
      }
    };

    const response = await fetch(`${url}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: options.signal
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      const error = new Error(`Ollama API error: ${response.status} ${errorBody}`);
      error.status = response.status;
      throw error;
    }

    const data = await response.json();

    return {
      content: data.message?.content || '',
      finishReason: data.done ? 'stop' : 'length',
      usage: {
        promptTokens: data.prompt_eval_count || 0,
        completionTokens: data.eval_count || 0,
        totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
      },
      model: data.model
    };
  }

  ensureAlternatingRoles(messages) {
    if (messages.length === 0) return messages;

    const cleaned = [];
    let lastRole = null;

    for (const msg of messages) {
      if (msg.role === lastRole) {
        // Merge consecutive same-role messages
        cleaned[cleaned.length - 1] = {
          ...cleaned[cleaned.length - 1],
          content: cleaned[cleaned.length - 1].content + '\n\n' + msg.content
        };
      } else {
        cleaned.push({ ...msg });
        lastRole = msg.role;
      }
    }

    // Anthropic requires first message to be user
    if (cleaned.length > 0 && cleaned[0].role !== 'user') {
      cleaned.unshift({ role: 'user', content: 'Please proceed.' });
    }

    return cleaned;
  }

  async chatStreaming(messages, options = {}, onChunk) {
    const {
      temperature = 0.7,
      max_tokens,
      signal
    } = options;

    const modelInfo = this.getModelInfo();
    const resolvedMaxTokens = max_tokens || modelInfo.maxOutput;

    switch (this.provider) {
      case 'openai':
      case 'openai-compatible':
        return await this.streamOpenAI(messages, {
          temperature,
          max_tokens: resolvedMaxTokens,
          signal
        }, onChunk);
      case 'anthropic':
        return await this.streamAnthropic(messages, {
          temperature,
          max_tokens: resolvedMaxTokens,
          signal
        }, onChunk);
      case 'ollama':
        return await this.streamOllama(messages, {
          temperature,
          max_tokens: resolvedMaxTokens,
          signal
        }, onChunk);
      default:
        // Fall back to non-streaming
        const result = await this.chat(messages, options);
        onChunk(result.content);
        return result;
    }
  }

  async streamOpenAI(messages, options, onChunk) {
    const url = this.baseUrl
      ? `${this.baseUrl}/v1/chat/completions`
      : 'https://api.openai.com/v1/chat/completions';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: options.temperature,
        max_tokens: options.max_tokens,
        stream: true
      }),
      signal: options.signal
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      const error = new Error(`OpenAI API error: ${response.status} ${errorBody}`);
      error.status = response.status;
      throw error;
    }

    let fullContent = '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
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
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            fullContent += delta;
            onChunk(delta);
          }
        } catch (e) {
          // Skip malformed chunks
        }
      }
    }

    return {
      content: fullContent,
      finishReason: 'stop',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      model: this.model
    };
  }

  async streamAnthropic(messages, options, onChunk) {
    const url = this.baseUrl || 'https://api.anthropic.com/v1/messages';

    let systemPrompt = '';
    const anthropicMessages = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemPrompt += (systemPrompt ? '\n\n' : '') + msg.content;
      } else {
        anthropicMessages.push({ role: msg.role, content: msg.content });
      }
    }

    const cleanedMessages = this.ensureAlternatingRoles(anthropicMessages);

    const body = {
      model: this.model,
      max_tokens: options.max_tokens,
      temperature: options.temperature,
      messages: cleanedMessages,
      stream: true
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(body),
      signal: options.signal
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      const error = new Error(`Anthropic API error: ${response.status} ${errorBody}`);
      error.status = response.status;
      throw error;
    }

    let fullContent = '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
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

        try {
          const parsed = JSON.parse(trimmed.slice(6));
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            fullContent += parsed.delta.text;
            onChunk(parsed.delta.text);
          }
        } catch (e) {
          // Skip malformed chunks
        }
      }
    }

    return {
      content: fullContent,
      finishReason: 'stop',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      model: this.model
    };
  }

  async streamOllama(messages, options, onChunk) {
    const url = this.baseUrl || 'http://127.0.0.1:11434';

    const response = await fetch(`${url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: true,
        options: {
          temperature: options.temperature,
          num_predict: options.max_tokens
        }
      }),
      signal: options.signal
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      const error = new Error(`Ollama API error: ${response.status} ${errorBody}`);
      error.status = response.status;
      throw error;
    }

    let fullContent = '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

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
            fullContent += parsed.message.content;
            onChunk(parsed.message.content);
          }
        } catch (e) {
          // Skip malformed lines
        }
      }
    }

    return {
      content: fullContent,
      finishReason: 'stop',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      model: this.model
    };
  }

  updateConfig(config) {
    if (config.provider !== undefined) this.provider = config.provider;
    if (config.apiKey !== undefined) this.apiKey = config.apiKey;
    if (config.baseUrl !== undefined) this.baseUrl = config.baseUrl;
    if (config.model !== undefined) this.model = config.model;
  }

  async testConnection() {
    try {
      const result = await this.chat([
        { role: 'user', content: 'Reply with exactly: CONNECTION_OK' }
      ], {
        temperature: 0,
        max_tokens: 20
      });

      return {
        success: result.content.includes('CONNECTION_OK'),
        model: result.model,
        message: result.content
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}
