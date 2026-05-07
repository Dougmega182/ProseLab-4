// src/llm/contextBuilder.js

import { TokenEstimator } from './tokenEstimator.js';

export class ContextBuilder {
  constructor(projectStore, options = {}) {
    this.store = projectStore;
    this.maxTokens = options.maxContextTokens || 8000;
  }

  buildContext(options = {}) {
    const {
      currentChapterId = null,
      currentText = null,
      taskType = 'general',
      includeCharacters = true,
      includeWorldBuilding = true,
      includeOutline = true,
      includePreviousChapters = true,
      maxPreviousChapters = 2,
    } = options;

    const sections = [];
    let tokenBudget = this.maxTokens;

    // 1. Project overview (always include, small cost)
    const projectSection = this.buildProjectSection();
    if (projectSection) {
      const tokens = TokenEstimator.estimate(projectSection);
      if (tokens <= tokenBudget) {
        sections.push(projectSection);
        tokenBudget -= tokens;
      }
    }

    // 2. Characters relevant to current context
    if (includeCharacters) {
      const charBudget = Math.min(Math.floor(tokenBudget * 0.25), 2000);
      const charSection = this.buildCharacterSection(currentChapterId, charBudget);
      if (charSection) {
        const tokens = TokenEstimator.estimate(charSection);
        sections.push(charSection);
        tokenBudget -= tokens;
      }
    }

    // 3. World-building details
    if (includeWorldBuilding) {
      const worldBudget = Math.min(Math.floor(tokenBudget * 0.2), 1500);
      const worldSection = this.buildWorldSection(worldBudget);
      if (worldSection) {
        const tokens = TokenEstimator.estimate(worldSection);
        sections.push(worldSection);
        tokenBudget -= tokens;
      }
    }

    // 4. Story outline / plot structure
    if (includeOutline) {
      const outlineBudget = Math.min(Math.floor(tokenBudget * 0.15), 1000);
      const outlineSection = this.buildOutlineSection(outlineBudget);
      if (outlineSection) {
        const tokens = TokenEstimator.estimate(outlineSection);
        sections.push(outlineSection);
        tokenBudget -= tokens;
      }
    }

    // 5. Previous chapter summaries for continuity
    if (includePreviousChapters && currentChapterId) {
      const prevBudget = Math.min(Math.floor(tokenBudget * 0.3), 2000);
      const prevSection = this.buildPreviousChaptersSection(
        currentChapterId,
        maxPreviousChapters,
        prevBudget
      );
      if (prevSection) {
        const tokens = TokenEstimator.estimate(prevSection);
        sections.push(prevSection);
        tokenBudget -= tokens;
      }
    }

    // 6. Current text context (the tail end of what's been written)
    if (currentText) {
      const textBudget = Math.min(tokenBudget, 2000);
      const textSection = this.buildCurrentTextSection(currentText, textBudget);
      if (textSection) {
        sections.push(textSection);
      }
    }

    return sections.length > 0 ? sections.join('\n\n') : '';
  }

  buildProjectSection() {
    const project = this.store.getProject?.();
    if (!project) return null;

    const parts = ['## Project Overview'];

    if (project.title) parts.push(`**Title:** ${project.title}`);
    if (project.genre) parts.push(`**Genre:** ${project.genre}`);
    if (project.targetAudience) parts.push(`**Target Audience:** ${project.targetAudience}`);
    if (project.pov) parts.push(`**Point of View:** ${project.pov}`);
    if (project.tense) parts.push(`**Tense:** ${project.tense}`);
    if (project.tone) parts.push(`**Tone:** ${project.tone}`);
    if (project.synopsis) parts.push(`**Synopsis:** ${project.synopsis}`);
    if (project.themes && project.themes.length > 0) {
      parts.push(`**Themes:** ${project.themes.join(', ')}`);
    }
    if (project.styleNotes) parts.push(`**Style Notes:** ${project.styleNotes}`);

    return parts.length > 1 ? parts.join('\n') : null;
  }

  buildCharacterSection(currentChapterId, tokenBudget) {
    const characters = this.store.getCharacters?.() || [];
    if (characters.length === 0) return null;

    const parts = ['## Characters'];
    let tokens = TokenEstimator.estimate(parts[0]);

    // Sort: main characters first, then by relevance to current chapter
    const sorted = [...characters].sort((a, b) => {
      const roleOrder = { protagonist: 0, antagonist: 1, major: 2, supporting: 3, minor: 4 };
      return (roleOrder[a.role] || 5) - (roleOrder[b.role] || 5);
    });

    for (const char of sorted) {
      const charDesc = this.formatCharacter(char);
      const charTokens = TokenEstimator.estimate(charDesc);

      if (tokens + charTokens > tokenBudget) break;

      parts.push(charDesc);
      tokens += charTokens;
    }

    return parts.length > 1 ? parts.join('\n\n') : null;
  }

  formatCharacter(char) {
    const lines = [`### ${char.name}`];

    if (char.role) lines.push(`**Role:** ${char.role}`);
    if (char.age) lines.push(`**Age:** ${char.age}`);
    if (char.description) lines.push(`**Description:** ${char.description}`);
    if (char.personality) lines.push(`**Personality:** ${char.personality}`);
    if (char.motivation) lines.push(`**Motivation:** ${char.motivation}`);
    if (char.speechPattern) lines.push(`**Speech Pattern:** ${char.speechPattern}`);
    if (char.backstory) lines.push(`**Backstory:** ${this.truncate(char.backstory, 200)}`);

    if (char.relationships && char.relationships.length > 0) {
      const rels = char.relationships
        .map(r => `${r.character}: ${r.relationship}`)
        .join('; ');
      lines.push(`**Relationships:** ${rels}`);
    }

    return lines.join('\n');
  }

  buildWorldSection(tokenBudget) {
    const entries = this.store.getWorldEntries?.() || [];
    if (entries.length === 0) return null;

    const parts = ['## World Building'];
    let tokens = TokenEstimator.estimate(parts[0]);

    for (const entry of entries) {
      const entryDesc = this.formatWorldEntry(entry);
      const entryTokens = TokenEstimator.estimate(entryDesc);

      if (tokens + entryTokens > tokenBudget) break;

      parts.push(entryDesc);
      tokens += entryTokens;
    }

    return parts.length > 1 ? parts.join('\n\n') : null;
  }

  formatWorldEntry(entry) {
    const lines = [`### ${entry.name || entry.title}`];

    if (entry.category) lines.push(`**Category:** ${entry.category}`);
    if (entry.description) lines.push(this.truncate(entry.description, 300));

    if (entry.facts && entry.facts.length > 0) {
      lines.push(`**Key Facts:** ${entry.facts.join('; ')}`);
    }

    return lines.join('\n');
  }

  buildOutlineSection(tokenBudget) {
    const chapters = this.store.getChapters?.() || [];
    if (chapters.length === 0) return null;

    const parts = ['## Story Outline'];
    let tokens = TokenEstimator.estimate(parts[0]);

    for (const chapter of chapters) {
      const line = `- **Chapter ${chapter.order || ''}${chapter.title ? ': ' + chapter.title : ''}**${chapter.synopsis ? ' — ' + this.truncate(chapter.synopsis, 100) : ''}`;
      const lineTokens = TokenEstimator.estimate(line);

      if (tokens + lineTokens > tokenBudget) break;

      parts.push(line);
      tokens += lineTokens;
    }

    return parts.length > 1 ? parts.join('\n') : null;
  }

  buildPreviousChaptersSection(currentChapterId, maxChapters, tokenBudget) {
    const chapters = this.store.getChapters?.() || [];
    const currentIndex = chapters.findIndex(c => c.id === currentChapterId);

    if (currentIndex <= 0) return null;

    const parts = ['## Previous Chapter Context'];
    let tokens = TokenEstimator.estimate(parts[0]);

    const startIndex = Math.max(0, currentIndex - maxChapters);

    for (let i = startIndex; i < currentIndex; i++) {
      const chapter = chapters[i];
      let section = `### Chapter ${chapter.order || i + 1}${chapter.title ? ': ' + chapter.title : ''}`;

      // Use summary if available, otherwise use truncated content
      if (chapter.summary) {
        section += `\n${chapter.summary}`;
      } else if (chapter.content) {
        section += `\n${this.truncate(chapter.content, 500)}`;
      }

      const sectionTokens = TokenEstimator.estimate(section);
      if (tokens + sectionTokens > tokenBudget) break;

      parts.push(section);
      tokens += sectionTokens;
    }

    return parts.length > 1 ? parts.join('\n\n') : null;
  }

  buildCurrentTextSection(currentText, tokenBudget) {
    if (!currentText || currentText.trim().length === 0) return null;

    const maxChars = tokenBudget * 4; // rough estimate
    let text = currentText;

    if (text.length > maxChars) {
      // Take the tail end — most relevant for continuation
      text = '...' + text.slice(-maxChars);
    }

    return `## Current Text\n\n${text}`;
  }

  truncate(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength).trim() + '...';
  }
}
