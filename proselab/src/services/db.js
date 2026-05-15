import {
  buildProjectCascadeDeletionPlan,
  normalizeProjectStructureRecords,
  repairMalformedProjectRefsInRecords
} from "./projectStructure.js";

/**
 * db.js - IndexedDB Service for ProseLab V4
 * 
 * Provides a persistent local-first data store for Projects, Chapters, and Scenes.
 * This replaces the simple localStorage persistence for multi-document support.
 */

const DB_NAME = "proselab_db";
const DB_VERSION = 3;
const LOCAL_STORAGE_KEYS = [
  "proselab_v4",
  "plab_costs_v1",
  "plab_cache_v3",
  "plab_cache_enabled",
  "plab_cache_version_override",
  "proselab_shadow_log",
  "proselab_gate_telemetry"
];

/**
 * Initializes the database and handles upgrades.
 */
export function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Projects: Root container
      if (!db.objectStoreNames.contains("projects")) {
        const projectStore = db.createObjectStore("projects", { keyPath: "id" });
        projectStore.createIndex("updatedAt", "updatedAt");
      }

      // Chapters: Organizational folders
      if (!db.objectStoreNames.contains("chapters")) {
        const chapterStore = db.createObjectStore("chapters", { keyPath: "id" });
        chapterStore.createIndex("projectId", "projectId");
        chapterStore.createIndex("order", "order");
      }

      // Scenes: The atomic unit of prose
      if (!db.objectStoreNames.contains("scenes")) {
        const sceneStore = db.createObjectStore("scenes", { keyPath: "id" });
        sceneStore.createIndex("chapterId", "chapterId");
        sceneStore.createIndex("projectId", "projectId");
        sceneStore.createIndex("updatedAt", "updatedAt");
      }

      // Documents: Generic asset storage (Characters, Rules, Beats, etc.)
      if (!db.objectStoreNames.contains("documents")) {
        const docStore = db.createObjectStore("documents", { keyPath: "id" });
        docStore.createIndex("projectId", "projectId");
        docStore.createIndex("type", "type");
        docStore.createIndex("domain", "domain");
        docStore.createIndex("subdomain", "subdomain");
      }

      // Shadow Actions: Agent proposals
      if (!db.objectStoreNames.contains("shadow_actions")) {
        const shadowStore = db.createObjectStore("shadow_actions", { keyPath: "id" });
        shadowStore.createIndex("timestamp", "timestamp");
      }

      // Composition Metrics: Validation data
      if (!db.objectStoreNames.contains("composition_metrics")) {
        const metricStore = db.createObjectStore("composition_metrics", { keyPath: "id" });
        metricStore.createIndex("timestamp", "timestamp");
      }
    };
  });
}

/**
 * Generic CRUD wrapper
 */
/**
 * Generic CRUD wrapper
 */
export async function perform(storeName, mode, callback) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    
    // Support both sync and async callbacks
    const result = callback(store);
    
    if (result instanceof Promise) {
      result.then(res => resolve(res)).catch(err => reject(err));
    } else if (result && result.onsuccess !== undefined) {
      result.onsuccess = () => resolve(result.result);
      result.onerror = () => reject(result.error);
    } else {
      resolve(result);
    }
  });
}

export async function resetLocalAppData({ preserveAiConfig = true } = {}) {
  for (const key of LOCAL_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }

  if (!preserveAiConfig) {
    localStorage.removeItem("storyforge_ai_config");
  }

  const dbResult = await new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve({ status: "deleted" });
    request.onerror = () => resolve({ status: "error", error: request.error?.message || "Delete failed" });
    request.onblocked = () => resolve({ status: "blocked", error: "Close other ProseLab tabs and retry." });
  });

  return {
    clearedKeys: [...LOCAL_STORAGE_KEYS, ...(preserveAiConfig ? [] : ["storyforge_ai_config"])],
    db: dbResult
  };
}

/**
 * EXPORT ALL DATA (FOR MIGRATION)
 */
export async function exportAllData() {
  const [projects, chapters, scenes, documents] = await Promise.all([
    listProjects(),
    perform("chapters", "readonly", s => s.getAll()),
    perform("scenes", "readonly", s => s.getAll()),
    perform("documents", "readonly", s => s.getAll())
  ]);

  return { projects, chapters, scenes, documents };
}

// ═══════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════

// PROJECTS
export const createProject = (project) => 
  perform("projects", "readwrite", store => store.add({ ...project, createdAt: Date.now(), updatedAt: Date.now() }));

export const getProject = (id) =>
  id ? perform("projects", "readonly", store => store.get(id)) : Promise.resolve(null);

export const listProjects = () => 
  perform("projects", "readonly", async store => {
    const projects = await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    return [...projects].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  });

export const updateProject = (id, updates) => 
  perform("projects", "readwrite", async store => {
    const project = await new Promise(res => {
      const req = store.get(id);
      req.onsuccess = () => res(req.result);
    });
    if (!project) throw new Error("Project not found");
    return store.put({ ...project, ...updates, updatedAt: Date.now() });
  });

export const deleteProjectCascade = async (projectId) => {
  if (!projectId) return;

  const [chapters, scenes, documents] = await Promise.all([
    listChaptersByProject(projectId),
    listScenesByProject(projectId),
    listDocumentsByProject(projectId)
  ]);

  const plan = buildProjectCascadeDeletionPlan(projectId, chapters, scenes, documents);

  for (const sceneId of plan.sceneIds) {
    await deleteScene(sceneId);
  }

  for (const chapterId of plan.chapterIds) {
    await deleteChapter(chapterId);
  }

  for (const documentId of plan.documentIds) {
    await perform("documents", "readwrite", store => store.delete(documentId));
  }

  await perform("projects", "readwrite", store => store.delete(projectId));
};

// SCENES
export const createScene = (scene) => 
  perform("scenes", "readwrite", store => store.add({ 
    ...scene, 
    text: scene.text || "", 
    modeFeedback: scene.modeFeedback || {}, 
    createdAt: Date.now(), 
    updatedAt: Date.now() 
  }));

export const getScene = (id) =>
  id ? perform("scenes", "readonly", store => store.get(id)) : Promise.resolve(null);

export const listScenesByProject = (projectId) => 
  perform("scenes", "readonly", store => {
    const index = store.index("projectId");
    return index.getAll(projectId);
  });

export const listScenesByChapter = (chapterId) => 
  perform("scenes", "readonly", store => {
    const index = store.index("chapterId");
    return index.getAll(chapterId);
  });

export const updateScene = (id, updates) => 
  perform("scenes", "readwrite", async store => {
    const scene = await new Promise(res => {
      const req = store.get(id);
      req.onsuccess = () => res(req.result);
    });
    if (!scene) throw new Error("Scene not found");
    return store.put({ ...scene, ...updates, updatedAt: Date.now() });
  });

export const deleteScene = (id) => 
  perform("scenes", "readwrite", store => store.delete(id));

// CHAPTERS
export const createChapter = (chapter) => 
  perform("chapters", "readwrite", store => store.add({ 
    ...chapter, 
    order: chapter.order || 0,
    createdAt: Date.now(), 
    updatedAt: Date.now() 
  }));

export const getChapter = (id) =>
  id ? perform("chapters", "readonly", store => store.get(id)) : Promise.resolve(null);

export const listChaptersByProject = (projectId) => 
  perform("chapters", "readonly", store => {
    const index = store.index("projectId");
    return index.getAll(projectId);
  });

export const updateChapter = (id, updates) => 
  perform("chapters", "readwrite", async store => {
    const chapter = await new Promise(res => {
      const req = store.get(id);
      req.onsuccess = () => res(req.result);
    });
    if (!chapter) throw new Error("Chapter not found");
    return store.put({ ...chapter, ...updates, updatedAt: Date.now() });
  });

export const deleteChapter = (id) => 
  perform("chapters", "readwrite", store => store.delete(id));

export const normalizeProjectStructure = async (projectId) => {
  if (!projectId) return { duplicateChaptersRemoved: 0, duplicateScenesRemoved: 0 };

  const [chapters, scenes] = await Promise.all([
    listChaptersByProject(projectId),
    listScenesByProject(projectId)
  ]);

  const plan = normalizeProjectStructureRecords(chapters, scenes);

  for (const sceneId of plan.sceneIdsToDelete) {
    await deleteScene(sceneId);
  }

  for (const chapterId of plan.chapterIdsToDelete) {
    await deleteChapter(chapterId);
  }

  for (const sceneUpdate of plan.sceneOrderUpdates) {
    await updateScene(sceneUpdate.id, { order: sceneUpdate.order });
  }

  return {
    duplicateChaptersRemoved: plan.duplicateChaptersRemoved,
    duplicateScenesRemoved: plan.duplicateScenesRemoved
  };
};

export const repairMalformedProjectRefs = async (preferredProjectId = null) => {
  const repaired = { chapters: 0, scenes: 0 };

  repaired.chapters = await perform("chapters", "readwrite", async store => {
    const chapters = await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    const plan = repairMalformedProjectRefsInRecords(chapters, preferredProjectId, "chapter");
    for (const chapter of plan.records) {
      if (chapter && typeof chapter.projectId !== "object") {
        await new Promise((resolve, reject) => {
          const req = store.put(chapter);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      }
    }
    return plan.repairedCount;
  });

  repaired.scenes = await perform("scenes", "readwrite", async store => {
    const scenes = await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    const plan = repairMalformedProjectRefsInRecords(scenes, preferredProjectId, "scene");
    for (const scene of plan.records) {
      if (scene && typeof scene.projectId !== "object") {
        await new Promise((resolve, reject) => {
          const req = store.put(scene);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      }
    }
    return plan.repairedCount;
  });

  return repaired;
};

// DOCUMENTS (Generic Assets)
export const createDocument = (doc) => 
  perform("documents", "readwrite", store => store.add({ 
    id: crypto.randomUUID(),
    ...doc, 
    createdAt: Date.now(), 
    updatedAt: Date.now() 
  }));

export const updateDocument = (id, updates) => 
  perform("documents", "readwrite", async store => {
    const doc = await new Promise(res => {
      const req = store.get(id);
      req.onsuccess = () => res(req.result);
    });
    if (!doc) throw new Error("Document not found");
    return store.put({ ...doc, ...updates, updatedAt: Date.now() });
  });

export const listDocumentsByProject = (projectId) => 
  perform("documents", "readonly", store => {
    const index = store.index("projectId");
    return index.getAll(projectId);
  });

export const findDocuments = (criteria) => 
  perform("documents", "readonly", store => {
    return new Promise(resolve => {
      const results = [];
      store.openCursor().onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const item = cursor.value;
          const match = Object.entries(criteria).every(([key, val]) => item[key] === val);
          if (match) results.push(item);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
    });
  });
