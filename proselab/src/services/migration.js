/**
 * migration.js - LocalStorage to IndexedDB migration utility
 * 
 * Transfers existing single-project data from localStorage into the new
 * structured IndexedDB Project/Scene model.
 */

import { initDB, createProject, createScene, listProjects, createChapter } from "./db.js";
import { loadProject } from "./storage.js";

export async function migrateIfNeeded() {
  const existingProjects = await listProjects();
  
  // Only migrate if DB is empty and localStorage has data
  if (existingProjects.length > 0) {
    console.log("Migration: IndexedDB already has data. Skipping.");
    return;
  }

  const oldProject = loadProject();
  if (!oldProject) {
    console.log("Migration: No legacy data found in localStorage.");
    return;
  }

  console.log("Migration: Legacy data found. Starting migration to IndexedDB...");

  try {
    // 1. Create the default project
    const projectId = crypto.randomUUID();
    const projectData = {
      id: projectId,
      title: oldProject.core?.title || "Legacy Project",
      genre: oldProject.core?.genre || "Unknown",
      core: oldProject.core || {},
      voice: oldProject.voice || {},
      settings: oldProject.settings || {},
      chars: oldProject.chars || [],
      rules: oldProject.rules || [],
      beats: oldProject.beats || [],
      // Keep everything else in metadata for now
      meta: oldProject
    };

    await createProject(projectData);
    
    // 1b. Create a default chapter
    const chapterId = crypto.randomUUID();
    await createChapter({
      id: chapterId,
      projectId: projectId,
      title: "Drafts",
      order: 0
    });

    // 2. Create the first scene from the existing editor text
    const sceneId = crypto.randomUUID();
    await createScene({
      id: sceneId,
      projectId: projectId,
      chapterId: chapterId,
      title: "First Scene",
      text: oldProject.text || "",
      modeFeedback: oldProject.modeFeedback || { ANALYSE: {}, ENGINEER: {}, MARKET: {}, VERDICT: {} },
      order: 0
    });

    console.log("Migration: Successfully moved legacy data to IndexedDB.");
    return { projectId, sceneId };
  } catch (error) {
    console.error("Migration: Failed to migrate legacy data", error);
  }
}
