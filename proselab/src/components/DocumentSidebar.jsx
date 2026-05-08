/**
 * DocumentSidebar.jsx - Hierarchical Navigation for Projects, Chapters, and Scenes
 */

import React, { useState, useEffect } from "react";
import { searchProject } from "../services/search.js";

export function DocumentSidebar({
  projects,
  tree,
  selectedProjectId,
  selectedSceneId,
  onSelectProject,
  onDeleteProject,
  onCreateProject,
  onRenameProject,
  onSelectScene,
  onCreateChapter,
  onCreateScene,
  onDeleteChapter,
  onDeleteScene,
  onReorderChapter,
  onReorderScene,
  onOpenImport
}) {
  const [expandedChapters, setExpandedChapters] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    if (searchQuery.trim().length >= 2 && selectedProjectId) {
      searchProject(selectedProjectId, searchQuery).then(setSearchResults);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, selectedProjectId]);

  useEffect(() => {
    if (!selectedSceneId || tree.length === 0) return;
    const owningChapter = tree.find((chapter) => chapter.scenes.some((scene) => scene.id === selectedSceneId));
    if (owningChapter) {
      setExpandedChapters((prev) => ({ ...prev, [owningChapter.id]: true }));
    }
  }, [selectedSceneId, tree]);

  const selectedProject = projects.find((project) => project.id === selectedProjectId) || null;
  const totalSceneCount = tree.reduce((count, chapter) => count + chapter.scenes.length, 0);

  const toggleChapter = (id) => {
    setExpandedChapters((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const formatProjectLabel = (project) => {
    const label = project?.title || "Untitled Project";
    if (!project?.updatedAt) return label;
    const stamp = new Date(project.updatedAt).toLocaleString("en-AU", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
    return `${label} - ${stamp}`;
  };

  const formatProjectMeta = (timestamp) => {
    if (!timestamp) return "Unknown";
    return new Date(timestamp).toLocaleString("en-AU", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
  };

  const handleDragStart = (event, type, id, chapterId = null) => {
    event.dataTransfer.setData("type", type);
    event.dataTransfer.setData("id", id);
    if (chapterId) event.dataTransfer.setData("chapterId", chapterId);
    event.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (event, targetType, targetId, index) => {
    event.preventDefault();
    const sourceType = event.dataTransfer.getData("type");
    const sourceId = event.dataTransfer.getData("id");

    if (sourceType === "scene" && (targetType === "scene" || targetType === "chapter")) {
      const targetChapterId = targetType === "chapter" ? targetId : event.dataTransfer.getData("targetChapterId");
      onReorderScene(sourceId, targetChapterId, index);
    } else if (sourceType === "chapter" && targetType === "chapter") {
      onReorderChapter(sourceId, index);
    }
  };

  const handleDeleteProject = () => {
    if (!selectedProjectId || typeof onDeleteProject !== "function") return;
    const currentProject = projects.find((project) => project.id === selectedProjectId);
    const projectLabel = currentProject?.title || "this project";
    const confirmed = window.confirm(`Delete ${projectLabel}? This removes the manuscript, chapters, scenes, and imported project data.`);
    if (!confirmed) return;
    onDeleteProject(selectedProjectId);
  };

  const handleCreateProject = () => {
    if (typeof onCreateProject === "function") {
      onCreateProject();
    }
  };

  const handleRenameProject = () => {
    if (typeof onRenameProject === "function") {
      onRenameProject();
    }
  };

  return (
    <div className="doc-sidebar">
      <div className="sidebar-header">
        <h3>PROSELAB</h3>
        <div className="sidebar-project-row">
          <select
            value={selectedProjectId || ""}
            onChange={(event) => onSelectProject(event.target.value)}
            className="project-selector"
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {formatProjectLabel(project)}
              </option>
            ))}
          </select>
        </div>
        <div className="sidebar-project-actions">
          <button className="btn-icon sidebar-project-action" title="Add new project" aria-label="Add new project" onClick={handleCreateProject}>+</button>
          <button className="btn-icon sidebar-project-action" title="Delete selected project" aria-label="Delete selected project" onClick={handleDeleteProject}>-</button>
          <button className="btn-icon sidebar-project-action" title="Import existing project MD file" aria-label="Import existing project MD file" onClick={onOpenImport}>!</button>
          <button className="btn-icon sidebar-project-action" title="Rename selected project" aria-label="Rename selected project" onClick={handleRenameProject}>@</button>
        </div>

        {selectedProject && (
          <div className="sidebar-project-meta">
            <div className="sidebar-project-meta__title">{selectedProject.title || "Untitled Project"}</div>
            <div className="sidebar-project-meta__facts">
              <span>{tree.length} chapter{tree.length !== 1 ? "s" : ""}</span>
              <span>{totalSceneCount} scene{totalSceneCount !== 1 ? "s" : ""}</span>
              <span>Updated {formatProjectMeta(selectedProject.updatedAt)}</span>
            </div>
            <div className="sidebar-project-meta__stamp">
              Created {formatProjectMeta(selectedProject.createdAt)}
            </div>
          </div>
        )}

        <div className="search-box sidebar-search-box">
          <input
            type="text"
            placeholder="Search manuscript..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <button className="search-clear" onClick={() => setSearchQuery("")}>x</button>
          )}
        </div>
      </div>

      <div className="sidebar-section">
        <div className="section-header">
          <span>MANUSCRIPT</span>
          <button onClick={() => onCreateChapter()} className="btn-icon" title="Add Chapter">+</button>
        </div>

        <div className="tree-container">
          {searchQuery.trim().length >= 2 ? (
            <div className="search-results">
              {searchResults.map((result) => (
                <div
                  key={result.sceneId}
                  className={`search-result-item ${result.sceneId === selectedSceneId ? "active" : ""}`}
                  onClick={() => {
                    onSelectScene(result.sceneId);
                  }}
                >
                  <div className="search-result-title">{result.sceneTitle}</div>
                  {result.snippets.map((snippet, index) => (
                    <div
                      key={index}
                      className="search-result-snippet"
                      dangerouslySetInnerHTML={{
                        __html: snippet.replace(new RegExp(searchQuery, "gi"), (match) => `<mark>${match}</mark>`)
                      }}
                    />
                  ))}
                </div>
              ))}
              {searchResults.length === 0 && (
                <div className="empty-state">No matches found for "{searchQuery}"</div>
              )}
            </div>
          ) : (
            tree.map((chapter) => (
              <div key={chapter.id} className="chapter-group">
                <div
                  className="chapter-header"
                  onClick={() => toggleChapter(chapter.id)}
                  draggable
                  onDragStart={(event) => handleDragStart(event, "chapter", chapter.id)}
                  onDragOver={handleDragOver}
                  onDrop={(event) => handleDrop(event, "chapter", chapter.id, tree.indexOf(chapter))}
                >
                  <span className={`chevron ${expandedChapters[chapter.id] ? "expanded" : ""}`}>▶</span>
                  <span className="chapter-title">{chapter.title}</span>
                  <button
                    className="btn-icon-sm"
                    onClick={(event) => { event.stopPropagation(); onCreateScene(chapter.id); }}
                    title="Add Scene"
                  >
                    +
                  </button>
                </div>

                {expandedChapters[chapter.id] && (
                  <div className="scene-list">
                    {chapter.scenes.map((scene, index) => (
                      <div
                        key={scene.id}
                        className={`scene-item ${scene.id === selectedSceneId ? "active" : ""}`}
                        onClick={() => onSelectScene(scene.id)}
                        draggable
                        onDragStart={(event) => handleDragStart(event, "scene", scene.id, chapter.id)}
                        onDragOver={handleDragOver}
                        onDrop={(event) => {
                          event.dataTransfer.setData("targetChapterId", chapter.id);
                          handleDrop(event, "scene", scene.id, index);
                        }}
                      >
                        <span className="scene-status-dot" data-status={scene.pipelineState || "draft"} />
                        <span className="scene-title">{scene.title || "Untitled Scene"}</span>
                      </div>
                    ))}
                    {chapter.scenes.length === 0 && (
                      <div className="empty-chapter">No scenes.</div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
          {tree.length === 0 && !searchQuery && (
            <div className="empty-project">No chapters yet. Create one to start writing.</div>
          )}
        </div>
      </div>
    </div>
  );
}
