import { TokenEstimator } from './tokenEstimator.js';

export class PromptBuilder {
  constructor(db) {
    this.db = db;
  }

  // --- Context gathering ---

  async gatherSceneContext(sceneId, options = {}) {
    const scene = await this.db.scenes.get(sceneId);
    if (!scene) throw new Error('Scene not found');

    const chapter = await this.db.chapters.get(scene.chapterId);
    if (!chapter) throw new Error('Chapter not found');

    const project = await this.db.projects.get(chapter.projectId);
    if (!project) throw new Error('Project not found');

    // Get all chapters for structure context
    const allChapters = await this.db.chapters
      .where('projectId').equals(project.id)
      .sortBy('order');

    // Get scenes in current chapter
    const chapterScenes = await this.db.scenes
      .where('chapterId').equals(chapter.id)
      .sortBy('order');

    // Get preceding scenes for narrative continuity
    const currentSceneIndex = chapterScenes.findIndex(s => s.id === sceneId);
    const precedingScenes = chapterScenes.slice(0, currentSceneIndex);

    // Get preceding chapters' last scenes for broader context
    const currentChapterIndex = allChapters.findIndex(c => c.id === chapter.id);
    const precedingChapterScenes = [];

    for (let i = Math.max(0, currentChapterIndex - 2); i < currentChapterIndex; i++) {
      const scenes = await this.db.scenes
        .where('chapterId').equals(allChapters[i].id)
        .sortBy('order');

      if (scenes.length > 0) {
        precedingChapterScenes.push({
          chapter: allChapters[i],
          lastScene: scenes[scenes.length - 1]
        });
      }
    }

    // Get entities (characters, locations, etc.)
    const entities = await this.db.entities
      .where('projectId').equals(project.id)
      .toArray();

    // Get relevant world notes
    const worldNotes = await this.db.worldNotes
      .where('projectId').equals(project.id)
      .toArray();

    // Get voice profile
    const voiceProfile = await this.db.voiceProfiles
      .where('projectId').equals(project.id)
      .first();

    return {
      project,
      chapter,
      scene,
      allChapters,
      chapterScenes,
      precedingScenes,
      precedingChapterScenes,
      entities,
      worldNotes,
      voiceProfile,
      currentSceneIndex,
      currentChapterIndex
    };
  }

  // --- System prompt construction ---

  buildSystemPrompt(context, task = 'write') {
    const { project, voiceProfile } = context;

    let system = `You are an expert fiction writer and creative collaborator. `;

    // Project context
    system += `You are working on a ${project.genre || 'fiction'} novel titled "${project.title}". `;

    if (project.description) {
      system += `\n\nProject Description: ${project.description}`;
    }

    // Voice and style
    if (voiceProfile) {
      system += `\n\n## Writing Voice & Style\n`;
      if (voiceProfile.voiceSummary) {
        system += voiceProfile.voiceSummary + '\n';
      }
      if (voiceProfile.styleGuide) {
        system += voiceProfile.styleGuide + '\n';
      }
      if (voiceProfile.sampleExcerpts && voiceProfile.sampleExcerpts.length > 0) {
        system += `\nReference excerpts demonstrating the target voice:\n`;
        for (const excerpt of voiceProfile.sampleExcerpts.slice(0, 3)) {
          system += `\n---\n${TokenEstimator.trimToFit(excerpt, 500)}\n---\n`;
        }
      }
    }

    // Task-specific instructions
    switch (task) {
      case 'write':
        system += `\n\n## Task Instructions\n`;
        system += `Write prose that continues the narrative naturally. `;
        system += `Match the established voice, tone, and style. `;
        system += `Show, don't tell. Use vivid sensory details. `;
        system += `Maintain consistent characterization. `;
        system += `Output ONLY the prose text — no meta-commentary, no headers, no explanations.`;
        break;

      case 'continue':
        system += `\n\n## Task Instructions\n`;
        system += `Continue the scene from exactly where it left off. `;
        system += `Maintain the same voice, tense, POV, and narrative flow. `;
        system += `Do not repeat any content that has already been written. `;
        system += `Output ONLY the continuation prose — no meta-commentary.`;
        break;

      case 'rewrite':
        system += `\n\n## Task Instructions\n`;
        system += `Rewrite the provided passage while preserving its narrative purpose and key events. `;
        system += `Improve prose quality, pacing, and voice consistency. `;
        system += `Output ONLY the rewritten prose — no explanations.`;
        break;

      case 'dialogue':
        system += `\n\n## Task Instructions\n`;
        system += `Write natural, character-appropriate dialogue. `;
        system += `Each character should have a distinct voice. `;
        system += `Include beats, action, and interiority between dialogue lines. `;
        system += `Output ONLY the prose — no meta-commentary.`;
        break;

      case 'describe':
        system += `\n\n## Task Instructions\n`;
        system += `Write vivid descriptive prose for the specified element. `;
        system += `Use sensory details and the POV character's perspective. `;
        system += `Weave description naturally into the narrative. `;
        system += `Output ONLY the prose — no meta-commentary.`;
        break;

      case 'brainstorm':
        system += `\n\n## Task Instructions\n`;
        system += `Help brainstorm ideas for the story. `;
        system += `Be creative but stay consistent with established characters, world, and plot. `;
        system += `Provide multiple options when possible. `;
        system += `Be concise and actionable.`;
        break;

      case 'outline':
        system += `\n\n## Task Instructions\n`;
        system += `Create a structured outline or plan. `;
        system += `Be specific about plot points, character arcs, and scene goals. `;
        system += `Consider pacing and narrative structure.`;
        break;

      case 'edit':
        system += `\n\n## Task Instructions\n`;
        system += `Provide editorial feedback on the provided text. `;
        system += `Focus on: prose quality, pacing, characterization, dialogue, `;
        system += `show vs tell, and narrative tension. `;
        system += `Be specific and constructive. Reference line-level issues.`;
        break;
    }

    return system;
  }

  // --- Entity context formatting ---

  formatEntities(entities, maxTokens = 2000) {
    if (!entities || entities.length === 0) return '';

    const grouped = {};
    for (const entity of entities) {
      const type = entity.type || 'other';
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(entity);
    }

    let text = '## Story Elements\n\n';

    const typeLabels = {
      character: 'Characters',
      location: 'Locations',
      item: 'Items',
      faction: 'Factions',
      concept: 'Concepts',
      other: 'Other'
    };

    for (const [type, items] of Object.entries(grouped)) {
      text += `### ${typeLabels[type] || type}\n`;
      for (const item of items) {
        text += `**${item.name}**`;
        if (item.aliases && item.aliases.length > 0) {
          text += ` (also: ${item.aliases.join(', ')})`;
        }
        text += `: ${item.description || 'No description'}`;
        if (item.notes) {
          text += ` — ${item.notes}`;
        }
        text += '\n';
      }
      text += '\n';
    }

    return TokenEstimator.trimToFit(text, maxTokens);
  }

  formatWorldNotes(worldNotes, maxTokens = 1000) {
    if (!worldNotes || worldNotes.length === 0) return '';

    let text = '## World Notes\n\n';

    for (const note of worldNotes) {
      text += `**${note.title}** (${note.category}): ${note.content}\n`;
    }

    return TokenEstimator.trimToFit(text, maxTokens);
  }

  // --- Narrative context formatting ---

  formatNarrativeContext(context, maxTokens = 4000) {
    const { precedingChapterScenes, precedingScenes, scene } = context;
    let text = '';

    // Previous chapter endings for broader context
    if (precedingChapterScenes.length > 0) {
      text += '## Previous Chapter Context\n\n';
      for (const { chapter, lastScene } of precedingChapterScenes) {
        text += `### End of "${chapter.title}"\n`;
        const excerpt = TokenEstimator.trimToFit(
          lastScene.content || '',
          500
        );
        text += excerpt + '\n\n';
      }
    }

    // Preceding scenes in current chapter
    if (precedingScenes.length > 0) {
      text += '## Earlier in This Chapter\n\n';

      for (const ps of precedingScenes) {
        const tokenBudget = Math.floor(2000 / precedingScenes.length);
        const excerpt = TokenEstimator.trimToFit(
          ps.content || '',
          tokenBudget
        );
        text += `### ${ps.title}\n${excerpt}\n\n`;
      }
    }

    return TokenEstimator.trimToFit(text, maxTokens);
  }

  // --- Scene metadata ---

  formatSceneMetadata(context) {
    const { chapter, scene, currentSceneIndex, chapterScenes } = context;

    let text = `## Current Scene\n`;
    text += `Chapter: "${chapter.title}"\n`;
    text += `Scene: "${scene.title}" (${currentSceneIndex + 1} of ${chapterScenes.length})\n`;

    if (scene.synopsis) {
      text += `Scene Synopsis: ${scene.synopsis}\n`;
    }
    if (scene.notes) {
      text += `Scene Notes: ${scene.notes}\n`;
    }
    if (scene.pov) {
      text += `POV Character: ${scene.pov}\n`;
    }
    if (scene.location) {
      text += `Location: ${scene.location}\n`;
    }
    if (scene.timeframe) {
      text += `Timeframe: ${scene.timeframe}\n`;
    }

    return text;
  }

  // --- Story structure overview ---

  formatStoryStructure(context) {
    const { allChapters, currentChapterIndex } = context;

    let text = '## Story Structure\n\n';

    for (let i = 0; i < allChapters.length; i++) {
      const marker = i === currentChapterIndex ? '>>> ' : '    ';
      text += `${marker}${i + 1}. ${allChapters[i].title}`;
      if (allChapters[i].synopsis) {
        text += ` — ${allChapters[i].synopsis}`;
      }
      text += '\n';
    }

    return text;
  }

  // --- Full prompt assembly ---

  async buildWritePrompt(sceneId, userInstruction = '') {
    const context = await this.gatherSceneContext(sceneId);

    const system = this.buildSystemPrompt(context, 'write');

    const contextParts = [];

    // Story structure (compact)
    contextParts.push(this.formatStoryStructure(context));

    // Entities
    const entityText = this.formatEntities(context.entities);
    if (entityText) contextParts.push(entityText);

    // World notes
    const worldText = this.formatWorldNotes(context.worldNotes);
    if (worldText) contextParts.push(worldText);

    // Narrative context (preceding content)
    contextParts.push(this.formatNarrativeContext(context));

    // Current scene metadata
    contextParts.push(this.formatSceneMetadata(context));

    const contextMessage = contextParts.join('\n\n');

    const messages = [
      { role: 'system', content: system },
      { role: 'user', content: contextMessage }
    ];

    // If scene already has content, include it
    if (context.scene.content && context.scene.content.trim()) {
      messages.push({
        role: 'user',
        content: `## Current Scene Content\n\n${context.scene.content}`
      });
    }

    // User instruction
    let instruction = userInstruction || 'Write the next portion of this scene.';
    if (context.scene.synopsis && !userInstruction) {
      instruction = `Write this scene. Scene goal: ${context.scene.synopsis}`;
    }

    messages.push({
      role: 'user',
      content: instruction
    });

    return messages;
  }

  async buildContinuePrompt(sceneId, existingContent) {
    const context = await this.gatherSceneContext(sceneId);

    const system = this.buildSystemPrompt(context, 'continue');

    const contextParts = [];
    contextParts.push(this.formatStoryStructure(context));

    const entityText = this.formatEntities(context.entities, 1000);
    if (entityText) contextParts.push(entityText);

    contextParts.push(this.formatNarrativeContext(context, 2000));
    contextParts.push(this.formatSceneMetadata(context));

    const contextMessage = contextParts.join('\n\n');

    // For continuation, we want the tail end of existing content
    const contentTail = TokenEstimator.trimToFit(
      existingContent || context.scene.content || '',
      3000
    );

    const messages = [
      { role: 'system', content: system },
      { role: 'user', content: contextMessage },
      {
        role: 'user',
        content: `## Text to Continue From\n\n${contentTail}\n\n---\n\nContinue writing from exactly where this leaves off. Do not repeat any of the above text.`
      }
    ];

    return messages;
  }

  async buildRewritePrompt(sceneId, selectedText, instruction = '') {
    const context = await this.gatherSceneContext(sceneId);

    const system = this.buildSystemPrompt(context, 'rewrite');

    const contextParts = [];

    const entityText = this.formatEntities(context.entities, 1000);
    if (entityText) contextParts.push(entityText);

    contextParts.push(this.formatSceneMetadata(context));

    const contextMessage = contextParts.join('\n\n');

    const rewriteInstruction = instruction
      ? `Rewrite the following passage. Specific guidance: ${instruction}`
      : 'Rewrite the following passage, improving prose quality while maintaining the same events and meaning.';

    const messages = [
      { role: 'system', content: system },
      { role: 'user', content: contextMessage },
      {
        role: 'user',
        content: `${rewriteInstruction}\n\n## Passage to Rewrite\n\n${selectedText}`
      }
    ];

    return messages;
  }

  async buildBrainstormPrompt(projectId, topic, additionalContext = '') {
    const project = await this.db.projects.get(projectId);
    if (!project) throw new Error('Project not found');

    const entities = await this.db.entities
      .where('projectId').equals(projectId)
      .toArray();

    const worldNotes = await this.db.worldNotes
      .where('projectId').equals(projectId)
      .toArray();

    const system = `You are an expert fiction writer and creative collaborator. You are working on a ${project.genre || 'fiction'} novel titled "${project.title}".

## Task Instructions
Help brainstorm ideas for the story. Be creative but stay consistent with established characters, world, and plot. Provide multiple options when possible. Be concise and actionable.`;

    const contextParts = [];

    if (project.description) {
      contextParts.push(`## Project Description\n${project.description}`);
    }

    const entityText = this.formatEntities(entities, 1500);
    if (entityText) contextParts.push(entityText);

    const worldText = this.formatWorldNotes(worldNotes, 1000);
    if (worldText) contextParts.push(worldText);

    if (additionalContext) {
      contextParts.push(`## Additional Context\n${additionalContext}`);
    }

    const contextMessage = contextParts.join('\n\n');

    const messages = [
      { role: 'system', content: system }
    ];

    if (contextMessage.trim()) {
      messages.push({ role: 'user', content: contextMessage });
    }

    messages.push({
      role: 'user',
      content: topic
    });

    return messages;
  }

  async buildEditPrompt(sceneId, textToEdit) {
    const context = await this.gatherSceneContext(sceneId);

    const system = this.buildSystemPrompt(context, 'edit');

    const contextParts = [];
    contextParts.push(this.formatSceneMetadata(context));

    const entityText = this.formatEntities(context.entities, 800);
    if (entityText) contextParts.push(entityText);

    const contextMessage = contextParts.join('\n\n');

    const messages = [
      { role: 'system', content: system },
      { role: 'user', content: contextMessage },
      {
        role: 'user',
        content: `Please provide editorial feedback on the following passage:\n\n---\n\n${textToEdit}\n\n---\n\nFocus on prose quality, pacing, characterization, and areas for improvement.`
      }
    ];

    return messages;
  }

  async buildCustomPrompt(projectId, systemOverride, userMessage) {
    const project = await this.db.projects.get(projectId);

    const system = systemOverride || `You are an expert fiction writer helping with a ${project?.genre || 'fiction'} novel titled "${project?.title || 'Untitled'}". Be helpful, creative, and concise.`;

    return [
      { role: 'system', content: system },
      { role: 'user', content: userMessage }
    ];
  }
}
