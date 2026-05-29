/**
 * useOrchestratorPipeline.js - Custom hook to coordinate ProseLab V4 AI pipeline execution.
 * Decouples heavy AI orchestration flows from App.jsx view state coordinator.
 */

import { useState, useCallback, useRef } from "react";
import { runCreateOrchestration } from "../services/orchestration/createOrchestrator.js";
import { runEditorialOrchestration } from "../services/orchestration/editorialOrchestrator.js";
import { runTargetedRewriteOrchestration, runSparkOrchestration } from "../services/orchestration/rewriteOrchestrator.js";
import { recommendExpansionInsertion, runExpansionInsertionDraft } from "../services/expansionOrchestrator.js";
import { getCacheStats } from "../services/inferenceCache.js";
import { getCostStats } from "../services/storage.js";
import { logTokenUsage } from "../store/appStore.js";
import { INFERENCE_CACHE_CONTEXT_VERSION } from "../engine/pipeline.js";
import { eventBus } from "../features/orchestration/events.js";

const COST_RATES = {
  "galaxy": { input: 0, output: 0, perCall: 0.0001 },
  "openai::gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "ollama": { input: 0, output: 0 },
};

function getTodayStats() {
  return getCostStats(COST_RATES);
}

function estimateTokens(text) {
  return Math.ceil((text || "").length / 4);
}

export function useOrchestratorPipeline({
  text,
  selectedSceneId,
  selectedProjectId,
  scenes,
  core,
  chars,
  rules,
  beats,
  voice,
  draftTree,
  createChapter,
  createScene,
  saveDocument,
  updateSceneText,
  updateSceneMetadata,
  expansionPlanText,
  setExpansionPlacement,
  setExpansionPlacementReasoning,
  setActiveTab,
  setCacheStats,
  setCostStats,
}) {
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState(null);
  const [output, setOutput] = useState("");
  const [stages, setStages] = useState({ draft: "", refined: "", final: "" });
  const [createModeCritique, setCreateModeCritique] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [delta, setDelta] = useState([]);
  const [modeFeedback, setModeFeedback] = useState({ ANALYSE: {}, ENGINEER: {}, MARKET: {}, VERDICT: {} });
  const [lastAnalyzedText, setLastAnalyzedText] = useState("");

  const outputRef = useRef(null);

  const ENV_KEYS = {
    openai: import.meta.env.VITE_OPENAI_KEY || "",
    gemini: import.meta.env.VITE_GEMINI_KEY || "",
    geminiModel: import.meta.env.VITE_GEMINI_MODEL || "gemini-2.5-flash",
    model: import.meta.env.VITE_OLLAMA_MODEL || "rocinante",
  };

  const runCreateMode = useCallback(async () => {
    setOutput("");
    setAnalysis(null);
    setDelta([]);
    setStages({ draft: "", refined: "", final: "" });

    try {
      eventBus.emit("pipeline.stage_changed", { stage: "starting" });
      const result = await runCreateOrchestration({
        text,
        preproduction: { core, chars, rules, beats, voice, scenes },
        preflightId: selectedSceneId,
        delta,
        keys: { openai: ENV_KEYS.openai, gemini: ENV_KEYS.gemini },
        cacheVersion: INFERENCE_CACHE_CONTEXT_VERSION,
        logTokenUsage,
        estimateTokens,
        onStage: (s) => {
          setStage(s);
          eventBus.emit("pipeline.stage_changed", { stage: s });
        },
        onIntent: (intent) =>
          setCreateModeCritique((prev) => ({ ...(prev || {}), intent })),
        onAnalysis: setAnalysis,
        onDelta: setDelta,
      });

      if (result.diagnostics?.verdict === "BLOCKED") {
        const critique = {
          verdict: "BLOCKED",
          score: null,
          failures: [],
          attempts: 0,
          traces: [],
          intent: result.diagnostics.intent,
        };
        setCreateModeCritique(critique);
        setOutput(result.output);
        setCacheStats(getCacheStats());
        setCostStats(getTodayStats());
        eventBus.emit("costs.updated", { costStats: getTodayStats() });
        eventBus.emit("pipeline.completed", { success: false, output: result.output, diagnostics: result.diagnostics });
        setActiveTab("output");
        return;
      }

      if (result.diagnostics?.stage === "failed" && result.diagnostics?.verdict === "ERROR") {
        setOutput("Error: " + result.warnings.join(", "));
        setStage(null);
        eventBus.emit("pipeline.completed", { success: false, output: result.output, diagnostics: result.diagnostics });
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
      eventBus.emit("costs.updated", { costStats: getTodayStats() });
      eventBus.emit("pipeline.completed", { success: true, output: result.output, diagnostics: result.diagnostics });
      setActiveTab("output");
    } catch (e) {
      setOutput("Error: " + e.message);
      setStage(null);
      eventBus.emit("pipeline.completed", { success: false, error: e.message });
      setActiveTab("output");
    }
  }, [text, core, chars, rules, beats, voice, scenes, selectedSceneId, delta, ENV_KEYS.openai, ENV_KEYS.gemini, setCacheStats, setCostStats, setActiveTab]);

  const run = useCallback(async (activeMode, activeModeInfo) => {
    if (!text.trim() || running || !activeModeInfo.isConfigReady || activeModeInfo.isLocked) return;
    setRunning(true); 
    setStage("analysis");
    eventBus.emit("pipeline.triggered", { mode: activeMode, text });

    if (activeMode === "CREATE") {
      await runCreateMode();
    } else {
      if (activeMode === "ANALYSE") setLastAnalyzedText(text);
      try {
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
          onStage: (s) => {
            setStage(s);
            eventBus.emit("pipeline.stage_changed", { stage: s });
          },
        });

        if (result.success || result.diagnostics?.verdict) {
          if (result.diagnostics?.feedback) {
            setModeFeedback(prev => ({ ...prev, [activeMode]: result.diagnostics.feedback }));
          }
          eventBus.emit("pipeline.completed", { success: true, output: result.output, diagnostics: result.diagnostics });
          setActiveTab("output");
        } else {
          setOutput("Error: " + (result.warnings?.join(", ") || "Editorial run failed."));
          eventBus.emit("pipeline.completed", { success: false, warnings: result.warnings });
        }
      } catch (err) {
        setOutput("Error: " + err.message);
        eventBus.emit("pipeline.completed", { success: false, error: err.message });
      }
    }
    setRunning(false);
  }, [text, running, runCreateMode, modeFeedback, voice, ENV_KEYS.openai, ENV_KEYS.gemini, scenes, selectedSceneId, setActiveTab]);

  const runTargetedRewrite = useCallback(async () => {
    if (running || !text) return;
    setRunning(true);
    eventBus.emit("pipeline.triggered", { mode: "REWRITE_TARGETED", text });
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
        onStage: (s) => {
          setStage(s);
          eventBus.emit("pipeline.stage_changed", { stage: s });
        },
      });

      if (result.success || result.diagnostics?.verdict) {
        setOutput(result.output);
        setStages(prev => ({ ...prev, final: result.output }));
        
        const critique = {
          verdict: result.diagnostics?.verdict,
          score: result.diagnostics?.challenger?.score || null,
          failures: result.diagnostics?.failures || [],
          attempts: result.diagnostics?.attempts || 1,
          traces: result.diagnostics?.traces || [],
          challenger: result.diagnostics?.challenger,
        };
        setCreateModeCritique(critique);
        eventBus.emit("pipeline.completed", { success: true, output: result.output, diagnostics: result.diagnostics });
        setActiveTab("output");
      } else {
        setOutput("Error: " + result.warnings.join(", "));
        eventBus.emit("pipeline.completed", { success: false, warnings: result.warnings });
      }
    } catch (e) {
      setOutput("Error: " + e.message);
      eventBus.emit("pipeline.completed", { success: false, error: e.message });
    } finally {
      setRunning(false);
      setStage(null);
    }
  }, [running, text, scenes, selectedSceneId, modeFeedback, ENV_KEYS.openai, ENV_KEYS.gemini, draftTree, createChapter, createScene, setActiveTab]);

  const runSpark = useCallback(async (spark) => {
    if (running || !text.trim()) return;
    setRunning(true);
    eventBus.emit("pipeline.triggered", { mode: "SPARK", text, spark });
    try {
      const result = await runSparkOrchestration({
        text,
        scenes,
        selectedSceneId,
        spark,
        openaiKey: ENV_KEYS.openai,
        onStage: (s) => {
          setStage(s);
          eventBus.emit("pipeline.stage_changed", { stage: s });
        },
      });

      if (result.success) {
        setOutput(result.output);
        setStages(prev => ({ ...prev, final: result.output }));
        eventBus.emit("pipeline.completed", { success: true, output: result.output });
        setActiveTab("output");
      } else {
        setOutput("Error: " + result.warnings.join(", "));
        eventBus.emit("pipeline.completed", { success: false, warnings: result.warnings });
      }
    } catch (e) {
      setOutput("Error: " + e.message);
      eventBus.emit("pipeline.completed", { success: false, error: e.message });
    } finally {
      setRunning(false);
      setStage(null);
    }
  }, [running, text, scenes, selectedSceneId, ENV_KEYS.openai, setActiveTab]);

  const handleRunExpansionInsertionDraft = useCallback(async () => {
    if (running) return;
    const activeScene = scenes.find(s => String(s.id) === String(selectedSceneId));
    const sourceText = activeScene?.text || text || "";

    setRunning(true);
    eventBus.emit("pipeline.triggered", { mode: "EXPANSION_DRAFT", text: sourceText });
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
        onStage: (s) => {
          setStage(s);
          eventBus.emit("pipeline.stage_changed", { stage: s });
        },
        onChunk: async ({ composedDraft }) => {
          setOutput(composedDraft);
          setStages(prev => ({ ...prev, final: composedDraft }));
        },
        onComplete: ({ finalText, placement }) => {
          setExpansionPlacement({ startParagraph: placement.startParagraph, endParagraph: placement.endParagraph });
          setExpansionPlacementReasoning(placement.reasoning);
          setOutput(finalText);
          setStages(prev => ({ ...prev, final: finalText }));
          eventBus.emit("pipeline.completed", { success: true, output: finalText });
          setActiveTab("output");
        },
        onError: (e) => {
          setOutput("Error: " + e.message);
          eventBus.emit("pipeline.completed", { success: false, error: e.message });
        }
      });
    } catch (e) {
      setOutput("Error: " + e.message);
      eventBus.emit("pipeline.completed", { success: false, error: e.message });
    } finally {
      setRunning(false);
      setStage(null);
    }
  }, [running, scenes, selectedSceneId, text, expansionPlanText, ENV_KEYS.openai, selectedProjectId, draftTree, createChapter, createScene, saveDocument, updateSceneText, updateSceneMetadata, setExpansionPlacement, setExpansionPlacementReasoning, setActiveTab]);

  const handleRecommendExpansionInsertion = useCallback(async () => {
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
  }, [running, scenes, selectedSceneId, text, expansionPlanText, ENV_KEYS.openai, setExpansionPlacement, setExpansionPlacementReasoning]);

  return {
    running,
    setRunning,
    stage,
    setStage,
    output,
    setOutput,
    stages,
    setStages,
    createModeCritique,
    setCreateModeCritique,
    analysis,
    setAnalysis,
    delta,
    modeFeedback,
    setModeFeedback,
    lastAnalyzedText,
    setLastAnalyzedText,
    run,
    runCreateMode,
    runTargetedRewrite,
    runSpark,
    handleRunExpansionInsertionDraft,
    handleRecommendExpansionInsertion,
    outputRef,
  };
}
