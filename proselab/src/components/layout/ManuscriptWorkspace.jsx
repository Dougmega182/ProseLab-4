import React from "react";
import { PreproductionKit } from "../PreproductionKit.jsx";
import LorePanel from "../LoreAgent/LorePanel.jsx";
import { ReportDashboard } from "../ReportDashboard.jsx";
import { ProseEditor } from "../ProseEditor.jsx";
import AnnotationRail from "../writing/AnnotationRail.jsx";
import { PipelineTracker } from "../Dashboard.jsx";

export default function ManuscriptWorkspace({
  activeTab,
  setActiveTab,
  activeMode,
  setActiveMode,
  isModeLocked,
  activeModeInfo,
  modeGatingState,
  
  // Preproduction
  core,
  chars,
  rules,
  beats,
  voice,
  scenes,
  chapters,
  shadowActions,
  docManager,
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
  setEditingChar,
  setEditingScene,
  selectScene,
  envStatusState,

  // Lore
  loreAgent,
  stages,
  output,
  text,
  ENV_KEYS,

  // Reports
  report,
  projects,
  selectedProjectId,

  // Write Tab
  selectedSceneId,
  currentScene,
  showPreview,
  setShowPreview,
  showMetadata,
  setShowMetadata,
  setText,
  wordCount,
  updateSceneMetadata,
  expansionPlanText,
  setExpansionPlanText,
  expansionPlacement,
  expansionPlacementReasoning,
  handleRecommendExpansionInsertion,
  handleRunExpansionInsertionDraft,
  running,
  stage,
  run,
  CREATE_PIPELINE_SUMMARY,

  // Output Tab
  createModeCritique,
  copyToEditor,

  // Event Handlers for Agent actions (suggest buttons)
  onRunCriticSuggest,
  onRunGeneratorSuggest,
  onRunInstrumentedCompositionTest,
  onRunOrchestrationLoop,
  onShowValidationStats,
  renderMarkdown
}) {
  return (
    <>
      {/* TABS NAVIGATION */}
      <div className="tabs-container">
        <button className={`tab-trigger ${activeTab === "preproduction" ? "active" : ""}`} onClick={() => setActiveTab("preproduction")}>Preproduction</button>
        <button className={`tab-trigger ${activeTab === "write" ? "active" : ""}`} onClick={() => setActiveTab("write")}>Write</button>
        <button className={`tab-trigger ${activeTab === "output" ? "active" : ""}`} onClick={() => setActiveTab("output")}>Output</button>
        <button className={`tab-trigger ${activeTab === "reports" ? "active" : ""}`} onClick={() => setActiveTab("reports")}>Reports</button>
        <button className={`tab-trigger ${activeTab === "lore" ? "active" : ""}`} onClick={() => setActiveTab("lore")}>Lore</button>
        <button className={`tab-trigger ${activeTab === "logs" ? "active" : ""}`} onClick={() => setActiveTab("logs")}>Logs</button>
        <button className={`tab-trigger ${activeTab === "system" ? "active" : ""}`} onClick={() => setActiveTab("system")}>System</button>

        {activeTab === "output" && (
          <>
            <button
              className="btn btn-primary"
              onClick={onRunCriticSuggest}
              style={{ marginLeft: "auto", fontSize: "0.7rem", padding: "4px 12px" }}
              disabled={running}
            >
              [AI] Critic Suggest
            </button>
            <button
              className="btn btn-ghost"
              onClick={onRunGeneratorSuggest}
              style={{ marginLeft: "8px", fontSize: "0.7rem", padding: "4px 12px", border: "1px solid var(--border-subtle)" }}
              disabled={running}
            >
              [AI] Generator Suggest
            </button>
            <button
              className="btn btn-ghost"
              onClick={onRunInstrumentedCompositionTest}
              style={{ marginLeft: "8px", fontSize: "0.7rem", padding: "4px 12px", border: "1px solid var(--border-subtle)", color: "var(--accent-purple)" }}
              disabled={running}
            >
              [TEST] Instrumented Composition Test
            </button>
            <button
              className="btn btn-ghost"
              onClick={onShowValidationStats}
              style={{ marginLeft: "8px", fontSize: "0.7rem", padding: "4px 12px", border: "1px solid var(--accent-purple)", color: "var(--accent-purple)" }}
            >
              [STATS] Final Report
            </button>
            <button
              className="btn btn-primary"
              onClick={onRunOrchestrationLoop}
              style={{ marginLeft: "8px", fontSize: "0.7rem", padding: "4px 12px" }}
              disabled={running}
            >
              [RUN] RUN ORCHESTRATION LOOP
            </button>
          </>
        )}
      </div>

      {/* MAIN CONTENT BY TAB */}
      <main>
        {activeTab === "preproduction" && (
          <PreproductionKit
            core={core}
            chars={chars}
            rules={rules}
            beats={beats}
            voice={voice}
            scenes={scenes}
            chapters={chapters}
            storage={docManager}
            shadowActions={shadowActions}
            applyAgentAction={applyAgentAction}
            removeShadowAction={removeShadowAction}
            updateProjectMetadata={updateProjectMetadata}
            saveCharacter={saveCharacter}
            deleteCharacter={deleteCharacter}
            saveRule={saveRule}
            deleteRule={deleteRule}
            saveBeat={saveBeat}
            deleteBeat={deleteBeat}
            moveBeat={moveBeat}
            reorderBeats={reorderBeats}
            moveScene={moveScene}
            reorderScenes={reorderScenes}
            onEditChar={setEditingChar}
            onEditScene={setEditingScene}
            onSelectScene={selectScene}
            envStatusState={envStatusState}
          />
        )}

        {activeTab === "lore" && (
          <div className="lore-view-container" style={{ height: "calc(100vh - 250px)", marginTop: "20px" }}>
            <LorePanel agent={loreAgent} text={stages.final || output || text} keys={ENV_KEYS} />
          </div>
        )}

        {activeTab === "reports" && (
          <div className="reports-view-container" style={{ height: "calc(100vh - 250px)", marginTop: "20px", overflowY: "auto" }}>
            <ReportDashboard 
              report={report} 
              text={text}
              chapters={chapters}
              scenes={scenes}
              activeProjectTitle={projects?.find(p => String(p.id) === String(selectedProjectId))?.title || "Active Manuscript"}
            />
          </div>
        )}

        {activeTab === "write" && (
          <div className="write-view">
            <div className="tabs-container" style={{ borderBottom: "none", marginBottom: "16px" }}>
              {["CREATE", "ANALYSE", "ENGINEER", "MARKET", "VERDICT"].map(m => (
                <button
                  key={m}
                  className={`tab-trigger ${activeMode === m ? "active" : ""} ${isModeLocked(m) ? "locked" : ""}`}
                  onClick={() => !isModeLocked(m) && setActiveMode(m)}
                  title={(activeModeInfo.lockReason || activeModeInfo.configWarnings[0] || "")}
                  style={{ fontSize: "11px", padding: "8px 12px", opacity: isModeLocked(m) ? 0.4 : 1, cursor: isModeLocked(m) ? "not-allowed" : "pointer" }}
                  disabled={isModeLocked(m)}
                >
                  {m}
                  {isModeLocked(m) && <span style={{ fontSize: "8px", marginLeft: "4px" }}>(Locked)</span>}
                </button>
              ))}
            </div>

            {(activeModeInfo.configWarnings.length > 0 || activeModeInfo.lockReason) && (
              <div className="mode-guidance">
                {activeModeInfo.configWarnings.length > 0 && (
                  <div className="mode-alert mode-alert-error">
                    <strong>Missing configuration for {activeMode}.</strong>
                    <div>{activeModeInfo.configWarnings.join(" ")}</div>
                  </div>
                )}
                {activeModeInfo.lockReason && (
                  <div className="mode-alert mode-alert-warning">
                    <strong>{activeMode} is locked.</strong>
                    <div>{activeModeInfo.lockReason}</div>
                  </div>
                )}
              </div>
            )}

            {stage && <PipelineTracker currentStage={stage} activeMode={activeMode} />}

            <div className="content-grid" style={{ gridTemplateColumns: "1fr" }}>
              <div className="panel">
                <div className="panel-header">
                  <span className="panel-title">{activeMode === "CREATE" ? "Active Scene / Paragraph" : `Editorial Review - ${activeMode}`}</span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div className="toggle-group">
                      <button className={`toggle-btn ${!showPreview ? 'active' : ''}`} onClick={() => setShowPreview(false)}>Edit</button>
                      <button className={`toggle-btn ${showPreview ? 'active' : ''}`} onClick={() => setShowPreview(true)}>Preview</button>
                    </div>
                    <button
                      className={`btn btn-ghost ${showMetadata ? 'active' : ''}`}
                      onClick={() => setShowMetadata(!showMetadata)}
                      style={{ padding: "4px 10px", fontSize: 11 }}
                    >
                      {showMetadata ? "Hide Meta" : "Metadata"}
                    </button>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{wordCount} words</span>
                  </div>
                </div>

                {selectedSceneId ? (
                  !showPreview ? (
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <ProseEditor
                          value={text}
                          onChange={setText}
                          placeholder="Start writing your scene..."
                          findings={report?.style?.findings || []}
                        />
                      </div>
                      <AnnotationRail 
                        findings={report?.style?.findings || []}
                      />
                      {showMetadata && currentScene && (
                        <div className="metadata-panel">
                          <div className="field-group">
                            <label className="field-label">Scene Title</label>
                            <input
                              className="field-input"
                              value={currentScene.title || ""}
                              onChange={e => updateSceneMetadata(currentScene.id, { title: e.target.value })}
                            />
                          </div>
                          <div className="field-group">
                            <label className="field-label">Tags (comma separated)</label>
                            <input
                              className="field-input"
                              value={currentScene.tags || ""}
                              placeholder="e.g. action, internal, draft"
                              onChange={e => updateSceneMetadata(currentScene.id, { tags: e.target.value })}
                            />
                          </div>
                          <div className="field-group">
                            <label className="field-label">Scene Notes</label>
                            <textarea
                              className="field-input"
                              style={{ minHeight: "200px", resize: "vertical" }}
                              value={currentScene.notes || ""}
                              placeholder="Plot points, emotional beats..."
                              onChange={e => updateSceneMetadata(currentScene.id, { notes: e.target.value })}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="prose-preview" dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />
                  )
                ) : (
                  <div className="empty-state-container" style={{ padding: "80px 20px", textAlign: "center", color: "var(--text-muted)" }}>
                    <div style={{ fontSize: "32px", marginBottom: "20px" }}>📝</div>
                    <h3 style={{ marginBottom: "12px", color: "var(--text-bright)" }}>No Scene Selected</h3>
                    <p style={{ maxWidth: "440px", margin: "0 auto", fontSize: "14px", lineHeight: "1.6" }}>
                      Select a chapter or scene from the manuscript sidebar to begin writing, or use the Import tool to bring in your work.
                    </p>
                  </div>
                )}

                <div className="panel" style={{ marginTop: "16px", borderLeft: "4px solid var(--accent-primary)" }}>
                  <div className="panel-header">
                    <span className="panel-title">Expansion Draft Insertion</span>
                  </div>
                  <div className="expansion-panel-body">
                    <textarea
                      className="field-input expansion-brief-input"
                      value={expansionPlanText}
                      placeholder="Paste expansion brief or plan instructions for Galaxy AI (Opus 4.6)..."
                      onChange={e => setExpansionPlanText(e.target.value)}
                    />
                    <div className="expansion-placement-summary">
                      <span className="expansion-placement-chip">
                        {expansionPlacement ? `Start: p${expansionPlacement.startParagraph}` : "Start: auto"}
                      </span>
                      <span className="expansion-placement-chip">
                        {expansionPlacement ? `End: p${expansionPlacement.endParagraph}` : "End: auto"}
                      </span>
                    </div>
                    <div className="expansion-actions-row">
                      <button
                        className="btn btn-ghost"
                        onClick={handleRecommendExpansionInsertion}
                        disabled={running || !selectedSceneId || !expansionPlanText.trim()}
                      >
                        {running && stage === "expansion-insertion-recommend" ? "Recommending Placement..." : "Refresh Auto Placement"}
                      </button>
                      <button
                        className="btn btn-ghost"
                        onClick={handleRunExpansionInsertionDraft}
                        disabled={running || !selectedSceneId || !expansionPlanText.trim()}
                      >
                        {running && String(stage || "").startsWith("expansion") ? "Generating Expansion Draft..." : "Generate Expansion Draft"}
                      </button>
                    </div>
                    {expansionPlacementReasoning && (
                      <div className="expansion-placement-reason">
                        {expansionPlacementReasoning}
                      </div>
                    )}
                  </div>
                </div>

                <div className="actions-bar">
                  <button id="run-btn" className="btn btn-primary" onClick={run} disabled={running || !text.trim() || !activeModeInfo.isConfigReady || activeModeInfo.isLocked}>
                    {running && <span className="spinner" />}
                    {running ? "Running Mode..." : `Start ${activeMode} Mode`}
                  </button>
                  <div style={{ marginLeft: "auto", fontSize: "11px", color: "var(--text-muted)", maxWidth: "300px", textAlign: "right" }}>
                    {activeMode === "CREATE" && CREATE_PIPELINE_SUMMARY}
                    {activeMode === "ANALYSE" && "Margaret (Prose) + Rafael (Character)"}
                    {activeMode === "ENGINEER" && "James (Structure) + Yuki (World)"}
                    {activeMode === "MARKET" && "Saoirse (Market Check)"}
                    {activeMode === "VERDICT" && "Victor (Final Decision)"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "output" && (() => {
          const editorialModes = ["ANALYSE", "ENGINEER", "MARKET", "VERDICT"]
            .filter(m => Object.keys(modeFeedback[m] || {}).length > 0);
          const hasCreateOutput = Boolean(createModeCritique || stages.final || (output && output.startsWith("Error:")));
          const hasEditorial = editorialModes.length > 0;
          const hasNothing = !hasCreateOutput && !hasEditorial;

          return (
            <div className="output-view">
              {hasCreateOutput && (
                <>
                  <div className="panel" style={{ marginBottom: "24px" }}>
                    <div className="panel-header">
                      <span className="panel-title">
                        Final Output - Pass {createModeCritique?.attempts ?? "?"}{" "}
                        <span style={{ color: createModeCritique?.verdict === "APPROVE" ? "var(--success)" : "var(--error)" }}>
                          {createModeCritique?.verdict ?? ""}
                        </span>
                      </span>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <div className="status-badge" style={{ fontSize: 10, background: "rgba(100, 100, 255, 0.1)", color: "#aaddff", border: "1px solid rgba(100, 100, 255, 0.3)" }}>
                          Engine: Galaxy AI (Opus 4.6)
                        </div>
                        {createModeCritique && (
                          <div className={`status-badge tag-${createModeCritique.verdict === "APPROVE" ? "locked" : "pending"}`} style={{ fontSize: 10 }}>
                            CRITIC: {createModeCritique.verdict} ({createModeCritique.score?.overall}/10)
                          </div>
                        )}
                        <button className="btn btn-ghost" onClick={() => copyToEditor(stages.final)} style={{ padding: "4px 10px", fontSize: 11 }}>Copy to Editor & Revise</button>
                        <button className="btn btn-ghost" onClick={() => navigator.clipboard.writeText(stages.final)} style={{ padding: "4px 10px", fontSize: 11 }}>Copy Text</button>
                      </div>
                    </div>
                    <div className="panel-body prose-preview" dangerouslySetInnerHTML={{ __html: renderMarkdown(stages.final) }} />
                  </div>
                </>
              )}
            </div>
          );
        })()}
      </main>
    </>
  );
}
