// src/components/import/AnalysisOptionsStep.jsx
import React, { useState, useCallback } from 'react';

const ANALYSIS_OPTIONS = [
  {
    key: 'extractCharacters',
    label: 'Extract Characters',
    icon: '👤',
    description: 'Use AI to identify and extract character profiles from the manuscript text.',
    estimatedTime: '30-60 seconds'
  },
  {
    key: 'extractWorldRules',
    label: 'Extract World Rules',
    icon: '🌍',
    description: 'Use AI to identify world-building rules, facts, and constraints from the text.',
    estimatedTime: '30-60 seconds'
  },
  {
    key: 'deriveBeatMap',
    label: 'Derive Beat Map',
    icon: '🗺️',
    description: 'Use AI to analyze story structure and create a beat-by-beat outline.',
    estimatedTime: '30-60 seconds'
  },
  {
    key: 'buildSceneInventory',
    label: 'Build Scene Inventory',
    icon: '🎬',
    description: 'Use AI to create a scene-by-scene inventory with settings, characters, and summaries.',
    estimatedTime: '30-60 seconds'
  },
  {
    key: 'checkContinuity',
    label: 'Check Continuity',
    icon: '🔍',
    description: 'Use AI to scan for continuity errors, contradictions, and inconsistencies.',
    estimatedTime: '30-60 seconds'
  }
];

export default function AnalysisOptionsStep({ options, onConfirm, onBack, onCancel }) {
  const [selected, setSelected] = useState({ ...options });

  const handleToggle = useCallback((key) => {
    setSelected(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleSelectAll = useCallback(() => {
    const allOn = ANALYSIS_OPTIONS.every(opt => selected[opt.key]);
    const newState = {};
    ANALYSIS_OPTIONS.forEach(opt => { newState[opt.key] = !allOn; });
    setSelected(prev => ({ ...prev, ...newState }));
  }, [selected]);

  const handleAutoSaveToggle = useCallback(() => {
    setSelected(prev => ({ ...prev, autoSaveExtracted: !prev.autoSaveExtracted }));
  }, []);

  const handleConfirm = useCallback(() => {
    onConfirm(selected);
  }, [selected, onConfirm]);

  const anySelected = ANALYSIS_OPTIONS.some(opt => selected[opt.key]);

  return (
    <div className="analysis-options-step">
      <p className="analysis-options-step__intro">
        Your import includes manuscript text. Would you like AI to analyze it?
        These analyses run after the basic import completes.
      </p>

      <div className="analysis-options-step__select-all">
        <button className="btn btn--small btn--outline" onClick={handleSelectAll}>
          {ANALYSIS_OPTIONS.every(opt => selected[opt.key]) ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      <div className="analysis-options-step__options">
        {ANALYSIS_OPTIONS.map(opt => (
          <label
            key={opt.key}
            className={`analysis-options-step__option ${selected[opt.key] ? 'analysis-options-step__option--selected' : ''}`}
          >
            <input
              type="checkbox"
              checked={!!selected[opt.key]}
              onChange={() => handleToggle(opt.key)}
            />
            <span className="analysis-options-step__option-icon">{opt.icon}</span>
            <div className="analysis-options-step__option-text">
              <strong>{opt.label}</strong>
              <p>{opt.description}</p>
              <small>Estimated time: {opt.estimatedTime}</small>
            </div>
          </label>
        ))}
      </div>

      {anySelected && (
        <div className="analysis-options-step__auto-save">
          <label>
            <input
              type="checkbox"
              checked={!!selected.autoSaveExtracted}
              onChange={handleAutoSaveToggle}
            />
            Automatically save extracted data (characters, world rules, etc.) to the project
          </label>
        </div>
      )}

      <div className="import-wizard__actions">
        <button className="btn btn--secondary" onClick={onCancel}>Cancel</button>
        <button className="btn btn--secondary" onClick={onBack}>← Back</button>
        <button className="btn btn--primary" onClick={handleConfirm}>
          {anySelected ? 'Import & Analyze →' : 'Import Without Analysis →'}
        </button>
      </div>
    </div>
  );
}
