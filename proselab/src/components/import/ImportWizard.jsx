// src/components/import/ImportWizard.jsx
import React, { useState, useCallback } from 'react';
import FileUploadStep from './FileUploadStep';
import FileClassificationStep from './FileClassificationStep';
import ConflictResolutionStep from './ConflictResolutionStep';
import AnalysisOptionsStep from './AnalysisOptionsStep';
import ImportProgressStep from './ImportProgressStep';
import ImportReportStep from './ImportReportStep';

const STEPS = {
  UPLOAD: 0,
  CLASSIFY: 1,
  CONFLICTS: 2,
  ANALYSIS: 3,
  PROGRESS: 4,
  REPORT: 5
};

const STEP_LABELS = [
  'Upload Files',
  'Classify Files',
  'Resolve Conflicts',
  'Analysis Options',
  'Importing...',
  'Results'
];

export default function ImportWizard({ projectId, orchestrator, onComplete, onCancel }) {
  const [currentStep, setCurrentStep] = useState(STEPS.UPLOAD);
  const [files, setFiles] = useState([]);
  const [classifications, setClassifications] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [analysisOptions, setAnalysisOptions] = useState({
    extractCharacters: false,
    extractWorldRules: false,
    deriveBeatMap: false,
    buildSceneInventory: false,
    checkContinuity: false,
    autoSaveExtracted: true
  });
  const [progress, setProgress] = useState({ current: 0, total: 1, message: '' });
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  // Step 1: Files uploaded
  const handleFilesUploaded = useCallback(async (uploadedFiles) => {
    setFiles(uploadedFiles);
    setError(null);

    try {
      // Read file contents
      const readFiles = await Promise.all(
        uploadedFiles.map(async (file) => {
          const text = await readFileAsText(file);
          return {
            fileName: file.name,
            text,
            size: file.size,
            type: file.type || guessFileType(file.name)
          };
        })
      );

      // Classify files
      const classified = orchestrator.classifyFiles(readFiles);
      setClassifications(classified);
      setCurrentStep(STEPS.CLASSIFY);
    } catch (err) {
      setError(`Failed to read files: ${err.message}`);
    }
  }, [orchestrator]);

  // Step 2: Classifications confirmed
  const handleClassificationsConfirmed = useCallback(async (confirmedClassifications) => {
    setClassifications(confirmedClassifications);
    setError(null);

    try {
      // Detect conflicts
      const detected = await orchestrator.detectConflicts(projectId, confirmedClassifications);

      if (detected.length > 0) {
        setConflicts(detected);
        setCurrentStep(STEPS.CONFLICTS);
      } else {
        // Skip conflict step, check if any manuscripts for analysis
        const hasManuscripts = confirmedClassifications.some(c => c.category === 'manuscript');
        if (hasManuscripts) {
          setCurrentStep(STEPS.ANALYSIS);
        } else {
          // Go straight to import
          startImport(confirmedClassifications, [], analysisOptions);
        }
      }
    } catch (err) {
      setError(`Failed to detect conflicts: ${err.message}`);
    }
  }, [orchestrator, projectId, analysisOptions]);

  // Step 3: Conflicts resolved
  const handleConflictsResolved = useCallback((resolvedConflicts) => {
    setConflicts(resolvedConflicts);
    setError(null);

    const hasManuscripts = classifications.some(c => c.category === 'manuscript');
    if (hasManuscripts) {
      setCurrentStep(STEPS.ANALYSIS);
    } else {
      startImport(classifications, resolvedConflicts, analysisOptions);
    }
  }, [classifications, analysisOptions]);

  // Step 4: Analysis options confirmed
  const handleAnalysisConfirmed = useCallback((options) => {
    setAnalysisOptions(options);
    setError(null);
    startImport(classifications, conflicts, options);
  }, [classifications, conflicts]);

  // Start the import
  const startImport = useCallback(async (classifiedFiles, resolvedConflicts, options) => {
    setCurrentStep(STEPS.PROGRESS);
    setError(null);

    try {
      const importOptions = {
        ...options,
        conflicts: resolvedConflicts
      };

      const result = await orchestrator.executeImport(
        projectId,
        classifiedFiles,
        importOptions,
        (progressData) => {
          setProgress(progressData);
        }
      );

      setReport(result);
      setCurrentStep(STEPS.REPORT);
    } catch (err) {
      setError(`Import failed: ${err.message}`);
      setCurrentStep(STEPS.REPORT);
      setReport({
        chaptersImported: 0,
        charactersImported: 0,
        worldRulesImported: 0,
        beatsImported: 0,
        notesImported: 0,
        skipped: 0,
        errors: [err.message],
        analysisResults: {}
      });
    }
  }, [orchestrator, projectId]);

  const handleBack = useCallback(() => {
    if (currentStep > STEPS.UPLOAD && currentStep < STEPS.PROGRESS) {
      // Skip conflict step on back if no conflicts
      if (currentStep === STEPS.ANALYSIS && conflicts.length === 0) {
        setCurrentStep(STEPS.CLASSIFY);
      } else {
        setCurrentStep(currentStep - 1);
      }
    }
  }, [currentStep, conflicts]);

  const handleDone = useCallback(() => {
    if (onComplete) onComplete(report);
  }, [onComplete, report]);

  return (
    <div className="import-wizard">
      <div className="import-wizard__header">
        <h2>Import Files</h2>
        <StepIndicator
          steps={STEP_LABELS}
          currentStep={currentStep}
        />
      </div>

      {error && (
        <div className="import-wizard__error">
          <span className="import-wizard__error-icon">⚠️</span>
          <span>{error}</span>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <div className="import-wizard__body">
        {currentStep === STEPS.UPLOAD && (
          <FileUploadStep
            onFilesSelected={handleFilesUploaded}
            onCancel={onCancel}
          />
        )}

        {currentStep === STEPS.CLASSIFY && (
          <FileClassificationStep
            classifications={classifications}
            onConfirm={handleClassificationsConfirmed}
            onBack={() => setCurrentStep(STEPS.UPLOAD)}
            onCancel={onCancel}
          />
        )}

        {currentStep === STEPS.CONFLICTS && (
          <ConflictResolutionStep
            conflicts={conflicts}
            onResolved={handleConflictsResolved}
            onBack={() => setCurrentStep(STEPS.CLASSIFY)}
            onCancel={onCancel}
          />
        )}

        {currentStep === STEPS.ANALYSIS && (
          <AnalysisOptionsStep
            options={analysisOptions}
            onConfirm={handleAnalysisConfirmed}
            onBack={handleBack}
            onCancel={onCancel}
          />
        )}

        {currentStep === STEPS.PROGRESS && (
          <ImportProgressStep
            progress={progress}
          />
        )}

        {currentStep === STEPS.REPORT && (
          <ImportReportStep
            report={report}
            onDone={handleDone}
          />
        )}
      </div>
    </div>
  );
}

function StepIndicator({ steps, currentStep }) {
  return (
    <div className="step-indicator">
      {steps.map((label, i) => (
        <div
          key={i}
          className={`step-indicator__step ${
            i === currentStep ? 'step-indicator__step--active' :
            i < currentStep ? 'step-indicator__step--completed' :
            'step-indicator__step--pending'
          }`}
        >
          <div className="step-indicator__dot">
            {i < currentStep ? '✓' : i + 1}
          </div>
          <div className="step-indicator__label">{label}</div>
        </div>
      ))}
    </div>
  );
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsText(file);
  });
}

function guessFileType(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  const typeMap = {
    txt: 'text/plain',
    md: 'text/markdown',
    markdown: 'text/markdown',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    rtf: 'application/rtf',
    json: 'application/json',
    csv: 'text/csv'
  };
  return typeMap[ext] || 'text/plain';
}
