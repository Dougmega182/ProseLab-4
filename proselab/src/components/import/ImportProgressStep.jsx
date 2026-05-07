// src/components/import/ImportProgressStep.jsx
import React from 'react';

export default function ImportProgressStep({ progress }) {
  const { current, total, message, phase } = progress;
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="import-progress-step">
      <div className="import-progress-step__spinner">
        <div className="spinner" />
      </div>

      <h3 className="import-progress-step__phase">
        {phase || 'Importing...'}
      </h3>

      <div className="import-progress-step__bar-container">
        <div
          className="import-progress-step__bar"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <p className="import-progress-step__percentage">{percentage}%</p>

      <p className="import-progress-step__message">
        {message || 'Processing files...'}
      </p>

      <p className="import-progress-step__hint">
        Please don't close this window while the import is in progress.
      </p>
    </div>
  );
}
