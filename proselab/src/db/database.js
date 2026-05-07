import Dexie from 'dexie';

/**
 * StoryDatabase
 * Feature-rich Dexie.js wrapper for IndexedDB.
 * Manages hierarchical narrative data, atomic transactions, versioning (snapshots), 
 * analytics, and high-fidelity project serialization/export.
 */
export class StoryDatabase extends Dexie {
  constructor() {
    super('StoryForgeDB');

    this.version(1).stores({
      projects: 'id, title, createdAt, updatedAt',
      chapters: 'id, projectId, order, title',
      scenes: 'id, chapterId, order, title',
      entities: 'id, projectId, type, name',
      worldNotes: 'id, projectId, category, title',
      voiceProfiles: 'id, projectId',
      generationLogs: 'id, sceneId, createdAt',
      snapshots: 'id, sceneId, createdAt',
      settings: 'key'
    });

    this.projects = this.table('projects');
    this.chapters = this.table('chapters');
    this.scenes = this.table('scenes');
    this.entities = this.table('entities');
    this.worldNotes = this.table('worldNotes');
    this.voiceProfiles = this.table('voiceProfiles');
    this.generationLogs = this.table('generationLogs');
    this.snapshots = this.table('snapshots');
    this.settings = this.table('settings');
  }

  // --- Project operations ---

  async createProject(data) {
    const project = {
      id: crypto.randomUUID(),
      title: data.title || 'Untitled Project',
      description: data.description || '',
      genre: data.genre || '',
      settings: data.settings || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await this.projects.add(project);
    return project;
  }

  async updateProject(projectId, updates) {
    await this.projects.update(projectId, {
      ...updates,
      updatedAt: new Date().toISOString()
    });
    return this.projects.get(projectId);
  }

  async deleteProject(projectId) {
    await this.transaction('rw',
      [this.projects, this.chapters, this.scenes, this.entities,
       this.worldNotes, this.voiceProfiles, this.generationLogs, this.snapshots],
      async () => {
        const chapters = await this.chapters.where('projectId').equals(projectId).toArray();
        const chapterIds = chapters.map(c => c.id);

        for (const chapterId of chapterIds) {
          const scenes = await this.scenes.where('chapterId').equals(chapterId).toArray();
          const sceneIds = scenes.map(s => s.id);

          for (const sceneId of sceneIds) {
            await this.generationLogs.where('sceneId').equals(sceneId).delete();
            await this.snapshots.where('sceneId').equals(sceneId).delete();
          }

          await this.scenes.where('chapterId').equals(chapterId).delete();
        }

        await this.chapters.where('projectId').equals(projectId).delete();
        await this.entities.where('projectId').equals(projectId).delete();
        await this.worldNotes.where('projectId').equals(projectId).delete();
        await this.voiceProfiles.where('projectId').equals(projectId).delete();
        await this.projects.delete(projectId);
      }
    );
  }

  // --- Chapter operations ---

  async createChapter(projectId, data = {}) {
    const existingChapters = await this.chapters
      .where('projectId').equals(projectId)
      .sortBy('order');

    const maxOrder = existingChapters.length > 0
      ? Math.max(...existingChapters.map(c => c.order))
      : -1;

    const chapter = {
      id: crypto.randomUUID(),
      projectId,
      title: data.title || `Chapter ${maxOrder + 2}`,
      summary: data.summary || '',
      outline: data.outline || '',
      order: maxOrder + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await this.chapters.add(chapter);
    return chapter;
  }

  async reorderChapters(projectId, orderedIds) {
    await this.transaction('rw', this.chapters, async () => {
      for (let i = 0; i < orderedIds.length; i++) {
        await this.chapters.update(orderedIds[i], { order: i });
      }
    });
  }

  async deleteChapter(chapterId) {
    await this.transaction('rw',
      [this.chapters, this.scenes, this.generationLogs, this.snapshots],
      async () => {
        const scenes = await this.scenes.where('chapterId').equals(chapterId).toArray();

        for (const scene of scenes) {
          await this.generationLogs.where('sceneId').equals(scene.id).delete();
          await this.snapshots.where('sceneId').equals(scene.id).delete();
        }

        await this.scenes.where('chapterId').equals(chapterId).delete();
        await this.chapters.delete(chapterId);
      }
    );
  }

  // --- Scene operations ---

  async createScene(chapterId, data = {}) {
    const existingScenes = await this.scenes
      .where('chapterId').equals(chapterId)
      .sortBy('order');

    const maxOrder = existingScenes.length > 0
      ? Math.max(...existingScenes.map(s => s.order))
      : -1;

    const scene = {
      id: crypto.randomUUID(),
      chapterId,
      title: data.title || `Scene ${maxOrder + 2}`,
      content: data.content || '',
      summary: data.summary || '',
      outline: data.outline || '',
      characters: data.characters || [],
      location: data.location || '',
      notes: data.notes || '',
      order: maxOrder + 1,
      wordCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await this.scenes.add(scene);
    return scene;
  }

  async updateSceneContent(sceneId, content) {
    const wordCount = content
      ? content.trim().split(/\s+/).filter(w => w.length > 0).length
      : 0;

    // Create a snapshot of the previous version
    const existing = await this.scenes.get(sceneId);
    if (existing && existing.content && existing.content !== content) {
      await this.createSnapshot(sceneId, existing.content);
    }

    await this.scenes.update(sceneId, {
      content,
      wordCount,
      updatedAt: new Date().toISOString()
    });
  }

  async reorderScenes(chapterId, orderedIds) {
    await this.transaction('rw', this.scenes, async () => {
      for (let i = 0; i < orderedIds.length; i++) {
        await this.scenes.update(orderedIds[i], { order: i });
      }
    });
  }

  // --- Snapshot operations (version history) ---

  async createSnapshot(sceneId, content) {
    const snapshot = {
      id: crypto.randomUUID(),
      sceneId,
      content,
      wordCount: content ? content.trim().split(/\s+/).filter(w => w.length > 0).length : 0,
      createdAt: new Date().toISOString()
    };

    await this.snapshots.add(snapshot);

    // Keep only the last 50 snapshots per scene
    const allSnapshots = await this.snapshots
      .where('sceneId').equals(sceneId)
      .sortBy('createdAt');

    if (allSnapshots.length > 50) {
      const toDelete = allSnapshots.slice(0, allSnapshots.length - 50);
      await this.snapshots.bulkDelete(toDelete.map(s => s.id));
    }

    return snapshot;
  }

  async getSnapshots(sceneId) {
    return this.snapshots
      .where('sceneId').equals(sceneId)
      .reverse()
      .sortBy('createdAt');
  }

  async restoreSnapshot(sceneId, snapshotId) {
    const snapshot = await this.snapshots.get(snapshotId);
    if (!snapshot) throw new Error('Snapshot not found');

    // Save current content as a snapshot before restoring
    const current = await this.scenes.get(sceneId);
    if (current && current.content) {
      await this.createSnapshot(sceneId, current.content);
    }

    await this.updateSceneContent(sceneId, snapshot.content);
    return snapshot.content;
  }

  // --- Generation log operations ---

  async logGeneration(sceneId, data) {
    const log = {
      id: crypto.randomUUID(),
      sceneId,
      prompt: data.prompt,
      promptTokens: data.promptTokens || 0,
      completionTokens: data.completionTokens || 0,
      totalTokens: (data.promptTokens || 0) + (data.completionTokens || 0),
      model: data.model || '',
      temperature: data.temperature || 0,
      generatedText: data.generatedText || '',
      createdAt: new Date().toISOString()
    };

    await this.generationLogs.add(log);
    return log;
  }

  async getGenerationLogs(sceneId, limit = 20) {
    const logs = await this.generationLogs
      .where('sceneId').equals(sceneId)
      .reverse()
      .sortBy('createdAt');

    return logs.slice(0, limit);
  }

  // --- World notes operations ---

  async createWorldNote(projectId, data) {
    const note = {
      id: crypto.randomUUID(),
      projectId,
      category: data.category || 'general',
      title: data.title || 'Untitled Note',
      content: data.content || '',
      tags: data.tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await this.worldNotes.add(note);
    return note;
  }

  async getWorldNotes(projectId, category = null) {
    const query = this.worldNotes.where('projectId').equals(projectId);
    const notes = await query.toArray();

    if (category) {
      return notes.filter(n => n.category === category);
    }

    return notes;
  }

  // --- Settings operations ---

  async getSetting(key, defaultValue = null) {
    const setting = await this.settings.get(key);
    return setting ? setting.value : defaultValue;
  }

  async setSetting(key, value) {
    await this.settings.put({ key, value });
  }

  // --- Statistics ---

  async getProjectStats(projectId) {
    const chapters = await this.chapters
      .where('projectId').equals(projectId)
      .toArray();

    let totalWords = 0;
    let totalScenes = 0;
    const logs = [];

    for (const chapter of chapters) {
      const scenes = await this.scenes
        .where('chapterId').equals(chapter.id)
        .toArray();

      totalScenes += scenes.length;
      totalWords += scenes.reduce((sum, s) => sum + (s.wordCount || 0), 0);

      for (const scene of scenes) {
        const sceneLogs = await this.generationLogs
          .where('sceneId').equals(scene.id)
          .toArray();
        logs.push(...sceneLogs);
      }
    }

    const totalTokensUsed = logs.reduce((sum, l) => sum + (l.totalTokens || 0), 0);

    return {
      chapterCount: chapters.length,
      sceneCount: totalScenes,
      totalWords,
      totalGenerations: logs.length,
      totalTokensUsed
    };
  }

  // --- Export ---

  async exportProject(projectId) {
    const project = await this.projects.get(projectId);
    if (!project) throw new Error('Project not found');

    const chapters = await this.chapters
      .where('projectId').equals(projectId)
      .sortBy('order');

    const exportData = {
      project,
      chapters: [],
      entities: await this.entities.where('projectId').equals(projectId).toArray(),
      worldNotes: await this.worldNotes.where('projectId').equals(projectId).toArray(),
      voiceProfile: await this.voiceProfiles.where('projectId').equals(projectId).first(),
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };

    for (const chapter of chapters) {
      const scenes = await this.scenes
        .where('chapterId').equals(chapter.id)
        .sortBy('order');

      exportData.chapters.push({
        ...chapter,
        scenes
      });
    }

    return exportData;
  }

  async importProject(exportData) {
    if (!exportData || !exportData.project) {
      throw new Error('Invalid export data');
    }

    const newProjectId = crypto.randomUUID();
    const idMap = new Map();

    await this.transaction('rw',
      [this.projects, this.chapters, this.scenes, this.entities,
       this.worldNotes, this.voiceProfiles],
      async () => {
        await this.projects.add({
          ...exportData.project,
          id: newProjectId,
          title: exportData.project.title + ' (Imported)',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        for (const chapterData of (exportData.chapters || [])) {
          const newChapterId = crypto.randomUUID();
          idMap.set(chapterData.id, newChapterId);

          const { scenes, ...chapterFields } = chapterData;

          await this.chapters.add({
            ...chapterFields,
            id: newChapterId,
            projectId: newProjectId
          });

          for (const scene of (scenes || [])) {
            const newSceneId = crypto.randomUUID();
            idMap.set(scene.id, newSceneId);

            await this.scenes.add({
              ...scene,
              id: newSceneId,
              chapterId: newChapterId
            });
          }
        }

        for (const entity of (exportData.entities || [])) {
          await this.entities.add({
            ...entity,
            id: crypto.randomUUID(),
            projectId: newProjectId
          });
        }

        for (const note of (exportData.worldNotes || [])) {
          await this.worldNotes.add({
            ...note,
            id: crypto.randomUUID(),
            projectId: newProjectId
          });
        }

        if (exportData.voiceProfile) {
          await this.voiceProfiles.add({
            ...exportData.voiceProfile,
            id: crypto.randomUUID(),
            projectId: newProjectId
          });
        }
      }
    );

    return newProjectId;
  }

  async exportAsMarkdown(projectId) {
    const project = await this.projects.get(projectId);
    if (!project) throw new Error('Project not found');

    const chapters = await this.chapters
      .where('projectId').equals(projectId)
      .sortBy('order');

    let markdown = `# ${project.title}\n\n`;

    if (project.description) {
      markdown += `${project.description}\n\n---\n\n`;
    }

    for (const chapter of chapters) {
      markdown += `## ${chapter.title}\n\n`;

      const scenes = await this.scenes
        .where('chapterId').equals(chapter.id)
        .sortBy('order');

      for (const scene of scenes) {
        if (scenes.length > 1) {
          markdown += `### ${scene.title}\n\n`;
        }
        markdown += `${scene.content || ''}\n\n`;
      }
    }

    return markdown;
  }
}

export const db = new StoryDatabase();
