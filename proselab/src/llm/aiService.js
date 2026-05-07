import { LLMClient } from './client.js';
import { PromptBuilder } from './promptBuilder.js';
import { TokenEstimator } from './tokenEstimator.js';

export class AIService {
  constructor(db) {
    this.db = db;
    this.client = null;
    this.promptBuilder = new PromptBuilder(db);
    this.activeRequests = new Map(); // id -> AbortController
    this.conversationHistory = new Map(); // sceneId -> messages[]
  }

  // --- Configuration ---

  configure(config) {
    this.client = new LLMClient(config);
  }

  isConfigured() {
    return this.client !== null;
  }

  async loadConfigFromDB() {
    try {
      const settings = await this.db.settings.get('llm');
      if (settings && settings.value) {
        this.configure(settings.value);
        return true;
      }
    } catch (e) {
      console.warn('Failed to load LLM config:', e);
    }
    return false;
  }

  async saveConfigToDB(config) {
    await this.db.settings.put({
      key: 'llm',
      value: config
    });
    this.configure(config);
  }

  // --- Request management ---

  createRequest(id) {
    // Cancel any existing request with this id
    this.cancelRequest(id);

    const controller = new AbortController();
    this.activeRequests.set(id, controller);
    return controller;
  }

  cancelRequest(id) {
    const existing = this.activeRequests.get(id);
    if (existing) {
      existing.abort();
      this.activeRequests.delete(id);
    }
  }

  cancelAllRequests() {
    for (const [id, controller] of this.activeRequests) {
      controller.abort();
    }
    this.activeRequests.clear();
  }

  cleanupRequest(id) {
    this.activeRequests.delete(id);
  }

  // --- High-level writing operations ---

  async writeScene(sceneId, instruction = '', options = {}) {
    if (!this.client) throw new Error('AI not configured');

    const requestId = `write-${sceneId}`;
    const controller = this.createRequest(requestId);

    try {
      const messages = await this.promptBuilder.buildWritePrompt(sceneId, instruction);

      const result = await this.client.chat(messages, {
        temperature: options.temperature || 0.8,
        max_tokens: options.maxTokens,
        signal: controller.signal
      });
      this.cleanupRequest(requestId);

      // Store in conversation history
      this.addToHistory(sceneId, messages, result.content);

      return {
        content: result.content,
        usage: result.usage,
        model: result.model
      };
    } catch (error) {
      this.cleanupRequest(requestId);
      if (error.name === 'AbortError') {
        return { content: '', cancelled: true };
      }
      throw error;
    }
  }

  async writeSceneStreaming(sceneId, instruction = '', options = {}, onChunk) {
    if (!this.client) throw new Error('AI not configured');

    const requestId = `write-stream-${sceneId}`;
    const controller = this.createRequest(requestId);

    try {
      const messages = await this.promptBuilder.buildWritePrompt(sceneId, instruction);

      const result = await this.client.chatStreaming(messages, {
        temperature: options.temperature || 0.8,
        max_tokens: options.maxTokens,
        signal: controller.signal
      }, onChunk);

      this.cleanupRequest(requestId);
      this.addToHistory(sceneId, messages, result.content);

      return {
        content: result.content,
        usage: result.usage,
        model: result.model
      };
    } catch (error) {
      this.cleanupRequest(requestId);
      if (error.name === 'AbortError') {
        return { content: '', cancelled: true };
      }
      throw error;
    }
  }

  async continueScene(sceneId, existingContent, options = {}) {
    if (!this.client) throw new Error('AI not configured');

    const requestId = `continue-${sceneId}`;
    const controller = this.createRequest(requestId);

    try {
      const messages = await this.promptBuilder.buildContinuePrompt(sceneId, existingContent);

      const result = await this.client.chat(messages, {
        temperature: options.temperature || 0.8,
        max_tokens: options.maxTokens,
        signal: controller.signal
      });

      this.cleanupRequest(requestId);
      this.addToHistory(sceneId, messages, result.content);

      return {
        content: result.content,
        usage: result.usage,
        model: result.model
      };
    } catch (error) {
      this.cleanupRequest(requestId);
      if (error.name === 'AbortError') {
        return { content: '', cancelled: true };
      }
      throw error;
    }
  }

  async continueSceneStreaming(sceneId, existingContent, options = {}, onChunk) {
    if (!this.client) throw new Error('AI not configured');

    const requestId = `continue-stream-${sceneId}`;
    const controller = this.createRequest(requestId);

    try {
      const messages = await this.promptBuilder.buildContinuePrompt(sceneId, existingContent);

      const result = await this.client.chatStreaming(messages, {
        temperature: options.temperature || 0.8,
        max_tokens: options.maxTokens,
        signal: controller.signal
      }, onChunk);

      this.cleanupRequest(requestId);
      this.addToHistory(sceneId, messages, result.content);

      return {
        content: result.content,
        usage: result.usage,
        model: result.model
      };
    } catch (error) {
      this.cleanupRequest(requestId);
      if (error.name === 'AbortError') {
        return { content: '', cancelled: true };
      }
      throw error;
    }
  }

  async rewriteText(sceneId, selectedText, instruction = '', options = {}) {
    if (!this.client) throw new Error('AI not configured');

    const requestId = `rewrite-${sceneId}-${Date.now()}`;
    const controller = this.createRequest(requestId);

    try {
      const messages = await this.promptBuilder.buildRewritePrompt(
        sceneId, selectedText, instruction
      );

      const result = await this.client.chat(messages, {
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens,
        signal: controller.signal
      });

      this.cleanupRequest(requestId);

      return {
        original: selectedText,
        rewritten: result.content,
        usage: result.usage,
        model: result.model
      };
    } catch (error) {
      this.cleanupRequest(requestId);
      if (error.name === 'AbortError') {
        return { original: selectedText, rewritten: '', cancelled: true };
      }
      throw error;
    }
  }

  async rewriteTextStreaming(sceneId, selectedText, instruction = '', options = {}, onChunk) {
    if (!this.client) throw new Error('AI not configured');

    const requestId = `rewrite-stream-${sceneId}-${Date.now()}`;
    const controller = this.createRequest(requestId);

    try {
      const messages = await this.promptBuilder.buildRewritePrompt(
        sceneId, selectedText, instruction
      );

      const result = await this.client.chatStreaming(messages, {
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens,
        signal: controller.signal
      }, onChunk);

      this.cleanupRequest(requestId);

      return {
        original: selectedText,
        rewritten: result.content,
        usage: result.usage,
        model: result.model
      };
    } catch (error) {
      this.cleanupRequest(requestId);
      if (error.name === 'AbortError') {
        return { original: selectedText, rewritten: '', cancelled: true };
      }
      throw error;
    }
  }

  async brainstorm(projectId, topic, additionalContext = '', options = {}) {
    if (!this.client) throw new Error('AI not configured');

    const requestId = `brainstorm-${Date.now()}`;
    const controller = this.createRequest(requestId);

    try {
      const messages = await this.promptBuilder.buildBrainstormPrompt(
        projectId, topic, additionalContext
      );

      const result = await this.client.chat(messages, {
        temperature: options.temperature || 0.9,
        max_tokens: options.maxTokens || 2000,
        signal: controller.signal
      });

      this.cleanupRequest(requestId);

      return {
        content: result.content,
        usage: result.usage,
        model: result.model
      };
    } catch (error) {
      this.cleanupRequest(requestId);
      if (error.name === 'AbortError') {
        return { content: '', cancelled: true };
      }
      throw error;
    }
  }

  async brainstormStreaming(projectId, topic, additionalContext = '', options = {}, onChunk) {
    if (!this.client) throw new Error('AI not configured');

    const requestId = `brainstorm-stream-${Date.now()}`;
    const controller = this.createRequest(requestId);

    try {
      const messages = await this.promptBuilder.buildBrainstormPrompt(
        projectId, topic, additionalContext
      );

      const result = await this.client.chatStreaming(messages, {
        temperature: options.temperature || 0.9,
        max_tokens: options.maxTokens || 2000,
        signal: controller.signal
      }, onChunk);

      this.cleanupRequest(requestId);

      return {
        content: result.content,
        usage: result.usage,
        model: result.model
      };
    } catch (error) {
      this.cleanupRequest(requestId);
      if (error.name === 'AbortError') {
        return { content: '', cancelled: true };
      }
      throw error;
    }
  }

  async getEditorialFeedback(sceneId, textToEdit, options = {}) {
    if (!this.client) throw new Error('AI not configured');

    const requestId = `edit-${sceneId}-${Date.now()}`;
    const controller = this.createRequest(requestId);

    try {
      const messages = await this.promptBuilder.buildEditPrompt(sceneId, textToEdit);

      const result = await this.client.chat(messages, {
        temperature: options.temperature || 0.5,
        max_tokens: options.maxTokens || 2000,
        signal: controller.signal
      });

      this.cleanupRequest(requestId);

      return {
        feedback: result.content,
        usage: result.usage,
        model: result.model
      };
    } catch (error) {
      this.cleanupRequest(requestId);
      if (error.name === 'AbortError') {
        return { feedback: '', cancelled: true };
      }
      throw error;
    }
  }

  async customChat(projectId, systemOverride, userMessage, options = {}) {
    if (!this.client) throw new Error('AI not configured');

    const requestId = `custom-${Date.now()}`;
    const controller = this.createRequest(requestId);

    try {
      const messages = await this.promptBuilder.buildCustomPrompt(
        projectId, systemOverride, userMessage
      );

      const result = await this.client.chat(messages, {
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens,
        signal: controller.signal
      });

      this.cleanupRequest(requestId);

      return {
        content: result.content,
        usage: result.usage,
        model: result.model
      };
    } catch (error) {
      this.cleanupRequest(requestId);
      if (error.name === 'AbortError') {
        return { content: '', cancelled: true };
      }
      throw error;
    }
  }

  async customChatStreaming(projectId, systemOverride, userMessage, options = {}, onChunk) {
    if (!this.client) throw new Error('AI not configured');

    const requestId = `custom-stream-${Date.now()}`;
    const controller = this.createRequest(requestId);

    try {
      const messages = await this.promptBuilder.buildCustomPrompt(
        projectId, systemOverride, userMessage
      );

      const result = await this.client.chatStreaming(messages, {
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens,
        signal: controller.signal
      }, onChunk);

      this.cleanupRequest(requestId);

      return {
        content: result.content,
        usage: result.usage,
        model: result.model
      };
    } catch (error) {
      this.cleanupRequest(requestId);
      if (error.name === 'AbortError') {
        return { content: '', cancelled: true };
      }
      throw error;
    }
  }

  // --- Conversation history management ---

  addToHistory(sceneId, messages, response) {
    if (!this.conversationHistory.has(sceneId)) {
      this.conversationHistory.set(sceneId, []);
    }

    const history = this.conversationHistory.get(sceneId);

    // Store only the user message and response (not the full context)
    const lastUserMsg = messages[messages.length - 1];
    history.push(
      { role: 'user', content: lastUserMsg.content, timestamp: Date.now() },
      { role: 'assistant', content: response, timestamp: Date.now() }
    );

    // Keep history manageable — last 20 exchanges
    while (history.length > 40) {
      history.shift();
    }
  }

  getHistory(sceneId) {
    return this.conversationHistory.get(sceneId) || [];
  }

  clearHistory(sceneId) {
    if (sceneId) {
      this.conversationHistory.delete(sceneId);
    } else {
      this.conversationHistory.clear();
    }
  }

  // --- Utility ---

  estimatePromptTokens(messages) {
    let total = 0;
    for (const msg of messages) {
      total += TokenEstimator.estimate(msg.content) + 4; // message overhead
    }
    return total;
  }

  async testConnection() {
    if (!this.client) throw new Error('AI not configured');

    const messages = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Say "Connection successful" and nothing else.' }
    ];

    const result = await this.client.chat(messages, {
      max_tokens: 20,
      temperature: 0
    });

    return {
      success: true,
      response: result.content,
      model: result.model
    };
  }
}
