/**
 * Context Assembler
 * Builds the prompt context window for narrative generation by managing token budgets
 * and prioritizing relevant lore, history, and voice.
 */

export class ContextAssembler {
  constructor(db, summarizer, entityTracker, voiceAnalyzer) {
    this.db = db;
    this.summarizer = summarizer;
    this.entityTracker = entityTracker;
    this.voiceAnalyzer = voiceAnalyzer;
  }

  async assembleContext(sceneId, options = {}) {
    const {
      maxContextTokens = 12000,
      includeVoice = true,
      includeEntities = true,
      includeWorldNotes = true,
      includePriorScenes = true,
      customInstructions = ''
    } = options;

    const scene = await this.db.scenes.get(sceneId);
    if (!scene) throw new Error(`Scene not found: ${sceneId}`);

    const chapter = await this.db.chapters.get(scene.chapterId);
    const project = await this.db.projects.get(chapter.projectId);

    // Token budget allocation (approximate, using ~4 chars per token)
    const tokenBudget = {
      system: Math.floor(maxContextTokens * 0.05),
      voice: Math.floor(maxContextTokens * 0.12),
      worldNotes: Math.floor(maxContextTokens * 0.08),
      entities: Math.floor(maxContextTokens * 0.08),
      priorContext: Math.floor(maxContextTokens * 0.30),
      sceneSetup: Math.floor(maxContextTokens * 0.07),
      recentContent: Math.floor(maxContextTokens * 0.25),
      instructions: Math.floor(maxContextTokens * 0.05)
    };

    const sections = [];

    // 1. System identity
    sections.push({
      role: 'system',
      key: 'identity',
      content: this.buildSystemIdentity(project),
      priority: 100
    });

    // 2. Voice profile
    if (includeVoice) {
      const voiceProfile = await this.db.voiceProfiles
        .where('projectId').equals(project.id)
        .first();

      if (voiceProfile && voiceProfile.profile) {
        sections.push({
          role: 'system',
          key: 'voice',
          content: `## Voice Profile\n\n${voiceProfile.profile}`,
          priority: 90,
          maxTokens: tokenBudget.voice
        });
      }
    }

    // 3. World notes
    if (includeWorldNotes) {
      const worldNotes = await this.db.worldNotes
        .where('projectId').equals(project.id)
        .toArray();

      if (worldNotes.length > 0) {
        const relevantNotes = this.filterRelevantNotes(worldNotes, scene);
        if (relevantNotes.length > 0) {
          const notesText = relevantNotes
            .map(n => `**${n.title}** (${n.category}): ${n.content}`)
            .join('\n\n');

          sections.push({
            role: 'system',
            key: 'worldNotes',
            content: `## World & Setting Notes\n\n${notesText}`,
            priority: 60,
            maxTokens: tokenBudget.worldNotes
          });
        }
      }
    }

    // 4. Entity state
    if (includeEntities) {
      const entityContext = await this.entityTracker.getEntityContext(project.id);
      if (entityContext) {
        sections.push({
          role: 'system',
          key: 'entities',
          content: `## Story Entities & Current State\n\n${entityContext}`,
          priority: 70,
          maxTokens: tokenBudget.entities
        });
      }
    }

    // 5. Prior scene context (summaries of earlier scenes)
    if (includePriorScenes) {
      const priorContext = await this.buildPriorContext(scene, chapter, project, tokenBudget.priorContext);
      if (priorContext) {
        sections.push({
          role: 'system',
          key: 'priorContext',
          content: priorContext,
          priority: 80,
          maxTokens: tokenBudget.priorContext
        });
      }
    }

    // 6. Scene setup
    const sceneSetup = this.buildSceneSetup(scene, chapter);
    sections.push({
      role: 'system',
      key: 'sceneSetup',
      content: sceneSetup,
      priority: 95,
      maxTokens: tokenBudget.sceneSetup
    });

    // 7. Custom instructions
    if (customInstructions) {
      sections.push({
        role: 'system',
        key: 'instructions',
        content: `## Additional Instructions\n\n${customInstructions}`,
        priority: 85,
        maxTokens: tokenBudget.instructions
      });
    }

    // 8. Recent content (the actual text leading up to the cursor)
    const recentContent = this.getRecentContent(scene.prose, tokenBudget.recentContent);

    // Assemble into messages
    return this.assembleMessages(sections, recentContent, maxContextTokens);
  }

  buildSystemIdentity(project) {
    let identity = `You are a skilled fiction writer collaborating on a ${project.genre || 'fiction'} project titled "${project.title}".`;

    if (project.description) {
      identity += `\n\nProject description: ${project.description}`;
    }

    identity += `\n\nYour role is to continue the story naturally, maintaining consistency with established characters, plot, setting, and voice. Write prose only — no meta-commentary, no explanations, no markdown headers. Continue seamlessly from where the text leaves off.`;

    return identity;
  }

  buildSceneSetup(scene, chapter) {
    let setup = `## Current Scene\n\n`;
    setup += `**Chapter:** ${chapter.title}\n`;
    setup += `**Scene:** ${scene.title}\n`;

    if (scene.pointOfView) {
      setup += `**POV:** ${scene.pointOfView}\n`;
    }
    if (scene.location) {
      setup += `**Location:** ${scene.location}\n`;
    }
    if (scene.characters && scene.characters.length > 0) {
      setup += `**Characters present:** ${scene.characters.join(', ')}\n`;
    }
    if (scene.outline) {
      setup += `\n**Scene outline:** ${scene.outline}\n`;
    }
    if (scene.notes) {
      setup += `\n**Scene notes:** ${scene.notes}\n`;
    }

    return setup;
  }

  async buildPriorContext(scene, chapter, project, maxTokens) {
    const allChapters = await this.db.chapters
      .where('projectId').equals(project.id)
      .sortBy('order');

    const parts = [];
    let estimatedTokens = 0;
    const charsPerToken = 4;

    // Get summaries of prior chapters
    for (const ch of allChapters) {
      if (ch.order >= chapter.order) break;

      if (ch.summary) {
        const entry = `**${ch.title}:** ${ch.summary}`;
        if (estimatedTokens + entry.length / charsPerToken > maxTokens) break;
        parts.push(entry);
        estimatedTokens += entry.length / charsPerToken;
      }
    }

    // Get scenes in current chapter before this scene
    const currentChapterScenes = await this.db.scenes
      .where('chapterId').equals(chapter.id)
      .sortBy('order');

    for (const s of currentChapterScenes) {
      if (s.order >= scene.order) break;

      if (s.summary) {
        const entry = `**${s.title}:** ${s.summary}`;
        if (estimatedTokens + entry.length / charsPerToken > maxTokens) break;
        parts.push(entry);
        estimatedTokens += entry.length / charsPerToken;
      } else if (s.prose && s.prose.trim().length > 0) {
        // If no summary, use truncated content
        const truncated = s.prose.slice(-2000);
        const entry = `**${s.title} (excerpt):** ...${truncated}`;
        if (estimatedTokens + entry.length / charsPerToken > maxTokens) break;
        parts.push(entry);
        estimatedTokens += entry.length / charsPerToken;
      }
    }

    if (parts.length === 0) return null;

    return `## Story So Far\n\n${parts.join('\n\n')}`;
  }

  getRecentContent(content, maxTokens) {
    if (!content || content.trim().length === 0) return '';

    const maxChars = maxTokens * 4;

    if (content.length <= maxChars) {
      return content;
    }

    // Take the tail end, but try to break at a paragraph boundary
    const truncated = content.slice(-maxChars);
    const paragraphBreak = truncated.indexOf('\n\n');

    if (paragraphBreak !== -1 && paragraphBreak < truncated.length * 0.3) {
      return truncated.slice(paragraphBreak + 2);
    }

    // Fall back to sentence boundary
    const sentenceBreak = truncated.indexOf('. ');
    if (sentenceBreak !== -1 && sentenceBreak < truncated.length * 0.2) {
      return truncated.slice(sentenceBreak + 2);
    }

    return truncated;
  }

  filterRelevantNotes(worldNotes, scene) {
    // Simple relevance: check if note title or content mentions scene characters/location
    const sceneTerms = new Set();

    if (scene.characters) {
      scene.characters.forEach(c => {
        sceneTerms.add(c.toLowerCase());
        const parts = c.split(' ');
        if (parts.length > 1) sceneTerms.add(parts[0].toLowerCase());
      });
    }

    if (scene.location) {
      sceneTerms.add(scene.location.toLowerCase());
    }

    if (scene.outline) {
      const caps = scene.outline.match(/[A-Z][a-z]{2,}/g);
      if (caps) caps.forEach(w => sceneTerms.add(w.toLowerCase()));
    }

    if (sceneTerms.size === 0) {
      return worldNotes.slice(0, 10);
    }

    const scored = worldNotes.map(note => {
      let score = 0;
      const noteText = `${note.title} ${note.content}`.toLowerCase();

      for (const term of sceneTerms) {
        if (noteText.includes(term)) score += 2;
      }

      if (note.category === 'character') score += 1;
      if (note.category === 'setting' && scene.location) score += 1;

      return { note, score };
    });

    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(s => s.note);
  }

  assembleMessages(sections, recentContent, maxContextTokens) {
    // Sort sections by priority (highest first)
    sections.sort((a, b) => b.priority - a.priority);

    // Truncate sections that exceed their token budget
    for (const section of sections) {
      if (section.maxTokens) {
        const maxChars = section.maxTokens * 4;
        if (section.content.length > maxChars) {
          section.content = section.content.slice(0, maxChars) + '\n[...truncated]';
        }
      }
    }

    // Combine all system sections
    const systemContent = sections
      .map(s => s.content)
      .join('\n\n---\n\n');

    const messages = [
      { role: 'system', content: systemContent }
    ];

    // Add recent content as the user message (the text to continue from)
    if (recentContent) {
      messages.push({
        role: 'user',
        content: `Continue the story from where it leaves off. Here is the recent text:\n\n---\n\n${recentContent}`
      });
    } else {
      messages.push({
        role: 'user',
        content: 'Begin writing the opening of this scene based on the scene setup and outline provided.'
      });
    }

    return messages;
  }

  estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }
}
