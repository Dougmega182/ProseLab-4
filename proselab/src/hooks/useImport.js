// src/hooks/useImport.js
import { useState, useCallback, useRef } from 'react';
import {
  readFiles,
  autoClassify,
  detectConflicts,
  applyImport,
} from '../services/importService';

const STEPS = ['upload', 'classify', 'conflicts', 'analysis', 'review', 'result'];

export function useImport(projectData, onProjectUpdate) {
  const [currentStep, setCurrentStep] = useState(0);
  const [importFiles, setImportFiles] = useState([]);
  const [classifications, setClassifications] = useState({});
  const [conflicts, setConflicts] = useState([]);
  const [conflictResolutions, setConflictResolutions] = useState({});
  const [analysisOptions, setAnalysisOptions] = useState({
    detectDuplicates: true,
    validateConsistency: true,
    suggestPlacements: true,
  });
  const [analysisResults, setAnalysisResults] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ percent: 0, label: '', detail: '' });
  const [error, setError] = useState(null);

  const abortRef = useRef(false);

  const reset = useCallback(() => {
    setCurrentStep(0);
    setImportFiles([]);
    setClassifications({});
    setConflicts([]);
    setConflictResolutions({});
    setAnalysisOptions({
      detectDuplicates: true,
      validateConsistency: true,
      suggestPlacements: true,
    });
    setAnalysisResults(null);
    setImportResult(null);
    setIsProcessing(false);
    setProgress({ percent: 0, label: '', detail: '' });
    setError(null);
    abortRef.current = false;
  }, []);

  // Step 1: Upload files
  const handleFilesSelected = useCallback(async (files) => {
    setIsProcessing(true);
    setProgress({ percent: 0, label: 'Reading files...', detail: '' });
    setError(null);

    try {
      const parsed = await readFiles(files);
      setImportFiles(parsed);

      // Auto-set classifications
      const autoClassifications = {};
      for (const item of parsed) {
        autoClassifications[item.id] = item.category;
      }
      setClassifications(autoClassifications);

      setIsProcessing(false);
      setCurrentStep(1);
    } catch (err) {
      setError(err.message);
      setIsProcessing(false);
    }
  }, []);

  // Step 2: Update classification for a file
  const handleClassificationChange = useCallback((fileId, category) => {
    setClassifications(prev => ({ ...prev, [fileId]: category }));
  }, []);

  // Step 2 -> 3: Proceed from classification to conflict detection
  const handleClassificationComplete = useCallback(() => {
    // Apply classifications to import files
    const updatedFiles = importFiles.map(f => ({
      ...f,
      category: classifications[f.id] || f.category,
    }));
    setImportFiles(updatedFiles);

    // Detect conflicts
    const detected = detectConflicts(updatedFiles, projectData);
    setConflicts(detected);

    if (detected.length > 0) {
      // Initialize resolutions
      const initialResolutions = {};
      for (const conflict of detected) {
        initialResolutions[conflict.id] = null;
      }
      setConflictResolutions(initialResolutions);
      setCurrentStep(2); // conflicts step
    } else {
      setCurrentStep(3); // skip to analysis
    }
  }, [importFiles, classifications, projectData]);

  // Step 3: Update conflict resolution
  const handleConflictResolution = useCallback((conflictId, resolution) => {
    setConflictResolutions(prev => ({ ...prev, [conflictId]: resolution }));
  }, []);

  // Apply same resolution to all conflicts
  const handleResolveAll = useCallback((resolution) => {
    setConflictResolutions(prev => {
      const updated = { ...prev };
      for (const key of Object.keys(updated)) {
        updated[key] = resolution;
      }
      return updated;
    });
  }, []);

  // Step 3 -> 4: Proceed from conflicts to analysis
  const handleConflictsComplete = useCallback(() => {
    setCurrentStep(3); // analysis step
  }, []);

  // Step 4: Update analysis options
  const handleAnalysisOptionChange = useCallback((option, value) => {
    setAnalysisOptions(prev => ({ ...prev, [option]: value }));
  }, []);

  // Step 4 -> 5: Run analysis and proceed to review
  const handleAnalysisComplete = useCallback(async () => {
    setIsProcessing(true);
    setProgress({ percent: 0, label: 'Analyzing content...', detail: '' });

    try {
      // Simulate analysis steps
      const results = { suggestions: [], warnings: [] };

      if (analysisOptions.detectDuplicates) {
        setProgress({ percent: 20, label: 'Checking for duplicates...', detail: '' });
        await delay(300);
        // Simple duplicate detection within imported files
        const seen = new Map();
        for (const file of importFiles) {
          if (!file.content) continue;
          const hash = simpleHash(file.content);
          if (seen.has(hash)) {
            results.warnings.push(
              `"${file.fileName}" appears to be a duplicate of "${seen.get(hash)}"`
            );
          } else {
            seen.set(hash, file.fileName);
          }
        }
      }

      if (analysisOptions.validateConsistency) {
        setProgress({ percent: 50, label: 'Validating consistency...', detail: '' });
        await delay(300);
        // Check for character name references across files
        const characterNames = new Set();
        for (const file of importFiles) {
          if (classifications[file.id] === 'characters' && file.content) {
            const names = extractNames(file.content);
            names.forEach(n => characterNames.add(n));
          }
        }
        // Check manuscript files for unknown character references
        if (characterNames.size > 0) {
          results.suggestions.push(
            `Found ${characterNames.size} character name(s) in character files`
          );
        }
      }

      if (analysisOptions.suggestPlacements) {
        setProgress({ percent: 80, label: 'Suggesting placements...', detail: '' });
        await delay(300);
        for (const file of importFiles) {
          if (classifications[file.id] === 'notes' && file.content) {
            // Check if notes content might be better classified
            const reclassified = autoClassify(file.fileName, file.content);
            if (reclassified !== 'notes') {
              results.suggestions.push(
                `"${file.fileName}" might be better classified as "${reclassified}" instead of "notes"`
              );
            }
          }
        }
      }

      setProgress({ percent: 100, label: 'Analysis complete', detail: '' });
      setAnalysisResults(results);
      setIsProcessing(false);
      setCurrentStep(4); // review step
    } catch (err) {
      setError(err.message);
      setIsProcessing(false);
    }
  }, [importFiles, classifications, analysisOptions]);

  // Step 5 -> 6: Execute import
  const handleExecuteImport = useCallback(async () => {
    setIsProcessing(true);
    setProgress({ percent: 0, label: 'Importing...', detail: '' });
    abortRef.current = false;

    try {
      const importPlan = importFiles
        .filter(f => f.status !== 'error' && f.content)
        .map(f => ({
          ...f,
          category: classifications[f.id] || f.category,
        }));

      const totalItems = importPlan.length;
      let processed = 0;

      // Process in batches to allow progress updates
      const result = {
        updatedProject: JSON.parse(JSON.stringify(projectData)),
        changelog: [],
        warnings: [],
        summary: {
          chaptersAdded: 0,
          chaptersUpdated: 0,
          charactersAdded: 0,
          charactersUpdated: 0,
          rulesAdded: 0,
          beatsAdded: 0,
          notesAdded: 0,
        },
      };

      for (const item of importPlan) {
        if (abortRef.current) {
          result.warnings.push('Import was cancelled by user');
          break;
        }

        setProgress({
          percent: Math.round((processed / totalItems) * 100),
          label: `Processing ${item.fileName}...`,
          detail: `${processed + 1} of ${totalItems}`,
        });

        // Small delay to allow UI updates
        await delay(100);

        const singleResult = await applyImport(
          result.updatedProject,
          [item],
          conflictResolutions
        );

        result.updatedProject = singleResult.updatedProject;
        result.changelog.push(...singleResult.changelog);
        result.warnings.push(...singleResult.warnings);

        // Merge summaries
        for (const key of Object.keys(result.summary)) {
          result.summary[key] += singleResult.summary[key] || 0;
        }

        processed++;
      }

      setProgress({ percent: 100, label: 'Import complete!', detail: '' });

      // Save to project
      if (onProjectUpdate) {
        onProjectUpdate(result.updatedProject);
      }

      setImportResult(result);
      setIsProcessing(false);
      setCurrentStep(5); // result step
    } catch (err) {
      setError(err.message);
      setIsProcessing(false);
    }
  }, [importFiles, classifications, conflictResolutions, projectData, onProjectUpdate]);

  const handleAbort = useCallback(() => {
    abortRef.current = true;
  }, []);

  // Navigation
  const goToStep = useCallback((step) => {
    if (step >= 0 && step < STEPS.length) {
      setCurrentStep(step);
    }
  }, []);

  const goBack = useCallback(() => {
    setCurrentStep(prev => {
      if (prev === 3 && conflicts.length === 0) return 1; // skip conflicts going back
      return Math.max(0, prev - 1);
    });
  }, [conflicts]);

  return {
    // State
    currentStep,
    stepName: STEPS[currentStep],
    totalSteps: STEPS.length,
    importFiles,
    classifications,
    conflicts,
    conflictResolutions,
    analysisOptions,
    analysisResults,
    importResult,
    isProcessing,
    progress,
    error,

    // Actions
    handleFilesSelected,
    handleClassificationChange,
    handleClassificationComplete,
    handleConflictResolution,
    handleResolveAll,
    handleConflictsComplete,
    handleAnalysisOptionChange,
    handleAnalysisComplete,
    handleExecuteImport,
    handleAbort,
    goToStep,
    goBack,
    reset,
  };
}

// Utilities
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < Math.min(str.length, 1000); i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}

function extractNames(content) {
  const names = new Set();
  // Look for "Name: X" patterns
  const namePattern = /(?:Name|Character)\s*:\s*(.+)/gim;
  let match;
  while ((match = namePattern.exec(content)) !== null) {
    names.add(match[1].trim());
  }
  // Look for markdown headings as names
  const headingPattern = /^#{1,3}\s+(.+)/gm;
  while ((match = headingPattern.exec(content)) !== null) {
    const heading = match[1].trim();
    if (heading.length < 50 && !heading.match(/description|traits|background|notes/i)) {
      names.add(heading);
    }
  }
  return names;
}
