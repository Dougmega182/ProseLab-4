import { resolveImportRefreshAction } from "./projectState.js";

export function createImportStorageAdapter(manager) {
  return {
    projects: manager.projects,
    selectedProjectId: manager.selectedProjectId,
    selectedSceneId: manager.selectedSceneId,
    tree: manager.tree,
    selectProject: manager.selectProject,
    refreshProjectState: manager.refreshProjectState,
    selectScene: manager.selectScene,
    createProject: manager.createProject,
    deleteProject: manager.deleteProject,
    createChapter: manager.createChapter,
    createScene: manager.createScene,
    deleteChapter: manager.deleteChapter,
    deleteScene: manager.deleteScene,
    updateSceneMetadata: manager.updateSceneMetadata,
    updateProjectMetadata: manager.updateProjectMetadata,
    updateProjectData: manager.updateProjectData,
    saveCharacter: manager.saveCharacter,
    deleteCharacter: manager.deleteCharacter,
    saveRule: manager.saveRule,
    deleteRule: manager.deleteRule,
    saveBeat: manager.saveBeat,
    deleteBeat: manager.deleteBeat,
    reorderChapter: manager.reorderChapter,
    reorderScene: manager.reorderScene,
    scenes: manager.scenes,
    core: manager.core,
    chars: manager.chars,
    rules: manager.rules,
    beats: manager.beats,
    voice: manager.voice,
    saveDocument: manager.saveDocument,
    updateDocument: manager.updateDocument,
    findDocuments: manager.findDocuments,
    createCharacter: manager.createCharacter,
    createWorldRule: manager.createWorldRule,
    createBeat: manager.createBeat,
    getProject: manager.getProject,
    getChapters: manager.getChapters,
    getScenes: manager.getScenes,
    getCharacters: manager.getCharacters,
    getWorldRules: manager.getWorldRules,
    getBeats: manager.getBeats,
    findCharacterByName: manager.findCharacterByName,
    updateSceneText: manager.updateSceneText
  };
}

export function createImportCompletionHandler({ selectProject, refreshProjectState, selectScene }) {
  return async function handleImportComplete(result) {
    console.log("[App] import complete", result);
    const action = resolveImportRefreshAction(result);

    if (action.type === "project") {
      selectProject(action.projectId);
      await refreshProjectState(action.projectId, action.sceneId);
      setTimeout(() => {
        refreshProjectState(action.projectId, action.sceneId);
      }, 150);
      return;
    }

    if (action.type === "scene") {
      selectScene(action.sceneId);
    }
  };
}
