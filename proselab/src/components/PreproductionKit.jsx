import React, { useState } from 'react';
import { PreflightBrief } from "./Dashboard.jsx";

export function PreproductionKit({ 
  core, 
  chars, 
  rules, 
  beats, 
  voice, 
  scenes, 
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
  onEditChar,
  onEditScene,
  envStatusState
}) {
  const [preTab, setPreTab] = useState("core");
  const [preflightId, setPreflightId] = useState("");

  const updatePre = (section, key, value) => {
    updateProjectMetadata({ [section]: { ...((section === 'core' ? core : voice) || {}), [key]: value } });
  };

  return (
    <div className="preproduction-kit">
      {shadowActions && shadowActions.length > 0 && (
        <div className="constraints-panel" style={{ marginBottom: "20px", background: "rgba(139, 92, 246, 0.1)", borderColor: "var(--accent-purple)" }}>
          <div className="panel-header">
            <span className="panel-title">🤖 PENDING AGENT PROPOSALS ({shadowActions.length})</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "12px" }}>
            {shadowActions.map(a => (
              <div key={a.id} className="shadow-proposal" style={{ padding: "10px", border: "1px solid var(--border-subtle)", borderRadius: "4px", background: "rgba(0,0,0,0.2)" }}>
                <div style={{ fontSize: "11px", color: "var(--accent-purple)", fontWeight: "bold", marginBottom: "4px" }}>
                  {a.meta?.agent.toUpperCase()} | Scene: {a.payload?.id} 
                  {a.meta?.entities_used?.length > 0 && ` | Entities: ${a.meta.entities_used.join(", ")}`}
                </div>
                <div style={{ fontSize: "12px", marginBottom: "8px" }}>{a.analysis}</div>
                <div className="grid-1" style={{ fontSize: "11px", background: "rgba(255,255,255,0.05)", padding: "10px", marginBottom: "8px", borderLeft: `3px solid ${a.meta?.agent === 'generator' ? 'var(--success)' : 'var(--accent-purple)'}`, borderRadius: "0 4px 4px 0" }}>
                  {a.payload?.patch?.title && <div><strong>NEW TITLE:</strong> {a.payload.patch.title}</div>}
                  {a.payload?.patch?.causality && <div><strong>NEW CAUSALITY:</strong> {a.payload.patch.causality}</div>}
                  {a.payload?.patch?.description && <div><strong>NEW DESCRIPTION:</strong> {a.payload.patch.description}</div>}
                  
                  {a.payload?.blocks && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <strong>PROPOSED NARRATIVE STRUCTURE:</strong>
                      {Object.entries(a.payload.blocks).map(([phase, text]) => (
                        <div key={phase} style={{ paddingLeft: "8px", borderLeft: "1px solid rgba(255,255,255,0.1)", marginBottom: "4px" }}>
                          <span style={{ color: "var(--text-muted)", fontSize: "9px", textTransform: "uppercase" }}>{phase.replace(/_/g, ' ')}</span>
                          <div style={{ color: "var(--text-primary)", fontStyle: "italic" }}>{text}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {a.payload?.phase && (
                    <div>
                      <strong>UPDATE {a.payload.phase.toUpperCase()}:</strong>
                      <div style={{ fontStyle: "italic", marginTop: "4px" }}>{a.payload.text}</div>
                    </div>
                  )}
                </div>

                {a.meta?.confidence !== undefined && (
                  <div style={{ marginBottom: "10px" }}>
                    <div className="metric-bar-container" style={{ height: "4px", background: "rgba(255,255,255,0.1)", borderRadius: "2px" }}>
                      <div className="metric-bar-fill" style={{ width: `${(a.meta.confidence / 10) * 100}%`, height: "100%", background: "var(--success)", borderRadius: "2px" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px", fontSize: "9px", color: "var(--text-muted)" }}>
                      <span>Agent Confidence</span>
                      <span>{a.meta.confidence}/10</span>
                    </div>
                  </div>
                )}
                <div style={{ display: "flex", gap: "8px" }}>
                  <button className="btn btn-primary" style={{ fontSize: "10px", padding: "4px 10px" }} onClick={() => { applyAgentAction(a.id, { humanOverride: true }); }}>Approve & Apply</button>
                  <button className="btn btn-ghost" style={{ fontSize: "10px", padding: "4px 10px" }} onClick={() => {
                    const r = prompt("Reason for dismissal?");
                    if (r) removeShadowAction(a.id, 'rejected', r);
                  }}>Dismiss</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB NAV */}
      <div className="tabs-container" style={{ borderBottom: "1px solid var(--border-subtle)", marginBottom: "20px" }}>
        {["core", "world", "dossiers", "beats", "inventory", "preflight", "settings"].map(t => (
          <button key={t} className={`tab-trigger ${preTab === t ? "active" : ""}`} onClick={() => setPreTab(t)} style={{ fontSize: "10px" }}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="preproduction-content">
        {preTab === "core" && (
          <div className="preproduction-section">
            <div className="preproduction-title">01 CORE LOCK</div>
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
            <div className="grid-3" style={{ marginTop: "12px" }}>
              <div className="field-group">
                <label className="field-label">Genre</label>
                <input className="field-input" value={core.genre || ""} onChange={e => updatePre("core", "genre", e.target.value)} />
              </div>
              <div className="field-group">
                <label className="field-label">Target WC</label>
                <input className="field-input" value={core.wc || ""} onChange={e => updatePre("core", "wc", e.target.value)} />
              </div>
              <div className="field-group">
                <label className="field-label">Current WC</label>
                <input className="field-input" value={core.wcCurrent || ""} onChange={e => updatePre("core", "wcCurrent", e.target.value)} />
              </div>
            </div>
            <div className="field-group" style={{ marginTop: "12px" }}>
              <label className="field-label">The Central Constraint (The "Core Hook")</label>
              <textarea className="field-textarea" value={core.constraint || ""} onChange={e => updatePre("core", "constraint", e.target.value)} />
            </div>
            <div className="grid-2" style={{ marginTop: "12px" }}>
              <div className="field-group">
                <label className="field-label">Primary Theme</label>
                <textarea className="field-textarea" value={core.theme || ""} onChange={e => updatePre("core", "theme", e.target.value)} />
              </div>
              <div className="field-group">
                <label className="field-label">Protagonist's False Belief</label>
                <textarea className="field-textarea" value={core.falseBelief || ""} onChange={e => updatePre("core", "falseBelief", e.target.value)} />
              </div>
            </div>

            <div className="preproduction-title" style={{ marginTop: "32px" }}>VOICE PROFILE</div>
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
            <div className="preproduction-title">02 WORLD RULES</div>
            <div className="rules-list">
              {rules.map(r => (
                <div key={r.id} className="rule-card">
                  <div className="grid-1">
                    <input className="field-input" style={{ fontWeight: "bold" }} value={r.rule} onChange={e => saveRule({ ...r, rule: e.target.value })} placeholder="The Rule (e.g. Magic costs blood)" />
                    <textarea className="field-textarea" value={r.consequence} onChange={e => saveRule({ ...r, consequence: e.target.value })} placeholder="Consequence of violation..." />
                  </div>
                  <div style={{ marginTop: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div className="grid-2" style={{ gap: "8px" }}>
                      <select className="field-select" value={r.category} onChange={e => saveRule({ ...r, category: e.target.value })}>
                        <option value="physics">Physics/Magic</option>
                        <option value="social">Social/Law</option>
                        <option value="personal">Personal Oath</option>
                      </select>
                      <input className="field-input" value={r.limit} onChange={e => saveRule({ ...r, limit: e.target.value })} placeholder="Hard Limit" />
                    </div>
                    <button className="btn btn-ghost" onClick={() => deleteRule(r.id)}>Delete</button>
                  </div>
                </div>
              ))}
              {rules.length === 0 && <div className="output-placeholder">No world rules defined.</div>}
            </div>
            <button className="btn btn-primary" style={{ marginTop: "20px" }} onClick={() => saveRule({ id: Date.now(), rule: "", consequence: "", category: "physics", limit: "" })}>+ ADD RULE</button>
          </div>
        )}

        {preTab === "dossiers" && (
          <div className="preproduction-section">
            <div className="preproduction-title">03 CHARACTER DOSSIERS</div>
            <div className="chars-grid">
              {chars.map(c => (
                <div key={c.id} className="char-card" onClick={() => onEditChar(c)}>
                  <div className="char-name">{c.name}</div>
                  <div className="char-role">{c.role}</div>
                  <div className="char-trait-pill">{c.trait}</div>
                </div>
              ))}
            </div>
            {chars.length === 0 && <div className="output-placeholder">No characters defined.</div>}
            <button className="btn btn-primary" style={{ marginTop: "20px" }} onClick={() => onEditChar({ name: "New Character", role: "", trait: "", description: "", constraints: "" })}>+ ADD CHARACTER</button>
          </div>
        )}

        {preTab === "beats" && (
          <div className="preproduction-section">
            <div className="preproduction-title">04 ACT BEAT MAP</div>
            <div className="beats-list">
              {beats.map(b => (
                <div key={b.id} className="beat-row">
                  <div className="beat-pct">{b.pct}%</div>
                  <input className="beat-title-input" value={b.title} onChange={e => saveBeat({ ...b, title: e.target.value })} />
                  <input className="beat-type-pill" value={b.type} onChange={e => saveBeat({ ...b, type: e.target.value })} />
                  <button className="btn btn-ghost" onClick={() => deleteBeat(b.id)}>×</button>
                </div>
              ))}
            </div>
            <button className="btn btn-primary" style={{ marginTop: "20px" }} onClick={() => saveBeat({ id: Date.now(), pct: "50", title: "New Beat", type: "Pinch" })}>+ ADD BEAT</button>
          </div>
        )}

        {preTab === "inventory" && (
          <div className="preproduction-section">
            <div className="preproduction-title">05 SCENE INVENTORY</div>
            <div className="inventory-table">
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", fontSize: "11px", color: "var(--text-muted)" }}>
                    <th style={{ padding: "8px" }}>ID</th>
                    <th style={{ padding: "8px" }}>TITLE</th>
                    <th style={{ padding: "8px" }}>CAUSALITY</th>
                    <th style={{ padding: "8px" }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {scenes.map(s => (
                    <tr key={s.id} style={{ borderBottom: "1px solid var(--border-subtle)", cursor: "pointer" }} onClick={() => onEditScene(s)}>
                      <td style={{ padding: "8px", fontSize: "10px" }}>{String(s.id).substring(0, 8)}</td>
                      <td style={{ padding: "8px", fontWeight: "bold" }}>{s.title}</td>
                      <td style={{ padding: "8px", fontSize: "11px", color: "var(--text-secondary)" }}>{s.causality}</td>
                      <td style={{ padding: "8px" }}><span className={`status-pill ${s.status === 'Draft' ? 'draft' : 'polish'}`}>{s.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {scenes.length === 0 && <div className="output-placeholder">No scenes defined.</div>}
          </div>
        )}

        {preTab === "preflight" && (
          <div className="preproduction-section">
            <div className="preproduction-title">06 PREFLIGHT BRIEF</div>
            <div className="grid-1" style={{ gap: "20px" }}>
              <select className="field-select" value={preflightId} onChange={e => setPreflightId(e.target.value)}>
                <option value="">Select Scene to Audit...</option>
                {scenes.map(s => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>

              {preflightId && (
                <PreflightBrief scene={scenes.find(s => String(s.id) === String(preflightId))} core={core} chars={chars} rules={rules} />
              )}
            </div>
          </div>
        )}

        {preTab === "settings" && (
          <div className="preproduction-section">
            <div className="preproduction-title">PIPELINE SETTINGS</div>
            <div className="grid-2">
              <div className="field-group">
                <label className="field-label">Ollama Model</label>
                <input className="field-input" value={voice.ollamaModel || "qwen3:8b"} onChange={e => updatePre("voice", "ollamaModel", e.target.value)} />
                <div style={{ marginTop: "4px", fontSize: "10px", color: envStatusState.ollamaReachable ? "var(--success)" : "var(--error)" }}>
                  {envStatusState.ollamaReachable ? "● Reachable" : "○ Unreachable"}
                </div>
              </div>
              <div className="field-group">
                <label className="field-label">Banned Word List (CSV)</label>
                <input className="field-input" value={(voice.banned || []).join(", ")} onChange={e => updatePre("voice", "banned", e.target.value.split(",").map(w => w.trim()))} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
