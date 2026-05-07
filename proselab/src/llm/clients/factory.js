// src/llm/clients/factory.js

import { OpenAIClient } from './openai.js';
import { GeminiClient } from './gemini.js';
import { OllamaClient } from './ollama.js';

export class LLMClientFactory {
  static create(provider, config) {
    switch (provider) {
      case 'openai':
        return new OpenAIClient({
          ...config,
          model: config.model || 'gpt-4o',
        });

      case 'gemini':
      case 'google':
        return new GeminiClient({
          ...config,
          model: config.model || 'gemini-1.5-pro',
        });

      case 'ollama':
        return new OllamaClient({
          ...config,
          model: config.model || 'llama3.1',
        });

      case 'openai-compatible':
        // For any OpenAI-compatible API (Together, Groq, OpenRouter, etc.)
        return new OpenAIClient({
          ...config,
          baseURL: config.baseURL || config.endpoint,
        });

      default:
        throw new Error(`Unknown LLM provider: ${provider}. Supported: openai, gemini, ollama, openai-compatible`);
    }
  }

  static getAvailableProviders() {
    return [
      {
        id: 'openai',
        name: 'OpenAI',
        requiresApiKey: true,
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
        defaultModel: 'gpt-4o',
      },
      {
        id: 'gemini',
        name: 'Google Gemini',
        requiresApiKey: true,
        models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'],
        defaultModel: 'gemini-1.5-pro',
      },
      {
        id: 'ollama',
        name: 'Ollama (Local)',
        requiresApiKey: false,
        models: [], // Dynamically loaded
        defaultModel: 'llama3.1',
      },
      {
        id: 'openai-compatible',
        name: 'OpenAI-Compatible API',
        requiresApiKey: true,
        requiresEndpoint: true,
        models: [],
        defaultModel: '',
      },
    ];
  }
}
