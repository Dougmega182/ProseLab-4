import test from "node:test";
import assert from "node:assert/strict";

import {
  buildProjectCascadeDeletionPlan,
  normalizeProjectStructureRecords,
  repairMalformedProjectRefsInRecords
} from "../src/services/projectStructure.js";
import {
  loadProjectStateBundle,
  resolveImportRefreshAction,
  resolvePreferredSceneId
} from "../src/services/projectState.js";

test("repairMalformedProjectRefsInRecords repairs malformed chapter refs", () => {
  const input = [
    {
      id: "ch-1",
      projectId: {
        projectId: "proj-1",
        title: "Chapter One",
        order: 4
      },
      title: "Wrong",
      order: 0
    }
  ];

  const result = repairMalformedProjectRefsInRecords(input, null, "chapter");
  assert.equal(result.repairedCount, 1);
  assert.equal(result.records[0].projectId, "proj-1");
  assert.equal(result.records[0].title, "Chapter One");
  assert.equal(result.records[0].order, 4);
});

test("repairMalformedProjectRefsInRecords repairs malformed scene refs", () => {
  const input = [
    {
      id: "sc-1",
      chapterId: "old-chapter",
      projectId: {
        projectId: "proj-1",
        chapterId: "ch-1",
        title: "Scene One",
        text: "Imported text",
        order: 2
      },
      text: "",
      order: 0
    }
  ];

  const result = repairMalformedProjectRefsInRecords(input, null, "scene");
  assert.equal(result.repairedCount, 1);
  assert.equal(result.records[0].projectId, "proj-1");
  assert.equal(result.records[0].chapterId, "ch-1");
  assert.equal(result.records[0].title, "Scene One");
  assert.equal(result.records[0].text, "Imported text");
  assert.equal(result.records[0].order, 2);
});

test("normalizeProjectStructureRecords removes duplicate chapters and reindexes kept scenes", () => {
  const chapters = [
    { id: "ch-old", title: "Chapter 1", order: 0, updatedAt: 10 },
    { id: "ch-new", title: "Chapter 1", order: 0, updatedAt: 20 }
  ];
  const scenes = [
    { id: "sc-old", chapterId: "ch-old", order: 0 },
    { id: "sc-keep-a", chapterId: "ch-new", order: 3 },
    { id: "sc-keep-b", chapterId: "ch-new", order: 9 }
  ];

  const plan = normalizeProjectStructureRecords(chapters, scenes);
  assert.deepEqual(plan.chapterIdsToDelete, ["ch-old"]);
  assert.deepEqual(plan.sceneIdsToDelete, ["sc-old"]);
  assert.deepEqual(plan.sceneOrderUpdates, [
    { id: "sc-keep-a", order: 0 },
    { id: "sc-keep-b", order: 1 }
  ]);
});

test("buildProjectCascadeDeletionPlan only targets matching project data", () => {
  const plan = buildProjectCascadeDeletionPlan(
    "proj-1",
    [{ id: "ch-1", projectId: "proj-1" }, { id: "ch-2", projectId: "proj-2" }],
    [{ id: "sc-1", projectId: "proj-1" }, { id: "sc-2", projectId: "proj-2" }],
    [{ id: "doc-1", projectId: "proj-1" }, { id: "doc-2", projectId: "proj-2" }]
  );

  assert.deepEqual(plan.chapterIds, ["ch-1"]);
  assert.deepEqual(plan.sceneIds, ["sc-1"]);
  assert.deepEqual(plan.documentIds, ["doc-1"]);
});

test("resolvePreferredSceneId prefers requested scene when present", () => {
  const scenes = [{ id: "scene-a" }, { id: "scene-b" }];
  assert.equal(resolvePreferredSceneId(scenes, "scene-b"), "scene-b");
  assert.equal(resolvePreferredSceneId(scenes, "missing"), "scene-a");
  assert.equal(resolvePreferredSceneId([], "missing"), null);
});

test("loadProjectStateBundle hydrates project bundle through shared loader", async () => {
  const calls = [];
  const fakeDb = {
    repairMalformedProjectRefs: async (projectId) => calls.push(`repair:${projectId}`),
    normalizeProjectStructure: async (projectId) => calls.push(`normalize:${projectId}`),
    getProject: async () => ({ id: "proj-1", core: { title: "Imported Book" } }),
    listChaptersByProject: async () => [{ id: "ch-1" }],
    listScenesByProject: async () => [{ id: "sc-1" }, { id: "sc-2" }]
  };

  const bundle = await loadProjectStateBundle(fakeDb, "proj-1", "sc-2");
  assert.deepEqual(calls, ["repair:proj-1", "normalize:proj-1"]);
  assert.equal(bundle.project.core.title, "Imported Book");
  assert.equal(bundle.chapters.length, 1);
  assert.equal(bundle.scenes.length, 2);
  assert.equal(bundle.selectedSceneId, "sc-2");
});

test("resolveImportRefreshAction keeps import refresh logic explicit", () => {
  assert.deepEqual(resolveImportRefreshAction({ targetProjectId: "proj-1", newSceneId: "sc-1" }), {
    type: "project",
    projectId: "proj-1",
    sceneId: "sc-1"
  });

  assert.deepEqual(resolveImportRefreshAction({ newSceneId: "sc-1" }), {
    type: "scene",
    projectId: null,
    sceneId: "sc-1"
  });

  assert.deepEqual(resolveImportRefreshAction({}), {
    type: "none",
    projectId: null,
    sceneId: null
  });
});
