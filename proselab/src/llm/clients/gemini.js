// src/llm/clients/gemini.js

import { BaseLLMClient } from './base.js';

export class GeminiClient extends BaseLLMClient {
  constructor(config = {}) {
    super(config);
    this.baseURL = config.baseURL || 'https://generativelanguage.googleapis.com/v1beta';
  }

  async chat(messages, params = {}) {
    const merged = this.mergeParams(params);

    // Gemini format: system_instruction + contents: [{role, parts: [{text}]}]
    const systemInstruction = messages.find(m => m.role === 'system')?.content;
    const contents = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const body = {
      contents,
      generationConfig: {
        temperature: merged.temperature,
        maxOutputTokens: merged.maxTokens,
        topP: merged.topP,
      },
    };

    if (systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    try {
      const url = `${this.baseURL}/models/${this.model}:generateContent?key=${this.apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw this.handleError(
          { message: errorData.error?.message || response.statusText },
          response.status
        );
      }

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      return {
        content,
        finishReason: data.candidates?.[0]?.finishReason,
        usage: {
          promptTokens: data.usageMetadata?.promptTokenCount || 0,
          completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: data.usageMetadata?.totalTokenCount || 0,
        },
        raw: data,
      };
    } catch (error) {
      if (error.statusCode) throw error;
      throw this.handleError(error, null);
    }
  }

  async chatStream(messages, params = {}, onChunk) {
    const merged = this.mergeParams(params);

    const systemInstruction = messages.find(m => m.role === 'system')?.content;
    const contents = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const body = {
      contents,
      generationConfig: {
        temperature: merged.temperature,
        maxOutputTokens: merged.maxTokens,
        topP: merged.topP,
      },
    };

    if (systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    try {
      const url = `${this.baseURL}/models/${this.model}:streamGenerateContent?alt=sse&key=${this.apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw this.handleError(
          { message: errorData.error?.message || response.statusText },
          response.status
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
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

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
            
            if (delta) {
              fullContent += delta;
              onChunk(delta);
            }
          } catch {
            // Skip malformed lines
          }
        }
      }

      return {
        content: fullContent,
        finishReason: 'stop',
        usage: null,
      };
    } catch (error) {
      if (error.statusCode) throw error;
      throw this.handleError(error, null);
    }
  }
}
