// src/llm/writingAssistant.js

import { LLMService } from './llmService.js';

/**
 * WritingAssistant - Higher-level interface between the UI and LLMService.
 * Manages state for the AI assistant panel.
 */
export class WritingAssistant {
  constructor(projectStore) {
    this.llmService = new LLMService(projectStore);
    this.projectStore = projectStore;
    this.history = []; // conversation history for the session
    this.isGenerating = false;
    this.currentRequestId = null;
    this.listeners = new Set();
  }

  configure(providerConfig) {
    this.llmService.configure(providerConfig);
  }

  isConfigured() {
    return this.llmService.isConfigured();
  }

  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      listener(this.getState());
    }
  }

  getState() {
    return {
      isGenerating: this.isGenerating,
      history: [...this.history],
      isConfigured: this.isConfigured(),
    };
  }

  async execute(operation, options = {}) {
    if (this.isGenerating) {
      throw new Error('A request is already in progress');
    }

    this.isGenerating = true;
    this.notify();

    const historyEntry = {
      id: Date.now(),
      operation,
      timestamp: new Date().toISOString(),
      request: this.describeOperation(operation, options),
      response: '',
      status: 'pending',
      usage: null,
    };

    this.history.push(historyEntry);
    this.notify();

    try {
      let streamedContent = '';

      const result = await this.llmService.request(operation, {
        ...options,
        stream: !!options.onChunk,
        onChunk: options.onChunk
          ? (chunk) => {
              streamedContent += chunk;
              historyEntry.response = streamedContent;
              historyEntry.status = 'streaming';
              this.notify();
              options.onChunk(chunk);
            }
          : undefined,
      });

      this.currentRequestId = result.requestId;
      historyEntry.response = result.content;
      historyEntry.status = 'complete';
      historyEntry.usage = result.usage;
      this.notify();

      return result;
    } catch (error) {
      historyEntry.status = 'error';
      historyEntry.error = error.message;
      this.notify();
      throw error;
    } finally {
      this.isGenerating = false;
      this.currentRequestId = null;
      this.notify();
    }
  }

  cancel() {
    if (this.currentRequestId) {
      this.llmService.cancelRequest(this.currentRequestId);
    }
    this.llmService.cancelAllRequests();
    this.isGenerating = false;

    const lastEntry = this.history[this.history.length - 1];
    if (lastEntry && lastEntry.status === 'pending') {
      lastEntry.status = 'cancelled';
    }
    if (lastEntry && lastEntry.status === 'streaming') {
      lastEntry.status = 'cancelled';
    }

    this.notify();
  }

  clearHistory() {
    this.history = [];
    this.notify();
  }

  describeOperation(operation, options) {
    const descriptions = {
      continue: 'Continue writing',
      rewrite: `Rewrite: "${(options.instruction || 'improve').substring(0, 60)}"`,
      dialogue: 'Generate dialogue',
      describe: `Describe: ${(options.subject || '').substring(0, 60)}`,
      brainstorm: `Brainstorm: ${(options.topic || '').substring(0, 60)}`,
      analyze: 'Analyze text',
      consistency: 'Check consistency',
      summarize: 'Summarize',
      outline: 'Outline chapter',
      transition: 'Write transition',
      'character-voice': `Character voice: ${options.character?.name || 'unknown'}`,
      custom: `Custom: "${(options.prompt || '').substring(0, 60)}"`,
    };
    return descriptions[operation] || operation;
  }
}
