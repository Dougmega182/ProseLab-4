/**
 * Scene Summarizer
 * Generates and caches hierarchical summaries (Scene -> Chapter) for context compression.
 * Features smart truncation for large scenes and invalidation tracking.
 */

export class SceneSummarizer {
  constructor(llm, db) {
    this.llm = llm;
    this.db = db;
    this.pendingInvalidations = new Set();
  }

  async summarize(sceneId, options = {}) {
    const { force = false } = options;

    const scene = await this.db.scenes.get(sceneId);
    if (!scene) throw new Error(`Scene not found: ${sceneId}`);

    // Return cached summary if valid
    if (!force && scene.summary && !this.pendingInvalidations.has(sceneId)) {
      return scene.summary;
    }

    if (!scene.prose || scene.prose.trim().length < 50) {
      return null;
    }

    const systemPrompt = `You are a precise story summarizer. Produce a concise summary of the scene that captures:
1. Key plot events and their sequence
2. Character actions and decisions
3. Important revelations or information
4. Emotional beats and relationship changes
5. Setting details if they're significant

The summary should be useful as context for generating subsequent scenes. Be factual and specific. Keep it under 300 words.`;

    // Truncate very long scenes (preserves context-rich head and tail)
    const maxContentChars = 20000;
    let content = scene.prose;
    if (content.length > maxContentChars) {
      const head = content.slice(0, Math.floor(maxContentChars * 0.3));
      const tail = content.slice(-Math.floor(maxContentChars * 0.7));
      content = head + '\n\n[...middle section omitted...]\n\n' + tail;
    }

    const result = await this.llm.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Summarize this scene titled "${scene.title || 'Untitled'}":\n\n${content}` }
    ], {
      purpose: 'summary',
      temperature: 0.2,
      max_tokens: 500
    });

    const summary = result.content.trim();

    // Cache the summary
    await this.db.scenes.update(sceneId, { summary });
    this.pendingInvalidations.delete(sceneId);

    return summary;
  }

  async invalidateSummary(sceneId) {
    this.pendingInvalidations.add(sceneId);
  }

  async summarizeChapter(chapterId) {
    const scenes = await this.db.scenes
      .where('chapterId').equals(chapterId)
      .sortBy('order');

    if (scenes.length === 0) return null;

    // Ensure all scenes have summaries
    const sceneSummaries = [];
    for (const scene of scenes) {
      if (scene.prose && scene.prose.trim().length > 50) {
        const summary = await this.summarize(scene.id);
        if (summary) {
          sceneSummaries.push({ title: scene.title, summary });
        }
      }
    }

    if (sceneSummaries.length === 0) return null;

    const systemPrompt = `You are a precise story summarizer. Given summaries of individual scenes within a chapter, produce a cohesive chapter summary that captures the overall arc, key events, and character developments. Keep it under 400 words.`;

    const sceneSummaryText = sceneSummaries
      .map((s, i) => `Scene ${i + 1}: "${s.title || 'Untitled'}"\n${s.summary}`)
      .join('\n\n');

    const chapter = await this.db.chapters.get(chapterId);

    const result = await this.llm.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Summarize this chapter titled "${chapter.title || 'Untitled'}":\n\n${sceneSummaryText}` }
    ], {
      purpose: 'summary',
      temperature: 0.2,
      max_tokens: 600
    });

    const summary = result.content.trim();

    await this.db.chapters.update(chapterId, { summary });

    return summary;
  }
}
