/**
 * Storyforge Database
 * Local-first persistence layer using Dexie.js (IndexedDB).
 */

import Dexie from 'dexie';

export class StoryforgeDB extends Dexie {
  constructor() {
    super('storyforge');

    this.version(1).stores({
      // Projects table
      projects: '++id, title, createdAt, updatedAt',

      // Chapters — ordered within a project
      chapters: '++id, projectId, order, title, createdAt',

      // Scenes — ordered within a chapter
      scenes: '++id, chapterId, projectId, order, status, createdAt, updatedAt',

      // Scene versions — full version history for each scene
      sceneVersions: '++id, sceneId, version, createdAt',

      // Lore entities
      entities: '++id, projectId, name, type, updatedAt',

      // Contradictions flagged by the system
      contradictions: '++id, projectId, entityName, status, sceneId, createdAt',

      // Shadow actions pending review
      shadowActions: '++id, projectId, sceneId, type, status, createdAt',

      // Voice profiles
      voiceProfiles: '++id, projectId, createdAt',

      // Generation logs — every LLM call for cost tracking and debugging
      generationLogs: '++id, projectId, sceneId, stage, model, createdAt',

      // Outline nodes — hierarchical outline structure
      outlineNodes: '++id, projectId, parentId, order, type, createdAt',

      // Project settings
      projectSettings: 'projectId'
    });
  }
}

export const db = new StoryforgeDB();
