// src/components/ImportWizard/ImportWizard.jsx
import React, { useCallback, useRef } from 'react';
import { useImportWizard } from '../../hooks/useImportWizard';
import './ImportWizard.css';

const CATEGORY_OPTIONS = [
  { value: 'chapters', label: 'Chapters', icon: '📖' },
  { value: 'characters', label: 'Characters', icon: '👤' },
  { value: 'worldRules', label: 'World Rules', icon: '🌍' },
  { value: 'beats', label: 'Story Beats', icon: '🎯' },
  { value: 'notes', label: 'Notes', icon: '📝' },
];

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
                        {' '}— Auto-detected: {CATEGORY_OPTIONS.find(c => c.value === file.category)?.label || file.category}
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

      {wizard.error && (
        <div className="error-message">{wizard.error}</div>
      )}
    </div>
  );

  const renderClassifyStep = () => (
    <div className="step-content">
      <h3>Classify Files</h3>
      <p className="step-description">Review and adjust the category for each imported file.</p>
      
      <div className="file-grid">
        {wizard.importFiles.filter(f => f.status === 'ready').map(file => (
          <div key={file.id} className="classify-card">
            <div className="card-header">
              <span className="card-filename" title={file.fileName}>{file.fileName}</span>
            </div>
            <div className="card-body">
              <select 
                value={wizard.classifications[file.id] || file.category}
                onChange={(e) => wizard.updateClassification(file.id, e.target.value)}
              >
                {CATEGORY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.icon} {opt.label}
                  </option>
                ))}
              </select>
              <div className="card-preview">
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
            <span className="item-icon">{CATEGORY_OPTIONS.find(c => c.value === (wizard.classifications[file.id] || file.category))?.icon}</span>
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

  const renderResultStep = () => (
    <div className="step-content result-step">
      <div className="result-animation">🎉</div>
      <h3>Import Successful</h3>
      
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

      <div className="result-changelog">
        <h4>Changelog</h4>
        <ul>
          {wizard.importResult?.changelog.map((log, i) => <li key={i}>{log}</li>)}
        </ul>
      </div>

      <button className="btn-primary full-width" onClick={onClose}>Done</button>
    </div>
  );

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
