/**
 * Generation Engine
 * Core orchestrator for narrative production. Manages specialized generation modes,
 * concurrency control with AbortControllers, and automated post-generation workflows.
 */

export class GenerationEngine {
  constructor({ db, llm, contextAssembler, summarizer, entityTracker, voiceAnalyzer }) {
    this.db = db;
    this.llm = llm;
    this.contextAssembler = contextAssembler;
    this.summarizer = summarizer;
    this.entityTracker = entityTracker;
    this.voiceAnalyzer = voiceAnalyzer;

    this.activeGenerations = new Map();
  }

  async generate(sceneId, options = {}) {
    const {
      mode = 'continue',        // continue | rewrite | insert | brainstorm
      selectedText = null,       // for rewrite mode
      insertionPoint = null,     // for insert mode
      userPrompt = '',           // additional user instruction
      temperature = null,
      maxTokens = null,
      stream = true,
      onChunk = null,            // callback for streaming chunks
      onComplete = null,
      onError = null
    } = options;

    const generationId = crypto.randomUUID();

    // Abort controller for cancellation
    const abortController = new AbortController();
    this.activeGenerations.set(generationId, { abortController, sceneId });

    try {
      const scene = await this.db.scenes.get(sceneId);
      if (!scene) throw new Error(`Scene not found: ${sceneId}`);

      const chapter = await this.db.chapters.get(scene.chapterId);
      const project = await this.db.projects.get(chapter.projectId);

      // Build custom instructions based on mode
      let customInstructions = userPrompt;

      switch (mode) {
        case 'continue':
          customInstructions = this.buildContinueInstructions(customInstructions);
          break;
        case 'rewrite':
          customInstructions = this.buildRewriteInstructions(selectedText, customInstructions);
          break;
        case 'insert':
          customInstructions = this.buildInsertInstructions(scene.prose, insertionPoint, customInstructions);
          break;
        case 'brainstorm':
          customInstructions = this.buildBrainstormInstructions(customInstructions);
          break;
      }

      // Assemble context
      const messages = await this.contextAssembler.assembleContext(sceneId, {
        maxContextTokens: 12000,
        customInstructions
      });

      // Determine generation parameters
      const genTemperature = temperature ?? project.settings?.defaultTemperature ?? 0.8;
      const genMaxTokens = maxTokens ?? project.settings?.defaultMaxTokens ?? 3000;

      if (stream && onChunk) {
        return await this.streamGeneration(generationId, sceneId, messages, {
          temperature: genTemperature,
          maxTokens: genMaxTokens,
          onChunk,
          onComplete,
          onError
        });
      } else {
        return await this.blockGeneration(generationId, sceneId, messages, {
          temperature: genTemperature,
          maxTokens: genMaxTokens
        });
      }
    } catch (error) {
      if (onError) onError(error);
      throw error;
    } finally {
      this.activeGenerations.delete(generationId);
    }
  }

  buildContinueInstructions(userPrompt) {
    let instructions = 'Continue the story naturally from where the text ends. Maintain the established pacing, tone, and voice.';
    if (userPrompt) {
      instructions += `\n\nAdditional guidance: ${userPrompt}`;
    }
    return instructions;
  }

  buildRewriteInstructions(selectedText, userPrompt) {
    let instructions = `Rewrite the following passage while maintaining the same narrative purpose and plot points, but improving the prose quality:\n\n"${selectedText}"`;
    if (userPrompt) {
      instructions += `\n\nSpecific guidance for the rewrite: ${userPrompt}`;
    }
    return instructions;
  }

  buildInsertInstructions(fullContent, insertionPoint, userPrompt) {
    const before = fullContent.slice(Math.max(0, insertionPoint - 500), insertionPoint);
    const after = fullContent.slice(insertionPoint, insertionPoint + 500);

    let instructions = `Write a passage that bridges between these two sections of text.\n\nText before insertion point:\n"...${before}"\n\nText after insertion point:\n"${after}..."`;
    if (userPrompt) {
      instructions += `\n\nGuidance: ${userPrompt}`;
    }
    return instructions;
  }

  buildBrainstormInstructions(userPrompt) {
    let instructions = 'Based on the story context, suggest 3 possible directions for what could happen next. For each option, write 2-3 sentences describing the direction, then write a brief sample paragraph showing how it might read.';
    if (userPrompt) {
      instructions += `\n\nFocus area: ${userPrompt}`;
    }
    return instructions;
  }

  async blockGeneration(generationId, sceneId, messages, params) {
    const result = await this.llm.chat(messages, {
      purpose: 'generation',
      temperature: params.temperature,
      max_tokens: params.maxTokens,
      stream: false
    });

    // Log the generation
    await this.db.logGeneration(sceneId, {
      prompt: JSON.stringify(messages),
      promptTokens: result.usage?.prompt_tokens || 0,
      completionTokens: result.usage?.completion_tokens || 0,
      model: result.model,
      temperature: params.temperature,
      generatedText: result.content
    });

    return {
      generationId,
      content: result.content,
      usage: result.usage,
      model: result.model
    };
  }

  async streamGeneration(generationId, sceneId, messages, params) {
    const result = await this.llm.chat(messages, {
      purpose: 'generation',
      temperature: params.temperature,
      max_tokens: params.maxTokens,
      stream: true
    });

    let fullContent = '';
    let usage = null;

    try {
      for await (const chunk of result.stream) {
        // Check if cancelled
        if (!this.activeGenerations.has(generationId)) {
          break;
        }

        if (chunk.type === 'content') {
          fullContent += chunk.content;
          params.onChunk(chunk.content, fullContent);
        }

        if (chunk.type === 'finish' || chunk.type === 'usage') {
          usage = chunk.usage;
        }
      }
    } catch (error) {
      if (params.onError) params.onError(error);
      throw error;
    }

    // Log the generation
    await this.db.logGeneration(sceneId, {
      prompt: JSON.stringify(messages),
      promptTokens: usage?.prompt_tokens || 0,
      completionTokens: usage?.completion_tokens || 0,
      model: this.llm.model,
      temperature: params.temperature,
      generatedText: fullContent
    });

    if (params.onComplete) {
      params.onComplete({
        generationId,
        content: fullContent,
        usage,
        model: this.llm.model
      });
    }

    return {
      generationId,
      content: fullContent,
      usage,
      model: this.llm.model
    };
  }

  cancelGeneration(generationId) {
    const gen = this.activeGenerations.get(generationId);
    if (gen) {
      gen.abortController.abort();
      this.activeGenerations.delete(generationId);
      return true;
    }
    return false;
  }

  cancelAllGenerations() {
    for (const [id, gen] of this.activeGenerations) {
      gen.abortController.abort();
    }
    this.activeGenerations.clear();
  }

  async acceptGeneration(sceneId, generatedText, mode = 'append') {
    const scene = await this.db.scenes.get(sceneId);
    if (!scene) throw new Error(`Scene not found: ${sceneId}`);

    let newContent;

    switch (mode) {
      case 'append':
        newContent = scene.prose
          ? scene.prose + '\n\n' + generatedText
          : generatedText;
        break;
      case 'replace':
        newContent = generatedText;
        break;
      case 'prepend':
        newContent = generatedText + '\n\n' + (scene.prose || '');
        break;
      default:
        newContent = scene.prose + '\n\n' + generatedText;
    }

    await this.db.updateSceneContent(sceneId, newContent);

    // Trigger background tasks
    this.runPostGenerationTasks(sceneId, newContent);

    return newContent;
  }

  async runPostGenerationTasks(sceneId, content) {
    // These run in the background and don't block the UI
    try {
      const scene = await this.db.scenes.get(sceneId);
      const chapter = await this.db.chapters.get(scene.chapterId);

      // Update scene summary if content is substantial
      if (content.length > 1000) {
        this.summarizer.summarizeScene(sceneId).catch(e => {
          console.warn('Background summarization failed:', e);
        });
      }

      // Extract and update entities
      this.entityTracker.updateFromContent(sceneId, content).catch(e => {
        console.warn('Background entity extraction failed:', e);
      });
    } catch (e) {
      console.warn('Post-generation tasks failed:', e);
    }
  }
}
