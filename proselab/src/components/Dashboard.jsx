import { Fragment } from "react";

function getSceneBriefWarnings(scene) {
  const warnings = [];
  if (!scene.location) warnings.push("Location not locked");
  if (!scene.time) warnings.push("Story time not locked");
  if (!scene.objects) warnings.push("Carried objects undefined");
  if (!scene.causality) warnings.push("Causality statement missing");
  if (!scene.output) warnings.push("Required output undefined");
  if (!scene.stakes) warnings.push("Stakes undefined");
  return warnings;
}

export function StatCard({ label, value, detail, accent }) {
  return (
    <div className={`stat-card ${accent || ""}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {detail && <div className="stat-detail">{detail}</div>}
    </div>
  );
}

export function MetricBar({ label, value, max = 1 }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  let color = "var(--accent-purple)";
  if (pct < 30) color = "#ef4444";
  else if (pct < 60) color = "#f59e0b";

  return (
    <div className="metric-row">
      <div className="metric-header">
        <span>{label}</span>
        <span>{value.toFixed(2)}</span>
      </div>
      <div className="metric-track">
        <div className="metric-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export function PipelineTracker({ currentStage }) {
  const stages = [
    { id: "analysis", label: "ANALYSIS", desc: "Measuring rhythm and truth" },
    { id: "delta", label: "DELTA", desc: "Generating constraints" },
    { id: "draft", label: "OLLAMA", desc: "Primary rewrite" },
    { id: "refinement", label: "OPENAI", desc: "Refinement pass" },
    { id: "critique", label: "CRITIC", desc: "Final gatekeeping" },
    { id: "done", label: "READY", desc: "Processing complete" }
  ];

  const currentIndex = stages.findIndex(s => s.id === currentStage);

  return (
    <div className="pipeline-tracker">
      <div className="pipeline-steps">
        {stages.map((s, i) => (
          <Fragment key={s.id}>
            <div className={`pipeline-step ${i <= currentIndex ? "active" : ""} ${s.id === currentStage ? "current" : ""}`}>
              <div className="step-dot" />
              <div className="step-label">{s.label}</div>
            </div>
            {i < stages.length - 1 && <div className={`pipeline-connector ${i < currentIndex ? "active" : ""}`} />}
          </Fragment>
        ))}
      </div>
      {currentStage && currentStage !== "done" && (
        <div className="pipeline-current-info">
          <div className="spinner-small" />
          <span>{stages[currentIndex]?.desc}...</span>
        </div>
      )}
    </div>
  );
}

export function PreflightBrief({ scene, preproduction }) {
  if (!scene) return null;

  const warnings = getSceneBriefWarnings(scene);
  const readiness = Math.max(0, 6 - warnings.length);
  const readinessPct = Math.round((readiness / 6) * 100);
  const presentCharacters = String(scene.chars || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return (
    <div className="preflight-doc">
      <div className="brief-header">
        <div className="brief-title">Ch.{scene.chapter} - {scene.title}</div>
        <div className="brief-meta">
          <div>PROJECT <span>{preproduction.core.title || "UNTITLED"}</span></div>
          <div>STATUS <span className={`status-badge tag-${scene.status}`}>{scene.status.toUpperCase()}</span></div>
          <div>FUNCTION <span className={`causality-badge tag-${scene.causalityType}`}>{scene.causalityType.toUpperCase()}</span></div>
        </div>
      </div>

      <div className="brief-audit-strip">
        <div className="brief-audit-card">
          <span>Scene readiness</span>
          <strong>{readinessPct}%</strong>
        </div>
        <div className="brief-audit-card">
          <span>Characters present</span>
          <strong>{presentCharacters.length || 0}</strong>
        </div>
        <div className="brief-audit-card">
          <span>Review items</span>
          <strong>{warnings.length}</strong>
        </div>
      </div>

      <div className="brief-grid">
        <div className="brief-section">
          <div className="brief-label">PHYSICAL BOUNDARY</div>
          <div className="brief-value">{scene.location || "NOT SET"}</div>
          <div className="brief-label">STORY TIME</div>
          <div className="brief-value">{scene.time || "NOT SET"}</div>
          <div className="brief-label">PLANTED OBJECTS</div>
          <div className="brief-value">{scene.objects || "NONE"}</div>
        </div>
        <div className="brief-section">
          <div className="brief-label">CAUSALITY / FUNCTION</div>
          <div className="brief-value">{scene.causality || "NOT SET"}</div>
          <div className="brief-label">REQUIRED OUTPUT</div>
          <div className="brief-value">{scene.output || "NOT SET"}</div>
          <div className="brief-label">STAKES</div>
          <div className="brief-value">{scene.stakes || "NOT SET"}</div>
        </div>
      </div>

      <div className="brief-grid">
        <div className="brief-section">
          <div className="brief-label">CHARACTERS IN SCENE</div>
          <div className="brief-value">
            {presentCharacters.length > 0 ? presentCharacters.join(", ") : "NOT SET"}
          </div>
        </div>
        <div className="brief-section">
          <div className="brief-label">SCENE SUMMARY</div>
          <div className="brief-value">{scene.summary || scene.notes || "NOT SET"}</div>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="brief-warnings">
          {warnings.map((warning, index) => (
            <div key={index} className="brief-warning-item">Review: {warning}</div>
          ))}
        </div>
      )}
    </div>
  );
}
