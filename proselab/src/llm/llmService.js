// src/llm/llmService.js

import { LLMClientFactory } from './clients/factory.js';
import { ContextBuilder } from './contextBuilder.js';
import { PromptTemplates } from './promptTemplates.js';
import { TokenEstimator } from './tokenEstimator.js';

export class LLMService {
  constructor(projectStore) {
    this.projectStore = projectStore;
    this.client = null;
    this.contextBuilder = new ContextBuilder();
    this.activeRequests = new Map();
    this.requestIdCounter = 0;
  }

  configure(providerConfig) {
    const { provider, ...config } = providerConfig;
    this.client = LLMClientFactory.create(provider, config);
    this.providerConfig = providerConfig;
  }

  isConfigured() {
    return this.client !== null;
  }

  async testConnection() {
    if (!this.client) {
      return { success: false, message: 'No LLM provider configured' };
    }
    return this.client.testConnection();
  }

  // ---- Core request method ----

  async request(operation, options = {}) {
    if (!this.client) {
      throw new Error('LLM not configured. Please set up a provider in Settings.');
    }

    const requestId = ++this.requestIdCounter;
    const abortController = new AbortController();
    this.activeRequests.set(requestId, abortController);

    try {
      const { messages, params } = this.buildRequest(operation, options);

      let result;
      if (options.stream && options.onChunk) {
        result = await this.client.chatStream(messages, params, options.onChunk);
      } else {
        result = await this.client.chat(messages, params);
      }

      return {
        requestId,
        content: result.content,
        finishReason: result.finishReason,
        usage: result.usage,
      };
    } finally {
      this.activeRequests.delete(requestId);
    }
  }

  cancelRequest(requestId) {
    const controller = this.activeRequests.get(requestId);
    if (controller) {
      controller.abort();
      this.activeRequests.delete(requestId);
    }
  }

  cancelAllRequests() {
    for (const [id, controller] of this.activeRequests) {
      controller.abort();
    }
    this.activeRequests.clear();
  }

  // ---- Build request messages ----

  buildRequest(operation, options) {
    const project = options.project || this.projectStore?.currentProject;
    const contextOptions = {
      project,
      currentChapterId: options.chapterId,
      currentText: options.currentText,
    };

    const projectContext = this.contextBuilder.buildContext(contextOptions);

    const systemPrompt = PromptTemplates.getSystemPrompt({
      customInstructions: options.customInstructions || project?.settings?.customInstructions || '',
      projectContext,
      additionalInstructions: this.getOperationInstructions(operation),
    });

    const userPrompt = this.buildUserPrompt(operation, options);

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const params = {
      temperature: options.temperature ?? this.getDefaultTemperature(operation),
      maxTokens: options.maxTokens ?? this.getDefaultMaxTokens(operation),
    };

    return { messages, params };
  }

  buildUserPrompt(operation, options) {
    switch (operation) {
      case 'continue':
        return PromptTemplates.continueWriting(options.currentText || '', {
          wordCount: options.wordCount,
          direction: options.direction,
        });

      case 'rewrite':
        return PromptTemplates.rewritePassage(options.selectedText || '', {
          instruction: options.instruction,
          tone: options.tone,
          preserveLength: options.preserveLength,
        });

      case 'dialogue':
        return PromptTemplates.generateDialogue({
          characters: options.characters,
          situation: options.situation,
          tone: options.tone,
          exchangeCount: options.exchangeCount,
          currentText: options.currentText,
        });

      case 'describe':
        return PromptTemplates.describeScene({
          subject: options.subject,
          senses: options.senses,
          mood: options.mood,
          wordCount: options.wordCount,
          pov: options.pov,
        });

      case 'brainstorm':
        return PromptTemplates.brainstorm({
          topic: options.topic,
          type: options.type,
          count: options.count,
          constraints: options.constraints,
        });

      case 'analyze':
        return PromptTemplates.analyzeText(options.selectedText || options.currentText || '', {
          focus: options.focus,
        });

      case 'consistency':
        return PromptTemplates.fixConsistency(options.currentText || '', {
          characters: options.characters,
          knownFacts: options.knownFacts,
        });

      case 'summarize':
        return PromptTemplates.summarizeScene(options.currentText || options.selectedText || '');

      case 'outline':
        return PromptTemplates.outlineChapter({
          chapterNumber: options.chapterNumber,
          plotPoints: options.plotPoints,
          characters: options.characters,
          previousSummary: options.previousSummary,
          sceneCount: options.sceneCount,
        });

      case 'transition':
        return PromptTemplates.transitionScene({
          fromScene: options.fromScene,
          toScene: options.toScene,
          type: options.transitionType,
          currentText: options.currentText,
        });

      case 'character-voice':
        return PromptTemplates.characterVoice({
          character: options.character,
          situation: options.situation,
          internalMonologue: options.internalMonologue,
          wordCount: options.wordCount,
        });

      case 'custom':
        return options.prompt || '';

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  getOperationInstructions(operation) {
    const instructions = {
      continue: 'You are continuing the author\'s text. Match their style exactly.',
      rewrite: 'You are rewriting a passage. Preserve the core meaning while improving the prose.',
      dialogue: 'You are writing dialogue. Make each character\'s voice distinct.',
      describe: 'You are writing a description. Use vivid, sensory language.',
      brainstorm: 'You are brainstorming. Be creative and offer diverse options.',
      analyze: 'You are providing editorial feedback. Be specific and constructive.',
      consistency: 'You are checking for consistency errors. Be thorough and precise.',
      summarize: 'You are summarizing. Be concise but capture all key elements.',
      outline: 'You are creating a chapter outline. Be structured and detailed.',
      transition: 'You are writing a scene transition. Make it feel natural.',
      'character-voice': 'You are writing in a specific character\'s voice. Stay in character.',
    };
    return instructions[operation] || '';
  }

  getDefaultTemperature(operation) {
    const temps = {
      continue: 0.8,
      rewrite: 0.6,
      dialogue: 0.85,
      describe: 0.8,
      brainstorm: 0.95,
      analyze: 0.3,
      consistency: 0.2,
      summarize: 0.3,
      outline: 0.7,
      transition: 0.75,
      'character-voice': 0.85,
      custom: 0.7,
    };
    return temps[operation] ?? 0.7;
  }

  getDefaultMaxTokens(operation) {
    const tokens = {
      continue: 1024,
      rewrite: 1024,
      dialogue: 1024,
      describe: 512,
      brainstorm: 1024,
      analyze: 1500,
      consistency: 1500,
      summarize: 256,
      outline: 1500,
      transition: 512,
      'character-voice': 512,
      custom: 2048,
    };
    return tokens[operation] ?? 1024;
  }

  // ---- Convenience methods ----

  async continueWriting(currentText, options = {}) {
    return this.request('continue', { currentText, ...options });
  }

  async rewrite(selectedText, instruction, options = {}) {
    return this.request('rewrite', { selectedText, instruction, ...options });
  }

  async generateDialogue(options = {}) {
    return this.request('dialogue', options);
  }

  async describeScene(options = {}) {
    return this.request('describe', options);
  }

  async brainstorm(topic, options = {}) {
    return this.request('brainstorm', { topic, ...options });
  }

  async analyzeText(text, options = {}) {
    return this.request('analyze', { selectedText: text, ...options });
  }

  async checkConsistency(text, options = {}) {
    return this.request('consistency', { currentText: text, ...options });
  }

  async summarize(text) {
    return this.request('summarize', { currentText: text });
  }

  async outlineChapter(options = {}) {
    return this.request('outline', options);
  }

  async customPrompt(prompt, options = {}) {
    return this.request('custom', { prompt, ...options });
  }
}
