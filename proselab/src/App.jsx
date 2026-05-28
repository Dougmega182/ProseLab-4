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
import TopNav from "./components/layout/TopNav";
import StatusBar from "./components/layout/StatusBar";
import WorkspaceLayout from "./components/layout/WorkspaceLayout";
import RightSidebar from "./components/layout/RightSidebar";
import ManuscriptWorkspace from "./components/layout/ManuscriptWorkspace";
import AgentCard from "./components/editorial/AgentCard";
import AnnotationRail from "./components/writing/AnnotationRail";
import { callOpenAI, callOllama } from "./services/llm.js";

import { analyze } from "./engine/analysis.js";
import { INFERENCE_CACHE_CONTEXT_VERSION } from "./engine/pipeline.js";
import { PERSONAS } from "./engine/editorial.js";
import { runCriticAgent, runGeneratorAgent, applyAgentAction } from "./agents/runAgent.js";
import { runTargetedRewriteOrchestration, runSparkOrchestration } from "./services/orchestration/rewriteOrchestrator.js";
import { recommendExpansionInsertion, runExpansionInsertionDraft } from "./services/expansionOrchestrator.js";
import { compileScene, SCENE_PHASES } from "./services/compiler.js";
import { runCreateOrchestration } from "./services/orchestration/createOrchestrator.js";
import { runEditorialOrchestration } from "./services/orchestration/editorialOrchestrator.js";
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

// REPORTS ENGINE
import { generateReport } from "./engine/reports/index.js";
import { ReportDashboard } from "./components/ReportDashboard.jsx";
import { FullPageReader } from "./components/FullPageReader.jsx";

import "./components/LoreAgent/LoreAgent.css";



// =============================
// TOKEN & COST TRACKING CONSTANTS
// =============================
const COST_RATES = {
  "galaxy": { input: 0, output: 0, perCall: 0.0001 },
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

function extractFirstJsonObject(raw) {
  const source = String(raw || "").replace(/```json|```/gi, "").trim();
  const first = source.indexOf("{");
  const last = source.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    throw new Error("Model did not return a JSON object.");
  }
  return JSON.parse(source.slice(first, last + 1));
}

function summarizeParagraphsForPlacement(sourceText, maxParagraphs = 120) {
  const paragraphs = String(sourceText || "")
    .split(/\n\s*\n/g)
    .map((p) => p.trim())
    .filter(Boolean);
  const capped = paragraphs.slice(0, maxParagraphs);
  const map = capped
    .map((p, idx) => `${idx + 1}: ${p.replace(/\s+/g, " ").slice(0, 260)}`)
    .join("\n");
  return {
    paragraphCount: paragraphs.length,
    providedCount: capped.length,
    map,
  };
}

function getTodayStats() {
  return getCostStats(COST_RATES);
}
// PROSELAB V4 - ANALYTICAL ENGINE
// =============================

const ENV_KEYS = {
  openai: import.meta.env.VITE_OPENAI_KEY || "",
  gemini: import.meta.env.VITE_GEMINI_KEY || "",
  geminiModel: import.meta.env.VITE_GEMINI_MODEL || "gemini-2.5-flash",
  model: import.meta.env.VITE_OLLAMA_MODEL || "llama3",
};

const SPARKS = {
  EDIT: [
    { id: "readability", label: "Readability", icon: "📖", prompt: "Improve readability and clarity without losing intent." },
    { id: "sensory", label: "Sensory Boost", icon: "✨", prompt: "Ground the scene in physical sensory detail (texture, smell, temperature)." },
    { id: "tense", label: "Tense Shift", icon: "⏳", prompt: "Shift the tense of this passage (e.g., past to present or vice-versa)." },
  ],
  INSPIRE: [
    { id: "dialogue", label: "Dialogue Prompt", icon: "💬", prompt: "Suggest a sharp, character-driven dialogue exchange to move the scene forward." },
    { id: "emotion", label: "Emotional Beat", icon: "❤️", prompt: "Deepen the emotional stakes of this moment." },
    { id: "next", label: "What Next?", icon: "🚀", prompt: "Suggest three high-tension directions this scene could take." },
  ]
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
  const [report, setReport] = useState(null);
  const [fullPageReadScene, setFullPageReadScene] = useState(null);
  const [prevSelectedSceneId, setPrevSelectedSceneId] = useState(null);

  // Theme State Management (Persisted in localStorage)
  const [theme, setTheme] = useState(() => localStorage.getItem("proselab-theme") || "dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("proselab-theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === "dark" ? "light" : "dark");

  // LORE AGENT INITIALIZATION
  const loreAgent = useMemo(() => new LoreAgent(), []);

  // DOCUMENT MANAGEMENT
  const {
    projects,
    selectedProjectId,
    selectedSceneId,
    tree,
    draftTree,
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
    chapters,
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
    saveSceneDraft,
    moveBeat,
    reorderBeats,
    moveScene,
    reorderScenes
  } = useDocumentManager();

  // Close full page reading overlay if active scene selection changes (render-phase sync)
  if (selectedSceneId !== prevSelectedSceneId) {
    setPrevSelectedSceneId(selectedSceneId);
    setFullPageReadScene(null);
  }

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
    updateSceneText, moveBeat, reorderBeats, moveScene, reorderScenes
  }), [
    projects, selectedProjectId, selectedSceneId, tree,
    selectProject, refreshProjectState, selectScene, createProject, deleteProject, createChapter, createScene,
    deleteChapter, deleteScene, updateSceneMetadata, updateProjectMetadata, updateProjectData,
    saveCharacter, deleteCharacter, saveRule, deleteRule, saveBeat, deleteBeat,
    reorderChapter, reorderScene, scenes, core, chars, rules, beats, voice,
    saveDocument, updateDocument, findDocuments,
    createCharacter, createWorldRule, createBeat,
    getProject, getChapters, getScenes, getCharacters, getWorldRules, getBeats, findCharacterByName,
    updateSceneText, moveBeat, reorderBeats, moveScene, reorderScenes
  ]);

  const llmService = useMemo(() => ({
    complete: async (prompt, options = {}) => {
      // Routes through Galaxy AI (Opus 4.6), fallback to Ollama if needed
      const res = await callOpenAI(ENV_KEYS.openai, prompt, {
        temperature: options.temperature || 0.3,
        maxTokens: options.maxTokens || 4000
      });
      if (res.ok) return res.content;

      // Fallback to Ollama if Galaxy fails
      const ollamaRes = await callOllama(ENV_KEYS.model, prompt);
      if (ollamaRes.ok) return ollamaRes.content;

      throw new Error(res.error || ollamaRes.error || "LLM call failed");
    }
  }), [ENV_KEYS.openai, ENV_KEYS.model]);


  const [showMetadata, setShowMetadata] = useState(false);
  const [saveStatus, setSaveStatus] = useState("idle");

  // Sync state with selected scene
  useEffect(() => {
    if (currentScene) {
      setText(currentScene.text || "");
      setModeFeedback(currentScene.modeFeedback || { ANALYSE: {}, ENGINEER: {}, MARKET: {}, VERDICT: {} });
    } else {
      setText("");
      setModeFeedback({ ANALYSE: {}, ENGINEER: {}, MARKET: {}, VERDICT: {} });
    }
  }, [selectedSceneId, currentScene?.id]); // Only on scene change

  // Auto-save debounced
  useEffect(() => {
    if (!selectedSceneId || !text) return;
    setSaveStatus("saving");
    const timer = setTimeout(async () => {
      await saveSceneDraft(selectedSceneId, { text, modeFeedback });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    }, 1000);
    return () => clearTimeout(timer);
  }, [text, modeFeedback, selectedSceneId, saveSceneDraft]);

  const [lastAnalyzedText, setLastAnalyzedText] = useState("");
  const [editingChar, setEditingChar] = useState(null);
  const [editingScene, setEditingScene] = useState(null);
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState(null);
  const [expansionPlanText, setExpansionPlanText] = useState("");
  const [expansionPlacement, setExpansionPlacement] = useState(null);
  const [expansionPlacementReasoning, setExpansionPlacementReasoning] = useState("");
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

        // Generate deep report
        const reportResult = generateReport(text);
        setReport(reportResult);
      } else {
        setAnalysis(null);
        setReport(null);
      }
    }, 500); // Slightly longer debounce for full report
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
      const model = voice?.ollamaModel || "rocinante";
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
    ollamaModel: Boolean(voice?.ollamaModel?.trim() || "rocinante"),
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
      label: "Galaxy AI",
      status: !envStatusState.openai ? "missing" : (envStatusState.openaiReachable ? "ready" : "warning"),
      detail: !envStatusState.openai
        ? "Missing Galaxy API key in proselab/.env"
        : (envStatusState.openaiReachable ? "Galaxy AI (Opus 4.6) connected" : `Configured but unreachable: ${envStatusState.openaiReason}`)
    },
    {
      key: "ollama",
      label: "Ollama",
      status: envStatusState.ollamaReachable ? "ready" : (envStatusState.ollamaModel ? "warning" : "missing"),
      detail: envStatusState.ollamaReachable
        ? `Reachable: ${voice?.ollamaModel || "rocinante"}`
        : `${voice?.ollamaModel || "rocinante"} unavailable: ${envStatusState.ollamaReason}`
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
      const result = await runEditorialOrchestration({
        activeMode,
        text,
        modeFeedback,
        voiceSpec: voice,
        openaiKey: ENV_KEYS.openai,
        geminiKey: ENV_KEYS.gemini,
        sceneIntent: scenes.find(s => String(s.id) === String(selectedSceneId)) ? {
          objective: scenes.find(s => String(s.id) === String(selectedSceneId)).output,
          success_state: scenes.find(s => String(s.id) === String(selectedSceneId)).output,
          failure_state: `Failed to fulfill: ${scenes.find(s => String(s.id) === String(selectedSceneId)).output}`,
          irreversible_change: scenes.find(s => String(s.id) === String(selectedSceneId)).causality,
          story_delta: scenes.find(s => String(s.id) === String(selectedSceneId)).stakes
        } : null,
        onStage: setStage,
      });

      if (result.success || result.diagnostics?.verdict) {
        if (result.diagnostics?.feedback) {
          setModeFeedback(prev => ({ ...prev, [activeMode]: result.diagnostics.feedback }));
        }
        setActiveTab("output");
      } else {
        setOutput("Error: " + (result.warnings?.join(", ") || "Editorial run failed."));
      }
    }
    setRunning(false);
  };

  const runCreateMode = async () => {
    setOutput("");
    setAnalysis(null);
    setDelta([]);
    setStages({ draft: "", refined: "", final: "" });

    try {
      const result = await runCreateOrchestration({
        text,
        preproduction: { core, chars, rules, beats, voice, scenes },
        preflightId: selectedSceneId,
        delta,
        keys: { openai: ENV_KEYS.openai, gemini: ENV_KEYS.gemini },
        cacheVersion: INFERENCE_CACHE_CONTEXT_VERSION,
        logTokenUsage,
        estimateTokens,
        onStage: setStage,
        onIntent: (intent) =>
          setCreateModeCritique((prev) => ({ ...(prev || {}), intent })),
        onAnalysis: setAnalysis,
        onDelta: setDelta,
      });

      if (result.diagnostics?.verdict === "BLOCKED") {
        setCreateModeCritique({
          verdict: "BLOCKED",
          score: null,
          failures: [],
          attempts: 0,
          traces: [],
          intent: result.diagnostics.intent,
        });
        setOutput(result.output);
        setCacheStats(getCacheStats());
        setCostStats(getTodayStats());
        outputRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        setActiveTab("output");
        return;
      }

      if (result.diagnostics?.stage === "failed" && result.diagnostics?.verdict === "ERROR") {
        setOutput("Error: " + result.warnings.join(", "));
        setStage(null);
        setActiveTab("output");
        return;
      }

      // Normal complete or quality failed retry-exhausted
      const draft = result.diagnostics?.traces?.[0]?.draft || "";
      setStages({ draft, refined: "", final: result.output });

      const critique = {
        verdict: result.diagnostics?.verdict,
        score: result.diagnostics?.validation?.overallScore ?? result.diagnostics?.challenger?.score,
        failures: result.diagnostics?.failures || [],
        intent: result.diagnostics?.intent,
        intent_verdict: result.diagnostics?.intent_verdict,
        intent_alignment: result.diagnostics?.intent_alignment,
        intent_failures: result.diagnostics?.intent_failures,
        attempts: result.diagnostics?.attempts || 1,
        traces: result.diagnostics?.traces || [],
        challenger: result.diagnostics?.challenger,
      };

      setCreateModeCritique(critique);
      setOutput(result.output);
      setCacheStats(getCacheStats());
      setCostStats(getTodayStats());
      outputRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      setActiveTab("output");
    } catch (e) {
      setOutput("Error: " + e.message);
      setStage(null);
      setActiveTab("output");
    }
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
    if (running || !text) return;
    setRunning(true);
    try {
      const result = await runTargetedRewriteOrchestration({
        text,
        scenes,
        selectedSceneId,
        modeFeedback,
        openaiKey: ENV_KEYS.openai,
        geminiKey: ENV_KEYS.gemini,
        draftTree,
        createChapter,
        createScene,
        onStage: setStage,
      });

      if (result.success || result.diagnostics?.verdict) {
        setOutput(result.output);
        setStages(prev => ({ ...prev, final: result.output }));
        
        // Construct the critique object for state
        const critique = {
          verdict: result.diagnostics?.verdict,
          score: result.diagnostics?.challenger?.score || null,
          failures: result.diagnostics?.failures || [],
          attempts: result.diagnostics?.attempts || 1,
          traces: result.diagnostics?.traces || [],
          challenger: result.diagnostics?.challenger,
        };
        setCreateModeCritique(critique);
        setActiveTab("output");
      } else {
        setOutput("Error: " + result.warnings.join(", "));
      }
    } catch (e) {
      setOutput("Error: " + e.message);
    } finally {
      setRunning(false);
      setStage(null);
    }
  };

  const handleRecommendExpansionInsertion = async () => {
    if (running) return;
    setRunning(true);
    setStage("expansion-insertion-recommend");
    try {
      const activeScene = scenes.find(s => String(s.id) === String(selectedSceneId));
      const sourceText = activeScene?.text || text || "";
      const placement = await recommendExpansionInsertion({
        activeScene,
        sourceText,
        expansionBrief: expansionPlanText,
        openaiKey: ENV_KEYS.openai,
        onStage: setStage,
      });

      setExpansionPlacement({ startParagraph: placement.startParagraph, endParagraph: placement.endParagraph });
      setExpansionPlacementReasoning(placement.reasoning);

      setOutput(`Recommended insertion:\nStart: before paragraph ${placement.boundary.start.paragraph} (line ${placement.boundary.start.line})\nEnd: before paragraph ${placement.boundary.end.paragraph} (line ${placement.boundary.end.line})\n\nReason: ${placement.reasoning}`);
    } catch (e) {
      setOutput("Error: " + e.message);
    } finally {
      setRunning(false);
      setStage(null);
    }
  };

  const runSpark = async (spark) => {
    if (running || !text.trim()) return;
    setRunning(true);
    try {
      const result = await runSparkOrchestration({
        text,
        scenes,
        selectedSceneId,
        spark,
        openaiKey: ENV_KEYS.openai,
        onStage: setStage,
      });

      if (result.success) {
        setOutput(result.output);
        setStages(prev => ({ ...prev, final: result.output }));
        setActiveTab("output");
      } else {
        setOutput("Error: " + result.warnings.join(", "));
      }
    } catch (e) {
      setOutput("Error: " + e.message);
    } finally {
      setRunning(false);
      setStage(null);
    }
  };

  const handleRunExpansionInsertionDraft = async () => {
    if (running) return;
    const activeScene = scenes.find(s => String(s.id) === String(selectedSceneId));
    const sourceText = activeScene?.text || text || "";

    setRunning(true);
    try {
      await runExpansionInsertionDraft({
        activeScene,
        sourceText,
        expansionBrief: expansionPlanText,
        openaiKey: ENV_KEYS.openai,
        selectedProjectId,
        draftTree,
        createChapter,
        createScene,
        saveDocument,
        updateSceneText,
        updateSceneMetadata,
        logTokenUsage,
        estimateTokens,
        onStage: setStage,
        onChunk: async ({ pass, composedDraft }) => {
          setSaveStatus("saving");
          setOutput(composedDraft);
          setStages(prev => ({ ...prev, final: composedDraft }));
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), 1200);
        },
        onComplete: ({ finalText, placement }) => {
          setExpansionPlacement({ startParagraph: placement.startParagraph, endParagraph: placement.endParagraph });
          setExpansionPlacementReasoning(placement.reasoning);
          setOutput(finalText);
          setStages(prev => ({ ...prev, final: finalText }));
          setActiveTab("output");
        },
        onError: (e) => {
          setOutput("Error: " + e.message);
        }
      });
    } catch (e) {
      setOutput("Error: " + e.message);
    } finally {
      setRunning(false);
      setStage(null);
    }
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

  const handleMigrateToDocker = async () => {
    const confirmed = window.confirm("Migrate all local browser data to the Docker PostgreSQL database? This will copy all your projects to the server.");
    if (!confirmed) return;

    setRunning(true);
    setStage("migration");
    try {
      const { exportAllData } = await import("./services/db.js");
      const { batchImport } = await import("./services/serverDb.js");
      
      const data = await exportAllData();
      const result = await batchImport(data);
      
      if (result.success) {
        alert(`Successfully migrated ${result.count} projects to the Docker database!`);
        window.location.reload();
      } else {
        throw new Error(result.error || "Migration failed");
      }
    } catch (err) {
      alert("Migration failed: " + err.message);
    } finally {
      setRunning(false);
      setStage(null);
    }
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
    <WorkspaceLayout
      isFocusMode={isFocusMode}
      focusHeader={
        <div className="focus-header">
          <div className="focus-scene-title">{currentScene?.title || "Untitled Scene"}</div>
          <button className="btn btn-ghost" onClick={() => setIsFocusMode(false)} style={{ fontSize: '20px', padding: '0 10px' }}>x</button>
        </div>
      }
      leftSidebar={
        <DocumentSidebar
          projects={projects}
          tree={tree}
          draftTree={draftTree}
          selectedProjectId={selectedProjectId}
          selectedSceneId={selectedSceneId}
          onSelectProject={selectProject}
          onDeleteProject={deleteProject}
          onCreateProject={handleCreateProject}
          onRenameProject={handleRenameProject}
          onSelectScene={selectScene}
          onCreateChapter={createChapter}
          onCreateDraftChapter={(data) => createChapter({ ...data, isDraft: true })}
          onCreateScene={createScene}
          onCreateDraftScene={(chapterId) => createScene({ chapterId, title: "New Draft", isDraft: true })}
          onDeleteChapter={deleteChapter}
          onDeleteScene={deleteScene}
          onReorderChapter={reorderChapter}
          onReorderScene={reorderScene}
          onEditScene={setEditingScene}
          onOpenImport={() => setShowImportWizard(true)}
          onFullPageRead={(scene) => setFullPageReadScene(scene)}
        />
      }
      rightSidebar={
        activeTab === "write" ? (
          <RightSidebar
            activeMode={activeMode}
            stage={stage}
            analysis={analysis}
            delta={delta}
            SPARKS={SPARKS}
            runSpark={runSpark}
            running={running}
            activeModeInfo={activeModeInfo}
            CREATE_PIPELINE_SUMMARY={CREATE_PIPELINE_SUMMARY}
          />
        ) : null
      }
      topNav={
        <TopNav 
          saveStatus={saveStatus}
          dateStr={dateStr}
          timeStr={timeStr}
          theme={theme}
          toggleTheme={toggleTheme}
          handleExport={handleExport}
        />
      }
      statusBar={
        <StatusBar
          providerCards={providerCards}
          runtimeCards={runtimeCards}
          cacheDiagnostics={cacheDiagnostics}
          handleClearCache={handleClearCache}
          handleClearCosts={handleClearCosts}
          handleResetLocalData={handleResetLocalData}
          isFocusMode={isFocusMode}
          setIsFocusMode={setIsFocusMode}
        />
      }
    >
      <ManuscriptWorkspace
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeMode={activeMode}
        setActiveMode={setActiveMode}
        isModeLocked={isModeLocked}
        activeModeInfo={activeModeInfo}
        modeGatingState={modeGatingState}
        
        // Preproduction
        core={core}
        chars={chars}
        rules={rules}
        beats={beats}
        voice={voice}
        scenes={scenes}
        chapters={chapters}
        shadowActions={shadowActions}
        docManager={docManager}
        applyAgentAction={(id, opts) => applyAgentAction(id, { shadowActions, scenes, removeShadowAction, ...opts })}
        removeShadowAction={removeShadowAction}
        updateProjectMetadata={updateProjectMetadata}
        saveCharacter={saveCharacter}
        deleteCharacter={deleteCharacter}
        saveRule={saveRule}
        deleteRule={deleteRule}
        saveBeat={saveBeat}
        deleteBeat={deleteBeat}
        moveBeat={moveBeat}
        reorderBeats={reorderBeats}
        moveScene={moveScene}
        reorderScenes={reorderScenes}
        setEditingChar={setEditingChar}
        setEditingScene={setEditingScene}
        selectScene={selectScene}
        envStatusState={envStatusState}

        // Lore
        loreAgent={loreAgent}
        stages={stages}
        output={output}
        text={text}
        ENV_KEYS={ENV_KEYS}

        // Reports
        report={report}
        projects={projects}
        selectedProjectId={selectedProjectId}

        // Write Tab
        selectedSceneId={selectedSceneId}
        currentScene={currentScene}
        showPreview={showPreview}
        setShowPreview={setShowPreview}
        showMetadata={showMetadata}
        setShowMetadata={setShowMetadata}
        setText={setText}
        wordCount={wordCount}
        updateSceneMetadata={updateSceneMetadata}
        expansionPlanText={expansionPlanText}
        setExpansionPlanText={setExpansionPlanText}
        expansionPlacement={expansionPlacement}
        expansionPlacementReasoning={expansionPlacementReasoning}
        handleRecommendExpansionInsertion={handleRecommendExpansionInsertion}
        handleRunExpansionInsertionDraft={handleRunExpansionInsertionDraft}
        running={running}
        stage={stage}
        run={run}
        CREATE_PIPELINE_SUMMARY={CREATE_PIPELINE_SUMMARY}

        // Output Tab
        createModeCritique={createModeCritique}
        copyToEditor={copyToEditor}

        // Event Handlers for Agent suggestions
        onRunCriticSuggest={() => {
          runCriticAgent({
            openaiKey: ENV_KEYS.openai,
            project: { core, chars, rules, beats, voice },
            scenes,
            logShadowAction
          }).then(res => setOutput(res.message));
        }}
        onRunGeneratorSuggest={() => {
          runGeneratorAgent({
            openaiKey: ENV_KEYS.openai,
            project: { core, chars, rules, beats, voice },
            scenes,
            logShadowAction
          }).then(res => setOutput(res.message));
        }}
        onRunInstrumentedCompositionTest={async () => {
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
        onShowValidationStats={() => {
          const report = generateValidationReport();
          if (report) {
            alert(`[STATS] CONVERGENCE RATE: ${report.loop_stability.convergence_rate}%\n[STATS] FALSE POSITIVE RATE: ${report.loop_stability.false_positive_rate}%\n[STATS] QUALITY DECAY: ${report.loop_stability.quality_degradation_rate}%\n\nESCAPE-TO-MISS: ${report.loop_stability.escape_to_miss_rate}%\nROBUSTNESS: ${report.phrasing_robustness.robustness_rate}%`);
            console.log("FINAL VALIDATION REPORT:", report);
          } else {
            alert("No metrics collected yet.");
          }
        }}
        onRunOrchestrationLoop={async () => {
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
        renderMarkdown={renderMarkdown}
      />

        {/* MODALS */}
        {editingChar && <CharModal char={editingChar} onSave={saveChar} onClose={() => setEditingChar(null)} onDelete={deleteChar} />}
        {editingScene && <SceneModal scene={editingScene} onSave={handleSaveSceneModal} onClose={() => setEditingScene(null)} onDelete={handleDeleteSceneModal} />}
        {fullPageReadScene && (
          <FullPageReader
            scene={fullPageReadScene}
            onClose={() => setFullPageReadScene(null)}
          />
        )}

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
    </WorkspaceLayout>
  );
}
