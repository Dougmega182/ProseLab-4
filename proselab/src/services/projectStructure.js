function getTimestamp(record) {
  const importedAt =
    typeof record?.importedAt === "string" && record.importedAt.trim()
      ? Date.parse(record.importedAt)
      : Number.NaN;

  return importedAt || record?.updatedAt || record?.createdAt || 0;
}

export function repairMalformedProjectRefsInRecords(records, preferredProjectId = null, recordType = "chapter") {
  let repairedCount = 0;

  const nextRecords = (records || []).map((record) => {
    if (!record || !record.projectId || typeof record.projectId !== "object") {
      return record;
    }

    repairedCount += 1;
    const nested = record.projectId;

    if (recordType === "scene") {
      return {
        ...record,
        ...nested,
        projectId: nested.projectId || preferredProjectId || null,
        chapterId: nested.chapterId || record.chapterId,
        title: nested.title || record.title,
        text: nested.text ?? record.text,
        order: nested.order ?? record.order
      };
    }

    return {
      ...record,
      ...nested,
      projectId: nested.projectId || preferredProjectId || null,
      title: nested.title || record.title,
      order: nested.order ?? record.order
    };
  });

  return { records: nextRecords, repairedCount };
}

export function normalizeProjectStructureRecords(chapters = [], scenes = []) {
  const groups = new Map();

  for (const chapter of chapters) {
    const key = `${chapter.order ?? 0}::${String(chapter.title || "").trim().toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(chapter);
  }

  const chapterIdsToDelete = [];
  const sceneIdsToDelete = [];
  const sceneOrderUpdates = [];

  for (const group of groups.values()) {
    if (group.length <= 1) continue;

    const sorted = [...group].sort((a, b) => getTimestamp(b) - getTimestamp(a));
    const keep = sorted[0];
    const remove = sorted.slice(1);

    for (const duplicateChapter of remove) {
      chapterIdsToDelete.push(duplicateChapter.id);

      const duplicateScenes = scenes.filter(scene => scene.chapterId === duplicateChapter.id);
      for (const duplicateScene of duplicateScenes) {
        sceneIdsToDelete.push(duplicateScene.id);
      }
    }

    const keepScenes = scenes
      .filter(scene => scene.chapterId === keep.id && !sceneIdsToDelete.includes(scene.id))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    keepScenes.forEach((scene, index) => {
      if ((scene.order ?? 0) !== index) {
        sceneOrderUpdates.push({ id: scene.id, order: index });
      }
    });
  }

  return {
    chapterIdsToDelete,
    sceneIdsToDelete,
    sceneOrderUpdates,
    duplicateChaptersRemoved: chapterIdsToDelete.length,
    duplicateScenesRemoved: sceneIdsToDelete.length
  };
}

export function buildProjectCascadeDeletionPlan(projectId, chapters = [], scenes = [], documents = []) {
  return {
    projectId,
    chapterIds: chapters.filter(chapter => chapter.projectId === projectId).map(chapter => chapter.id),
    sceneIds: scenes.filter(scene => scene.projectId === projectId).map(scene => scene.id),
    documentIds: documents.filter(doc => doc.projectId === projectId).map(doc => doc.id)
  };
}
