/**
 * db.js - IndexedDB Service for ProseLab V4
 * 
 * Provides a persistent local-first data store for Projects, Chapters, and Scenes.
 * This replaces the simple localStorage persistence for multi-document support.
 */

const DB_NAME = "proselab_db";
const DB_VERSION = 2;

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
    };
  });
}

/**
 * Generic CRUD wrapper
 */
async function perform(storeName, mode, callback) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = callback(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ═══════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════

// PROJECTS
export const createProject = (project) => 
  perform("projects", "readwrite", store => store.add({ ...project, createdAt: Date.now(), updatedAt: Date.now() }));

export const getProject = (id) => 
  perform("projects", "readonly", store => store.get(id));

export const listProjects = () => 
  perform("projects", "readonly", store => store.getAll());

export const updateProject = (id, updates) => 
  perform("projects", "readwrite", async store => {
    const project = await new Promise(res => {
      const req = store.get(id);
      req.onsuccess = () => res(req.result);
    });
    if (!project) throw new Error("Project not found");
    return store.put({ ...project, ...updates, updatedAt: Date.now() });
  });

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
  perform("scenes", "readonly", store => store.get(id));

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
  perform("chapters", "readonly", store => store.get(id));

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
