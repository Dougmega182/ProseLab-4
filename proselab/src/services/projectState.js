export function resolvePreferredSceneId(projectScenes = [], preferredSceneId = null) {
  if (preferredSceneId && projectScenes.some(scene => scene.id === preferredSceneId)) {
    return preferredSceneId;
  }

  return projectScenes.length > 0 ? projectScenes[0].id : null;
}

export async function loadProjectStateBundle(dataSource, projectId, preferredSceneId = null) {
  if (!projectId) {
    return {
      project: null,
      chapters: [],
      scenes: [],
      selectedSceneId: null
    };
  }

  await dataSource.repairMalformedProjectRefs(projectId);
  await dataSource.normalizeProjectStructure(projectId);

  const [project, chapters, scenes] = await Promise.all([
    dataSource.getProject(projectId),
    dataSource.listChaptersByProject(projectId),
    dataSource.listScenesByProject(projectId)
  ]);

  return {
    project,
    chapters: chapters || [],
    scenes: scenes || [],
    selectedSceneId: resolvePreferredSceneId(scenes || [], preferredSceneId)
  };
}

export function resolveImportRefreshAction(result = {}) {
  if (result.targetProjectId) {
    return {
      type: "project",
      projectId: result.targetProjectId,
      sceneId: result.newSceneId || null
    };
  }

  if (result.newSceneId) {
    return {
      type: "scene",
      projectId: null,
      sceneId: result.newSceneId
    };
  }

  return {
    type: "none",
    projectId: null,
    sceneId: null
  };
}
