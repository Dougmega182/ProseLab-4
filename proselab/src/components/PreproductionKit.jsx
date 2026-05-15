import React, { useMemo, useState, useEffect } from 'react';
import { PreflightBrief } from "./Dashboard.jsx";


const PRE_TABS = ["core", "world", "dossiers", "beats", "inventory", "preflight", "settings"];

function cleanText(value, fallback = "Not set") {
  if (value === undefined || value === null) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function firstFilled(...values) {
  return values.find(value => String(value || "").trim()) || "";
}

function getRoleTone(role = "") {
  const normalized = String(role).toLowerCase();
  if (normalized.includes("protagon")) return "protagonist";
  if (normalized.includes("antagon")) return "antagonist";
  if (normalized.includes("support")) return "supporting";
  return "secondary";
}

function inferSceneLabel(scene = {}) {
  return firstFilled(scene.title, scene.summary, scene.hook, `Scene ${scene.order || ""}`) || "Untitled scene";
}

function formatSourceLabel(source = "") {
  const normalized = String(source || "").trim().toLowerCase();
  if (!normalized) return "manual";
  return normalized.replace(/[_-]+/g, " ");
}

function formatImportedAt(value) {
  if (!value) return "Unknown";
  const stamp = typeof value === "number" ? value : Date.parse(value);
  if (Number.isNaN(stamp)) return "Unknown";
  return new Date(stamp).toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function getCharacterReviewIssues(char = {}) {
  const issues = [];
  if (!String(char.role || "").trim()) issues.push("role");
  if (!String(firstFilled(char.motivation, char.goal, char.desire) || "").trim()) issues.push("motivation");
  if (!String(firstFilled(char.psychology, char.Psychology, char.traits) || "").trim()) issues.push("psychology");
  return issues;
}

function getRuleReviewIssues(rule = {}) {
  const issues = [];
  if (!String(rule.rule || rule.title || "").trim()) issues.push("rule");
  if (!String(rule.consequence || rule.description || "").trim()) issues.push("consequence");
  if (!String(rule.limit || "").trim()) issues.push("limit");
  return issues;
}

function getBeatReviewIssues(beat = {}) {
  const issues = [];
  if (!String(beat.title || "").trim()) issues.push("title");
  if (!String(beat.description || "").trim()) issues.push("description");
  if (!String(beat.type || "").trim()) issues.push("type");
  return issues;
}

function getSceneReviewIssues(scene = {}) {
  const issues = [];
  if (!String(scene.location || "").trim()) issues.push("location");
  if (!String(scene.time || "").trim()) issues.push("time");
  if (!String(scene.causality || "").trim()) issues.push("causality");
  if (!String(scene.output || "").trim()) issues.push("output");
  if (!String(scene.stakes || "").trim()) issues.push("stakes");
  if (!String(scene.summary || scene.notes || "").trim()) issues.push("summary");
  return issues;
}

function getSceneReadiness(scene = {}) {
  const required = ["location", "time", "causality", "output", "stakes", "summary"];
  const present = required.filter((field) => {
    if (field === "summary") return String(scene.summary || scene.notes || "").trim();
    return String(scene[field] || "").trim();
  }).length;
  return Math.round((present / required.length) * 100);
}

export function PreproductionKit({
  core,
  chars,
  rules,
  beats,
  voice,
  scenes,
  chapters = [],
  storage,
  shadowActions,
  applyAgentAction,
  removeShadowAction,
  updateProjectMetadata,
  saveCharacter,
  deleteCharacter,
  saveRule,
  deleteRule,
  saveBeat,
  deleteBeat,
  moveBeat,
  reorderBeats,
  moveScene,
  reorderScenes,
  onEditChar,
  onEditScene,
  onSelectScene,
  envStatusState
}) {
  const [preTab, setPreTab] = useState("core");
  const [preflightId, setPreflightId] = useState("");
  const [draggedBeatIndex, setDraggedBeatIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [draggedSceneIndex, setDraggedSceneIndex] = useState(null);
  const [sceneDragOverIndex, setSceneDragOverIndex] = useState(null);

  useEffect(() => {
    if (onSelectScene && preflightId) {
      onSelectScene(preflightId);
    }
  }, [preflightId, onSelectScene]);

  const updatePre = (section, key, value) => {
    updateProjectMetadata({ [section]: { ...((section === "core" ? core : voice) || {}), [key]: value } });
  };

  const handleBeatDragStart = (index) => (e) => {
    setDraggedBeatIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleBeatDragOver = (index) => (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) setDragOverIndex(index);
  };

  const handleBeatDrop = (dropIndex) => (e) => {
    e.preventDefault();
    if (draggedBeatIndex === null || draggedBeatIndex === dropIndex) {
      setDraggedBeatIndex(null);
      setDragOverIndex(null);
      return;
    }
    const reordered = [...sortedBeats];
    const [moved] = reordered.splice(draggedBeatIndex, 1);
    reordered.splice(dropIndex, 0, moved);
    reorderBeats(reordered);
    setDraggedBeatIndex(null);
    setDragOverIndex(null);
  };

  const handleSceneDragStart = (index) => (e) => {
    setDraggedSceneIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleSceneDragOver = (index) => (e) => {
    e.preventDefault();
    if (sceneDragOverIndex !== index) setSceneDragOverIndex(index);
  };

  const handleSceneDrop = (dropIndex) => (e) => {
    e.preventDefault();
    if (draggedSceneIndex === null || draggedSceneIndex === dropIndex) {
      setDraggedSceneIndex(null);
      setSceneDragOverIndex(null);
      return;
    }
    const reordered = [...sortedScenes];
    const [moved] = reordered.splice(draggedSceneIndex, 1);
    reordered.splice(dropIndex, 0, moved);
    reorderScenes(reordered);
    setDraggedSceneIndex(null);
    setSceneDragOverIndex(null);
  };

  const sortedBeats = useMemo(
    () => [...beats].sort((a, b) => Number(a.pct || 0) - Number(b.pct || 0)),
    [beats]
  );

  const chapterOrderMap = useMemo(() => {
    const map = new Map();
    chapters.forEach(c => map.set(c.id, Number(c.order ?? 0)));
    return map;
  }, [chapters]);

  const sortedScenes = useMemo(
    () => [...scenes].sort((a, b) => {
      const chA = chapterOrderMap.get(a.chapterId) ?? 9999;
      const chB = chapterOrderMap.get(b.chapterId) ?? 9999;
      if (chA !== chB) return chA - chB;
      return Number(a.order || 0) - Number(b.order || 0);
    }),
    [scenes, chapterOrderMap]
  );

  const topRoles = useMemo(() => {
    const counts = chars.reduce((acc, char) => {
      const key = cleanText(char.role, "Unassigned");
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  }, [chars]);

  const ruleCategories = useMemo(() => {
    const counts = rules.reduce((acc, rule) => {
      const key = cleanText(rule.category, "Uncategorized");
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  }, [rules]);

  const sceneStatusCounts = useMemo(() => {
    const counts = sortedScenes.reduce((acc, scene) => {
      const key = cleanText(scene.status, "Unknown");
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [sortedScenes]);

  const characterReviewCount = useMemo(
    () => chars.filter((char) => getCharacterReviewIssues(char).length > 0).length,
    [chars]
  );

  const ruleReviewCount = useMemo(
    () => rules.filter((rule) => getRuleReviewIssues(rule).length > 0).length,
    [rules]
  );

  const beatReviewCount = useMemo(
    () => beats.filter((beat) => getBeatReviewIssues(beat).length > 0).length,
    [beats]
  );

  const importedSourceSummary = useMemo(() => {
    const items = [...chars, ...rules, ...beats];
    const counts = items.reduce((acc, item) => {
      const key = formatSourceLabel(item.source);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [chars, rules, beats]);

  const sceneReviewCount = useMemo(
    () => sortedScenes.filter((scene) => getSceneReviewIssues(scene).length > 0).length,
    [sortedScenes]
  );

  return (
    <div className="preproduction-kit">
      {shadowActions && shadowActions.length > 0 && (
        <div className="constraints-panel preproduction-alert">
          <div className="panel-header">
            <span className="panel-title">Pending Agent Proposals ({shadowActions.length})</span>
          </div>
          <div className="preproduction-alert-list">
            {shadowActions.map(a => (
              <div key={a.id} className="shadow-proposal preproduction-alert-card">
                <div className="preproduction-alert-meta">
                  {cleanText(a.meta?.agent, "agent").toUpperCase()} | Scene: {cleanText(a.payload?.id, "n/a")}
                  {a.meta?.entities_used?.length > 0 ? ` | Entities: ${a.meta.entities_used.join(", ")}` : ""}
                </div>
                <div className="preproduction-alert-copy">{a.analysis}</div>
                <div className={`preproduction-alert-patch ${a.meta?.agent === "generator" ? "is-generator" : ""}`}>
                  {a.payload?.patch?.title ? <div><strong>New title:</strong> {a.payload.patch.title}</div> : null}
                  {a.payload?.patch?.causality ? <div><strong>New causality:</strong> {a.payload.patch.causality}</div> : null}
                  {a.payload?.patch?.description ? <div><strong>New description:</strong> {a.payload.patch.description}</div> : null}
                  {a.payload?.blocks ? (
                    <div className="preproduction-alert-blocks">
                      <strong>Proposed narrative structure</strong>
                      {Object.entries(a.payload.blocks).map(([phase, text]) => (
                        <div key={phase} className="preproduction-alert-block">
                          <span>{phase.replace(/_/g, " ")}</span>
                          <div>{text}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {a.payload?.phase ? (
                    <div>
                      <strong>Update {a.payload.phase}:</strong>
                      <div>{a.payload.text}</div>
                    </div>
                  ) : null}
                </div>
                {a.meta?.confidence !== undefined ? (
                  <div className="preproduction-meter">
                    <div className="metric-bar-container">
                      <div className="metric-bar-fill" style={{ width: `${(a.meta.confidence / 10) * 100}%` }} />
                    </div>
                    <div className="preproduction-meter-meta">
                      <span>Agent confidence</span>
                      <span>{a.meta.confidence}/10</span>
                    </div>
                  </div>
                ) : null}
                <div className="preproduction-alert-actions">
                  <button className="btn btn-primary btn-compact" onClick={() => { applyAgentAction(a.id, { humanOverride: true }); }}>
                    Approve & Apply
                  </button>
                  <button className="btn btn-ghost btn-compact" onClick={() => {
                    const reason = prompt("Reason for dismissal?");
                    if (reason) removeShadowAction(a.id, "rejected", reason);
                  }}>
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="tabs-container preproduction-tabs">
        {PRE_TABS.map(t => (
          <button key={t} className={`tab-trigger ${preTab === t ? "active" : ""}`} onClick={() => setPreTab(t)}>
            {t}
          </button>
        ))}
      </div>

      <div className="preproduction-content">
        {preTab === "core" && (
          <div className="preproduction-section">
            <div className="preproduction-header">
              <div>
                <div className="preproduction-kicker">Story Core</div>
                <div className="preproduction-title">Core lock and voice profile</div>
              </div>
              <div className="preproduction-summary-strip">
                <div className="summary-chip">
                  <span>Characters</span>
                  <strong>{chars.length}</strong>
                </div>
                <div className="summary-chip">
                  <span>World rules</span>
                  <strong>{rules.length}</strong>
                </div>
                <div className="summary-chip">
                  <span>Beats</span>
                  <strong>{beats.length}</strong>
                </div>
                <div className="summary-chip">
                  <span>Scenes</span>
                  <strong>{scenes.length}</strong>
                </div>
              </div>
            </div>

            <div className="preproduction-overview-grid">
              <div className="overview-panel">
                <div className="overview-label">Imported foundation</div>
                <div className="overview-value">{cleanText(core.title, "Untitled project")}</div>
                <div className="overview-meta">
                  <span>{cleanText(core.genre, "Genre not set")}</span>
                  <span>{cleanText(core.subtitle, "No working subtitle")}</span>
                </div>
              </div>
              <div className="overview-panel">
                <div className="overview-label">Narrative pressure</div>
                <div className="overview-value">{cleanText(core.constraint, "No central constraint defined yet")}</div>
                <div className="overview-meta">
                  <span>{cleanText(core.theme, "Theme not set")}</span>
                  <span>{cleanText(core.falseBelief, "False belief not set")}</span>
                </div>
              </div>
              <div className="overview-panel">
                <div className="overview-label">Extraction audit</div>
                <div className="overview-value">{characterReviewCount + ruleReviewCount + beatReviewCount} items need editorial review</div>
                <div className="overview-meta">
                  <span>{characterReviewCount} dossiers incomplete</span>
                  <span>{ruleReviewCount} rules need hard limits</span>
                  <span>{beatReviewCount} beats need clarification</span>
                </div>
              </div>
              <div className="overview-panel">
                <div className="overview-label">Source mix</div>
                <div className="overview-value">
                  {importedSourceSummary.length > 0
                    ? importedSourceSummary.map(([label, count]) => `${label} (${count})`).join(" | ")
                    : "No imported analysis yet"}
                </div>
                <div className="overview-meta">
                  <span>Use this to distinguish AI-derived structure from manual edits.</span>
                </div>
              </div>
            </div>

            <div className="grid-2">
              <div className="field-group">
                <label className="field-label">Project Title</label>
                <input className="field-input" value={core.title || ""} onChange={e => updatePre("core", "title", e.target.value)} />
              </div>
              <div className="field-group">
                <label className="field-label">Subtitle / Working Title</label>
                <input className="field-input" value={core.subtitle || ""} onChange={e => updatePre("core", "subtitle", e.target.value)} />
              </div>
            </div>

            <div className="grid-3">
              <div className="field-group">
                <label className="field-label">Genre</label>
                <input className="field-input" value={core.genre || ""} onChange={e => updatePre("core", "genre", e.target.value)} />
              </div>
              <div className="field-group">
                <label className="field-label">Target Word Count</label>
                <input className="field-input" value={core.wc || ""} onChange={e => updatePre("core", "wc", e.target.value)} />
              </div>
              <div className="field-group">
                <label className="field-label">Current Word Count</label>
                <input className="field-input" value={core.wcCurrent || ""} onChange={e => updatePre("core", "wcCurrent", e.target.value)} />
              </div>
            </div>

            <div className="field-group">
              <label className="field-label">Central Constraint / Core Hook</label>
              <textarea className="field-textarea" value={core.constraint || ""} onChange={e => updatePre("core", "constraint", e.target.value)} />
            </div>

            <div className="grid-2">
              <div className="field-group">
                <label className="field-label">Primary Theme</label>
                <textarea className="field-textarea" value={core.theme || ""} onChange={e => updatePre("core", "theme", e.target.value)} />
              </div>
              <div className="field-group">
                <label className="field-label">Protagonist False Belief</label>
                <textarea className="field-textarea" value={core.falseBelief || ""} onChange={e => updatePre("core", "falseBelief", e.target.value)} />
              </div>
            </div>

            <div className="preproduction-divider" />

            <div className="preproduction-header">
              <div>
                <div className="preproduction-kicker">Voice Profile</div>
                <div className="preproduction-title">Lock the prose behavior before drafting</div>
              </div>
            </div>

            <div className="grid-4">
              <div className="field-group">
                <label className="field-label">Sentence Length</label>
                <select className="field-select" value={voice.length || "Medium"} onChange={e => updatePre("voice", "length", e.target.value)}>
                  <option>Short/Staccato</option>
                  <option>Medium</option>
                  <option>Long/Flowing</option>
                </select>
              </div>
              <div className="field-group">
                <label className="field-label">Fragment Density</label>
                <select className="field-select" value={voice.fragments || "Occasional"} onChange={e => updatePre("voice", "fragments", e.target.value)}>
                  <option>None</option>
                  <option>Occasional</option>
                  <option>Frequent</option>
                </select>
              </div>
              <div className="field-group">
                <label className="field-label">Metaphor Frequency</label>
                <select className="field-select" value={voice.metaphor || "Moderate"} onChange={e => updatePre("voice", "metaphor", e.target.value)}>
                  <option>Sparse</option>
                  <option>Moderate</option>
                  <option>Heavy</option>
                </select>
              </div>
              <div className="field-group">
                <label className="field-label">Dialogue Style</label>
                <select className="field-select" value={voice.dialogue || "Direct"} onChange={e => updatePre("voice", "dialogue", e.target.value)}>
                  <option>Direct</option>
                  <option>Implicit</option>
                  <option>Theatrical</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {preTab === "world" && (
          <div className="preproduction-section">
            <div className="preproduction-header">
              <div>
                <div className="preproduction-kicker">World Model</div>
                <div className="preproduction-title">Rules, limits, and consequences</div>
              </div>
              <div className="preproduction-summary-strip">
                {ruleCategories.length > 0 ? ruleCategories.map(([label, count]) => (
                  <div key={label} className="summary-chip">
                    <span>{label}</span>
                    <strong>{count}</strong>
                  </div>
                )) : (
                  <div className="summary-chip">
                    <span>Status</span>
                    <strong>Empty</strong>
                  </div>
                )}
                <div className="summary-chip summary-chip--review">
                  <span>Needs review</span>
                  <strong>{ruleReviewCount}</strong>
                </div>
              </div>
            </div>

            <div className="rules-grid">
              {rules.map(r => {
                const reviewIssues = getRuleReviewIssues(r);
                return (
                <div key={r.id} className="rule-card">
                  <div className="rule-card-head">
                    <div className="asset-card-head-meta">
                      <span className="rule-category">{cleanText(r.category, "uncategorized")}</span>
                      <div className="asset-provenance">
                        <span>{formatSourceLabel(r.source)}</span>
                        <span>Imported {formatImportedAt(r.importedAt)}</span>
                      </div>
                    </div>
                    <button className="btn btn-ghost btn-compact" onClick={() => deleteRule(r.id)}>Delete</button>
                  </div>
                  {reviewIssues.length > 0 && (
                    <div className="review-flags">
                      {reviewIssues.map((issue) => (
                        <span key={issue} className="review-flag">Review {issue}</span>
                      ))}
                    </div>
                  )}
                  <div className="field-group">
                    <label className="field-label">Rule</label>
                    <input className="field-input rule-title-input" value={r.rule || ""} onChange={e => saveRule({ ...r, rule: e.target.value })} placeholder="What must remain true in this world?" />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Consequence</label>
                    <textarea className="field-textarea" value={r.consequence || ""} onChange={e => saveRule({ ...r, consequence: e.target.value })} placeholder="What happens when the rule is violated?" />
                  </div>
                  <div className="grid-2">
                    <div className="field-group">
                      <label className="field-label">Category</label>
                      <select className="field-select" value={r.category || "physics"} onChange={e => saveRule({ ...r, category: e.target.value })}>
                        <option value="physics">Physics / Magic</option>
                        <option value="social">Social / Law</option>
                        <option value="personal">Personal Oath</option>
                      </select>
                    </div>
                    <div className="field-group">
                      <label className="field-label">Hard Limit</label>
                      <input className="field-input" value={r.limit || ""} onChange={e => saveRule({ ...r, limit: e.target.value })} placeholder="Boundary, cost, or prohibition" />
                    </div>
                  </div>
                  {String(r.evidence || "").trim() && (
                    <div className="asset-evidence">
                      <span>Evidence</span>
                      <p>{r.evidence}</p>
                    </div>
                  )}
                </div>
              )})}
            </div>
            {rules.length === 0 ? <div className="output-placeholder">No world rules defined.</div> : null}
            <button className="btn btn-primary" onClick={() => saveRule({ id: Date.now(), rule: "", consequence: "", category: "physics", limit: "" })}>
              + Add Rule
            </button>
          </div>
        )}

        {preTab === "dossiers" && (
          <div className="preproduction-section">
            <div className="preproduction-header">
              <div>
                <div className="preproduction-kicker">Character Dossiers</div>
                <div className="preproduction-title">Imported cast with motive and pressure</div>
              </div>
              <div className="preproduction-summary-strip">
                {topRoles.length > 0 ? topRoles.map(([label, count]) => (
                  <div key={label} className="summary-chip">
                    <span>{label}</span>
                    <strong>{count}</strong>
                  </div>
                )) : (
                  <div className="summary-chip">
                    <span>Status</span>
                    <strong>Empty</strong>
                  </div>
                )}
                <div className="summary-chip summary-chip--review">
                  <span>Needs review</span>
                  <strong>{characterReviewCount}</strong>
                </div>
              </div>
            </div>

            <div className="chars-grid dossiers-grid">
              {chars.map(c => {
                const reviewIssues = getCharacterReviewIssues(c);
                return (
                <div key={c.id} className={`char-card dossier-card ${getRoleTone(c.role)}`} onClick={() => onEditChar(c)}>
                  <div className="dossier-card-head">
                    <div>
                      <div className="char-name">{cleanText(c.name, "Unnamed character")}</div>
                      <div className="char-role">{cleanText(c.role, "Role not set")}</div>
                    </div>
                    <div className="char-trait-pill">{cleanText(firstFilled(c.trait, c.archetype), "Unlabeled")}</div>
                  </div>
                  <div className="asset-provenance">
                    <span>{formatSourceLabel(c.source)}</span>
                    <span>Imported {formatImportedAt(c.importedAt)}</span>
                  </div>
                  {reviewIssues.length > 0 && (
                    <div className="review-flags">
                      {reviewIssues.map((issue) => (
                        <span key={issue} className="review-flag">Review {issue}</span>
                      ))}
                    </div>
                  )}
                  <div className="dossier-stats">
                    <div className="dossier-stat">
                      <span>Archetype</span>
                      <strong>{cleanText(c.archetype, "Not set")}</strong>
                    </div>
                    <div className="dossier-stat">
                      <span>Motivation</span>
                      <strong>{cleanText(c.motivation, "Not set")}</strong>
                    </div>
                  </div>
                  <div className="dossier-copy">
                    <div>
                      <span>Physiology</span>
                      <p>{cleanText(firstFilled(c.physiology, c.Physiology), "No physical profile captured.")}</p>
                    </div>
                    <div>
                      <span>Psychology</span>
                      <p>{cleanText(firstFilled(c.psychology, c.Psychology), "No psychological profile captured.")}</p>
                    </div>
                  </div>
                  <div className="dossier-footer">
                    <div className="dossier-description">{cleanText(firstFilled(c.description, c.notes), "Open dossier to add more detail.")}</div>
                    <button
                      className="btn btn-ghost btn-compact"
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteCharacter(c.id);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )})}
            </div>
            {chars.length === 0 ? <div className="output-placeholder">No characters defined.</div> : null}
            <button className="btn btn-primary" onClick={() => onEditChar({ name: "New Character", role: "", trait: "", archetype: "", motivation: "", description: "", constraints: "" })}>
              + Add Character
            </button>
          </div>
        )}

        {preTab === "beats" && (
          <div className="preproduction-section">
            <div className="preproduction-header">
              <div>
                <div className="preproduction-kicker">Beat Map</div>
                <div className="preproduction-title">Narrative timing and pressure points</div>
              </div>
              <div className="preproduction-summary-strip">
                <div className="summary-chip summary-chip--review">
                  <span>Needs review</span>
                  <strong>{beatReviewCount}</strong>
                </div>
              </div>
            </div>

            <div className="beats-timeline">
              {sortedBeats.map((b, i) => {
                const reviewIssues = getBeatReviewIssues(b);
                const isDragging = draggedBeatIndex === i;
                const isOver = dragOverIndex === i;
                return (
                <div 
                  key={b.id} 
                  className={`beat-card ${isDragging ? "is-dragging" : ""} ${isOver ? "is-over" : ""}`}
                  draggable
                  onDragStart={handleBeatDragStart(i)}
                  onDragOver={handleBeatDragOver(i)}
                  onDrop={handleBeatDrop(i)}
                  onDragEnd={() => { setDraggedBeatIndex(null); setDragOverIndex(null); }}
                >
                  <div className="beat-card-rail">
                    <div className="beat-pct">{cleanText(b.pct, "0")}%</div>
                    <div className="beat-reorder-controls">
                      <button className="btn-reorder" onClick={() => moveBeat(b.id, 'up')} disabled={i === 0}>▲</button>
                      <button className="btn-reorder" onClick={() => moveBeat(b.id, 'down')} disabled={i === sortedBeats.length - 1}>▼</button>
                    </div>
                  </div>
                  <div className="beat-card-body">
                    <div className="asset-provenance">
                      <span>{formatSourceLabel(b.source)}</span>
                      <span>Imported {formatImportedAt(b.importedAt)}</span>
                    </div>
                    {reviewIssues.length > 0 && (
                      <div className="review-flags">
                        {reviewIssues.map((issue) => (
                          <span key={issue} className="review-flag">Review {issue}</span>
                        ))}
                      </div>
                    )}
                    <div className="beat-card-head">
                      <input className="beat-title-input" value={b.title || ""} onChange={e => saveBeat({ ...b, title: e.target.value })} />
                      <input className="beat-type-pill" value={b.type || ""} onChange={e => saveBeat({ ...b, type: e.target.value })} />
                    </div>
                    <textarea
                      className="field-textarea beat-description"
                      value={b.description || ""}
                      onChange={e => saveBeat({ ...b, description: e.target.value })}
                      placeholder="What changes here, and why does it matter?"
                    />
                  </div>
                  <button className="btn btn-ghost btn-compact" onClick={() => deleteBeat(b.id)}>Delete</button>
                </div>
              )})}
            </div>
            {beats.length === 0 ? <div className="output-placeholder">No beats defined.</div> : null}
            <button className="btn btn-primary" onClick={() => saveBeat({ id: Date.now(), pct: "50", title: "New Beat", type: "Pinch", description: "" })}>
              + Add Beat
            </button>
          </div>
        )}

        {preTab === "inventory" && (
          <div className="preproduction-section">
            <div className="preproduction-header">
              <div>
                <div className="preproduction-kicker">Scene Inventory</div>
                <div className="preproduction-title">Scene ledger with status and causality</div>
              </div>
              <div className="preproduction-summary-strip">
                {sceneStatusCounts.length > 0 ? sceneStatusCounts.slice(0, 3).map(([label, count]) => (
                  <div key={label} className="summary-chip">
                    <span>{label}</span>
                    <strong>{count}</strong>
                  </div>
                )) : null}
                <div className="summary-chip summary-chip--review">
                  <span>Needs review</span>
                  <strong>{sceneReviewCount}</strong>
                </div>
              </div>
            </div>

            <div className="inventory-table scene-table-wrap">
              <table className="scene-table">
                <thead>
                  <tr>
                    <th style={{ width: "40px" }}></th>
                    <th style={{ width: "60px" }}>Pos</th>
                    <th>Title</th>
                    <th style={{ width: "80px" }}>Ready</th>
                    <th>Causality</th>
                    <th>Review</th>
                    <th>Status</th>
                    <th style={{ width: "60px" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedScenes.map((s, i) => {
                    const reviewIssues = getSceneReviewIssues(s);
                    const readiness = getSceneReadiness(s);
                    const parentChapter = chapters.find(c => c.id === s.chapterId);
                    const isDragging = draggedSceneIndex === i;
                    const isOver = sceneDragOverIndex === i;
                    
                    return (
                    <tr 
                      key={s.id} 
                      onClick={() => onEditScene(s)} 
                      className={`${reviewIssues.length > 0 ? "scene-row-needs-review" : ""} ${isDragging ? "is-dragging" : ""} ${isOver ? "is-over" : ""}`}
                      draggable
                      onDragStart={handleSceneDragStart(i)}
                      onDragOver={handleSceneDragOver(i)}
                      onDrop={handleSceneDrop(i)}
                      onDragEnd={() => { setDraggedSceneIndex(null); setSceneDragOverIndex(null); }}
                    >
                      <td className="drag-handle-cell">⋮⋮</td>
                      <td style={{ textAlign: "center" }}>
                        <div className="scene-pos-chip">{cleanText(s.pct, "0")}%</div>
                      </td>
                      <td>
                        <div className="scene-table-title">{inferSceneLabel(s)}</div>
                        <div className="scene-table-subtitle">
                          {parentChapter ? <strong style={{ color: "var(--accent-primary)" }}>{parentChapter.title}</strong> : null}
                          {parentChapter ? " | " : ""}
                          {cleanText(firstFilled(s.location, s.time), "No location or time lock")}
                        </div>
                      </td>
                      <td>
                        <span className={`readiness-pill ${readiness >= 80 ? "ready" : readiness >= 50 ? "partial" : "weak"}`}>
                          {readiness}%
                        </span>
                      </td>
                      <td>{cleanText(s.causality, "Not defined")}</td>
                      <td>
                        {reviewIssues.length > 0 ? (
                          <div className="scene-review-flags">
                            {reviewIssues.slice(0, 3).map((issue) => (
                              <span key={issue} className="review-flag">{issue}</span>
                            ))}
                          </div>
                        ) : (
                          <span className="scene-table-subtitle">Ready for audit</span>
                        )}
                      </td>
                      <td>
                        <span className={`status-pill ${String(s.status).toLowerCase() === "draft" ? "draft" : "polish"}`}>
                          {cleanText(s.status, "Unknown")}
                        </span>
                      </td>
                      <td>
                        <div className="scene-reorder-btns">
                          <button 
                            className="btn-reorder-sm" 
                            onClick={(e) => { e.stopPropagation(); moveScene(s.id, 'up'); }}
                            disabled={i === 0}
                          >▲</button>
                          <button 
                            className="btn-reorder-sm" 
                            onClick={(e) => { e.stopPropagation(); moveScene(s.id, 'down'); }}
                            disabled={i === sortedScenes.length - 1}
                          >▼</button>
                        </div>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
            {scenes.length === 0 ? <div className="output-placeholder">No scenes defined.</div> : null}
          </div>
        )}



        {preTab === "preflight" && (
          <div className="preproduction-section">
            <div className="preproduction-header">
              <div>
                <div className="preproduction-kicker">Preflight Brief</div>
                <div className="preproduction-title">Audit a scene before it enters the drafting loop</div>
              </div>
            </div>

            <div className="grid-1 preflight-stack">
              <select className="field-select" value={preflightId} onChange={e => setPreflightId(e.target.value)}>
                <option value="">Select scene to audit...</option>
                {sortedScenes.map(s => {
                  const parentCh = chapters.find(c => c.id === s.chapterId);
                  const chLabel = parentCh ? `${parentCh.title} > ` : "";
                  return (
                    <option key={s.id} value={s.id}>{chLabel}{inferSceneLabel(s)}</option>
                  );
                })}
              </select>

              {preflightId ? (
                <PreflightBrief
                  scene={sortedScenes.find(s => String(s.id) === String(preflightId))}
                  preproduction={{ core, chars, rules, beats, voice }}
                />
              ) : null}
            </div>
          </div>
        )}

        {preTab === "settings" && (
          <div className="preproduction-section">
            <div className="preproduction-header">
              <div>
                <div className="preproduction-kicker">Pipeline Settings</div>
                <div className="preproduction-title">Model targeting and drafting constraints</div>
              </div>
            </div>
            <div className="grid-2">
              <div className="field-group">
                <label className="field-label">Ollama Model</label>
                <input className="field-input" value={voice.ollamaModel || "qwen3:8b"} onChange={e => updatePre("voice", "ollamaModel", e.target.value)} />
                <div className={`pipeline-status ${envStatusState.ollamaReachable ? "is-live" : "is-down"}`}>
                  {envStatusState.ollamaReachable ? "Live" : "Unreachable"}
                </div>
              </div>
              <div className="field-group">
                <label className="field-label">Banned Word List (CSV)</label>
                <input className="field-input" value={(voice.banned || []).join(", ")} onChange={e => updatePre("voice", "banned", e.target.value.split(",").map(w => w.trim()).filter(Boolean))} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
