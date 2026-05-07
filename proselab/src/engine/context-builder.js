/**
 * Context Builder
 * Assembles the optimal context window for narrative generation by prioritizing
 * voice, lore, history, and instructions.
 */

export class ContextBuilder {
  constructor(db) {
    this.db = db;
    this.maxContextTokens = 100000; // Conservative estimate for large context models
    this.charsPerToken = 4; // Rough approximation
  }

  setMaxTokens(tokens) {
    this.maxContextTokens = tokens;
  }

  estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / this.charsPerToken);
  }

  async buildContext(sceneId, options = {}) {
    const {
      includeVoiceProfile = true,
      includeOutline = true,
      includeEntityStates = true,
      includePreviousScenes = true,
      includeChapterSummaries = true,
      includeSceneNotes = true,
      maxPreviousScenes = 3,
      customInstructions = null
    } = options;

    const scene = await this.db.scenes.get(sceneId);
    if (!scene) throw new Error(`Scene not found: ${sceneId}`);

    const chapter = await this.db.chapters.get(scene.chapterId);
    const project = await this.db.projects.get(chapter.projectId);

    const contextParts = [];
    let tokenBudget = this.maxContextTokens;

    // 1. Voice profile (highest priority)
    if (includeVoiceProfile && project.voiceProfileId) {
      const profile = await this.db.voiceProfiles.get(project.voiceProfileId);
      if (profile) {
        const voiceText = profile.profile || JSON.stringify(profile);
        const voiceSection = `## Voice Profile\n${voiceText}`;
        const tokens = this.estimateTokens(voiceSection);

        if (tokens < tokenBudget) {
          contextParts.push({ priority: 100, section: 'voice', content: voiceSection, tokens });
          tokenBudget -= tokens;
        }
      }
    }

    // 2. Custom instructions
    if (customInstructions) {
      const section = `## Author Instructions\n${customInstructions}`;
      const tokens = this.estimateTokens(section);
      if (tokens < tokenBudget) {
        contextParts.push({ priority: 95, section: 'instructions', content: section, tokens });
        tokenBudget -= tokens;
      }
    }

    // 3. Scene-specific notes and beat sheet
    if (includeSceneNotes) {
      let sceneNotes = '';
      if (scene.notes) sceneNotes += `Scene Notes: ${scene.notes}\n`;
      if (scene.beatSheet) sceneNotes += `Beat Sheet:\n${scene.beatSheet}\n`;
      if (scene.beat) sceneNotes += `Core Beat: ${scene.beat}\n`;
      if (scene.pov) sceneNotes += `POV: ${scene.pov}\n`;

      if (sceneNotes) {
        const section = `## Current Scene: "${scene.title || 'Untitled'}"\n${sceneNotes}`;
        const tokens = this.estimateTokens(section);
        if (tokens < tokenBudget) {
          contextParts.push({ priority: 90, section: 'sceneNotes', content: section, tokens });
          tokenBudget -= tokens;
        }
      }
    }

    // 4. Entity states (characters, locations, etc.)
    if (includeEntityStates) {
      const entities = await this.db.entities
        .where('projectId').equals(project.id)
        .toArray();

      if (entities.length > 0) {
        const entityText = entities.map(e => {
          let entry = `**${e.name}** (${e.type})`;
          if (e.description) entry += `: ${e.description}`;
          if (e.currentState && Object.keys(e.currentState).length > 0) {
            const stateStr = Object.entries(e.currentState)
              .map(([k, v]) => `  - ${k}: ${v}`)
              .join('\n');
            entry += `\n${stateStr}`;
          }
          if (e.relationships && e.relationships.length > 0) {
            entry += '\n  Relationships: ' + e.relationships.map(r => `${r.relationshipType} → ${r.targetName}`).join('; ');
          }
          return entry;
        }).join('\n\n');

        const section = `## Entity States\n${entityText}`;
        const tokens = this.estimateTokens(section);
        if (tokens < tokenBudget) {
          contextParts.push({ priority: 85, section: 'entities', content: section, tokens });
          tokenBudget -= tokens;
        }
      }
    }

    // 5. Outline context
    if (includeOutline && project.logline) {
      const section = `## Story Outline & Logline\n${project.logline}`;
      const tokens = this.estimateTokens(section);

      if (tokens < tokenBudget) {
        contextParts.push({ priority: 70, section: 'outline', content: section, tokens });
        tokenBudget -= tokens;
      }
    }

    // 6. Previous chapter summaries
    if (includeChapterSummaries) {
      const allChapters = await this.db.chapters
        .where('projectId').equals(project.id)
        .sortBy('order');

      const previousChapters = allChapters.filter(c => c.order < chapter.order);

      if (previousChapters.length > 0) {
        const summaries = previousChapters
          .filter(c => c.summary)
          .map(c => `**Chapter ${c.order + 1}: "${c.title}"**\n${c.summary}`)
          .join('\n\n');

        if (summaries) {
          const section = `## Previous Chapter Summaries\n${summaries}`;
          const tokens = this.estimateTokens(section);
          if (tokens < tokenBudget) {
            contextParts.push({ priority: 75, section: 'chapterSummaries', content: section, tokens });
            tokenBudget -= tokens;
          }
        }
      }
    }

    // 7. Previous scenes in current chapter (full text for recent, summaries for older)
    if (includePreviousScenes) {
      const chapterScenes = await this.db.scenes
        .where('chapterId').equals(scene.chapterId)
        .sortBy('order');

      const previousScenes = chapterScenes.filter(s => s.order < scene.order);

      if (previousScenes.length > 0) {
        const recentScenes = previousScenes.slice(-maxPreviousScenes);
        const olderScenes = previousScenes.slice(0, -maxPreviousScenes);

        // Older scenes as summaries
        if (olderScenes.length > 0) {
          const olderSummaries = olderScenes
            .filter(s => s.summary || s.prose)
            .map(s => {
              const text = s.summary || `[Scene "${s.title}" — no summary available]`;
              return `[${s.title}]: ${text}`;
            })
            .join('\n\n');

          if (olderSummaries) {
            const section = `## Earlier Scenes (Summaries)\n${olderSummaries}`;
            const tokens = this.estimateTokens(section);
            if (tokens < tokenBudget) {
              contextParts.push({ priority: 65, section: 'olderScenes', content: section, tokens });
              tokenBudget -= tokens;
            }
          }
        }

        // Recent scenes as full text
        for (let i = 0; i < recentScenes.length; i++) {
          const s = recentScenes[i];
          if (!s.prose) continue;

          const isImmediatelyPrevious = i === recentScenes.length - 1;
          const priority = isImmediatelyPrevious ? 88 : 60 - (recentScenes.length - i);

          const section = `## Previous Scene: "${s.title}"\n${s.prose}`;
          const tokens = this.estimateTokens(section);

          if (tokens < tokenBudget) {
            contextParts.push({ priority, section: `prevScene_${i}`, content: section, tokens });
            tokenBudget -= tokens;
          } else if (isImmediatelyPrevious) {
            const lastPortion = s.prose.slice(-8000);
            const truncSection = `## Previous Scene: "${s.title}" (ending)\n[...earlier content omitted...]\n${lastPortion}`;
            const truncTokens = this.estimateTokens(truncSection);
            if (truncTokens < tokenBudget) {
              contextParts.push({ priority, section: `prevScene_${i}`, content: truncSection, tokens: truncTokens });
              tokenBudget -= truncTokens;
            }
          }
        }
      }
    }

    // 8. Current scene content so far (if continuing)
    if (scene.prose) {
      const section = `## Current Scene Content So Far\n${scene.prose}`;
      const tokens = this.estimateTokens(section);
      if (tokens < tokenBudget) {
        contextParts.push({ priority: 99, section: 'currentContent', content: section, tokens });
        tokenBudget -= tokens;
      } else {
        const tail = scene.prose.slice(-12000);
        const truncSection = `## Current Scene Content So Far\n[...earlier content omitted...]\n${tail}`;
        const truncTokens = this.estimateTokens(truncSection);
        contextParts.push({ priority: 99, section: 'currentContent', content: truncSection, tokens: truncTokens });
        tokenBudget -= truncTokens;
      }
    }

    // Sort by priority descending and assemble
    contextParts.sort((a, b) => b.priority - a.priority);

    return {
      parts: contextParts,
      totalTokens: contextParts.reduce((sum, p) => sum + p.tokens, 0),
      remainingBudget: tokenBudget,
      assembled: contextParts.map(p => p.content).join('\n\n---\n\n')
    };
  }

  truncateToTokens(text, maxTokens) {
    const maxChars = maxTokens * this.charsPerToken;
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars);
  }

  async buildContinuationPrompt(sceneId, instructions = '') {
    const context = await this.buildContext(sceneId);
    
    const systemPrompt = `You are a fiction ghostwriter. Continue the scene exactly where it left off. Maintain the established voice, tone, and style. Do not repeat content already written. Do not add meta-commentary or notes — output only the story text.`;

    const userPrompt = instructions
      ? `Continue the scene. Additional guidance: ${instructions}`
      : `Continue the scene from where it left off.`;

    return {
      messages: [
        { role: 'system', content: systemPrompt + '\n\n' + context.assembled },
        { role: 'user', content: userPrompt }
      ],
      context
    };
  }

  async buildNewScenePrompt(sceneId, instructions = '') {
    const context = await this.buildContext(sceneId, {
      includePreviousScenes: true,
      maxPreviousScenes: 2
    });
    const scene = await this.db.scenes.get(sceneId);

    const systemPrompt = `You are a fiction ghostwriter. Write the opening of a new scene. Maintain the established voice, tone, and style throughout. Output only the story text — no meta-commentary, no scene headers, no notes.`;

    let userPrompt = `Write the scene: "${scene.title || 'Untitled'}"`;
    if (scene.notes) userPrompt += `\nScene notes: ${scene.notes}`;
    if (scene.beatSheet) userPrompt += `\nBeat sheet: ${scene.beatSheet}`;
    if (scene.beat) userPrompt += `\nCore beat: ${scene.beat}`;
    if (instructions) userPrompt += `\nAdditional guidance: ${instructions}`;

    return {
      messages: [
        { role: 'system', content: systemPrompt + '\n\n' + context.assembled },
        { role: 'user', content: userPrompt }
      ],
      context
    };
  }
}
