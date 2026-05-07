// src/components/import/ImportReportStep.jsx
import React, { useState } from 'react';

export default function ImportReportStep({ report, onDone }) {
  const [expandedSection, setExpandedSection] = useState(null);

  if (!report) {
    return (
      <div className="import-report-step">
        <p>No report available.</p>
        <button className="btn btn--primary" onClick={onDone}>Done</button>
      </div>
    );
  }

  const {
    chaptersImported = 0,
    charactersImported = 0,
    worldRulesImported = 0,
    beatsImported = 0,
    notesImported = 0,
    skipped = 0,
    errors = [],
    analysisResults = {}
  } = report;

  const totalImported = chaptersImported + charactersImported + worldRulesImported + beatsImported + notesImported;
  const hasErrors = errors.length > 0;
  const hasAnalysis = Object.keys(analysisResults).length > 0;

  const toggleSection = (section) => {
    setExpandedSection(prev => prev === section ? null : section);
  };

  return (
    <div className="import-report-step">
      <div className={`import-report-step__header ${hasErrors ? 'import-report-step__header--warning' : 'import-report-step__header--success'}`}>
        <span className="import-report-step__header-icon">
          {hasErrors ? '⚠️' : '✅'}
        </span>
        <h3>
          {hasErrors
            ? `Import completed with ${errors.length} error${errors.length !== 1 ? 's' : ''}`
            : 'Import completed successfully!'
          }
        </h3>
      </div>

      <div className="import-report-step__stats">
        <h4>Import Summary</h4>
        <div className="import-report-step__stat-grid">
          {chaptersImported > 0 && (
            <div className="import-report-step__stat">
              <span className="import-report-step__stat-icon">📖</span>
              <span className="import-report-step__stat-value">{chaptersImported}</span>
              <span className="import-report-step__stat-label">Chapter{chaptersImported !== 1 ? 's' : ''}</span>
            </div>
          )}
          {charactersImported > 0 && (
            <div className="import-report-step__stat">
              <span className="import-report-step__stat-icon">👤</span>
              <span className="import-report-step__stat-value">{charactersImported}</span>
              <span className="import-report-step__stat-label">Character{charactersImported !== 1 ? 's' : ''}</span>
            </div>
          )}
          {worldRulesImported > 0 && (
            <div className="import-report-step__stat">
              <span className="import-report-step__stat-icon">🌍</span>
              <span className="import-report-step__stat-value">{worldRulesImported}</span>
              <span className="import-report-step__stat-label">World Rule{worldRulesImported !== 1 ? 's' : ''}</span>
            </div>
          )}
          {beatsImported > 0 && (
            <div className="import-report-step__stat">
              <span className="import-report-step__stat-icon">🗺️</span>
              <span className="import-report-step__stat-value">{beatsImported}</span>
              <span className="import-report-step__stat-label">Beat{beatsImported !== 1 ? 's' : ''}</span>
            </div>
          )}
          {notesImported > 0 && (
            <div className="import-report-step__stat">
              <span className="import-report-step__stat-icon">📝</span>
              <span className="import-report-step__stat-value">{notesImported}</span>
              <span className="import-report-step__stat-label">Note{notesImported !== 1 ? 's' : ''}</span>
            </div>
          )}
          {skipped > 0 && (
            <div className="import-report-step__stat import-report-step__stat--skipped">
              <span className="import-report-step__stat-icon">⏭️</span>
              <span className="import-report-step__stat-value">{skipped}</span>
              <span className="import-report-step__stat-label">Skipped</span>
            </div>
          )}
        </div>
      </div>

      {hasErrors && (
        <div className="import-report-step__section">
          <button
            className="import-report-step__section-toggle"
            onClick={() => toggleSection('errors')}
          >
            ⚠️ Errors ({errors.length})
            <span>{expandedSection === 'errors' ? '▼' : '▶'}</span>
          </button>
          {expandedSection === 'errors' && (
            <ul className="import-report-step__error-list">
              {errors.map((err, i) => (
                <li key={i} className="import-report-step__error-item">{err}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {hasAnalysis && (
        <div className="import-report-step__section">
          <button
            className="import-report-step__section-toggle"
            onClick={() => toggleSection('analysis')}
          >
            🔬 Analysis Results
            <span>{expandedSection === 'analysis' ? '▼' : '▶'}</span>
          </button>
          {expandedSection === 'analysis' && (
            <div className="import-report-step__analysis">
              {analysisResults.characters && (
                <div className="import-report-step__analysis-group">
                  <h5>👤 Extracted Characters ({analysisResults.characters.length})</h5>
                  <ul>
                    {analysisResults.characters.map((char, i) => (
                      <li key={i}>{char.name} — {char.role || 'Unknown role'}</li>
                    ))}
                  </ul>
                </div>
              )}
              {analysisResults.worldRules && (
                <div className="import-report-step__analysis-group">
                  <h5>🌍 Extracted World Rules ({analysisResults.worldRules.length})</h5>
                  <ul>
                    {analysisResults.worldRules.map((rule, i) => (
                      <li key={i}>{rule.title || rule.summary}</li>
                    ))}
                  </ul>
                </div>
              )}
              {analysisResults.beats && (
                <div className="import-report-step__analysis-group">
                  <h5>🗺️ Derived Beats ({analysisResults.beats.length})</h5>
                  <ul>
                    {analysisResults.beats.map((beat, i) => (
                      <li key={i}>{beat.title || beat.summary}</li>
                    ))}
                  </ul>
                </div>
              )}
              {analysisResults.scenes && (
                <div className="import-report-step__analysis-group">
                  <h5>🎬 Scene Inventory ({analysisResults.scenes.length})</h5>
                  <ul>
                    {analysisResults.scenes.map((scene, i) => (
                      <li key={i}>
                        Scene {i + 1}: {scene.setting || 'Unknown setting'} — {scene.summary || ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {analysisResults.continuityIssues && (
                <div className="import-report-step__analysis-group">
                  <h5>🔍 Continuity Issues ({analysisResults.continuityIssues.length})</h5>
                  {analysisResults.continuityIssues.length === 0 ? (
                    <p>No continuity issues found! ✅</p>
                  ) : (
                    <ul>
                      {analysisResults.continuityIssues.map((issue, i) => (
                        <li key={i} className={`continuity-issue--${issue.severity || 'info'}`}>
                          [{issue.severity || 'info'}] {issue.description}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="import-wizard__actions">
        <button className="btn btn--primary" onClick={onDone}>
          Done — Go to Project
        </button>
      </div>
    </div>
  );
}
