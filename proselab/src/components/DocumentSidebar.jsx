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

  const toggleChapter = (id) => {
    setExpandedChapters(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDragStart = (e, type, id, chapterId = null) => {
    e.dataTransfer.setData("type", type);
    e.dataTransfer.setData("id", id);
    if (chapterId) e.dataTransfer.setData("chapterId", chapterId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e, targetType, targetId, index) => {
    e.preventDefault();
    const sourceType = e.dataTransfer.getData("type");
    const sourceId = e.dataTransfer.getData("id");

    if (sourceType === "scene" && (targetType === "scene" || targetType === "chapter")) {
      const targetChapterId = targetType === "chapter" ? targetId : e.dataTransfer.getData("targetChapterId");
      onReorderScene(sourceId, targetChapterId, index);
    } else if (sourceType === "chapter" && targetType === "chapter") {
      onReorderChapter(sourceId, index);
    }
  };

  return (
    <div className="doc-sidebar">
      <div className="sidebar-header">
        <h3>PROSELAB</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select 
            value={selectedProjectId || ""} 
            onChange={(e) => onSelectProject(e.target.value)}
            className="project-selector"
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
          <button className="btn-icon" title="New Project">+</button>
          <button className="btn-icon" title="Import Manuscript/Assets" onClick={onOpenImport}>📥</button>
        </div>
        <div className="search-box" style={{ marginTop: '12px' }}>
          <input 
            type="text" 
            placeholder="Search manuscript..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <button className="search-clear" onClick={() => setSearchQuery("")}>×</button>
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
              {searchResults.map(result => (
                <div 
                  key={result.sceneId} 
                  className={`search-result-item ${result.sceneId === selectedSceneId ? "active" : ""}`}
                  onClick={() => {
                    onSelectScene(result.sceneId);
                  }}
                >
                  <div className="search-result-title">{result.sceneTitle}</div>
                  {result.snippets.map((snippet, i) => (
                    <div key={i} className="search-result-snippet" dangerouslySetInnerHTML={{ 
                      __html: snippet.replace(new RegExp(searchQuery, 'gi'), match => `<mark>${match}</mark>`) 
                    }} />
                  ))}
                </div>
              ))}
              {searchResults.length === 0 && (
                <div className="empty-state">No matches found for "{searchQuery}"</div>
              )}
            </div>
          ) : (
            tree.map(chapter => (
              <div key={chapter.id} className="chapter-group">
                <div 
                  className="chapter-header"
                  onClick={() => toggleChapter(chapter.id)}
                  draggable
                  onDragStart={(e) => handleDragStart(e, "chapter", chapter.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, "chapter", chapter.id, tree.indexOf(chapter))}
                >
                  <span className={`chevron ${expandedChapters[chapter.id] ? "expanded" : ""}`}>▶</span>
                  <span className="chapter-title">{chapter.title}</span>
                  <button 
                    className="btn-icon-sm" 
                    onClick={(e) => { e.stopPropagation(); onCreateScene(chapter.id); }}
                    title="Add Scene"
                  >+</button>
                </div>

                {expandedChapters[chapter.id] && (
                  <div className="scene-list">
                    {chapter.scenes.map((s, idx) => (
                      <div 
                        key={s.id} 
                        className={`scene-item ${s.id === selectedSceneId ? "active" : ""}`}
                        onClick={() => onSelectScene(s.id)}
                        draggable
                        onDragStart={(e) => handleDragStart(e, "scene", s.id, chapter.id)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => {
                          e.dataTransfer.setData("targetChapterId", chapter.id);
                          handleDrop(e, "scene", s.id, idx);
                        }}
                      >
                        <span className="scene-status-dot" data-status={s.pipelineState || "draft"}></span>
                        <span className="scene-title">{s.title || "Untitled Scene"}</span>
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
      
      <style>{`
        .doc-sidebar {
          width: 280px;
          height: 100vh;
          background: #111115;
          border-right: 1px solid #222;
          display: flex;
          flex-direction: column;
          color: #999;
          font-family: var(--font-sans);
        }
        .sidebar-header {
          padding: 20px;
          border-bottom: 1px solid #222;
        }
        .search-box {
          position: relative;
          display: flex;
          align-items: center;
        }
        .search-input {
          width: 100%;
          background: #09090c;
          border: 1px solid #222;
          color: #eee;
          padding: 8px 30px 8px 12px;
          border-radius: 4px;
          font-size: 0.8rem;
          outline: none;
        }
        .search-input:focus { border-color: var(--accent-primary); }
        .search-clear {
          position: absolute;
          right: 8px;
          background: transparent;
          border: none;
          color: #444;
          font-size: 1.2rem;
          cursor: pointer;
        }
        .search-results {
          padding: 0 10px;
        }
        .search-result-item {
          padding: 12px;
          border-radius: 4px;
          cursor: pointer;
          margin-bottom: 4px;
          transition: background 0.2s;
        }
        .search-result-item:hover { background: #1a1a22; }
        .search-result-item.active { background: #252530; }
        .search-result-title {
          font-size: 0.85rem;
          font-weight: 600;
          color: #eee;
          margin-bottom: 4px;
        }
        .search-result-snippet {
          font-size: 0.75rem;
          color: #666;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        mark {
          background: rgba(var(--accent-primary-rgb), 0.3);
          color: var(--accent-primary);
          padding: 0 2px;
          border-radius: 2px;
        }
        .empty-state {
          padding: 20px;
          font-size: 0.8rem;
          color: #444;
          text-align: center;
        }
        .sidebar-header h3 {
          margin: 0 0 12px 0;
          font-size: 0.75rem;
          font-weight: 800;
          letter-spacing: 0.25rem;
          color: #444;
        }
        .project-selector {
          flex: 1;
          background: #1a1a22;
          border: 1px solid #333;
          color: #ddd;
          padding: 6px 10px;
          border-radius: 4px;
          font-size: 0.85rem;
          outline: none;
        }
        .sidebar-section {
          flex: 1;
          overflow-y: auto;
          padding: 24px 0;
        }
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 20px 16px 20px;
          font-size: 0.7rem;
          font-weight: 800;
          color: #555;
          letter-spacing: 0.1rem;
        }
        .chapter-group {
          margin-bottom: 4px;
        }
        .chapter-header {
          display: flex;
          align-items: center;
          padding: 8px 20px;
          cursor: pointer;
          font-size: 0.85rem;
          font-weight: 600;
          color: #bbb;
          transition: background 0.2s;
          gap: 8px;
        }
        .chapter-header:hover {
          background: #1a1a22;
          color: #eee;
        }
        .chapter-header .chevron {
          font-size: 0.6rem;
          transition: transform 0.2s;
          color: #444;
        }
        .chapter-header .chevron.expanded {
          transform: rotate(90deg);
        }
        .chapter-title {
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .scene-list {
          display: flex;
          flex-direction: column;
          padding-left: 20px;
        }
        .scene-item {
          padding: 8px 20px 8px 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.85rem;
          color: #888;
          transition: all 0.2s;
          border-radius: 4px 0 0 4px;
        }
        .scene-item:hover {
          background: #1a1a22;
          color: #ddd;
        }
        .scene-item.active {
          background: #252530;
          color: #fff;
          border-left: 2px solid var(--accent-primary);
        }
        .scene-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #333;
          flex-shrink: 0;
        }
        .scene-status-dot[data-status="approved"] { background: var(--success); }
        .scene-status-dot[data-status="critiquing"] { background: var(--warning); }
        .scene-status-dot[data-status="failed"] { background: var(--error); }
        
        .empty-chapter, .empty-project {
          padding: 10px 40px;
          font-size: 0.75rem;
          font-style: italic;
          color: #444;
        }

        .btn-icon, .btn-icon-sm {
          background: transparent;
          border: none;
          color: #444;
          cursor: pointer;
          transition: color 0.2s;
        }
        .btn-icon { font-size: 1.2rem; }
        .btn-icon-sm { font-size: 0.9rem; opacity: 0; }
        .chapter-header:hover .btn-icon-sm { opacity: 1; }
        .btn-icon:hover, .btn-icon-sm:hover { color: #fff; }
      `}</style>
    </div>
  );
}
