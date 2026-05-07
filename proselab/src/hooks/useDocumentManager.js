/**
 * useDocumentManager.js - Custom hook for managing Projects, Chapters, and Scenes
 * 
 * Orchestrates IndexedDB interactions and provides a unified state for the UI.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import * as db from "../services/db.js";
import { migrateIfNeeded } from "../services/migration.js";

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
  const [loading, setLoading] = useState(true);

  // Build tree structure for sidebar
  const tree = useMemo(() => {
    if (!selectedProjectId) return [];
    return chapters.map(chapter => ({
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

          const [projectChapters, projectScenes] = await Promise.all([
            db.listChaptersByProject(defaultProject),
            db.listScenesByProject(defaultProject)
          ]);

          setChapters(projectChapters);
          setScenes(projectScenes);

          const activeProj = allProjects.find(p => p.id === defaultProject);
          if (activeProj) {
            setCore(activeProj.core || {});
            setChars(activeProj.chars || []);
            setRules(activeProj.rules || []);
            setBeats(activeProj.beats || []);
            setVoice(activeProj.voice || {});
          }

          if (projectScenes.length > 0) {
            setSelectedSceneId(migration?.sceneId || projectScenes[0].id);
          }
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
    if (selectedProjectId) {
      Promise.all([
        db.listChaptersByProject(selectedProjectId),
        db.listScenesByProject(selectedProjectId)
      ]).then(([newChapters, newScenes]) => {
        setChapters(newChapters);
        setScenes(newScenes);
        db.getProject(selectedProjectId).then(p => {
          if (p) {
            setCore(p.core || {});
            setChars(p.chars || []);
            setRules(p.rules || []);
            setBeats(p.beats || []);
            setVoice(p.voice || {});
          }
        });
      });
    }
  }, [selectedProjectId]);

  const selectProject = useCallback((id) => {
    setSelectedProjectId(id);
    setSelectedSceneId(null);
  }, []);

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

  const createChapter = useCallback(async (arg1 = "New Chapter") => {
    if (!selectedProjectId) return;
    
    let chapterData = typeof arg1 === 'object' ? arg1 : { title: arg1 };
    
    const newChapter = {
      id: crypto.randomUUID(),
      projectId: chapterData.projectId || selectedProjectId,
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
    if (!selectedProjectId) return;
    
    let sceneData = typeof arg1 === 'object' ? arg1 : { chapterId: arg1, title: arg2 };
    
    const newScene = {
      id: crypto.randomUUID(),
      projectId: sceneData.projectId || selectedProjectId,
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
    const existing = chars.find(c => c.id === id);
    if (existing) {
      await saveCharacter({ ...existing, ...updates, id });
    }
  }, [chars, saveCharacter]);

  const getCharacter = useCallback(async (projectId, id) => {
    return chars.find(c => c.id === id);
  }, [chars]);

  const updateWorldRule = useCallback(async (projectId, id, updates) => {
    const existing = rules.find(r => r.id === id);
    if (existing) {
      await saveRule({ ...existing, ...updates, id });
    }
  }, [rules, saveRule]);

  const getWorldRule = useCallback(async (projectId, id) => {
    return rules.find(r => r.id === id);
  }, [rules]);

  const getBeats = useCallback(async (projectId) => {
    return beats;
  }, [beats]);

  const getWorldRules = useCallback(async (projectId) => {
    return rules;
  }, [rules]);

  const getCharacters = useCallback(async (projectId) => {
    return chars;
  }, [chars]);

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

  const getChapters = useCallback(async (projectId) => {
    return await db.listChaptersByProject(projectId || selectedProjectId);
  }, [selectedProjectId]);

  const getScenes = useCallback(async (chapterIdOrProjectId) => {
    // If it looks like a projectId, list all scenes for that project
    // This is a bit ambiguous in the requested code, but we'll support both.
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

  return {
    projects,
    selectedProjectId,
    selectedSceneId,
    tree,
    loading,
    selectProject,
    selectScene,
    createProject,
    createChapter,
    createScene,
    deleteChapter,
    deleteScene,
    updateSceneText,
    updateSceneMetadata,
    updateProjectMetadata,
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
    getChapters,
    getScenes,
    findCharacterByName,
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
    getBeats,
    createNote,
    // High-level Orchestrator compatibility aliases
    createChapter: useCallback((projectId, data) => createChapter({ ...data, projectId }), [createChapter]),
    createScene: useCallback((projectId, data) => createScene({ ...data, projectId }), [createScene]),
    createCharacter: useCallback((projectId, data) => saveCharacter({ ...data, projectId }), [saveCharacter]),
    createWorldRule: useCallback((projectId, data) => saveRule({ ...data, projectId }), [saveRule]),
    createBeat: useCallback((projectId, data) => saveBeat({ ...data, projectId }), [saveBeat])
  };
}
