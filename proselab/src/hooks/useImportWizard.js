import { useState, useCallback, useRef, useMemo } from 'react';
import { ImportOrchestrator } from '../services/importOrchestrator';

const STEPS = [
  { id: 'upload', label: 'Upload' },
  { id: 'classify', label: 'Classify' },
  { id: 'conflicts', label: 'Conflicts' },
  { id: 'analysis', label: 'Analysis' },
  { id: 'review', label: 'Review' },
  { id: 'result', label: 'Result' },
];

const SUPPORTED_EXTENSIONS = ['.txt', '.md', '.json', '.docx', '.rtf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function useImportWizard({ projectId, existingData, onImportComplete, storage, llm }) {
  const orchestrator = useMemo(() => new ImportOrchestrator(storage, llm), [storage, llm]);
  const [currentStep, setCurrentStep] = useState(0);
  const [importFiles, setImportFiles] = useState([]);
  const [classifications, setClassifications] = useState({});
  const [conflicts, setConflicts] = useState([]);
  const [conflictResolutions, setConflictResolutions] = useState({});
  const [analysisOptions, setAnalysisOptions] = useState({
    detectDuplicates: true,
    validateConsistency: true,
    suggestPlacements: false,
  });
  const [analysisResults, setAnalysisResults] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ percent: 0, label: '', detail: '' });
  const [error, setError] = useState(null);

  const abortRef = useRef(false);
  const fileIdCounter = useRef(0);

  const stepName = STEPS[currentStep]?.id;

  // File reading
  const readFileContent = useCallback(async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      
      const ext = file.name.split('.').pop().toLowerCase();
      if (ext === 'json' || ext === 'txt' || ext === 'md') {
        reader.readAsText(file);
      } else {
        // Fallback for others
        reader.readAsText(file);
      }
    });
  }, []);

  // Auto-classify based on filename and content
  const autoClassify = useCallback((fileName, content) => {
    const name = fileName.toLowerCase();
    const text = (content || '').toLowerCase();

    // Check filename patterns
    if (name.match(/chapter|ch\d|part\s?\d/i)) return 'chapters';
    if (name.match(/character|cast|persona/i)) return 'characters';
    if (name.match(/world|setting|rule|lore|magic/i)) return 'worldRules';
    if (name.match(/beat|outline|plot|structure/i)) return 'beats';
    if (name.match(/note|idea|brainstorm|todo/i)) return 'notes';

    // Check content patterns
    if (text.match(/^#\s*chapter/m)) return 'chapters';
    if (text.match(/"name"\s*:/)) {
      if (text.match(/"age"\s*:/) || text.match(/"personality"\s*:/)) return 'characters';
    }
    if (text.match(/^#\s*(world|setting|rule)/mi)) return 'worldRules';

    return 'notes'; // default
  }, []);

  // Handle file selection
  const handleFiles = useCallback(async (fileList) => {
    setError(null);
    const newFiles = [];

    for (const file of Array.from(fileList)) {
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      const id = `file-${++fileIdCounter.current}`;

      if (!SUPPORTED_EXTENSIONS.includes(ext)) {
        newFiles.push({
          id,
          fileName: file.name,
          fileSize: file.size,
          status: 'error',
          error: `Unsupported file type: ${ext}`,
          content: null,
          category: 'notes',
          file,
        });
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        newFiles.push({
          id,
          fileName: file.name,
          fileSize: file.size,
          status: 'error',
          error: 'File exceeds 10MB limit',
          content: null,
          category: 'notes',
          file,
        });
        continue;
      }

      try {
        const content = await readFileContent(file);
        const category = autoClassify(file.name, content);
        newFiles.push({
          id,
          fileName: file.name,
          fileSize: file.size,
          status: 'ready',
          error: null,
          content,
          category,
          file,
        });
      } catch (err) {
        newFiles.push({
          id,
          fileName: file.name,
          fileSize: file.size,
          status: 'error',
          error: err.message,
          content: null,
          category: 'notes',
          file,
        });
      }
    }

    setImportFiles(prev => [...prev, ...newFiles]);

    // Auto-set classifications
    const newClassifications = {};
    newFiles.forEach(f => {
      if (f.status === 'ready') {
        newClassifications[f.id] = f.category;
      }
    });
    setClassifications(prev => ({ ...prev, ...newClassifications }));
  }, [readFileContent, autoClassify]);

  const removeFile = useCallback((fileId) => {
    setImportFiles(prev => prev.filter(f => f.id !== fileId));
    setClassifications(prev => {
      const next = { ...prev };
      delete next[fileId];
      return next;
    });
  }, []);

  const updateClassification = useCallback((fileId, category) => {
    setClassifications(prev => ({ ...prev, [fileId]: category }));
  }, []);

  // Conflict detection
  const detectConflicts = useCallback(() => {
    const detected = [];
    const existing = existingData || {};

    importFiles.forEach(file => {
      if (file.status === 'error') return;
      const category = classifications[file.id] || file.category;

      if (category === 'chapters' && existing.chapters) {
        const titleMatch = file.fileName.replace(/\.\w+$/, '').trim();
        const existingChapter = existing.chapters.find(ch =>
          ch.title && ch.title.toLowerCase() === titleMatch.toLowerCase()
        );
        if (existingChapter) {
          detected.push({
            id: `conflict-${file.id}`,
            fileId: file.id,
            type: 'chapter',
            existingId: existingChapter.id,
            existingTitle: existingChapter.title,
            existingPreview: (existingChapter.content || '').substring(0, 200),
            incomingPreview: (file.content || '').substring(0, 200),
          });
        }
      }

      if (category === 'characters' && existing.characters) {
        let charNames = [];
        try {
          const parsed = JSON.parse(file.content);
          if (Array.isArray(parsed)) {
            charNames = parsed.map(c => c.name).filter(Boolean);
          } else if (parsed.name) {
            charNames = [parsed.name];
          }
        } catch {
          const nameMatch = file.content.match(/^#\s+(.+)$/m);
          if (nameMatch) charNames = [nameMatch[1].trim()];
        }

        charNames.forEach(name => {
          const existingChar = existing.characters.find(c =>
            c.name && c.name.toLowerCase() === name.toLowerCase()
          );
          if (existingChar) {
            detected.push({
              id: `conflict-${file.id}-${existingChar.id}`,
              fileId: file.id,
              type: 'character',
              existingId: existingChar.id,
              existingTitle: existingChar.name,
              existingPreview: existingChar.description || existingChar.bio || '',
              incomingPreview: (file.content || '').substring(0, 200),
            });
          }
        });
      }

      if (category === 'worldRules' && existing.worldRules) {
        const titleMatch = file.fileName.replace(/\.\w+$/, '').trim();
        const existingRule = existing.worldRules.find(r =>
          r.title && r.title.toLowerCase() === titleMatch.toLowerCase()
        );
        if (existingRule) {
          detected.push({
            id: `conflict-${file.id}`,
            fileId: file.id,
            type: 'worldRule',
            existingId: existingRule.id,
            existingTitle: existingRule.title,
            existingPreview: (existingRule.content || '').substring(0, 200),
            incomingPreview: (file.content || '').substring(0, 200),
          });
        }
      }
    });

    setConflicts(detected);

    const defaultResolutions = {};
    detected.forEach(c => {
      defaultResolutions[c.id] = 'keep_existing';
    });
    setConflictResolutions(defaultResolutions);

    return detected;
  }, [importFiles, classifications, existingData]);

  const resolveConflict = useCallback((conflictId, resolution) => {
    setConflictResolutions(prev => ({ ...prev, [conflictId]: resolution }));
  }, []);

  const resolveAllConflicts = useCallback((resolution) => {
    const all = {};
    conflicts.forEach(c => {
      all[c.id] = resolution;
    });
    setConflictResolutions(all);
  }, [conflicts]);

  // Analysis
  const runAnalysis = useCallback(async () => {
    setIsProcessing(true);
    setProgress({ percent: 0, label: 'Analyzing files...', detail: '' });

    try {
      const warnings = [];
      const suggestions = [];
      const readyFiles = importFiles.filter(f => f.status === 'ready');

      for (let i = 0; i < readyFiles.length; i++) {
        if (abortRef.current) break;

        const file = readyFiles[i];
        const category = classifications[file.id];

        setProgress({
          percent: Math.round(((i + 1) / readyFiles.length) * 100),
          label: 'Analyzing files...',
          detail: file.fileName,
        });

        if (analysisOptions.detectDuplicates) {
          const otherFiles = readyFiles.filter(f => f.id !== file.id && classifications[f.id] === category);
          for (const other of otherFiles) {
            if (file.content && other.content) {
              const similarity = computeSimilarity(file.content, other.content);
              if (similarity > 0.8) {
                warnings.push(
                  `"${file.fileName}" and "${other.fileName}" appear to be duplicates (${Math.round(similarity * 100)}% similar)`
                );
              }
            }
          }
        }

        if (analysisOptions.validateConsistency) {
          if (category === 'chapters' && file.content) {
            if (file.content.trim().length < 100) {
              warnings.push(`"${file.fileName}" is very short for a chapter (${file.content.trim().length} characters)`);
            }
          }
        }

        if (analysisOptions.suggestPlacements) {
          if (category === 'notes') {
            if (file.content && file.content.length > 2000) {
              suggestions.push(
                `"${file.fileName}" is quite long for a note. Consider classifying as a chapter.`
              );
            }
          }
        }

        await new Promise(r => setTimeout(r, 50));
      }

      setAnalysisResults({ warnings, suggestions });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  }, [importFiles, classifications, analysisOptions]);

  function computeSimilarity(textA, textB) {
    const wordsA = new Set(textA.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const wordsB = new Set(textB.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    if (wordsA.size === 0 && wordsB.size === 0) return 1;
    if (wordsA.size === 0 || wordsB.size === 0) return 0;
    let intersection = 0;
    for (const w of wordsA) {
      if (wordsB.has(w)) intersection++;
    }
    const union = new Set([...wordsA, ...wordsB]).size;
    return intersection / union;
  }

  const executeImport = useCallback(async () => {
    setIsProcessing(true);
    abortRef.current = false;
    setProgress({ percent: 0, label: 'Preparing import...', detail: '' });

    try {
      const readyFiles = importFiles.filter(f => f.status === 'ready');
      const resolutions = {};
      Object.entries(conflictResolutions).forEach(([id, res]) => {
        resolutions[id] = res;
      });

      const result = await orchestrator.execute(
        projectId, 
        readyFiles, 
        resolutions, 
        {}, // Options
        (prog) => {
          setProgress({
            percent: prog.current,
            label: prog.message,
            detail: prog.detail || ''
          });
        }
      );

      const finalResult = {
        ...result,
        success: true,
        totalImported: result.summary ? Object.values(result.summary).reduce((a, b) => a + b, 0) : 0,
        totalFiles: readyFiles.length
      };

      setImportResult(finalResult);
      if (onImportComplete) onImportComplete(finalResult);
      setCurrentStep(STEPS.length - 1);
    } catch (err) {
      setError(`Import failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  }, [importFiles, conflictResolutions, projectId, orchestrator, onImportComplete]);

  const canProceed = useCallback(() => {
    switch (stepName) {
      case 'upload': return importFiles.some(f => f.status === 'ready');
      case 'classify': return importFiles.filter(f => f.status === 'ready').every(f => classifications[f.id]);
      case 'conflicts': return conflicts.every(c => conflictResolutions[c.id]);
      case 'analysis': return true;
      case 'review': return true;
      case 'result': return false;
      default: return false;
    }
  }, [stepName, importFiles, classifications, conflicts, conflictResolutions]);

  const goNext = useCallback(async () => {
    if (currentStep === 1) detectConflicts();
    if (currentStep === 3 && !analysisResults) await runAnalysis();
    if (currentStep === 4) {
      await executeImport();
      return;
    }
    setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
  }, [currentStep, detectConflicts, runAnalysis, executeImport, analysisResults]);

  const goBack = useCallback(() => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  }, []);

  const skipStep = useCallback(() => {
    if (stepName === 'conflicts' && conflicts.length === 0) setCurrentStep(prev => prev + 1);
    if (stepName === 'analysis') setCurrentStep(prev => prev + 1);
  }, [stepName, conflicts]);

  const cancelImport = useCallback(() => { abortRef.current = true; }, []);

  const reset = useCallback(() => {
    setCurrentStep(0);
    setImportFiles([]);
    setClassifications({});
    setConflicts([]);
    setConflictResolutions({});
    setAnalysisResults(null);
    setImportResult(null);
    setIsProcessing(false);
    setProgress({ percent: 0, label: '', detail: '' });
    setError(null);
    abortRef.current = false;
  }, []);

  return {
    steps: STEPS,
    currentStep,
    stepName,
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
    handleFiles,
    removeFile,
    updateClassification,
    resolveConflict,
    resolveAllConflicts,
    setAnalysisOptions,
    runAnalysis,
    executeImport,
    canProceed,
    goNext,
    goBack,
    skipStep,
    cancelImport,
    reset,
    setError,
  };
}
