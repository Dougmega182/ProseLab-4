// src/llm/clients/base.js

export class BaseLLMClient {
  constructor(config = {}) {
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.baseURL = config.baseURL;
    this.defaultParams = {
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 2048,
      topP: config.topP ?? 1,
      frequencyPenalty: config.frequencyPenalty ?? 0,
      presencePenalty: config.presencePenalty ?? 0,
    };
  }

  async chat(messages, params = {}) {
    throw new Error('chat() must be implemented by subclass');
  }

  async chatStream(messages, params = {}, onChunk) {
    throw new Error('chatStream() must be implemented by subclass');
  }

  async testConnection() {
    try {
      const result = await this.chat(
        [{ role: 'user', content: 'Reply with exactly: OK' }],
        { maxTokens: 10 }
      );
      return { success: true, message: 'Connection successful' };
    } catch (error) { return { success: false, message: error.message };
    }
  }

  handleError(error, statusCode) {
    const err = new Error(error.message || 'LLM API error');

    if (statusCode === 401 || statusCode === 403) {
      err.message = 'Invalid API key. Please check your settings.';
      err.retryable = false;
    } else if (statusCode === 429) {
      err.message = 'Rate limited. Please wait a moment and try again.';
      err.retryable = true;
      // Try to extract retry-after
      if (error.headers?.['retry-after']) {
        err.retryAfter = parseInt(error.headers['retry-after'], 10);
      }
    } else if (statusCode === 400) {
      err.message = `Bad request: ${error.message || 'Check your input'}`;
      err.retryable = false;
    } else if (statusCode >= 500) {
      err.message = 'Server error from API provider. Please try again.';
      err.retryable = true;
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      err.message = 'Cannot connect to API. Check your internet connection and API endpoint.';
      err.retryable = true;
    } else {
      err.retryable = false;
    }

    err.statusCode = statusCode;
    err.originalError = error;
    return err;
  }

  mergeParams(params) {
    return { ...this.defaultParams, ...params };
  }
}
