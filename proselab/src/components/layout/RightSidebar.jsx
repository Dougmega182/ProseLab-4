import React from 'react';

export default function RightSidebar({ 
  activeMode, 
  stage, 
  analysis, 
  delta, 
  SPARKS, 
  runSpark, 
  running, 
  activeModeInfo, 
  CREATE_PIPELINE_SUMMARY 
}) {
  return (
    <div className="right-sidebar" style={{ width: '380px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '24px', padding: '24px' }}>
      
      <div className="sidebar-section">
        <h3 className="sidebar-heading">Mission Control</h3>
        <div className="mission-control-panel">
          <div className="status-indicator">
            <span className="status-dot active"></span>
            <span className="status-text">{activeMode || "IDLE"}</span>
          </div>
          {stage && <div className="current-stage">{stage}</div>}
        </div>
      </div>

      <div className="sidebar-section">
        <h3 className="sidebar-heading">Active Rewrite Constraints</h3>
        {delta && delta.length > 0 ? (
          <ul className="constraints-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {delta.map((d, i) => (
              <li key={i} className="constraint-item" style={{ fontSize: '13px', marginBottom: '8px', padding: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px' }}>
                <span className="constraint-dot" style={{ display: 'inline-block', width: '6px', height: '6px', background: 'var(--accent-primary)', borderRadius: '50%', marginRight: '8px' }}></span>
                {d}
              </li>
            ))}
          </ul>
        ) : (
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No active constraints</div>
        )}
      </div>

      {analysis && (
        <div className="sidebar-section">
          <h3 className="sidebar-heading">Live Telemetry</h3>
          <div className="telemetry-grid">
            <div className="telemetry-item">
              <span className="telemetry-label">Physical Grounding</span>
              <span className="telemetry-value">{(analysis.emotion?.physicalRatio ? Math.round(analysis.emotion.physicalRatio * 10) : 0)}/10</span>
            </div>
            <div className="telemetry-item">
              <span className="telemetry-label">Specificity</span>
              <span className="telemetry-value">{(analysis.specificity?.concreteRatio ? Math.round(analysis.specificity.concreteRatio * 10) : 0)}/10</span>
            </div>
          </div>
        </div>
      )}

      {SPARKS && (
        <div className="sidebar-section">
          <h3 className="sidebar-heading">Sparks & Actions</h3>
          <div className="sparks-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {SPARKS.EDIT?.map(s => (
              <button key={s.id} className="btn btn-ghost btn-spark btn-sm" onClick={() => runSpark(s)} disabled={running}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
