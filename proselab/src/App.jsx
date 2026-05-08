import { useState, useEffect, useMemo, useRef, Fragment } from "react";
import * as db from "./services/db.js";
import {
  clearInferenceCache,
  getCacheStats,
  getCacheDiagnostics,
} from "./services/inferenceCache.js";
import { EngineV1 } from "./engine/v1/api.js";
import { ShadowManager } from "./engine/shadowLayer.js";
import {
  getCostStats,
  clearTokenLog
} from "./services/storage.js";
import {
  logTokenUsage,
} from "./store/appStore.js";
import { compileManuscript, downloadManuscript } from "./services/export.js";
import { PreproductionKit } from "./components/PreproductionKit.jsx";
import ImportWizard from "./components/ImportWizard/ImportWizard.jsx";
import { callOpenAI, callOllama } from "./services/llm.js";

import { analyze } from "./engine/analysis.js";
import { INFERENCE_CACHE_CONTEXT_VERSION } from "./engine/pipeline.js";
import { PERSONAS } from "./engine/editorial.js";
import { runCriticAgent, runGeneratorAgent, applyAgentAction } from "./agents/runAgent.js";
import { compileScene, SCENE_PHASES } from "./services/compiler.js";
import { runCreateModeOrchestrator } from "./services/createModeOrchestrator.js";
import { runEditorialModeOrchestrator } from "./services/editorialModeOrchestrator.js";
import { getModeInfo, getModeLockReason } from "./engine/modeRules.js";
import { checkOllamaReachability, checkOpenAIReachability, checkGeminiReachability } from "./services/llm.js";
import { CharModal, SceneModal } from "./components/Modals.jsx";
import { StatCard, MetricBar, PipelineTracker, PreflightBrief } from "./components/Dashboard.jsx";
import { useDocumentManager } from "./hooks/useDocumentManager.js";
import { DocumentSidebar } from "./components/DocumentSidebar.jsx";
import { ProseEditor } from "./components/ProseEditor.jsx";
import { LoreAgent } from "./engine/lore/index.js";
import LorePanel from "./components/LoreAgent/LorePanel.jsx";
import { createImportCompletionHandler, createImportStorageAdapter } from "./services/appAdapters.js";
import { CREATE_PIPELINE_SUMMARY, getChallengerRuntimeLabel } from "./services/runtimeTruth.js";
import { resetLocalAppData } from "./services/db.js";
import "./components/LoreAgent/LoreAgent.css";



// =============================
// TOKEN & COST TRACKING CONSTANTS
// =============================
const COST_RATES = {
  "openai::gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "ollama": { input: 0, output: 0 },
};

function renderMarkdown(text) {
  if (!text) return "";
  let html = text
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
    .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*)\*/gim, '<em>$1</em>')
    .replace(/---/gim, '<hr />')
    .replace(/\n/gim, '<br />');
  return html;
}

function estimateTokens(text) { return Math.ceil((text || "").length / 4); }

function getTodayStats() {
  return getCostStats(COST_RATES);
}
// PROSELAB V4 - ANALYTICAL ENGINE
// =============================

const ENV_KEYS = {
  openai: import.meta.env.VITE_OPENAI_KEY || "",
  gemini: import.meta.env.VITE_GEMINI_KEY || "",
  model: import.meta.env.VITE_OLLAMA_MODEL || "llama3",
};
// =============================
// MAIN APP
// =============================
export default function ProseLabV4() {
  const [activeTab, setActiveTab] = useState("write");
  const [activeMode, setActiveMode] = useState("CREATE");
  const [text, setText] = useState("");
  const [output, setOutput] = useState("");
  const [stages, setStages] = useState({ draft: "", refined: "", final: "" });
  const [createModeCritique, setCreateModeCritique] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [delta, setDelta] = useState([]);
  const [modeFeedback, setModeFeedback] = useState({ ANALYSE: {}, ENGINEER: {}, MARKET: {}, VERDICT: {} });
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);

  // LORE AGENT INITIALIZATION
  const loreAgent = useMemo(() => new LoreAgent(), []);

  // DOCUMENT MANAGEMENT
  const {
    projects,
    selectedProjectId,
    selectedSceneId,
    tree,
    selectProject,
    refreshProjectState,
    selectScene,
    createProject,
    deleteProject,
    createChapter,
    createScene,
    deleteChapter,
    deleteScene,
    updateSceneMetadata,
    updateProjectMetadata,
    updateProjectData,
    saveCharacter,
    deleteCharacter,
    saveRule,
    deleteRule,
    saveBeat,
    deleteBeat,
    reorderChapter,
    reorderScene,
    scenes,
    core,
    chars,
    rules,
    beats,
    voice,
    shadowActions,
    compositionMetrics,
    logShadowAction,
    removeShadowAction,
    clearShadowActions,
    generateValidationReport,
    saveDocument,
    updateDocument,
    findDocuments,
    createCharacter,
    createWorldRule,
    createBeat,
    getProject,
    getChapters,
    getScenes,
    getCharacters,
    getWorldRules,
    getBeats,
    findCharacterByName,
    updateSceneText,
    saveSceneDraft
  } = useDocumentManager();

  const currentScene = useMemo(() =>
    scenes.find(s => s.id === selectedSceneId),
    [scenes, selectedSceneId]
  );

  const docManager = useMemo(() => createImportStorageAdapter({
    projects, selectedProjectId, selectedSceneId, tree,
    selectProject, refreshProjectState, selectScene, createProject, deleteProject, createChapter, createScene,
    deleteChapter, deleteScene, updateSceneMetadata, updateProjectMetadata, updateProjectData,
    saveCharacter, deleteCharacter, saveRule, deleteRule, saveBeat, deleteBeat,
    reorderChapter, reorderScene, scenes, core, chars, rules, beats, voice,
    saveDocument, updateDocument, findDocuments,
    createCharacter, createWorldRule, createBeat,
    getProject, getChapters, getScenes, getCharacters, getWorldRules, getBeats, findCharacterByName,
    updateSceneText
  }), [
    projects, selectedProjectId, selectedSceneId, tree,
    selectProject, refreshProjectState, selectScene, createProject, deleteProject, createChapter, createScene,
    deleteChapter, deleteScene, updateSceneMetadata, updateProjectMetadata, updateProjectData,
    saveCharacter, deleteCharacter, saveRule, deleteRule, saveBeat, deleteBeat,
    reorderChapter, reorderScene, scenes, core, chars, rules, beats, voice,
    saveDocument, updateDocument, findDocuments,
    createCharacter, createWorldRule, createBeat,
    getProject, getChapters, getScenes, getCharacters, getWorldRules, getBeats, findCharacterByName,
    updateSceneText
  ]);

  const llmService = useMemo(() => ({
    complete: async (prompt, options = {}) => {
      // Default to OpenAI for complex extraction, fallback to Ollama if needed
      const res = await callOpenAI(ENV_KEYS.openai, prompt, {
        temperature: options.temperature || 0.3,
        maxTokens: options.maxTokens || 4000
      });
      if (res.ok) return res.content;

      // Fallback to Ollama if OpenAI fails
      const ollamaRes = await callOllama(ENV_KEYS.model, prompt);
      if (ollamaRes.ok) return ollamaRes.content;

      throw new Error(res.error || ollamaRes.error || "LLM call failed");
    }
  }), [ENV_KEYS.openai, ENV_KEYS.model]);


  const [showMetadata, setShowMetadata] = useState(false);

  // Sync state with selected scene
  useEffect(() => {
    if (currentScene) {
      setText(currentScene.text || "");
      setModeFeedback(currentScene.modeFeedback || { ANALYSE: {}, ENGINEER: {}, MARKET: {}, VERDICT: {} });
    }
  }, [selectedSceneId, currentScene?.id]); // Only on scene change

  // Auto-save debounced
  useEffect(() => {
    if (!selectedSceneId || !text) return;
    const timer = setTimeout(() => {
      saveSceneDraft(selectedSceneId, { text, modeFeedback });
    }, 1000);
    return () => clearTimeout(timer);
  }, [text, modeFeedback, selectedSceneId, saveSceneDraft]);

  const [lastAnalyzedText, setLastAnalyzedText] = useState("");
  const [editingChar, setEditingChar] = useState(null);
  const [editingScene, setEditingScene] = useState(null);
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState(null);
  const [cacheStats, setCacheStats] = useState(getCacheStats());
  const [costStats, setCostStats] = useState(getTodayStats());
  const [envStatus, setEnvStatus] = useState({
    openaiReachable: false,
    openaiReason: "Unknown",
    geminiReachable: false,
    geminiReason: "Unknown",
    ollamaReachable: false,
    ollamaReason: "Unknown"
  });
  const [now, setNow] = useState(new Date());
  const outputRef = useRef(null);

  useEffect(() => {
    const handleWindowError = (event) => {
      console.error('[ProseLab] window error', event.error || event.message || event);
      if (typeof window !== 'undefined') {
        window.__PROSELAB_LAST_WINDOW_ERROR__ = {
          type: 'error',
          message: event.message || event.error?.message || 'Unknown window error',
          stack: event.error?.stack || null,
          at: new Date().toISOString()
        };
      }
    };

    const handleUnhandledRejection = (event) => {
      console.error('[ProseLab] unhandled rejection', event.reason);
      if (typeof window !== 'undefined') {
        window.__PROSELAB_LAST_WINDOW_ERROR__ = {
          type: 'unhandledrejection',
          message: event.reason?.message || String(event.reason),
          stack: event.reason?.stack || null,
          at: new Date().toISOString()
        };
      }
    };

    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.__PROSELAB_UI_STATE__ = {
      selectedProjectId,
      selectedSceneId,
      projectCount: projects.length,
      projectTitles: projects.map(p => ({ id: p.id, title: p.title })),
      chapterCount: tree.length,
      sceneCount: scenes.length,
      charCount: chars.length,
      ruleCount: rules.length,
      beatCount: beats.length,
      currentSceneTitle: currentScene?.title || null,
      coreTitle: core?.title || null
    };
  }, [
    selectedProjectId,
    selectedSceneId,
    projects,
    tree,
    scenes,
    chars,
    rules,
    beats,
    currentScene?.title,
    core?.title
  ]);

  useEffect(() => {
    let cancelled = false;

    async function publishDbState() {
      if (typeof window === "undefined") return;
      try {
        const [allProjects, allChapters, allScenes, selectedProjectChapters, selectedProjectScenes] = await Promise.all([
          db.listProjects(),
          db.perform("chapters", "readonly", store => store.getAll()),
          db.perform("scenes", "readonly", store => store.getAll()),
          selectedProjectId ? db.listChaptersByProject(selectedProjectId) : Promise.resolve([]),
          selectedProjectId ? db.listScenesByProject(selectedProjectId) : Promise.resolve([])
        ]);

        if (cancelled) return;

        window.__PROSELAB_DB_STATE__ = {
          selectedProjectId,
          totalProjects: allProjects.length,
          totalChapters: allChapters.length,
          totalScenes: allScenes.length,
          selectedProjectChapters: selectedProjectChapters.length,
          selectedProjectScenes: selectedProjectScenes.length,
          chapterProjectIds: allChapters.slice(0, 50).map(ch => ({ id: ch.id, projectId: ch.projectId, title: ch.title })),
          sceneProjectIds: allScenes.slice(0, 50).map(sc => ({ id: sc.id, projectId: sc.projectId, chapterId: sc.chapterId, title: sc.title }))
        };
      } catch (error) {
        window.__PROSELAB_DB_STATE__ = {
          selectedProjectId,
          error: error.message
        };
      }
    }

    publishDbState();
    return () => {
      cancelled = true;
    };
  }, [selectedProjectId, tree.length, scenes.length]);

  // Live Analysis - with Debounce or simpler check
  useEffect(() => {
    const handler = setTimeout(() => {
      if (text.trim()) {
        const result = analyze(text);
        setAnalysis(result);
      } else {
        setAnalysis(null);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [text]);

  const getShadowLog = () => {
    try {
      return JSON.parse(localStorage.getItem("proselab_shadow_log") || "[]");
    } catch {
      return [];
    }
  };

  // Clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function refreshProviderStatus() {
      const model = voice?.ollamaModel || "qwen3:8b";
      const [openaiStatus, geminiStatus, ollamaStatus] = await Promise.all([
        checkOpenAIReachability(ENV_KEYS.openai),
        checkGeminiReachability(ENV_KEYS.gemini),
        checkOllamaReachability(model)
      ]);

      if (cancelled) return;

      setEnvStatus({
        openaiReachable: openaiStatus.reachable,
        openaiReason: openaiStatus.reason,
        geminiReachable: geminiStatus.reachable,
        geminiReason: geminiStatus.reason,
        ollamaReachable: ollamaStatus.reachable,
        ollamaReason: ollamaStatus.reason
      });
    }

    refreshProviderStatus();
    return () => {
      cancelled = true;
    };
  }, [voice?.ollamaModel]);

  const envStatusState = {
    openai: ENV_KEYS.openai && ENV_KEYS.openai !== "your_openai_key_here",
    gemini: ENV_KEYS.gemini && ENV_KEYS.gemini !== "your_gemini_key_here",
    ollamaModel: Boolean(voice?.ollamaModel?.trim() || "qwen3:8b"),
    openaiReachable: envStatus?.openaiReachable ?? false,
    openaiReason: envStatus?.openaiReason || "Unknown",
    geminiReachable: envStatus?.geminiReachable ?? false,
    geminiReason: envStatus?.geminiReason || "Unknown",
    ollamaReachable: envStatus?.ollamaReachable ?? false,
    ollamaReason: envStatus?.ollamaReason || "Unknown",
  };
  const totalProjectWordCount = useMemo(() => {
    let total = 0;
    tree.forEach(chapter => {
      chapter.scenes.forEach(scene => {
        total += (scene.text || "").trim() ? (scene.text || "").trim().split(/\s+/).length : 0;
      });
    });
    return total;
  }, [tree]);
  const totalSceneCount = tree.reduce((acc, chapter) => acc + chapter.scenes.length, 0);
  const preflightReadyCount = scenes.filter(scene =>
    String(scene.location || "").trim() &&
    String(scene.time || "").trim() &&
    String(scene.causality || "").trim() &&
    String(scene.output || "").trim() &&
    String(scene.stakes || "").trim()
  ).length;
  const dossierCoverage = chars.filter(char =>
    String(char.name || "").trim() &&
    (String(char.motivation || "").trim() || String(char.archetype || "").trim())
  ).length;
  const worldCoverage = rules.filter(rule =>
    String(rule.rule || "").trim() && String(rule.consequence || "").trim()
  ).length;
  const savedPct = costStats.today.calls > 0 ? Math.round((cacheStats.entries / (cacheStats.entries + costStats.today.calls)) * 100) : 0;
  const providerCards = [
    {
      key: "openai",
      label: "OpenAI",
      status: !envStatusState.openai ? "missing" : (envStatusState.openaiReachable ? "ready" : "warning"),
      detail: !envStatusState.openai
        ? "Missing API key in proselab/.env"
        : (envStatusState.openaiReachable ? "Configured for refinement and extraction" : `Configured but unreachable: ${envStatusState.openaiReason}`)
    },
    {
      key: "ollama",
      label: "Ollama",
      status: envStatusState.ollamaReachable ? "ready" : (envStatusState.ollamaModel ? "warning" : "missing"),
      detail: envStatusState.ollamaReachable
        ? `Reachable: ${voice?.ollamaModel || "qwen3:8b"}`
        : `${voice?.ollamaModel || "qwen3:8b"} unavailable: ${envStatusState.ollamaReason}`
    },
    {
      key: "gemini",
      label: "Gemini Challenger",
      status: !envStatusState.gemini ? "missing" : (envStatusState.geminiReachable ? "partial" : "warning"),
      detail: !envStatusState.gemini
        ? "No Gemini key configured"
        : `${getChallengerRuntimeLabel(envStatusState.gemini)} Health: ${envStatusState.geminiReason}`
    }
  ];
  const runtimeCards = [
    {
      label: "Manuscript Structure",
      tone: totalSceneCount > 0 ? "success" : "warning",
      value: `${tree.length} ch / ${totalSceneCount} scenes`,
      detail: totalProjectWordCount > 0 ? `${totalProjectWordCount.toLocaleString()} words compiled across the active project.` : "No manuscript structure loaded yet."
    },
    {
      label: "Preflight Coverage",
      tone: preflightReadyCount === totalSceneCount && totalSceneCount > 0 ? "success" : "warning",
      value: `${preflightReadyCount}/${Math.max(totalSceneCount, 1)} ready`,
      detail: `${dossierCoverage}/${chars.length || 1} dossiers have motive/archetype. ${worldCoverage}/${rules.length || 1} rules have consequence data.`
    },
    {
      label: "CREATE Runtime",
      tone: envStatusState.openaiReachable && envStatusState.ollamaReachable ? "accent" : "warning",
      value: CREATE_PIPELINE_SUMMARY,
      detail: envStatusState.openaiReachable && envStatusState.ollamaReachable
        ? "Config, runtime reachability, and quality gate are all visible separately below."
        : "One or more required providers are unavailable; critique differs from transport failure."
    },
    {
      label: "Cache and Spend",
      tone: "info",
      value: `${cacheStats.entries} cached`,
      detail: `$${costStats.today.cost.toFixed(4)} today | ~${savedPct}% reuse rate`
    }
  ];

  const modeGatingState = {
    envStatusState,
    text,
    lastAnalyzedText,
    modeFeedback
  };

  const activeModeInfo = getModeInfo(activeMode, modeGatingState);
  const handleImportComplete = useMemo(
    () => createImportCompletionHandler({ selectProject, refreshProjectState, selectScene }),
    [selectProject, refreshProjectState, selectScene]
  );



  const dateStr = now.toLocaleDateString("en-AU", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

  const run = async () => {

    if (!text.trim() || running || !activeModeInfo.isConfigReady || activeModeInfo.isLocked) return;
    setRunning(true); setStage("analysis");

    if (activeMode === "CREATE") {
      await runCreateMode();
    } else {
      if (activeMode === "ANALYSE") setLastAnalyzedText(text);
      await runEditorialModeOrchestrator({
        activeMode,
        text,
        modeFeedback,
        voiceSpec: voice,
        openaiKey: ENV_KEYS.openai,
        logTokenUsage,
        onStage: setStage,
        onFeedback: (mode, feedback) =>
          setModeFeedback(prev => ({ ...prev, [mode]: feedback })),
        onComplete: () => setActiveTab("output"),
        onError: (e) => setOutput("Error: " + e.message),
      });
    }
    setRunning(false);
  };

  const runCreateMode = async () => {
    setOutput("");
    setAnalysis(null);
    setDelta([]);
    setStages({ draft: "", refined: "", final: "" });

    await runCreateModeOrchestrator({
      text,
      preproduction: { core, chars, rules, beats, voice, scenes },
      preflightId: selectedSceneId,
      delta,
      keys: { openai: ENV_KEYS.openai },
      cacheVersion: INFERENCE_CACHE_CONTEXT_VERSION,
      logTokenUsage,
      estimateTokens,
      onStage: setStage,
      onIntent: (intent) =>
        setCreateModeCritique((prev) => ({ ...(prev || {}), intent })),
      onAnalysis: setAnalysis,
      onDelta: setDelta,
      onBlocked: ({ intent, fallbackText }) => {
        setCreateModeCritique({
          verdict: "BLOCKED",
          score: null,
          failures: [],
          attempts: 0,
          traces: [],
          intent,
        });
        setOutput(fallbackText);
        setCacheStats(getCacheStats());
        setCostStats(getTodayStats());
        outputRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        setActiveTab("output");
      },
      onComplete: ({ analysis, delta, draft, final, critique }) => {
        setAnalysis(analysis);
        setDelta(delta);
        setStages({ draft, refined: "", final });
        setCreateModeCritique(critique);
        setOutput(final);
        setCacheStats(getCacheStats());
        setCostStats(getTodayStats());
        outputRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        setActiveTab("output");
      },
      onError: (e) => {
        setOutput("Error: " + e.message);
        setStage(null);
        setActiveTab("output");
      },
    });
  };

  const copyToEditor = (content) => {
    setText(content);
    setActiveTab("write");
    // Pulse effect or notification?
  };

  const isModeLocked = (mode) => {
    return Boolean(getModeLockReason(mode, { text, lastAnalyzedText, modeFeedback }));
  };


  const runTargetedRewrite = async () => {
    if (running || !modeFeedback.ANALYSE?.margaret) return;
    setRunning(true); setStage("margaret-rewrite");

    try {
      // Get the active scene intent for the context of the rewrite
      const activeScene = scenes.find(s => String(s.id) === String(selectedSceneId));
      const sceneIntent = activeScene ? {
        objective: activeScene.output,
        success_state: activeScene.output,
        failure_state: `Failed to fulfill: ${activeScene.output}`,
        irreversible_change: activeScene.causality,
        story_delta: activeScene.stakes
      } : null;

      const res = await EngineV1.evaluate({
        text,
        sceneIntent,
        keys: { openai: ENV_KEYS.openai },
        onStage: setStage,
        flags: {
          USE_STYLE_REFINEMENT: true,
          MAX_ITERATIONS: 2
        }
      });

      if (res.final) {
        setOutput(res.final);
        setStages(prev => ({ ...prev, final: res.final }));
        setActiveTab("output");
      } else {
        throw new Error("Rewrite failed to produce content.");
      }
    } catch (e) {
      setOutput("Error: " + e.message);
    }
    setRunning(false); setStage(null);
  };
  const handleClearCache = () => {
    clearInferenceCache();
    setCacheStats(getCacheStats());
  };

  const handleClearCosts = () => {
    clearTokenLog();
    setCostStats(getTodayStats());
    alert("Token usage logs cleared.");
  };

  const handleCreateProject = async () => {
    const proposedName = window.prompt("Project name", `Project ${projects.length + 1}`);
    if (proposedName === null) return;
    const title = proposedName.trim() || `Project ${projects.length + 1}`;
    await createProject({ title });
  };

  const handleRenameProject = async () => {
    const currentProject = projects.find((project) => project.id === selectedProjectId);
    if (!currentProject || !selectedProjectId) return;
    const proposedName = window.prompt("Rename project", currentProject.title || "Untitled Project");
    if (proposedName === null) return;
    const title = proposedName.trim();
    if (!title || title === currentProject.title) return;
    await updateProjectMetadata({ title });
  };

  const handleResetLocalData = async () => {
    const confirmed = window.confirm(
      "Reset local ProseLab data? This clears IndexedDB, imported manuscripts, cache, costs, and shadow logs. AI settings will be kept."
    );
    if (!confirmed) return;

    const result = await resetLocalAppData({ preserveAiConfig: true });
    if (result.db.status === "blocked") {
      window.alert("Reset blocked. Close other ProseLab tabs or windows and try again.");
      return;
    }
    if (result.db.status === "error") {
      window.alert(`Reset failed: ${result.db.error}`);
      return;
    }

    window.location.reload();
  };

  const handleExport = () => {
    const projectBase = projects.find(p => p.id === selectedProjectId);
    if (!projectBase) return;

    // Enrich with current session state
    const fullProject = {
      ...projectBase,
      core,
      chars,
      rules,
      beats,
      voice
    };

    const content = compileManuscript(fullProject, tree);
    const filename = `${fullProject.title || "manuscript"}_${new Date().toISOString().split('T')[0]}.md`;
    downloadManuscript(content, filename);
  };

  const saveChar = (char) => {
    saveCharacter(char);
    setEditingChar(null);
  };

  const deleteChar = (id) => {
    deleteCharacter(id);
    setEditingChar(null);
  };

  const handleSaveSceneModal = (scene) => {
    updateSceneMetadata(scene.id, scene);
    setEditingScene(null);
  };

  const handleDeleteSceneModal = (id) => {
    deleteScene(id);
    setEditingScene(null);
  };


  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const cacheDiagnostics = getCacheDiagnostics();

  return (
    <div className={`app-container ${isFocusMode ? 'focus-mode' : ''}`}>
      {!isFocusMode && (
        <DocumentSidebar
          projects={projects}
          tree={tree}
          selectedProjectId={selectedProjectId}
          selectedSceneId={selectedSceneId}
          onSelectProject={selectProject}
          onDeleteProject={deleteProject}
          onCreateProject={handleCreateProject}
          onRenameProject={handleRenameProject}
          onSelectScene={selectScene}
          onCreateChapter={createChapter}
          onCreateScene={createScene}
          onDeleteChapter={deleteChapter}
          onDeleteScene={deleteScene}
          onReorderChapter={reorderChapter}
          onReorderScene={reorderScene}
          onOpenImport={() => setShowImportWizard(true)}
        />
      )}

      <div className="main-content">
        {isFocusMode ? (
          <div className="focus-header">
            <div className="focus-scene-title">{currentScene?.title || "Untitled Scene"}</div>
            <button className="btn btn-ghost" onClick={() => setIsFocusMode(false)} style={{ fontSize: '20px', padding: '0 10px' }}>x</button>
          </div>
        ) : (
          <>
            {/* HEADER */}
            <header className="header">
              <div className="header-left">
                <img className="logo-mark" src="/logo.png" alt="ProseLab" />
                <div>
                  <div className="header-title">ProseLab <span style={{ color: "var(--accent-primary)", fontWeight: 800 }}>V4</span></div>
                  <div className="header-subtitle">Precision Analytical Engine</div>
                </div>
              </div>
              <div className="header-right">
                <div className="datetime-display">
                  <div className="datetime-date">{dateStr}</div>
                  <div className="datetime-time">{timeStr}</div>
                </div>
                <div className="status-dot" title="System Online" />
                <button className="btn btn-primary" onClick={handleExport} style={{ marginLeft: "15px", padding: "6px 14px", fontSize: "11px" }}>
                  [Export] Export .MD
                </button>
              </div>
            </header>

            {/* ENV STATUS BAR */}
            <div className="env-status shell-status">
              <div className="provider-status-grid">
                {providerCards.map(card => (
                  <div key={card.key} className={`provider-status-card is-${card.status}`}>
                    <div className="provider-status-head">
                      <span>{card.label}</span>
                      <div className={`env-dot ${card.status === "ready" ? "connected" : card.status === "partial" ? "info" : "missing"}`} />
                    </div>
                    <strong>{card.status === "ready" ? "Ready" : card.status === "partial" ? "Partial" : card.status === "warning" ? "Blocked" : "Missing"}</strong>
                    <p>{card.detail}</p>
                  </div>
                ))}
                {runtimeCards.map(card => (
                  <div key={card.label} className={`provider-status-card is-${card.tone}`}>
                    <div className="provider-status-head">
                      <span>{card.label}</span>
                    </div>
                    <strong>{card.value}</strong>
                    <p>{card.detail}</p>
                  </div>
                ))}
              </div>
              <div className="shell-status-actions">
                <div className="env-item env-note">
                  <div className="env-dot info" />
                  <span>Cache {cacheDiagnostics.enabled ? "On" : "Off"} | {cacheDiagnostics.version} | TTL {Math.round(cacheDiagnostics.ttlMs / 3600000)}h</span>
                </div>
                <button className="btn btn-ghost btn-compact" onClick={handleClearCache}>Clear Cache</button>
                <button className="btn btn-ghost btn-compact" onClick={handleClearCosts}>Reset Costs</button>
                <button className="btn btn-ghost btn-compact" onClick={handleResetLocalData}>Reset Local Data</button>
                <button
                  className={`btn btn-compact shell-focus-toggle ${isFocusMode ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setIsFocusMode(!isFocusMode)}
                >
                  {isFocusMode ? "Exit Focus" : "Focus Mode"}
                </button>
              </div>
            </div>

            {/* DASHBOARD STATS */}
            <div className="dashboard-grid">
              {runtimeCards.map(card => (
                <StatCard
                  key={card.label}
                  label={card.label}
                  value={card.value}
                  detail={card.detail}
                  accent={card.tone}
                />
              ))}
            </div>

            {/* TABS NAVIGATION */}
            <div className="tabs-container">
              <button className={`tab-trigger ${activeTab === "preproduction" ? "active" : ""}`} onClick={() => setActiveTab("preproduction")}>Preproduction</button>
              <button className={`tab-trigger ${activeTab === "write" ? "active" : ""}`} onClick={() => setActiveTab("write")}>Write</button>
              <button className={`tab-trigger ${activeTab === "output" ? "active" : ""}`} onClick={() => setActiveTab("output")}>Output</button>
              <button className={`tab-trigger ${activeTab === "lore" ? "active" : ""}`} onClick={() => setActiveTab("lore")}>Lore</button>
              <button className={`tab-trigger ${activeTab === "logs" ? "active" : ""}`} onClick={() => setActiveTab("logs")}>Logs</button>

              <button
                className="btn btn-primary"
                onClick={() => runCriticAgent({
                  openaiKey: ENV_KEYS.openai,
                  project: { core, chars, rules, beats, voice },
                  scenes,
                  logShadowAction
                }).then(res => setOutput(res.message))}
                style={{ marginLeft: "auto", fontSize: "0.7rem", padding: "4px 12px" }}
              >
                [AI] Critic Suggest
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => runGeneratorAgent({
                  openaiKey: ENV_KEYS.openai,
                  project: { core, chars, rules, beats, voice },
                  scenes,
                  logShadowAction
                }).then(res => setOutput(res.message))}
                style={{ marginLeft: "8px", fontSize: "0.7rem", padding: "4px 12px", border: "1px solid var(--border-subtle)" }}
              >
                [AI] Generator Suggest
              </button>

              <button
                className="btn btn-ghost"
                onClick={async () => {
                  setRunning(true);
                  const genRes = await runGeneratorAgent({
                    openaiKey: ENV_KEYS.openai,
                    project: { core, chars, rules, beats, voice },
                    scenes,
                    logShadowAction
                  });
                  if (genRes.ok) {
                    await runCriticAgent({
                      openaiKey: ENV_KEYS.openai,
                      project: { core, chars, rules, beats, voice },
                      scenes,
                      logShadowAction,
                      contextPatch: genRes.action?.payload?.patch
                    });
                  }
                  setRunning(false);
                }}
                style={{ marginLeft: "8px", fontSize: "0.7rem", padding: "4px 12px", border: "1px solid var(--border-subtle)", color: "var(--accent-purple)" }}
                disabled={running}
              >
                [TEST] Instrumented Composition Test
              </button>

              <button
                className="btn btn-ghost"
                onClick={() => {
                  const report = generateValidationReport();
                  if (report) {
                    alert(`[STATS] CONVERGENCE RATE: ${report.loop_stability.convergence_rate}%\n[STATS] FALSE POSITIVE RATE: ${report.loop_stability.false_positive_rate}%\n[STATS] QUALITY DECAY: ${report.loop_stability.quality_degradation_rate}%\n\nESCAPE-TO-MISS: ${report.loop_stability.escape_to_miss_rate}%\nROBUSTNESS: ${report.phrasing_robustness.robustness_rate}%`);
                    console.log("FINAL VALIDATION REPORT:", report);
                  } else {
                    alert("No metrics collected yet.");
                  }
                }}
                style={{ marginLeft: "8px", fontSize: "0.7rem", padding: "4px 12px", border: "1px solid var(--accent-purple)", color: "var(--accent-purple)" }}
              >
                [STATS] Final Report
              </button>

              <button
                className="btn btn-primary"
                onClick={async () => {
                  setRunning(true);
                  setStage("intent");
                  const genRes = await runGeneratorAgent({
                    openaiKey: ENV_KEYS.openai,
                    project: { core, chars, rules, beats, voice },
                    scenes
                  });
                  if (genRes.ok) {
                    if (!genRes.action) {
                      alert("Generator did not propose any changes.");
                      setStage(null);
                      setRunning(false);
                      return;
                    }
                    setStage("critique");
                    const criticRes = await runCriticAgent({
                      openaiKey: ENV_KEYS.openai,
                      project: { core, chars, rules, beats, voice },
                      scenes,
                      logShadowAction,
                      contextPatch: genRes.action?.payload?.patch
                    });

                    if (criticRes.autoApply) {
                      applyAgentAction(criticRes.action.id, { shadowActions, scenes, removeShadowAction });
                      alert("Scene refined and applied automatically.");
                    } else {
                      const reason = criticRes.gate?.reason || criticRes.message;
                      const costTag = criticRes.gate?.cost_tier ? ` [${criticRes.gate.cost_tier}]` : "";
                      alert(`Blocked${costTag}: ${reason}. \n\nThe trace has been kept in the Pending Agent Proposals below so you can inspect it!`);
                    }
                  } else {
                    alert(`Generator failed: ${genRes.message}`);
                  }
                  setStage(null);
                  setRunning(false);
                }}
                style={{ marginLeft: "8px", fontSize: "0.7rem", padding: "4px 12px" }}
                disabled={running}
              >
                [RUN] RUN ORCHESTRATION LOOP
              </button>
            </div>
          </>
        )}

        {/* MAIN CONTENT BY TAB */}
        <main>
          {activeTab === "preproduction" && (
            <PreproductionKit
              core={core}
              chars={chars}
              rules={rules}
              beats={beats}
              voice={voice}
              scenes={scenes}
              shadowActions={shadowActions}
              applyAgentAction={(id, opts) => applyAgentAction(id, { shadowActions, scenes, removeShadowAction, ...opts })}
              removeShadowAction={removeShadowAction}
              updateProjectMetadata={updateProjectMetadata}
              saveCharacter={saveCharacter}
              deleteCharacter={deleteCharacter}
              saveRule={saveRule}
              deleteRule={deleteRule}
              saveBeat={saveBeat}
              deleteBeat={deleteBeat}
              onEditChar={setEditingChar}
              onEditScene={setEditingScene}
              envStatusState={envStatusState}
            />
          )}

          {activeTab === "lore" && (
            <div className="lore-view-container" style={{ height: "calc(100vh - 250px)", marginTop: "20px" }}>
              <LorePanel agent={loreAgent} />
            </div>
          )}

          {activeTab === "write" && (
            <div className="write-view">
              <div className="tabs-container" style={{ borderBottom: "none", marginBottom: "16px" }}>
                {["CREATE", "ANALYSE", "ENGINEER", "MARKET", "VERDICT"].map(m => (
                  <button
                    key={m}
                    className={`tab-trigger ${activeMode === m ? "active" : ""} ${isModeLocked(m) ? "locked" : ""}`}
                    onClick={() => !isModeLocked(m) && setActiveMode(m)}
                    title={(getModeInfo(m, modeGatingState).lockReason || getModeInfo(m, modeGatingState).configWarnings[0] || "")}
                    style={{ fontSize: "11px", padding: "8px 12px", opacity: isModeLocked(m) ? 0.4 : 1, cursor: isModeLocked(m) ? "not-allowed" : "pointer" }}
                    disabled={isModeLocked(m)}
                  >
                    {m}
                    {isModeLocked(m) && <span style={{ fontSize: "8px", marginLeft: "4px" }}>(Locked)</span>}
                  </button>
                ))}
              </div>

              {(activeModeInfo.configWarnings.length > 0 || activeModeInfo.lockReason) && (
                <div className="mode-guidance">
                  {activeModeInfo.configWarnings.length > 0 && (
                    <div className="mode-alert mode-alert-error">
                      <strong>Missing configuration for {activeMode}.</strong>
                      <div>{activeModeInfo.configWarnings.join(" ")}</div>
                    </div>
                  )}
                  {activeModeInfo.lockReason && (
                    <div className="mode-alert mode-alert-warning">
                      <strong>{activeMode} is locked.</strong>
                      <div>{activeModeInfo.lockReason}</div>
                    </div>
                  )}
                </div>
              )}

              {stage && <PipelineTracker currentStage={stage} activeMode={activeMode} />}

              <div className="content-grid" style={{ gridTemplateColumns: "1fr" }}>
                <div className="panel">
                  <div className="panel-header">
                    <span className="panel-title">{activeMode === "CREATE" ? "Active Scene / Paragraph" : `Editorial Review - ${activeMode}`}</span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <div className="toggle-group">
                        <button className={`toggle-btn ${!showPreview ? 'active' : ''}`} onClick={() => setShowPreview(false)}>Edit</button>
                        <button className={`toggle-btn ${showPreview ? 'active' : ''}`} onClick={() => setShowPreview(true)}>Preview</button>
                      </div>
                      <button
                        className={`btn btn-ghost ${showMetadata ? 'active' : ''}`}
                        onClick={() => setShowMetadata(!showMetadata)}
                        style={{ padding: "4px 10px", fontSize: 11 }}
                      >
                        {showMetadata ? "Hide Meta" : "Metadata"}
                      </button>
                      <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{wordCount} words</span>
                    </div>
                  </div>
                  {!showPreview ? (
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                      <ProseEditor
                        value={text}
                        onChange={setText}
                        placeholder="Start writing your scene..."
                      />
                      {showMetadata && currentScene && (
                        <div className="metadata-panel">
                          <div className="field-group">
                            <label className="field-label">Scene Title</label>
                            <input
                              className="field-input"
                              value={currentScene.title || ""}
                              onChange={e => updateSceneMetadata(currentScene.id, { title: e.target.value })}
                            />
                          </div>
                          <div className="field-group">
                            <label className="field-label">Tags (comma separated)</label>
                            <input
                              className="field-input"
                              value={currentScene.tags || ""}
                              placeholder="e.g. action, internal, draft"
                              onChange={e => updateSceneMetadata(currentScene.id, { tags: e.target.value })}
                            />
                          </div>
                          <div className="field-group">
                            <label className="field-label">Scene Notes</label>
                            <textarea
                              className="field-input"
                              style={{ minHeight: "200px", resize: "vertical" }}
                              value={currentScene.notes || ""}
                              placeholder="Plot points, emotional beats..."
                              onChange={e => updateSceneMetadata(currentScene.id, { notes: e.target.value })}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="prose-preview" dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />
                  )}
                  <div className="actions-bar">
                    <button id="run-btn" className="btn btn-primary" onClick={run} disabled={running || !text.trim() || !activeModeInfo.isConfigReady || activeModeInfo.isLocked}>
                      {running && <span className="spinner" />}
                      {running ? "Running Mode..." : `Start ${activeMode} Mode`}
                    </button>
                    <div style={{ marginLeft: "auto", fontSize: "11px", color: "var(--text-muted)", maxWidth: "300px", textAlign: "right" }}>
                      {activeMode === "CREATE" && CREATE_PIPELINE_SUMMARY}
                      {activeMode === "ANALYSE" && "Margaret (Prose) + Rafael (Character)"}
                      {activeMode === "ENGINEER" && "James (Structure) + Yuki (World)"}
                      {activeMode === "MARKET" && "Saoirse (Market Check)"}
                      {activeMode === "VERDICT" && "Victor (Final Decision)"}
                    </div>
                  </div>
                </div>
              </div>

              {analysis && (
                <div className="analysis-grid">
                  <div className="analysis-card">
                    <div className="analysis-card-title">Rhythm</div>
                    <MetricBar label="Short Sentence Ratio" value={analysis.rhythm.shortRatio} />
                    <MetricBar label="Avg Length" value={analysis.rhythm.avg} max={30} />
                    <div className="analysis-metric">
                      <span className="analysis-metric-label">Variance</span>
                      <span className="analysis-metric-value" style={{ color: analysis.rhythm.variance === "high" ? "var(--success)" : "var(--warning)" }}>
                        {analysis.rhythm.variance.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className="analysis-card">
                    <div className="analysis-card-title">Physical Grounding</div>
                    <MetricBar label="Physical Grounding" value={createModeCritique?.score?.physical_grounding || 0} max={10} />
                    <div className="analysis-metric">
                      <span className="analysis-metric-label">Target</span>
                      <span className="analysis-metric-value">7.00</span>
                    </div>
                  </div>
                  <div className="analysis-card">
                    <div className="analysis-card-title">Specificity</div>
                    <MetricBar label="Specificity" value={createModeCritique?.score?.specificity || 0} max={10} />
                    <div className="analysis-metric">
                      <span className="analysis-metric-label">Target</span>
                      <span className="analysis-metric-value">7.00</span>
                    </div>
                  </div>
                </div>
              )}

              {delta.length > 0 && (
                <div className="constraints-panel">
                  <div className="panel-header">
                    <span className="panel-title">Active Rewrite Constraints</span>
                    <span className="panel-badge live">{delta.length} active</span>
                  </div>
                  {delta.map((d, i) => (
                    <div key={i} className="constraint-item">
                      <div className="constraint-dot" />
                      <span>{d}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "output" && (
            <div className="output-view" ref={outputRef}>
              {activeMode === "CREATE" ? (
                <>
                  <div className="panel" style={{ marginBottom: "24px" }}>
                    <div className="panel-header">
                      <span className="panel-title">
                        Final Output - Pass {createModeCritique?.attempts ?? "?"}{" "}
                        <span style={{ color: createModeCritique?.verdict === "APPROVE" ? "var(--success)" : "var(--error)" }}>
                          {createModeCritique?.verdict ?? ""}
                        </span>
                      </span>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        {createModeCritique && (
                          <div className={`status-badge tag-${createModeCritique.verdict === "APPROVE" ? "locked" : "pending"}`} style={{ fontSize: 10 }}>
                            CRITIC: {createModeCritique.verdict} ({createModeCritique.score?.overall}/10)
                          </div>
                        )}
                        <button className="btn btn-ghost" onClick={() => copyToEditor(stages.final)} style={{ padding: "4px 10px", fontSize: 11 }}>Copy to Editor & Revise</button>
                        <button className="btn btn-ghost" onClick={() => navigator.clipboard.writeText(stages.final)} style={{ padding: "4px 10px", fontSize: 11 }}>Copy Text</button>
                      </div>
                    </div>
                    {output && output.startsWith("Error:") ? (
                      <div className="output-content" style={{ color: "var(--error)", padding: "16px", borderLeft: "4px solid var(--error)", background: "rgba(255, 0, 0, 0.05)" }}>
                        <strong>Pipeline Blocked:</strong><br />
                        {output}
                      </div>
                    ) : stages.final ? (
                      <div className="output-content" style={{ fontSize: "17px", fontStyle: "italic", borderLeft: "4px solid var(--accent-primary)" }}>{stages.final}</div>
                    ) : (
                      <div className="output-placeholder">No output yet. Run the pipeline in the Write tab.</div>
                    )}
                  </div>

                  <div className="content-grid" style={{ gridTemplateColumns: "1fr" }}>
                    {createModeCritique?.intent?.intent_verdict === "FAIL" && (
                      <div className="panel" style={{ borderLeft: "4px solid var(--error)" }}>
                        <div className="panel-header">
                          <span className="panel-title">Intent Gate - FAIL</span>
                          <div style={{ fontSize: "10px", opacity: 0.7 }}>
                            Alignment: {createModeCritique.intent.intent_alignment}
                          </div>
                        </div>
                        {createModeCritique.intent.intent_failures?.length > 0 && (
                          <div style={{ background: "rgba(255,255,255,0.03)", padding: "10px", borderRadius: "4px", marginBottom: "12px" }}>
                            <div style={{ fontSize: "10px", fontWeight: "bold", color: "var(--error)", marginBottom: "4px" }}>
                              INTENT FAILURES:
                            </div>
                            {createModeCritique.intent.intent_failures.map((failure, idx) => (
                              <div key={idx} style={{ fontSize: "11px", color: "var(--text-secondary)", marginLeft: "8px", marginBottom: "3px" }}>
                                - {failure}
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                          Minimal fix: {createModeCritique.intent.minimal_fix?.instruction}
                        </div>
                      </div>
                    )}
                    {createModeCritique?.traces?.map((t, idx) => (
                      <div key={idx} className="panel" style={{ borderLeft: `4px solid ${t.critique.verdict === "APPROVE" ? "var(--success)" : "var(--error)"}` }}>
                        <div className="panel-header">
                          <span className="panel-title">Pass {idx + 1} - {t.critique.verdict} ({t.critique.score?.overall}/10)</span>
                          <div style={{ fontSize: "10px", opacity: 0.7 }}>
                            Intent: {t.critique.intent_verdict} ({t.critique.intent_alignment}) | R: {t.critique.score?.rhythm} | S: {t.critique.score?.specificity} | G: {t.critique.score?.physical_grounding}
                          </div>
                        </div>
                        <div className="output-content" style={{ fontSize: "14px", marginBottom: "12px", opacity: 0.9 }}>
                          {t.draft}
                        </div>
                        {t.critique.verdict === "REWRITE" && (
                          <div style={{ background: "rgba(255,255,255,0.03)", padding: "10px", borderRadius: "4px" }}>
                            {t.critique.intent_failures?.length > 0 && (
                              <div style={{ marginBottom: "10px" }}>
                                <div style={{ fontSize: "10px", fontWeight: "bold", color: "var(--error)", marginBottom: "4px" }}>
                                  INTENT FAILURES:
                                </div>
                                {t.critique.intent_failures.map((failure, fi) => (
                                  <div key={fi} style={{ fontSize: "11px", color: "var(--text-secondary)", marginLeft: "8px", marginBottom: "3px" }}>
                                    - {failure}
                                  </div>
                                ))}
                                {t.critique.minimal_fix?.instruction && (
                                  <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginLeft: "8px", marginTop: "6px" }}>
                                    Minimal fix: {t.critique.minimal_fix.instruction}
                                  </div>
                                )}
                              </div>
                            )}
                            {t.critique.failures?.length > 0 && (
                              <div style={{ marginBottom: "10px" }}>
                                <div style={{ fontSize: "10px", fontWeight: "bold", color: "var(--error)", marginBottom: "4px" }}>
                                  FAILURE REASONS:
                                </div>
                                {t.critique.failures.map((f, fi) => (
                                  <div key={fi} style={{ fontSize: "11px", color: "var(--text-secondary)", marginLeft: "8px", marginBottom: "3px" }}>
                                    <span style={{ color: "var(--warning)", fontWeight: 600 }}>{f.type}</span>
                                    {f.reason ? ` - ${f.reason}` : ""}
                                  </div>
                                ))}
                              </div>
                            )}
                            {t.critique.rewrite?.instructions?.length > 0 && (
                              <div>
                                <div style={{ fontSize: "10px", fontWeight: "bold", color: "var(--accent-primary)", marginBottom: "4px" }}>
                                  REWRITE INSTRUCTIONS:
                                </div>
                                {t.critique.rewrite.instructions.map((inst, i) => (
                                  <div key={i} style={{ fontSize: "11px", color: "var(--text-secondary)", marginLeft: "8px" }}>&bull; {inst}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                    {!createModeCritique && (
                      <div className="output-placeholder">No loop traces yet. Run the pipeline in the Write tab.</div>
                    )}
                  </div>
                </>
              ) : (
                <div className="editorial-board">
                  <div className="panel-header" style={{ marginBottom: "20px" }}>
                    <span className="panel-title">Editorial Board Review: {activeMode}</span>
                    {activeMode === "ANALYSE" && modeFeedback.ANALYSE?.margaret && (
                      <button className="btn btn-amber btn-sm" onClick={runTargetedRewrite} disabled={running}>
                        {running ? "Running Targeted Rewrite..." : "Apply Targeted Rewrite (Margaret Only)"}
                      </button>
                    )}
                  </div>
                  <div className="content-grid">
                    {Object.entries(modeFeedback[activeMode] || {}).map(([pKey, feedback]) => (
                      <div key={pKey} className="panel">
                        <div className="panel-header">
                          <span className="panel-title" style={{ color: "var(--accent-primary)" }}>{PERSONAS[pKey].name}</span>
                        </div>
                        <div className="output-content" style={{ fontSize: "14px", whiteSpace: "pre-wrap" }}>{feedback}</div>
                      </div>
                    ))}
                    {Object.keys(modeFeedback[activeMode] || {}).length === 0 && (
                      <div className="output-placeholder" style={{ gridColumn: "1 / -1" }}>No editorial feedback for this mode yet.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "logs" && (
            <div className="logs-view">
              <div className="panel" style={{ marginBottom: "20px" }}>
                <div className="panel-header">
                  <span className="panel-title">Shadow Calibration Dashboard</span>
                  <div style={{ display: "flex", gap: "10px" }}>
                    {ShadowManager.getTailMetrics() && (
                      <div style={{ fontSize: "10px", color: "var(--text-muted)", display: "flex", gap: "12px" }}>
                        <span>P95: <strong>{ShadowManager.getTailMetrics().p95}ms</strong></span>
                        <span>TOTAL: <strong>{ShadowManager.getTailMetrics().total}</strong></span>
                      </div>
                    )}
                    <button className="btn btn-ghost" onClick={() => { ShadowManager.clear(); clearShadowActions(); }} style={{ padding: "4px 10px", fontSize: 11 }}>Reset Calibration</button>
                  </div>
                </div>
                <div className="logs-container">
                  {getShadowLog().reverse().map((entry, i) => (
                    <div key={i} className={`log-entry divergence-${entry.divergence.type.toLowerCase()}`}>
                      <span className="log-time">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                      <span className="log-label">{entry.divergence.type}</span>
                      <div className="log-value" style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ color: entry.divergence.is_critical ? "var(--error)" : "var(--info)" }}>
                          {entry.divergence.desc || "Aligned"} | Shadow: {entry.shadow.verdict} (Conf: {entry.shadow.confidence.toFixed(2)}) | Legacy: {entry.legacy.verdict}
                        </span>
                        {entry.divergence.drift && (
                          <span style={{ fontSize: "9px", opacity: 0.7 }}>
                            STYLE DRIFT: Len Shift {entry.divergence.drift.length_shift.toFixed(1)} words | Complexity {entry.divergence.drift.complexity_delta > 0 ? "+" : ""}{entry.divergence.drift.complexity_delta} sents
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {getShadowLog().length === 0 && (
                    <div className="output-placeholder">No shadow traces recorded yet. Run CREATE mode to collect data.</div>
                  )}
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <span className="panel-title">Pipeline Trace</span>
                  <button className="btn btn-ghost" onClick={() => console.clear()} style={{ padding: "4px 10px", fontSize: 11 }}>Clear Console</button>
                </div>
                <div className="logs-container">
                  <div className="log-entry">
                    <span className="log-time">{new Date().toLocaleTimeString()}</span>
                    <span className="log-label">SYSTEM</span>
                    <span className="log-value">ProseLab V4 initialized. Ready for preproduction.</span>
                  </div>
                  {stages.final && (
                    <>
                      <div className="log-entry">
                        <span className="log-label">TRACE</span>
                        <span className="log-value">Draft Length: {stages.draft?.length} chars</span>
                      </div>
                      <div className="log-entry">
                        <span className="log-label">TRACE</span>
                        <span className="log-value">Refined Length: {stages.refined?.length} chars</span>
                      </div>
                      <div className="log-entry">
                        <span className="log-label">TRACE</span>
                        <span className="log-value">Final Length: {stages.final?.length} chars</span>
                      </div>
                    </>
                  )}
                  <div className="log-entry" style={{ color: "var(--text-muted)" }}>
                    Check browser console (F12) for full object inspection.
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* MODALS */}
        {editingChar && <CharModal char={editingChar} onSave={saveChar} onClose={() => setEditingChar(null)} onDelete={deleteChar} />}
        {editingScene && <SceneModal scene={editingScene} onSave={handleSaveSceneModal} onClose={() => setEditingScene(null)} onDelete={handleDeleteSceneModal} />}

        {showImportWizard && (
          <ImportWizard
            projectId={selectedProjectId}
            existingData={projects.find(p => p.id === selectedProjectId)}
            storage={docManager}
            llm={{ generate: llmService.complete }}
            onImportComplete={handleImportComplete}
            onClose={() => setShowImportWizard(false)}
          />
        )}
      </div>
    </div>
  );
}
