// src/components/import/ConflictResolutionStep.jsx
import React, { useState, useCallback } from 'react';

const RESOLUTION_OPTIONS = [
  { value: 'skip', label: 'Skip — Keep existing, don\'t import this' },
  { value: 'overwrite', label: 'Overwrite — Replace existing with imported' },
  { value: 'merge', label: 'Merge — Combine both versions' },
  { value: 'rename', label: 'Rename — Import as a new item with modified name' }
];

export default function ConflictResolutionStep({ conflicts, onResolved, onBack, onCancel }) {
  const [resolutions, setResolutions] = useState(
    conflicts.map(c => ({
      ...c,
      resolution: 'skip' // default
    }))
  );

  const handleResolutionChange = useCallback((index, resolution) => {
    setResolutions(prev => prev.map((item, i) =>
      i === index ? { ...item, resolution } : item
    ));
  }, []);

  const handleApplyAll = useCallback((resolution) => {
    setResolutions(prev => prev.map(item => ({ ...item, resolution })));
  }, []);

  const handleConfirm = useCallback(() => {
    onResolved(resolutions);
  }, [resolutions, onResolved]);

  return (
    <div className="conflict-resolution-step">
      <p className="conflict-resolution-step__intro">
        We found <strong>{conflicts.length}</strong> potential conflict{conflicts.length !== 1 ? 's' : ''} with existing data.
        Please choose how to handle each one.
      </p>

      <div className="conflict-resolution-step__bulk-actions">
        <span>Apply to all:</span>
        {RESOLUTION_OPTIONS.map(opt => (
          <button
            key={opt.value}
            className="btn btn--small btn--outline"
            onClick={() => handleApplyAll(opt.value)}
          >
            {opt.label.split('—')[0].trim()}
          </button>
        ))}
      </div>

      <div className="conflict-resolution-step__list">
        {resolutions.map((conflict, index) => (
          <div key={index} className="conflict-resolution-step__item">
            <div className="conflict-resolution-step__conflict-info">
              <span className="conflict-resolution-step__type-badge">
                {conflict.type}
              </span>
              <span className="conflict-resolution-step__name">
                {conflict.importedName || conflict.fileName}
              </span>
              <p className="conflict-resolution-step__detail">
                Conflicts with existing: <strong>{conflict.existingName}</strong>
              </p>
              {conflict.existingPreview && (
                <div className="conflict-resolution-step__existing-preview">
                  <small>Existing:</small> {conflict.existingPreview.substring(0, 150)}...
                </div>
              )}
              {conflict.importedPreview && (
                <div className="conflict-resolution-step__imported-preview">
                  <small>Imported:</small> {conflict.importedPreview.substring(0, 150)}...
                </div>
              )}
            </div>
            <div className="conflict-resolution-step__resolution-select">
              <select
                value={conflict.resolution}
                onChange={(e) => handleResolutionChange(index, e.target.value)}
              >
                {RESOLUTION_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>

      <div className="import-wizard__actions">
        <button className="btn btn--secondary" onClick={onCancel}>Cancel</button>
        <button className="btn btn--secondary" onClick={onBack}>← Back</button>
        <button className="btn btn--primary" onClick={handleConfirm}>
          Continue →
        </button>
      </div>
    </div>
  );
}
