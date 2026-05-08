// src/components/ImportWizard/ImportWizard.jsx
import React, { useCallback, useRef } from 'react';
import { useImportWizard } from '../../hooks/useImportWizard';
import './ImportWizard.css';

const CATEGORY_OPTIONS = [
  { value: 'manuscript', label: 'Manuscript', icon: '📖' },
  { value: 'notes', label: 'Notes', icon: '📝' },
  { value: 'characters', label: 'Characters', icon: '👤' },
  { value: 'scenes', label: 'Scenes', icon: '🎬' },
  { value: 'worldbuilding', label: 'World Building', icon: '🌍' },
  { value: 'outline', label: 'Outline', icon: '📋' },
];

// Map orchestrator types to UI categories (if they differ, but we'll align them now)
const MAP_CATEGORY = (cat) => {
  if (cat === 'chapters') return 'manuscript';
  if (cat === 'worldRule') return 'worldbuilding';
  if (cat === 'beatMap') return 'outline';
  return cat;
};

const asArray = (value) => Array.isArray(value) ? value : [];

const isHeuristic = (item) => String(item?.source || '').toLowerCase().includes('heuristic');

function buildAnalysisTrustSummary(importResult) {
  const analysis = importResult?.analysisResults || {};
  const warnings = asArray(importResult?.warnings);

  const characters = asArray(analysis.characters);
  const worldRules = asArray(analysis.worldRules);
  const beats = asArray(analysis.beats);
  const scenes = asArray(analysis.scenes);
  const continuityIssues = asArray(analysis.continuityIssues);

  const sections = [
    {
      key: 'characters',
      label: 'Characters',
      total: characters.length,
      trustworthy: characters.filter((item) =>
        !isHeuristic(item) && String(item?.name || '').trim() && String(item?.role || '').trim()
      ).length,
      review: characters.filter((item) =>
        isHeuristic(item) || !String(item?.role || '').trim() || !String(item?.motivation || item?.relationships || '').trim()
      ).length,
      examples: characters.slice(0, 3).map((item) => `${item.name || 'Unnamed'} - ${item.role || 'role missing'}`)
    },
    {
      key: 'worldRules',
      label: 'World Rules',
      total: worldRules.length,
      trustworthy: worldRules.filter((item) =>
        !isHeuristic(item) && String(item?.title || item?.rule || '').trim() && String(item?.description || item?.consequence || '').trim()
      ).length,
      review: worldRules.filter((item) =>
        isHeuristic(item) || !String(item?.description || item?.consequence || '').trim()
      ).length,
      examples: worldRules.slice(0, 3).map((item) => item.title || item.rule || 'Untitled rule')
    },
    {
      key: 'beats',
      label: 'Beats',
      total: beats.length,
      trustworthy: beats.filter((item) =>
        !isHeuristic(item) && String(item?.title || '').trim() && String(item?.description || '').trim()
      ).length,
      review: beats.filter((item) =>
        isHeuristic(item) || !String(item?.description || '').trim()
      ).length,
      examples: beats.slice(0, 3).map((item) => item.title || 'Untitled beat')
    },
    {
      key: 'scenes',
      label: 'Scene Inventory',
      total: scenes.length,
      trustworthy: scenes.filter((item) =>
        !isHeuristic(item) && String(item?.summary || '').trim() && String(item?.setting || item?.location || '').trim()
      ).length,
      review: scenes.filter((item) =>
        isHeuristic(item) || !String(item?.summary || '').trim() || !String(item?.setting || item?.location || '').trim()
      ).length,
      examples: scenes.slice(0, 3).map((item, index) => `Scene ${index + 1} - ${item.title || item.setting || 'summary/location missing'}`)
    },
    {
      key: 'continuity',
      label: 'Continuity',
      total: continuityIssues.length,
      trustworthy: continuityIssues.length === 0 ? 1 : 0,
      review: continuityIssues.length,
      examples: continuityIssues.slice(0, 3).map((item) => `[${item.severity || 'info'}] ${item.description || item.message || 'Issue detected'}`)
    }
  ];

  return {
    sections,
    warnings,
    analysisTotal: sections.reduce((sum, section) => sum + section.total, 0),
    trustworthyTotal: sections.reduce((sum, section) => sum + section.trustworthy, 0),
    reviewTotal: sections.reduce((sum, section) => sum + section.review, 0) + warnings.length
  };
}

function getTrustTone(section) {
  if (section.key === 'continuity') {
    return section.review > 0 ? 'review' : 'strong';
  }
  if (section.total === 0) return 'empty';
  if (section.review === 0) return 'strong';
  if (section.trustworthy > 0) return 'mixed';
  return 'review';
}

export default function ImportWizard({ projectId, existingData, onImportComplete, onClose, storage, llm }) {
  const wizard = useImportWizard({ projectId, existingData, onImportComplete, storage, llm });
  const fileInputRef = useRef(null);
  const dropRef = useRef(null);

  // Drag and drop handlers
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('drag-over');
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) {
      wizard.handleFiles(e.dataTransfer.files);
    }
  }, [wizard.handleFiles]);

  const handleFileInput = useCallback((e) => {
    if (e.target.files.length > 0) {
      wizard.handleFiles(e.target.files);
      e.target.value = '';
    }
  }, [wizard.handleFiles]);

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Step renderers
  const renderUploadStep = () => (
    <div className="step-content">
      <h3>Upload Files</h3>
      <p className="step-description">
        Drag and drop files or click to browse. Supported formats: .txt, .md, .json, .docx, .rtf
      </p>

      <div
        ref={dropRef}
        className="drop-zone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <span className="drop-icon">📁</span>
        <span className="drop-text">Drop files here or click to browse</span>
        <span className="drop-hint">Up to 10MB per file</span>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".txt,.md,.json,.docx,.rtf"
          onChange={handleFileInput}
          style={{ display: 'none' }}
        />
      </div>

      {wizard.importFiles.length > 0 && (
        <div className="file-list">
          {wizard.importFiles.map(file => (
            <div key={file.id} className={`file-item ${file.status}`}>
              <div className="file-info">
                <span className="file-icon">
                  {file.status === 'error' ? '❌' : '📄'}
                </span>
                <div className="file-details">
                  <span className="file-name">{file.fileName}</span>
                  <span className="file-meta">
                    {formatFileSize(file.fileSize)}
                    {file.status === 'error' && (
                      <span className="file-error"> — {file.error}</span>
                    )}
                    {file.status === 'ready' && (
                      <span className="file-category-hint">
                        {' '}— Auto-detected: {CATEGORY_OPTIONS.find(c => c.value === MAP_CATEGORY(file.category))?.label || file.category}
                      </span>
                    )}
                  </span>
                </div>
              </div>
              <button
                className="file-remove"
                onClick={(e) => {
                  e.stopPropagation();
                  wizard.removeFile(file.id);
                }}
                title="Remove file"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderClassifyStep = () => (
    <div className="step-content">
      <h3>Classify Files</h3>
      <p className="step-description">Review and adjust the category for each imported file.</p>
      
      <div className="file-grid">
        {wizard.importFiles.filter(f => f.status === 'ready').map(file => (
          <div key={file.id} className="classify-item">
            <div className="classify-file-info">
              <span className="card-filename" title={file.fileName}>{file.fileName}</span>
            </div>
            <div className="classify-select-wrapper">
              <select 
                className="classify-select"
                value={wizard.classifications[file.id] || MAP_CATEGORY(file.category)}
                onChange={(e) => wizard.updateClassification(file.id, e.target.value)}
              >
                {CATEGORY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.icon} {opt.label}
                  </option>
                ))}
              </select>
              <div className="content-preview">
                {file.content?.substring(0, 150)}...
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderConflictsStep = () => (
    <div className="step-content">
      <h3>Resolve Conflicts</h3>
      {wizard.conflicts.length === 0 ? (
        <div className="no-conflicts">
          <span className="success-icon">✅</span>
          <p>No direct conflicts detected. Existing data is safe.</p>
        </div>
      ) : (
        <>
          <p className="step-description">Found {wizard.conflicts.length} items that already exist in your project.</p>
          <div className="bulk-actions">
            <button onClick={() => wizard.resolveAllConflicts('keep_existing')}>Keep All Existing</button>
            <button onClick={() => wizard.resolveAllConflicts('replace')}>Replace All with Incoming</button>
          </div>
          <div className="conflict-list">
            {wizard.conflicts.map(conflict => (
              <div key={conflict.id} className="conflict-card">
                <div className="conflict-card-header">
                  <span className="conflict-type-tag">{conflict.type}</span>
                  <span className="conflict-title">{conflict.existingTitle}</span>
                </div>
                <div className="conflict-diff">
                  <div className="diff-panel existing">
                    <label>Existing</label>
                    <div className="diff-content">{conflict.existingPreview}...</div>
                  </div>
                  <div className="diff-panel incoming">
                    <label>Incoming</label>
                    <div className="diff-content">{conflict.incomingPreview}...</div>
                  </div>
                </div>
                <div className="conflict-actions">
                  <button 
                    className={wizard.conflictResolutions[conflict.id] === 'keep_existing' ? 'active' : ''}
                    onClick={() => wizard.resolveConflict(conflict.id, 'keep_existing')}
                  >
                    Keep Existing
                  </button>
                  <button 
                    className={wizard.conflictResolutions[conflict.id] === 'replace' ? 'active' : ''}
                    onClick={() => wizard.resolveConflict(conflict.id, 'replace')}
                  >
                    Replace
                  </button>
                  <button 
                    className={wizard.conflictResolutions[conflict.id] === 'merge' ? 'active' : ''}
                    onClick={() => wizard.resolveConflict(conflict.id, 'merge')}
                  >
                    Merge
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  const renderAnalysisStep = () => (
    <div className="step-content">
      <h3>AI Analysis</h3>
      <p className="step-description">We'll perform a pre-flight check to ensure your data is clean.</p>
      
      <div className="analysis-toggles">
        <label className="toggle-item">
          <input 
            type="checkbox" 
            checked={wizard.analysisOptions.detectDuplicates}
            onChange={(e) => wizard.setAnalysisOptions(prev => ({ ...prev, detectDuplicates: e.target.checked }))}
          />
          <div className="toggle-label">
            <strong>Detect Duplicates</strong>
            <span>Checks for content overlap between files</span>
          </div>
        </label>
        <label className="toggle-item">
          <input 
            type="checkbox" 
            checked={wizard.analysisOptions.validateConsistency}
            onChange={(e) => wizard.setAnalysisOptions(prev => ({ ...prev, validateConsistency: e.target.checked }))}
          />
          <div className="toggle-label">
            <strong>Validate Consistency</strong>
            <span>Check character references and chapter lengths</span>
          </div>
        </label>
      </div>

      {wizard.analysisResults && (
        <div className="analysis-results">
          {wizard.analysisResults.warnings.length > 0 && (
            <div className="analysis-block warnings">
              <h4>⚠️ Warnings</h4>
              <ul>{wizard.analysisResults.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </div>
          )}
          {wizard.analysisResults.suggestions.length > 0 && (
            <div className="analysis-block suggestions">
              <h4>💡 Suggestions</h4>
              <ul>{wizard.analysisResults.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
          )}
          {wizard.analysisResults.warnings.length === 0 && wizard.analysisResults.suggestions.length === 0 && (
            <p className="analysis-clean">Clean scan! No issues detected.</p>
          )}
        </div>
      )}
    </div>
  );

  const renderReviewStep = () => (
    <div className="step-content">
      <h3>Final Review</h3>
      <p className="step-description">Ready to commit these changes to your project.</p>

      {wizard.importFiles.some(f => f.status === 'ready' && (wizard.classifications[f.id] || f.category) === 'manuscript') && (
        <div className="field-group" style={{ marginBottom: '18px' }}>
          <label className="field-label" style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
            Manuscript Project Name
          </label>
          <input
            type="text"
            className="search-input"
            value={wizard.projectName}
            onChange={(e) => wizard.setProjectName(e.target.value)}
            placeholder="Enter manuscript name"
          />
        </div>
      )}
      
      <div className="review-summary">
        <div className="summary-card">
          <span className="summary-count">{wizard.importFiles.filter(f => f.status === 'ready').length}</span>
          <span className="summary-label">Files to Process</span>
        </div>
        <div className="summary-card">
          <span className="summary-count">{wizard.conflicts.length}</span>
          <span className="summary-label">Conflicts Resolved</span>
        </div>
      </div>

      <div className="review-list">
        {wizard.importFiles.filter(f => f.status === 'ready').map(file => (
          <div key={file.id} className="review-item">
            <span className="item-icon">{CATEGORY_OPTIONS.find(c => c.value === (wizard.classifications[file.id] || MAP_CATEGORY(file.category)))?.icon}</span>
            <span className="item-name">{file.fileName}</span>
            <span className="item-action">
              {wizard.conflicts.some(c => c.fileId === file.id) ? (
                <span className="action-tag conflict">{wizard.conflictResolutions[wizard.conflicts.find(c => c.fileId === file.id)?.id]}</span>
              ) : (
                <span className="action-tag add">Add</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  const renderResultStep = () => {
    const trust = buildAnalysisTrustSummary(wizard.importResult);

    return (
      <div className="step-content result-step result-step--analysis">
        <div className="result-animation">Import complete</div>
        <h3>Import Complete</h3>
        <p className="step-description result-description">
          This is the first trust pass on your imported manuscript analysis. Strong sections can be explored immediately. Mixed and review sections should be checked before you rely on them.
        </p>

        <div className="result-stats">
          {Object.entries(wizard.importResult?.summary || {}).map(([key, val]) => (
            val > 0 && (
              <div key={key} className="result-stat-card">
                <span className="stat-val">{val}</span>
                <span className="stat-key">{key.replace(/([A-Z])/g, ' $1')}</span>
              </div>
            )
          ))}
        </div>

        <div className="result-trust-grid">
          <div className="result-trust-card">
            <span>Analysis items</span>
            <strong>{trust.analysisTotal}</strong>
          </div>
          <div className="result-trust-card result-trust-card--strong">
            <span>Looks strong</span>
            <strong>{trust.trustworthyTotal}</strong>
          </div>
          <div className="result-trust-card result-trust-card--review">
            <span>Needs review</span>
            <strong>{trust.reviewTotal}</strong>
          </div>
        </div>

        <div className="result-analysis-sections">
          {trust.sections.map((section) => {
            const tone = getTrustTone(section);
            return (
              <div key={section.key} className={`result-analysis-card is-${tone}`}>
                <div className="result-analysis-card__head">
                  <div>
                    <h4>{section.label}</h4>
                    <p>
                      {tone === 'strong' && 'Trustworthy enough to inspect in-app now.'}
                      {tone === 'mixed' && 'Useful, but some extracted items still need editorial review.'}
                      {tone === 'review' && 'Review this section before you rely on it.'}
                      {tone === 'empty' && 'No extracted data landed here.'}
                    </p>
                  </div>
                  <span className={`trust-badge trust-badge--${tone}`}>
                    {tone === 'strong' ? 'Strong' : tone === 'mixed' ? 'Mixed' : tone === 'review' ? 'Review' : 'Empty'}
                  </span>
                </div>
                <div className="result-analysis-card__stats">
                  <span>{section.total} total</span>
                  <span>{section.trustworthy} strong</span>
                  <span>{section.review} review</span>
                </div>
                {section.examples.length > 0 && (
                  <ul className="result-analysis-list">
                    {section.examples.map((example, index) => (
                      <li key={index}>{example}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>

        {trust.warnings.length > 0 && (
          <div className="result-warning-panel">
            <h4>Warnings</h4>
            <ul>
              {trust.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="result-changelog">
          <h4>Changelog</h4>
          <ul>
            {wizard.importResult?.changelog.map((log, i) => (
              <li key={i}>
                {typeof log === 'object' ? (
                  <span>
                    <strong>{log.action} {log.type}:</strong> {log.detail}
                  </span>
                ) : log}
              </li>
            ))}
          </ul>
        </div>

        <button className="btn-primary full-width" onClick={onClose}>Done</button>
      </div>
    );
  };

  return (
    <div className="import-wizard-overlay">
      <div className="import-wizard-modal">
        <div className="wizard-header">
          <div className="header-main">
            <h2>Import Assets</h2>
            <button className="btn-close" onClick={onClose}>×</button>
          </div>
          <div className="wizard-stepper">
            {wizard.steps.map((step, i) => (
              <div 
                key={step.id} 
                className={`stepper-item ${i === wizard.currentStep ? 'active' : i < wizard.currentStep ? 'complete' : ''}`}
              >
                <div className="stepper-circle">{i < wizard.currentStep ? '✓' : i + 1}</div>
                <span className="stepper-label">{step.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="wizard-body">
          {wizard.error && (
            <div className="error-message global-error">{wizard.error}</div>
          )}
          {wizard.stepName === 'upload' && renderUploadStep()}
          {wizard.stepName === 'classify' && renderClassifyStep()}
          {wizard.stepName === 'conflicts' && renderConflictsStep()}
          {wizard.stepName === 'analysis' && renderAnalysisStep()}
          {wizard.stepName === 'review' && renderReviewStep()}
          {wizard.stepName === 'result' && renderResultStep()}
        </div>

        <div className="wizard-footer">
          {wizard.stepName !== 'result' && (
            <>
              <button 
                className="btn-secondary" 
                onClick={wizard.goBack}
                disabled={wizard.currentStep === 0 || wizard.isProcessing}
              >
                Back
              </button>
              <div className="footer-right">
                {(wizard.stepName === 'conflicts' && wizard.conflicts.length === 0) || wizard.stepName === 'analysis' ? (
                  <button className="btn-ghost" onClick={wizard.skipStep} disabled={wizard.isProcessing}>
                    Skip
                  </button>
                ) : null}
                <button 
                  className="btn-primary" 
                  onClick={wizard.goNext}
                  disabled={!wizard.canProceed() || wizard.isProcessing}
                >
                  {wizard.stepName === 'review' ? 'Import Now' : 'Continue'}
                </button>
              </div>
            </>
          )}
        </div>

        {wizard.isProcessing && (
          <div className="wizard-processing-overlay">
            <div className="processing-card">
              <div className="spinner"></div>
              <div className="processing-text">
                <strong>{wizard.progress.label}</strong>
                <span>{wizard.progress.detail}</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${wizard.progress.percent}%` }}></div>
              </div>
              <button className="btn-cancel" onClick={wizard.cancelImport}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
