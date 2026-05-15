/**
 * serverDb.js - Storage adapter for the ProseLab Docker Backend (Postgres)
 */

const API_BASE = "/api/ingestion/api"; // Mapped via Nginx

export const listProjects = async () => {
  const res = await fetch(`${API_BASE}/projects`);
  return await res.json();
};

export const getProject = async (id) => {
  const res = await fetch(`${API_BASE}/projects/${id}`);
  if (!res.ok) return null;
  return await res.json();
};

export const createProject = async (project) => {
  const res = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...project,
      createdAt: project.createdAt || Date.now(),
      updatedAt: project.updatedAt || Date.now()
    })
  });
  return await res.json();
};

export const updateProject = async (id, updates) => {
  const res = await fetch(`${API_BASE}/projects/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...updates, updated_at: Date.now() })
  });
  return await res.json();
};

export const deleteProjectCascade = async (id) => {
  const res = await fetch(`${API_BASE}/projects/${id}`, { method: 'DELETE' });
  return await res.json();
};

// CHAPTERS
export const listChaptersByProject = async (projectId) => {
  const res = await fetch(`${API_BASE}/projects/${projectId}/chapters`);
  return await res.json();
};

export const createChapter = async (chapter) => {
  const res = await fetch(`${API_BASE}/chapters`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...chapter,
      createdAt: chapter.createdAt || Date.now(),
      updatedAt: chapter.updatedAt || Date.now()
    })
  });
  return await res.json();
};

export const updateChapter = async (id, updates) => {
  // Placeholder for now
  return { success: true };
};

export const deleteChapter = async (id) => {
    // Placeholder for now
    return { success: true };
};

// SCENES
export const listScenesByProject = async (projectId) => {
  const res = await fetch(`${API_BASE}/projects/${projectId}/scenes`);
  return await res.json();
};

export const createScene = async (scene) => {
  const res = await fetch(`${API_BASE}/scenes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...scene,
      createdAt: scene.createdAt || Date.now(),
      updatedAt: scene.updatedAt || Date.now()
    })
  });
  return await res.json();
};

export const updateScene = async (id, updates) => {
  const res = await fetch(`${API_BASE}/scenes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...updates, updated_at: Date.now() })
  });
  return await res.json();
};

export const deleteScene = async (id) => {
    // Placeholder for now
    return { success: true };
};

// MIGRATION
export const batchImport = async (data) => {
  const res = await fetch(`${API_BASE}/migrate/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return await res.json();
};
