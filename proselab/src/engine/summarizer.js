/**
 * Summarizer
 * Generates and maintains hierarchical summaries (Scene -> Chapter -> Project).
 * Features progressive compression for rolling history and concurrency management.
 */

export class Summarizer {
  constructor(db, llm) {
    this.db = db;
    this.llm = llm;
    this.pendingSummaries = new Set();
  }

  async summarizeScene(sceneId) {
    if (this.pendingSummaries.has(sceneId)) return;
    this.pendingSummaries.add(sceneId);

    try {
      const scene = await this.db.scenes.get(sceneId);
      if (!scene || !scene.prose || scene.prose.trim().length < 200) return;

      const messages = [
        {
          role: 'system',
          content: `You are a precise story summarizer. Summarize the following scene in 2-4 sentences, capturing the key plot events, character actions, emotional beats, and any important revelations or changes. Be factual and specific. Do not editorialize.`
        },
        {
          role: 'user',
          content: scene.prose
        }
      ];

      const result = await this.llm.chat(messages, {
        purpose: 'summarization',
        temperature: 0.3,
        max_tokens: 300
      });

      await this.db.scenes.update(sceneId, {
        summary: result.content
      });

      // Check if we should update the chapter summary too
      const chapter = await this.db.chapters.get(scene.chapterId);
      if (chapter) {
        await this.maybeUpdateChapterSummary(chapter.id);
      }

      return result.content;
    } finally {
      this.pendingSummaries.delete(sceneId);
    }
  }

  async maybeUpdateChapterSummary(chapterId) {
    const scenes = await this.db.scenes
      .where('chapterId').equals(chapterId)
      .sortBy('order');

    // Only update if all scenes have summaries
    const allSummarized = scenes.every(s => s.summary);
    if (!allSummarized || scenes.length === 0) return;

    const sceneSummaries = scenes
      .map(s => `${s.title || 'Untitled'}: ${s.summary}`)
      .join('\n\n');

    const messages = [
      {
        role: 'system',
        content: `You are a precise story summarizer. Given the scene-by-scene summaries of a chapter, produce a cohesive chapter summary in 3-5 sentences. Capture the main arc, key events, and character developments. Be factual and specific.`
      },
      {
        role: 'user',
        content: sceneSummaries
      }
    ];

    const result = await this.llm.chat(messages, {
      purpose: 'summarization',
      temperature: 0.3,
      max_tokens: 400
    });

    await this.db.chapters.update(chapterId, {
      summary: result.content
    });

    return result.content;
  }

  async regenerateSummary(sceneId) {
    // Force regeneration by clearing existing summary first
    await this.db.scenes.update(sceneId, { summary: null });
    return this.summarizeScene(sceneId);
  }

  async summarizeText(text, maxSentences = 3) {
    const messages = [
      {
        role: 'system',
        content: `Summarize the following text in ${maxSentences} sentences or fewer. Be precise and factual.`
      },
      {
        role: 'user',
        content: text
      }
    ];

    const result = await this.llm.chat(messages, {
      purpose: 'summarization',
      temperature: 0.3,
      max_tokens: 200
    });

    return result.content;
  }

  async getProgressiveSummary(projectId, upToChapterOrder) {
    const chapters = await this.db.chapters
      .where('projectId').equals(projectId)
      .sortBy('order');

    const relevantChapters = chapters.filter(c => c.order < upToChapterOrder);

    if (relevantChapters.length === 0) return null;

    // If few chapters, just concatenate summaries
    if (relevantChapters.length <= 5) {
      return relevantChapters
        .filter(c => c.summary)
        .map(c => `${c.title || 'Untitled'}: ${c.summary}`)
        .join('\n\n');
    }

    // For many chapters, create a rolling summary
    // Older chapters get compressed more aggressively
    const recentCount = 3;
    const olderChapters = relevantChapters.slice(0, -recentCount);
    const recentChapters = relevantChapters.slice(-recentCount);

    let olderSummary = '';
    if (olderChapters.length > 0) {
      const olderText = olderChapters
        .filter(c => c.summary)
        .map(c => `${c.title || 'Untitled'}: ${c.summary}`)
        .join('\n\n');

      if (olderText.length > 2000) {
        olderSummary = await this.summarizeText(olderText, 5);
      } else {
        olderSummary = olderText;
      }
    }

    const recentSummary = recentChapters
      .filter(c => c.summary)
      .map(c => `${c.title || 'Untitled'}: ${c.summary}`)
      .join('\n\n');

    let combined = '';
    if (olderSummary) {
      combined += `### Earlier in the story:\n${olderSummary}\n\n`;
    }
    if (recentSummary) {
      combined += `### Recent chapters:\n${recentSummary}`;
    }

    return combined;
  }
}
