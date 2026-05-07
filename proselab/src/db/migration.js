/**
 * Migration Manager
 * Imports legacy ProseLab V4 localStorage data into StoryforgeDB.
 */

import { db } from '../db/index.js';

export class MigrationManager {
  static async migrateLegacyData(legacyData) {
    if (!legacyData) return;

    // Create a new project for the legacy data
    const projectId = crypto.randomUUID();
    
    await db.projects.add({
      id: projectId,
      title: legacyData.core?.title || 'Imported Project',
      genre: legacyData.core?.genre || '',
      logline: legacyData.core?.logline || '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    // Import Characters
    if (legacyData.chars && Array.isArray(legacyData.chars)) {
      for (const char of legacyData.chars) {
        await db.entities.add({
          id: char.id || crypto.randomUUID(),
          projectId,
          name: char.name,
          type: 'character',
          description: char.description || '',
          physicalDescription: char.appearance || '',
          currentState: char.state || {},
          permanentTraits: char.traits || {},
          aliases: char.aliases || [],
          notes: char.notes || '',
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      }
    }

    // Import Chapters and Scenes
    // Legacy tree structure: [{ id, title, scenes: [{ id, title, text, beat... }] }]
    if (legacyData.tree && Array.isArray(legacyData.tree)) {
      for (let i = 0; i < legacyData.tree.length; i++) {
        const legacyChapter = legacyData.tree[i];
        const chapterId = legacyChapter.id || crypto.randomUUID();

        await db.chapters.add({
          id: chapterId,
          projectId,
          title: legacyChapter.title || `Chapter ${i + 1}`,
          order: i,
          createdAt: Date.now()
        });

        if (legacyChapter.scenes && Array.isArray(legacyChapter.scenes)) {
          for (let j = 0; j < legacyChapter.scenes.length; j++) {
            const legacyScene = legacyChapter.scenes[j];
            await db.scenes.add({
              id: legacyScene.id || crypto.randomUUID(),
              chapterId,
              projectId,
              title: legacyScene.title || `Scene ${j + 1}`,
              order: j,
              beat: legacyScene.beat || '',
              prose: legacyScene.text || '',
              wordCount: (legacyScene.text || '').split(/\s+/).length,
              status: 'draft',
              createdAt: Date.now(),
              updatedAt: Date.now()
            });
          }
        }
      }
    }

    // Import World Rules
    if (legacyData.rules && Array.isArray(legacyData.rules)) {
      for (const rule of legacyData.rules) {
        await db.entities.add({
          id: rule.id || crypto.randomUUID(),
          projectId,
          name: rule.name || 'World Rule',
          type: 'concept',
          description: rule.description || '',
          notes: rule.notes || '',
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      }
    }

    return projectId;
  }
}
