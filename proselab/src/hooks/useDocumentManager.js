/**
 * useDocumentManager.js - Custom hook for managing Projects, Chapters, and Scenes
 * 
 * Orchestrates IndexedDB interactions and provides a unified state for the UI.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import * as db from "../services/db.js";
import { migrateIfNeeded } from "../services/migration.js";
import { loadProjectStateBundle } from "../services/projectState.js";

export function useDocumentManager() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [selectedSceneId, setSelectedSceneId] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [scenes, setScenes] = useState([]);
  const [core, setCore] = useState({});
  const [chars, setChars] = useState([]);
  const [rules, setRules] = useState([]);
  const [beats, setBeats] = useState([]);
  const [voice, setVoice] = useState({});
  const [shadowActions, setShadowActions] = useState([]);
  const [compositionMetrics, setCompositionMetrics] = useState([]);
  const [loading, setLoading] = useState(true);

  const applyLoadedProjectState = useCallback((bundle) => {
    setChapters(bundle.chapters || []);
    setScenes(bundle.scenes || []);
    setSelectedSceneId(bundle.selectedSceneId || null);

    if (bundle.project) {
      setCore(bundle.project.core || {});
      setChars(bundle.project.chars || []);
      setRules(bundle.project.rules || []);
      setBeats(bundle.project.beats || []);
      setVoice(bundle.project.voice || {});
    } else {
      setCore({});
      setChars([]);
      setRules([]);
      setBeats([]);
      setVoice({});
    }
  }, []);

  // Build tree structure for sidebar
  const tree = useMemo(() => {
    if (!selectedProjectId) return [];
    return [...chapters]
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map(chapter => ({
      ...chapter,
      scenes: scenes.filter(s => s.chapterId === chapter.id)
        .sort((a, b) => (a.order || 0) - (b.order || 0))
    }));
  }, [chapters, scenes, selectedProjectId]);

  // Initialize DB and migrate legacy data on mount
  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        await db.initDB();
        const migration = await migrateIfNeeded();

        const allProjects = await db.listProjects();
        setProjects(allProjects);

        if (allProjects.length > 0) {
          const defaultProject = migration?.projectId || allProjects[0].id;
          setSelectedProjectId(defaultProject);
          const bundle = await loadProjectStateBundle(db, defaultProject, migration?.sceneId || null);
          applyLoadedProjectState(bundle);

          // Load Shadow Actions and Metrics
          const [actions, metrics] = await Promise.all([
            db.perform("shadow_actions", "readonly", s => s.getAll()),
            db.perform("composition_metrics", "readonly", s => s.getAll())
          ]);
          setShadowActions(actions || []);
          setCompositionMetrics(metrics || []);
        }
      } catch (err) {
        console.error("Failed to initialize document manager", err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // Load data when project changes
  useEffect(() => {
    if (!selectedProjectId) return;

    loadProjectStateBundle(db, selectedProjectId)
      .then(applyLoadedProjectState)
      .catch((error) => {
        console.error("Failed to load selected project state", error);
      });
  }, [selectedProjectId, applyLoadedProjectState]);

  const selectProject = useCallback((id) => {
    setSelectedProjectId(id);
    setSelectedSceneId(null);
  }, []);

  const refreshProjectState = useCallback(async (projectId, preferredSceneId = null) => {
    if (!projectId) return;
    const bundle = await loadProjectStateBundle(db, projectId, preferredSceneId);

    setProjects(await db.listProjects());
    setSelectedProjectId(projectId);
    applyLoadedProjectState(bundle);
  }, [applyLoadedProjectState]);

  const createProject = useCallback(async (data = {}) => {
    const newProject = {
      id: crypto.randomUUID(),
      title: data.name || data.title || "New Project",
      core: {},
      chars: [],
      rules: [],
      beats: [],
      voice: {},
      ...data
    };
    await db.createProject(newProject);
    const all = await db.listProjects();
    setProjects(all);
    setSelectedProjectId(newProject.id);
    return newProject;
  }, []);

  const selectScene = useCallback((id) => {
    setSelectedSceneId(id);
  }, []);

  const deleteProject = useCallback(async (projectId) => {
    const resolvedProjectId = projectId || selectedProjectId;
    if (!resolvedProjectId) return;

    await db.deleteProjectCascade(resolvedProjectId);

    const remainingProjects = await db.listProjects();
    setProjects(remainingProjects);

    if (remainingProjects.length === 0) {
      setSelectedProjectId(null);
      setSelectedSceneId(null);
      setChapters([]);
      setScenes([]);
      setCore({});
      setChars([]);
      setRules([]);
      setBeats([]);
      setVoice({});
      return;
    }

    await refreshProjectState(remainingProjects[0].id, null);
  }, [selectedProjectId, refreshProjectState]);

  const createChapter = useCallback(async (arg1 = "New Chapter") => {
    let chapterData = typeof arg1 === 'object' ? arg1 : { title: arg1 };
    const resolvedProjectId = chapterData.projectId || selectedProjectId;
    if (!resolvedProjectId) return null;
    
    const newChapter = {
      id: crypto.randomUUID(),
      projectId: resolvedProjectId,
      title: chapterData.title || "New Chapter",
      order: chapterData.order ?? chapters.length,
      ...chapterData
    };
    await db.createChapter(newChapter);
    const updatedChapters = await db.listChaptersByProject(newChapter.projectId);
    if (newChapter.projectId === selectedProjectId) {
        setChapters(updatedChapters);
    }
    return newChapter;
  }, [selectedProjectId, chapters.length]);

  const createScene = useCallback(async (arg1, arg2 = "New Scene") => {
    let sceneData = typeof arg1 === 'object' ? arg1 : { chapterId: arg1, title: arg2 };
    const resolvedProjectId = sceneData.projectId || selectedProjectId;
    if (!resolvedProjectId) return null;
    
    const newScene = {
      id: crypto.randomUUID(),
      projectId: resolvedProjectId,
      chapterId: sceneData.chapterId,
      title: sceneData.title || "New Scene",
      text: sceneData.content || sceneData.text || "",
      order: sceneData.order ?? scenes.filter(s => s.chapterId === sceneData.chapterId).length,
      ...sceneData
    };
    await db.createScene(newScene);
    const updatedScenes = await db.listScenesByProject(newScene.projectId);
    if (newScene.projectId === selectedProjectId) {
        setScenes(updatedScenes);
        setSelectedSceneId(newScene.id);
    }
    return newScene;
  }, [selectedProjectId, scenes]);

  const deleteChapter = useCallback(async (id) => {
    await db.deleteChapter(id);
    const [newChapters, newScenes] = await Promise.all([
      db.listChaptersByProject(selectedProjectId),
      db.listScenesByProject(selectedProjectId)
    ]);
    setChapters(newChapters);
    setScenes(newScenes);
    if (selectedSceneId && !newScenes.find(s => s.id === selectedSceneId)) {
      setSelectedSceneId(null);
    }
  }, [selectedProjectId, selectedSceneId]);

  const deleteScene = useCallback(async (id) => {
    await db.deleteScene(id);
    const updatedScenes = await db.listScenesByProject(selectedProjectId);
    setScenes(updatedScenes);
    if (selectedSceneId === id) setSelectedSceneId(null);
  }, [selectedProjectId, selectedSceneId]);

  const updateSceneText = useCallback(async (id, text) => {
    await db.updateScene(id, { text });
    // Update local state optimistically
    setScenes(prev => prev.map(s => s.id === id ? { ...s, text } : s));
  }, []);

  const saveSceneDraft = useCallback(async (id, updates) => {
    await db.updateScene(id, updates);
    setScenes(prev => prev.map(scene => scene.id === id ? { ...scene, ...updates } : scene));
  }, []);

  const reorderScene = useCallback(async (sceneId, targetChapterId, newIndex) => {
    if (!selectedProjectId) return;
    const sceneToMove = scenes.find(s => s.id === sceneId);
    if (!sceneToMove) return;

    // Filter out the scene being moved and get target chapter's scenes
    const otherScenes = scenes.filter(s => s.id !== sceneId && s.chapterId === targetChapterId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    otherScenes.splice(newIndex, 0, { ...sceneToMove, chapterId: targetChapterId });

    // Batch update order for all scenes in the target chapter
    const updatePromises = otherScenes.map((s, idx) =>
      db.updateScene(s.id, { chapterId: targetChapterId, order: idx })
    );

    await Promise.all(updatePromises);
    const updatedScenes = await db.listScenesByProject(selectedProjectId);
    setScenes(updatedScenes);
  }, [selectedProjectId, scenes]);

  const reorderChapter = useCallback(async (chapterId, newIndex) => {
    if (!selectedProjectId) return;
    const chapterToMove = chapters.find(c => c.id === chapterId);
    if (!chapterToMove) return;

    const otherChapters = chapters.filter(c => c.id !== chapterId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    otherChapters.splice(newIndex, 0, chapterToMove);

    const updatePromises = otherChapters.map((c, idx) =>
      db.updateChapter(c.id, { order: idx })
    );

    await Promise.all(updatePromises);
    const updatedChapters = await db.listChaptersByProject(selectedProjectId);
    setChapters(updatedChapters);
  }, [selectedProjectId, chapters]);

  const updateSceneMetadata = useCallback(async (id, metadata) => {
    await db.updateScene(id, metadata);
    setScenes(prev => prev.map(s => s.id === id ? { ...s, ...metadata } : s));
  }, []);

  const updateProjectMetadata = useCallback(async (updates) => {
    if (!selectedProjectId) return;
    await db.updateProject(selectedProjectId, updates);
    if (updates.core) setCore(prev => ({ ...prev, ...updates.core }));
    if (updates.chars) setChars(updates.chars);
    if (updates.rules) setRules(updates.rules);
    if (updates.beats) setBeats(updates.beats);
    if (updates.voice) setVoice(prev => ({ ...prev, ...updates.voice }));
    setProjects(prev => prev.map(p => p.id === selectedProjectId ? { ...p, ...updates } : p));
  }, [selectedProjectId]);

  const updateProjectData = useCallback(async (projectId, updates) => {
    if (!projectId) return;
    await db.updateProject(projectId, updates);
    const refreshed = await db.listProjects();
    setProjects(refreshed);

    if (projectId === selectedProjectId) {
      if (updates.core) setCore(prev => ({ ...prev, ...updates.core }));
      if (updates.chars) setChars(updates.chars);
      if (updates.rules) setRules(updates.rules);
      if (updates.beats) setBeats(updates.beats);
      if (updates.voice) setVoice(prev => ({ ...prev, ...updates.voice }));
    }
  }, [selectedProjectId]);

  const saveCharacter = useCallback(async (char) => {
    const newChars = chars.find(c => c.id === char.id)
      ? chars.map(c => c.id === char.id ? char : c)
      : [...chars, { ...char, id: char.id || Date.now() }];
    await updateProjectMetadata({ chars: newChars });
  }, [chars, updateProjectMetadata]);

  const deleteCharacter = useCallback(async (id) => {
    const newChars = chars.filter(c => c.id !== id);
    await updateProjectMetadata({ chars: newChars });
  }, [chars, updateProjectMetadata]);

  const saveRule = useCallback(async (rule) => {
    const newRules = rules.find(r => r.id === rule.id)
      ? rules.map(r => r.id === rule.id ? rule : r)
      : [...rules, { ...rule, id: rule.id || Date.now() }];
    await updateProjectMetadata({ rules: newRules });
  }, [rules, updateProjectMetadata]);

  const deleteRule = useCallback(async (id) => {
    const newRules = rules.filter(r => r.id !== id);
    await updateProjectMetadata({ rules: newRules });
  }, [rules, updateProjectMetadata]);

  const saveBeat = useCallback(async (beat) => {
    const newBeats = beats.find(b => b.id === beat.id)
      ? beats.map(b => b.id === beat.id ? beat : b)
      : [...beats, { ...beat, id: beat.id || Date.now() }];
    // Enforce order by pct
    newBeats.sort((a, b) => (parseInt(a.pct) || 0) - (parseInt(b.pct) || 0));
    await updateProjectMetadata({ beats: newBeats });
  }, [beats, updateProjectMetadata]);

  const deleteBeat = useCallback(async (id) => {
    const newBeats = beats.filter(b => b.id !== id);
    await updateProjectMetadata({ beats: newBeats });
  }, [beats, updateProjectMetadata]);

  // --- STORAGE ALIASES FOR ORCHESTRATOR ---
  
  const saveChapter = useCallback(async (projectId, chapter) => {
    return await createChapter({ ...chapter, projectId });
  }, [createChapter]);

  const saveScene = useCallback(async (projectId, scene) => {
    return await createScene({ ...scene, projectId });
  }, [createScene]);

  const saveWorldRule = useCallback(async (projectId, rule) => {
    return await saveRule({ ...rule, projectId });
  }, [saveRule]);

  const saveCharacterWithProjectId = useCallback(async (projectId, char) => {
    return await saveCharacter({ ...char, projectId });
  }, [saveCharacter]);

  const updateChapter = useCallback(async (projectId, id, updates) => {
    await db.updateChapter(id, updates);
    if (projectId === selectedProjectId) {
      setChapters(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    }
  }, [selectedProjectId]);

  const getChapter = useCallback(async (projectId, id) => {
    return await db.getChapter(id);
  }, []);

  const updateCharacter = useCallback(async (projectId, id, updates) => {
    const project = await db.getProject(projectId || selectedProjectId);
    const existingChars = project?.chars || [];
    const existing = existingChars.find(c => c.id === id);
    if (existing) {
      const nextChars = existingChars.map(c => c.id === id ? { ...c, ...updates, id } : c);
      await updateProjectData(projectId || selectedProjectId, { chars: nextChars });
    }
  }, [selectedProjectId, updateProjectData]);

  const getCharacter = useCallback(async (projectId, id) => {
    return chars.find(c => c.id === id);
  }, [chars]);

  const updateWorldRule = useCallback(async (projectId, id, updates) => {
    const project = await db.getProject(projectId || selectedProjectId);
    const existingRules = project?.rules || [];
    const existing = existingRules.find(r => r.id === id);
    if (existing) {
      const nextRules = existingRules.map(r => r.id === id ? { ...r, ...updates, id } : r);
      await updateProjectData(projectId || selectedProjectId, { rules: nextRules });
    }
  }, [selectedProjectId, updateProjectData]);

  const getWorldRule = useCallback(async (projectId, id) => {
    return rules.find(r => r.id === id);
  }, [rules]);

  const getBeats = useCallback(async (projectId) => {
    if (!projectId || projectId === selectedProjectId) return beats;
    const project = await db.getProject(projectId);
    return project?.beats || [];
  }, [beats, selectedProjectId]);

  const getWorldRules = useCallback(async (projectId) => {
    if (!projectId || projectId === selectedProjectId) return rules;
    const project = await db.getProject(projectId);
    return project?.rules || [];
  }, [rules, selectedProjectId]);

  const getCharacters = useCallback(async (projectId) => {
    if (!projectId || projectId === selectedProjectId) return chars;
    const project = await db.getProject(projectId);
    return project?.chars || [];
  }, [chars, selectedProjectId]);

  // --- NEW GENERIC DOCUMENT METHODS ---

  const saveDocument = useCallback(async (doc) => {
    const id = await db.createDocument(doc);
    return id;
  }, []);

  const updateDocument = useCallback(async (id, updates) => {
    await db.updateDocument(id, updates);
  }, []);

  const findDocuments = useCallback(async (criteria) => {
    return await db.findDocuments(criteria);
  }, []);

  const createNote = useCallback(async (projectId, note) => {
    return await db.createDocument({ ...note, projectId, type: 'note', createdAt: Date.now(), updatedAt: Date.now() });
  }, []);

  const getProject = useCallback(async (projectId) => {
    const resolvedProjectId = projectId || selectedProjectId;
    if (!resolvedProjectId) return null;
    return await db.getProject(resolvedProjectId);
  }, [selectedProjectId]);

  const listChapters = useCallback(async (projectId) => {
    const resolvedProjectId = projectId || selectedProjectId;
    if (!resolvedProjectId) return [];
    return await db.listChaptersByProject(resolvedProjectId);
  }, [selectedProjectId]);

  const listScenes = useCallback(async (chapterIdOrProjectId) => {
    if (!chapterIdOrProjectId) return [];
    if (chapterIdOrProjectId === selectedProjectId || chapters.find(c => c.projectId === chapterIdOrProjectId)) {
        return await db.listScenesByProject(chapterIdOrProjectId);
    }
    return scenes.filter(s => s.chapterId === chapterIdOrProjectId);
  }, [selectedProjectId, scenes, chapters]);

  const findCharacterByName = useCallback(async (projectId, name) => {
    const docs = await db.findDocuments({ projectId, type: 'character' });
    return docs.find(d => {
        const content = typeof d.content === 'string' ? JSON.parse(d.content) : d.content;
        return (content.name || d.title).toLowerCase() === name.toLowerCase();
    });
  }, []);

  // --- SHADOW ACTIONS & METRICS ---

  const logShadowAction = useCallback(async (action) => {
    const newAction = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      ...action
    };
    await db.perform("shadow_actions", "readwrite", s => s.add(newAction));
    setShadowActions(prev => [...prev, newAction]);
    return newAction;
  }, []);

  const removeShadowAction = useCallback(async (id, resolution = 'dismissed', reason = 'n/a', extra = {}) => {
    const action = shadowActions.find(a => a.id === id);
    if (!action) return;

    const metric = {
      id: crypto.randomUUID(),
      actionId: id,
      agent: action.meta?.agent || 'unknown',
      res: resolution.toUpperCase(),
      reason,
      timestamp: Date.now(),
      ...extra
    };

    await Promise.all([
      db.perform("shadow_actions", "readwrite", s => s.delete(id)),
      db.perform("composition_metrics", "readwrite", s => s.add(metric))
    ]);

    setShadowActions(prev => prev.filter(a => a.id !== id));
    setCompositionMetrics(prev => [...prev, metric]);
  }, [shadowActions]);

  const clearShadowActions = useCallback(async () => {
    await db.perform("shadow_actions", "readwrite", s => s.clear());
    setShadowActions([]);
  }, []);

  const generateValidationReport = useCallback(() => {
    if (compositionMetrics.length === 0) return null;
    
    return {
      total: compositionMetrics.length,
      approvals: compositionMetrics.filter(m => m.res === 'APPROVED').length,
      rejections: compositionMetrics.filter(m => m.res === 'REJECTED').length,
      dismissals: compositionMetrics.filter(m => m.res === 'DISMISSED').length,
    };
  }, [compositionMetrics]);

  // Orchestrator compatibility aliases (STABLE - NOT CALLING HOOKS)
  const orchestratorAliases = useMemo(() => ({
    createChapter: (projectId, data) => createChapter({ ...data, projectId }),
    createScene: (projectId, data) => createScene({ ...data, projectId }),
    createCharacter: async (projectId, data) => {
      const project = await db.getProject(projectId);
      if (!project) throw new Error("Project not found");
      const nextChars = [...(project.chars || []), { ...data, id: data.id || crypto.randomUUID() }];
      await updateProjectData(projectId, { chars: nextChars });
      return nextChars[nextChars.length - 1];
    },
    createWorldRule: async (projectId, data) => {
      const project = await db.getProject(projectId);
      if (!project) throw new Error("Project not found");
      const nextRules = [...(project.rules || []), { ...data, id: data.id || crypto.randomUUID() }];
      await updateProjectData(projectId, { rules: nextRules });
      return nextRules[nextRules.length - 1];
    },
    createBeat: async (projectId, data) => {
      const project = await db.getProject(projectId);
      if (!project) throw new Error("Project not found");
      const nextBeats = [...(project.beats || []), { ...data, id: data.id || crypto.randomUUID() }];
      await updateProjectData(projectId, { beats: nextBeats });
      return nextBeats[nextBeats.length - 1];
    }
  }), [createChapter, createScene, updateProjectData]);

  return {
    projects,
    selectedProjectId,
    selectedSceneId,
    tree,
    loading,
    selectProject,
    refreshProjectState,
    selectScene,
    createProject,
    deleteProject,
    createChapter,
    createScene,
    deleteChapter,
    deleteScene,
    updateSceneText,
    saveSceneDraft,
    updateSceneMetadata,
    updateProjectMetadata,
    updateProjectData,
    saveCharacter,
    deleteCharacter,
    saveRule,
    deleteRule,
    saveBeat,
    deleteBeat,
    scenes,
    core,
    chars,
    rules,
    beats,
    voice,
    chapters,
    reorderChapter,
    reorderScene,
    saveDocument,
    updateDocument,
    findDocuments,
    getProject,
    getChapters: listChapters,
    getScenes: listScenes,
    findCharacterByName,
    shadowActions,
    compositionMetrics,
    logShadowAction,
    removeShadowAction,
    generateValidationReport,
    clearShadowActions,
    saveChapter,
    saveScene,
    saveWorldRule,
    saveCharacterWithProjectId,
    updateChapter,
    getChapter,
    getCharacter,
    updateCharacter,
    updateWorldRule,
    getWorldRule,
    getCharacters,
    getWorldRules,
    getBeats,
    createNote,
    ...orchestratorAliases
  };
}
