/**
 * Gemini Provider
 * Implementation for Google Gemini API (Google AI).
 */

import { ProviderError } from './openai.js'; // Importing shared error class

export class GeminiProvider {
  constructor(config) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
  }

  async complete({ model, messages, temperature, max_tokens, response_format, stream }) {
    // Gemini uses a 'contents' array with 'parts'
    // It also handles 'system_instruction' separately in some versions, 
    // but here we'll map roles to 'user' and 'model'
    
    const systemMessage = messages.find(m => m.role === 'system');
    const nonSystemMessages = messages.filter(m => m.role !== 'system');

    const contents = nonSystemMessages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const body = {
      contents,
      generationConfig: {
        temperature: temperature ?? 0.7,
        maxOutputTokens: max_tokens ?? 4096,
      }
    };

    if (systemMessage) {
      body.systemInstruction = {
        parts: [{ text: systemMessage.content }]
      };
    }

    if (response_format?.type === 'json_object') {
      body.generationConfig.responseMimeType = 'application/json';
    }

    const endpoint = stream ? 'streamGenerateContent' : 'generateContent';
    const url = `${this.baseUrl}/models/${model}:${endpoint}?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new ProviderError(
        `Gemini API error: ${error.error?.message || response.statusText}`,
        response.status,
        error
      );
    }

    if (stream) {
      return {
        stream: this.parseGeminiStream(response.body),
        usage: null
      };
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    
    if (!candidate) {
      throw new Error('Gemini returned no candidates');
    }

    return {
      content: candidate.content.parts[0].text,
      usage: {
        input_tokens: data.usageMetadata?.promptTokenCount || 0,
        output_tokens: data.usageMetadata?.candidatesTokenCount || 0
      }
    };
  }

  async *parseGeminiStream(body) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Gemini streaming returns a JSON array that grows, or a series of objects
        // In the REST API, it's often a series of [ { ... }, { ... } ]
        // A simple way to handle this is to look for the boundaries of JSON objects
        
        let boundary;
        while ((boundary = buffer.indexOf('}\n,')) !== -1 || (boundary = buffer.indexOf('}]')) !== -1) {
           // This is tricky with raw fetch and Gemini's non-standard streaming format
           // For now, we'll yield the content if we can find a valid parts.text
           // Standard approach involves parsing the JSON chunks
           break; 
        }
        
        // Note: Real Gemini streaming via REST requires a more robust NDJSON/SSE parser
        // or using the official SDK. For this implementation, we'll yield a placeholder
        // until we implement the full NDJSON chunking.
      }
    } finally {
      reader.releaseLock();
    }
  }
}
