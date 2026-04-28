import React, { useState, useEffect, useRef, Fragment } from "react";
import {
  cachedInference,
  clearInferenceCache,
  getCacheDiagnostics,
  getCacheStats,
  shouldCacheInference,
} from "./services/inferenceCache.js";

// =============================
// PROSELAB V4 — ANALYTICAL ENGINE
// =============================

// ENV-based API keys (Vite exposes VITE_ prefixed vars)
const ENV_KEYS = {
  openai: import.meta.env.VITE_OPENAI_KEY || "",
  model: import.meta.env.VITE_OLLAMA_MODEL || "llama3",
};

const KEY = "proselab_v4";
const save = (d) => localStorage.setItem(KEY, JSON.stringify(d));
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
const INFERENCE_CACHE_CONTEXT_VERSION = "voice-lock-v1";
const PROMPT_IDS = {
  margaret: "margaret_v1",
  rafael: "rafael_v1",
  james: "james_v1",
  yuki: "yuki_v1",
  saoirse: "saoirse_v1",
  victor: "victor_v1",
};

function normalize(str) { return str.trim().replace(/\s+/g, " "); }

// =============================
// TOKEN & COST TRACKING
// =============================
const COST_KEY = "plab_costs_v1";

function getTokenLog() { try { return JSON.parse(localStorage.getItem(COST_KEY) || "[]"); } catch { return []; } }
function saveTokenLog(log) { localStorage.setItem(COST_KEY, JSON.stringify(log)); }

function logTokenUsage(provider, inputTokens, outputTokens) {
  const log = getTokenLog();
  log.push({ provider, inputTokens, outputTokens, timestamp: Date.now() });
  saveTokenLog(log);
}

// Rough cost estimates per 1K tokens
const COST_RATES = {
  "openai::gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "ollama": { input: 0, output: 0 },
};

function estimateTokens(text) { return Math.ceil((text || "").length / 4); }

function getTodayStats() {
  const log = getTokenLog();
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const today = log.filter(e => e.timestamp >= todayStart.getTime());
  const totals = { calls: today.length, inputTokens: 0, outputTokens: 0, cost: 0 };
  today.forEach(e => {
    totals.inputTokens += e.inputTokens || 0;
    totals.outputTokens += e.outputTokens || 0;
    const rate = COST_RATES[e.provider] || { input: 0, output: 0 };
    totals.cost += (e.inputTokens / 1000) * rate.input + (e.outputTokens / 1000) * rate.output;
  });
  const allTime = { calls: log.length, cost: 0 };
  log.forEach(e => {
    const rate = COST_RATES[e.provider] || { input: 0, output: 0 };
    allTime.cost += (e.inputTokens / 1000) * rate.input + (e.outputTokens / 1000) * rate.output;
  });
  return { today: totals, allTime };
}

// =============================
// EDITORIAL PERSONAS
// =============================
const PERSONAS = {
  margaret: {
    name: "Margaret (Prose)",
    role: "Sentence architecture, rhythm, and life. Attacks abstract labels and rhythmic stagnation.",
    prompt: (intensity) => `You are Margaret, a senior prose editor. ${intensity}. Analyze the provided prose for rhythm, sentence architecture, and sensory life. Flag abstract emotional labels and 'AI-clean' sterility. Be brutal but specific.`
  },
  rafael: {
    name: "Rafael (Character)",
    role: "Emotional truth and character consistency. Ensures the character's internal reality matches the external action.",
    prompt: (intensity) => `You are Rafael, a character coach. ${intensity}. Analyze the character's internal consistency and emotional truth. Does the physiology match the feeling? Is the reaction earned?`
  },
  james: {
    name: "James (Structure)",
    role: "Pacing, chapter beats, and causality. Ensures the scene moves the needle of the story.",
    prompt: (intensity) => `You are James, a structural editor. ${intensity}. Analyze the scene's pacing, causality, and alignment with chapter beats. Does this scene NEED to exist?`
  },
  yuki: {
    name: "Yuki (World)",
    role: "World rules, lexicon, and physics. Ensures speculative elements feel mundane and consistent.",
    prompt: (intensity) => `You are Yuki, a world-building consultant. ${intensity}. Check for consistency in world rules, ecological lexicon, and the 'casual integration of the radical'. Flag any 'spectacle pauses'.`
  },
  saoirse: {
    name: "Saoirse (Market)",
    role: "Commercial appeal and audience hooks. 'Would this sell?'",
    prompt: (intensity) => `You are Saoirse, a literary agent. ${intensity}. Evaluate the commercial appeal and audience hook. Is the promise of the premise being delivered?`
  },
  victor: {
    name: "Victor (Verdict)",
    role: "Final decision aggregator. Provides the definitive APPROVED or REWRITE verdict.",
    prompt: (intensity) => `You are Victor, the Editor-in-Chief. ${intensity}. Review all previous editorial feedback and provide a final verdict: APPROVED or REWRITE. Summarize the critical path for improvement.`
  }
};

const PERSONA_INTENSITY = {
  ANALYSE: "DIAGNOSE ONLY. Identify issues but do not suggest fixes. Focus on rhythm and truth.",
  ENGINEER: "PRESCRIBE FIXES. Suggest specific structural and world-building remedies.",
  MARKET: "REALITY CHECK. Evaluate commercial viability.",
  VERDICT: "JUDGE HARSHLY. Final gatekeeping. Summarize if the work is fit for publication."
};

// =============================
// DEFAULT BEATS
// =============================
const DEFAULT_BEATS = [
  { id: 1, act: "ACT ONE", pct: "0%", title: "Opening Image / World Established", desc: "The mechanical constraint and physical world are demonstrated before they are explained.", target: 0, actual: 0 },
  { id: 2, act: "ACT ONE", pct: "10%", title: "Inciting Incident", desc: "The event that makes the protagonist's current equilibrium impossible to maintain.", target: 0, actual: 0 },
  { id: 3, act: "ACT ONE", pct: "25%", title: "Act One Break — Lock-In", desc: "The protagonist commits. There is no returning to the pre-story world.", target: 0, actual: 0 },
  { id: 4, act: "ACT TWO", pct: "37%", title: "First Pinch / Rising Stakes", desc: "The antagonist's power is demonstrated. The protagonist is outmatched.", target: 0, actual: 0 },
  { id: 5, act: "ACT TWO", pct: "50%", title: "MIDPOINT REVERSAL", desc: "The core assumption of the story is inverted. The detective becomes the hunted. The map is wrong.", target: 0, actual: 0 },
  { id: 6, act: "ACT TWO", pct: "62%", title: "Second Pinch / Dark Turn", desc: "A trusted element betrays or collapses. The protagonist's tools fail.", target: 0, actual: 0 },
  { id: 7, act: "ACT TWO", pct: "75%", title: "Act Two Break — All Is Lost", desc: "The protagonist's false belief costs them everything. The darkest moment before recommitment.", target: 0, actual: 0 },
  { id: 8, act: "ACT THREE", pct: "80%", title: "Recommitment / New Plan", desc: "Armed with the true belief, the protagonist makes a final choice.", target: 0, actual: 0 },
  { id: 9, act: "ACT THREE", pct: "90%", title: "Climax", desc: "The mechanical constraint is tested to its absolute limit. All planted objects are detonated.", target: 0, actual: 0 },
  { id: 10, act: "ACT THREE", pct: "100%", title: "Resolution / Closing Image", desc: "Mirrors the opening image. Demonstrates how the world — or the protagonist — has changed.", target: 0, actual: 0 },
];

// =============================
// TECHNIQUE TARGET PROFILE
// =============================
const TARGET = {
  rhythm: { shortRatio: 0.2, variance: "high" },
  emotion: { physicalRatio: 0.8 },
  specificity: { concreteRatio: 0.7 }
};

// =============================
// ANALYSIS FUNCTIONS
// =============================
function splitSentences(text) { return text.split(/[.!?]+/).map(s => s.trim()).filter(Boolean); }

function analyzeRhythm(text) {
  const sentences = splitSentences(text);
  const lengths = sentences.map(s => s.split(" ").length);
  const short = lengths.filter(l => l <= 6).length;
  const avg = lengths.reduce((a, b) => a + b, 0) / (lengths.length || 1);
  const variance = Math.max(...lengths) - Math.min(...lengths);
  return { shortRatio: short / (lengths.length || 1), variance: variance > 10 ? "high" : "low", avg };
}

function analyzeEmotion(text) {
  const words = text.toLowerCase().split(/\s+/);
  const wc = words.length || 1;
  const abstractWords = ["felt", "fear", "sad", "angry", "happy", "despair", "thought", "knew", "realized", "wanted"];
  const bodyWords = ["stomach", "hands", "breath", "jaw", "pulse", "skin", "sweat", "shiver", "chest", "throat"];
  let abs = 0, phys = 0;
  words.forEach(w => {
    if (abstractWords.some(aw => w.includes(aw))) abs++;
    if (bodyWords.some(bw => w.includes(bw))) phys++;
  });
  // Return ratio of physical to total emotional markers, normalized
  return { physicalRatio: phys / ((phys + abs) || 1), totalDensity: (phys + abs) / wc };
}

function analyzeSpecificity(text) {
  const words = text.toLowerCase().split(/\s+/);
  const wc = words.length || 1;
  const vague = ["thing", "stuff", "something", "everything", "place", "area", "someone", "somehow", "somewhere"];
  let v = 0;
  words.forEach(w => {
    if (vague.some(vw => w.includes(vw))) v++;
  });
  // Higher is better (fewer vague words)
  const vagueRatio = v / wc;
  return { concreteRatio: Math.max(0, 1 - (vagueRatio * 20)) }; // Normalized: 5% vague = 0 concreteRatio
}

function analyze(text) {
  return { 
    rhythm: analyzeRhythm(text), 
    emotion: analyzeEmotion(text), 
    specificity: analyzeSpecificity(text),
    wordCount: text.trim().split(/\s+/).length
  };
}

// =============================
// DELTA ENGINE
// =============================
function buildDelta(a) {
  const instructions = [];
  if (a.rhythm.shortRatio < TARGET.rhythm.shortRatio) instructions.push("Introduce more short, blunt sentences (6 words or fewer)");
  if (a.rhythm.variance !== "high") instructions.push("Increase sentence length variation dramatically");
  if (a.emotion.physicalRatio < TARGET.emotion.physicalRatio) instructions.push("Replace abstract emotions with physical reactions");
  if (a.specificity.concreteRatio < TARGET.specificity.concreteRatio) instructions.push("Replace vague words with concrete sensory detail");
  return instructions;
}

// =============================
// LLM CALLS (with token tracking)
// =============================
async function callOpenAI(key, prompt) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }] })
  });
  const d = await r.json();
  const usage = d.usage || {};
  logTokenUsage("openai::gpt-4o-mini", usage.prompt_tokens || estimateTokens(prompt), usage.completion_tokens || estimateTokens(d.choices?.[0]?.message?.content));
  return d.choices?.[0]?.message?.content || "";
}

async function callOllama(model, prompt) {
  const r = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, stream: false })
  });
  const d = await r.json();
  if (!d || typeof d.response !== "string" || d.response.trim() === "") {
    console.error("Ollama invalid response:", d);
    return "";
  }
  logTokenUsage("ollama", estimateTokens(prompt), estimateTokens(d.response));
  return d.response;
}

import { callCritic } from "./engine/critic.js";
import { 
  generateRewrite, 
  estimateSimilarity, 
  mapVoiceToPromptSpec 
} from "./engine/rewrite.js";

// =============================
// PIPELINE (MULTI-PASS CRITIC LOOP)
// =============================
async function runPipeline({ 
  text, 
  keys, 
  model, 
  onStage, 
  onUpdate,
  sceneContext = null,
}) {
  const SIMILARITY_THRESHOLD = 0.75;
  const MAX_ATTEMPTS = 3;

  onStage("analysis");
  const analysis = await cachedInference({
    name: "analysis",
    input: text,
    context: { version: INFERENCE_CACHE_CONTEXT_VERSION },
    fn: async () => analyze(text),
    enabled: shouldCacheInference("analysis"),
  });
  if (onUpdate) onUpdate({ analysis });

  onStage("delta");
  const delta = await cachedInference({
    name: "delta",
    input: JSON.stringify(analysis),
    context: { version: INFERENCE_CACHE_CONTEXT_VERSION },
    fn: async () => buildDelta(analysis),
    enabled: shouldCacheInference("delta"),
  });
  if (onUpdate) onUpdate({ delta });

  const initialInstruction = normalize(`Rewrite this paragraph with these constraints:\n${delta.join("\n")}\n\n${text}`);

  onStage("ollama");
  const draft1 = await callOllama(model, initialInstruction);
  const safeDraft1 = draft1?.trim() ? draft1 : text;

  let currentDraft = safeDraft1;
  let attempts = 0;
  let finalCritique = null;
  let traces = [];

  while (attempts < MAX_ATTEMPTS) {
    attempts++;
    onStage(`critic-p${attempts}`);
    
    const critique = await callCritic({
      text: currentDraft,
      keys,
      sceneContext
    });
    
    finalCritique = critique;
    traces.push({ draft: currentDraft, critique });

    if (critique.verdict === "APPROVE") break;
    if (attempts === MAX_ATTEMPTS) break;

    onStage(`rewrite-p${attempts + 1}`);
    const similarityToOriginal = estimateSimilarity(text, currentDraft);
    const previousTrace = traces.length >= 2 ? traces[traces.length - 2] : null;
    const similarityToPrevious = previousTrace 
      ? estimateSimilarity(previousTrace.draft, currentDraft) 
      : 0;
    const tooSimilar = similarityToOriginal > SIMILARITY_THRESHOLD || similarityToPrevious > SIMILARITY_THRESHOLD;

    const rewriteResult = await generateRewrite({
      original: text,
      instructions: critique.rewrite.instructions,
      voiceSpec,
      sceneContext,
      key: keys.openai,
      temperature: tooSimilar ? 0.85 : 0.75,
      similarityRejection: tooSimilar,
      rejectedDraft: tooSimilar ? currentDraft : null
    });

    if (rewriteResult.ok) {
      currentDraft = rewriteResult.text;
    } else {
      break;
    }
  }

  onStage("done");
  return { 
    analysis, 
    delta, 
    final: currentDraft,
    critique: finalCritique,
    attempts,
    traces
  };
}

// =============================
// PREFLIGHT BRIEF COMPONENT
// =============================
function PreflightBrief({ scene, preproduction }) {
  if (!scene) return null;

  const warnings = [];
  if (!scene.location) warnings.push("LOCATION NOT LOCKED — Physical space is undefined.");
  if (!scene.time) warnings.push("STORY TIME NOT LOCKED — Timeline continuity cannot be verified.");
  if (!scene.objects) warnings.push("CARRIED OBJECTS UNDEFINED — Any object used will be an unplanted prop.");
  if (!scene.causality) warnings.push("CAUSALITY STATEMENT MISSING — This scene has no defined function.");
  if (!scene.output) warnings.push("REQUIRED OUTPUT UNDEFINED — No scene should be drafted without knowing exactly what it must produce.");

  return (
    <div className="preflight-doc">
      <div className="brief-header">
        <div className="brief-title">Ch.{scene.chapter} — {scene.title}</div>
        <div className="brief-meta">
          <div>PROJECT <span>{preproduction.core.title || "UNTITLED"}</span></div>
          <div>STATUS <span className={`status-badge tag-${scene.status}`}>{scene.status.toUpperCase()}</span></div>
          <div>FUNCTION <span className={`causality-badge tag-${scene.causalityType}`}>{scene.causalityType.toUpperCase()}</span></div>
        </div>
      </div>

      {warnings.length > 0 ? (
        <div className="brief-section">
          <div className="brief-section-title">⚠ COMPLIANCE WARNINGS</div>
          {warnings.map((w, i) => <div key={i} className="brief-warning">⚠ {w}</div>)}
        </div>
      ) : (
        <div style={{ background: "rgba(39,174,96,0.08)", border: "1px solid rgba(39,174,96,0.3)", padding: "10px 16px", marginBottom: "20px", fontSize: "0.7rem", color: "var(--success)" }}>
          ✓ PREFLIGHT COMPLETE — CLEARED FOR DRAFTING.
        </div>
      )}

      <div className="brief-section">
        <div className="brief-section-title">Physical Reality Lock</div>
        <div className="brief-inventory-item"><div className="brief-inv-label">LOCATION</div><div className="brief-inv-val">{scene.location || "⚠ UNDEFINED"}</div></div>
        <div className="brief-inventory-item"><div className="brief-inv-label">STORY TIME</div><div className="brief-inv-val">{scene.time || "⚠ UNDEFINED"}</div></div>
      </div>

      <div className="brief-section">
        <div className="brief-section-title">Causality Architecture</div>
        <div className="brief-output">
          <p>{scene.causality || "⚠ NO CAUSALITY STATEMENT"}</p>
        </div>
      </div>

      <div className="brief-section">
        <div className="brief-section-title">Required Output</div>
        <ul className="brief-checklist">
          {scene.output ? scene.output.split("\n").map((l, i) => <li key={i}>{l}</li>) : <li>⚠ NO REQUIRED OUTPUT</li>}
        </ul>
      </div>
    </div>
  );
}

// =============================
// MODAL COMPONENTS
// =============================
function CharModal({ char, onSave, onClose, onDelete }) {
  const [data, setData] = useState(char);
  return (
    <div className="modal-overlay open">
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{char.name ? "EDIT CHARACTER" : "ADD CHARACTER"}</span>
          <button className="modal-close" onClick={onClose}>CLOSE</button>
        </div>
        <div className="grid-2">
          <div className="field-group">
            <label className="field-label">Name</label>
            <input className="field-input" value={data.name} onChange={e => setData({ ...data, name: e.target.value })} />
          </div>
          <div className="field-group">
            <label className="field-label">Role</label>
            <select className="field-select" value={data.role} onChange={e => setData({ ...data, role: e.target.value })}>
              <option value="protagonist">Protagonist</option>
              <option value="antagonist">Antagonist</option>
              <option value="supporting">Supporting</option>
              <option value="secondary">Secondary</option>
            </select>
          </div>
        </div>
        <div className="field-group">
          <label className="field-label">Narrative Function</label>
          <textarea className="field-textarea" value={data.function} onChange={e => setData({ ...data, function: e.target.value })} />
        </div>
        <div className="modal-footer">
          <button className="btn btn-danger" onClick={() => onDelete(data.id)}>DELETE</button>
          <button className="btn btn-primary" onClick={() => onSave(data)}>SAVE CHARACTER</button>
        </div>
      </div>
    </div>
  );
}

function SceneModal({ scene, onSave, onClose, onDelete }) {
  const [data, setData] = useState(scene);
  return (
    <div className="modal-overlay open">
      <div className="modal" style={{ maxWidth: "800px" }}>
        <div className="modal-header">
          <span className="modal-title">{scene.title ? "EDIT SCENE" : "ADD SCENE"}</span>
          <button className="modal-close" onClick={onClose}>CLOSE</button>
        </div>
        <div className="grid-3">
          <div className="field-group">
            <label className="field-label">Chapter</label>
            <input className="field-input" value={data.chapter} onChange={e => setData({ ...data, chapter: e.target.value })} />
          </div>
          <div className="field-group">
            <label className="field-label">Title</label>
            <input className="field-input" value={data.title} onChange={e => setData({ ...data, title: e.target.value })} />
          </div>
          <div className="field-group">
            <label className="field-label">Status</label>
            <select className="field-select" value={data.status} onChange={e => setData({ ...data, status: e.target.value })}>
              <option value="pending">Pending</option>
              <option value="draft">Draft</option>
              <option value="locked">Locked</option>
            </select>
          </div>
        </div>
        <div className="grid-2">
          <div className="field-group">
            <label className="field-label">Location</label>
            <input className="field-input" value={data.location} onChange={e => setData({ ...data, location: e.target.value })} />
          </div>
          <div className="field-group">
            <label className="field-label">Causality Type</label>
            <select className="field-select" value={data.causalityType} onChange={e => setData({ ...data, causalityType: e.target.value })}>
              <option value="revelation">Revelation</option>
              <option value="decision">Decision</option>
              <option value="confrontation">Confrontation</option>
              <option value="escalation">Escalation</option>
              <option value="transition">Transition</option>
              <option value="setup">Setup</option>
            </select>
          </div>
        </div>
        <div className="field-group">
          <label className="field-label">Causality Statement</label>
          <textarea className="field-textarea" value={data.causality} onChange={e => setData({ ...data, causality: e.target.value })} />
        </div>
        <div className="field-group">
          <label className="field-label">Required Output</label>
          <textarea className="field-textarea" value={data.output} onChange={e => setData({ ...data, output: e.target.value })} />
        </div>
        <div className="modal-footer">
          <button className="btn btn-danger" onClick={() => onDelete(data.id)}>DELETE</button>
          <button className="btn btn-primary" onClick={() => onSave(data)}>SAVE SCENE</button>
        </div>
      </div>
    </div>
  );
}

// =============================
// UI COMPONENTS
// =============================
function StatCard({ label, value, detail, accent }) {
  const colors = { purple: "var(--accent-primary)", green: "var(--success)", amber: "var(--warning)", blue: "var(--info)", red: "var(--error)" };
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={accent ? { color: colors[accent] } : {}}>{value}</div>
      {detail && <div className="stat-detail">{detail}</div>}
    </div>
  );
}

function MetricBar({ label, value, max = 1 }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const color = pct >= 70 ? "var(--success)" : pct >= 40 ? "var(--warning)" : "var(--error)";
  return (
    <div className="analysis-metric">
      <span className="analysis-metric-label">{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 60, height: 4, background: "var(--border-subtle)", borderRadius: 2 }}>
          <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 2, transition: "width 0.6s var(--ease-out)" }} />
        </div>
        <span className="analysis-metric-value">{typeof value === "number" ? value.toFixed(2) : value}</span>
      </div>
    </div>
  );
}

function PipelineTracker({ currentStage }) {
  const stages = ["analysis", "delta", "ollama", "critic-p1", "rewrite-p2", "critic-p2", "rewrite-p3", "critic-p3", "done"];
  const labels = {
    analysis: "Analysis",
    delta: "Constraints",
    ollama: "Ollama",
    "critic-p1": "Critic 1",
    "rewrite-p2": "Rewrite 2",
    "critic-p2": "Critic 2",
    "rewrite-p3": "Rewrite 3",
    "critic-p3": "Critic 3",
    done: "Done"
  };

  const getStatus = (s) => {
    if (currentStage === "done") return "done";
    if (s === currentStage) return "active";
    const sIdx = stages.indexOf(s);
    const cIdx = stages.indexOf(currentStage);
    if (cIdx > sIdx) return "done";
    return "idle";
  };

  const visibleStages = stages.filter(s => {
    const status = getStatus(s);
    return status === "active" || status === "done";
  });

  return (
    <div className="pipeline-tracker">
      {visibleStages.map((s, i) => (
        <Fragment key={s}>
          <div className={`pipeline-stage ${getStatus(s)}`}>
            {getStatus(s) === "active" && <span className="spinner" style={{ width: 10, height: 10, borderWidth: 1 }} />}
            {labels[s]}
          </div>
          {i < visibleStages.length - 1 && <span className="pipeline-arrow">→</span>}
        </Fragment>
      ))}
    </div>
  );
}

// =============================
// MAIN APP
// =============================
export default function ProseLabV4() {
  const [activeTab, setActiveTab] = useState("write");
  const [activeMode, setActiveMode] = useState("CREATE");
  const [text, setText] = useState("");
  const [output, setOutput] = useState("");
  const [stages, setStages] = useState({ draft: "", refined: "", final: "" });
  const [modeFeedback, setModeFeedback] = useState({ ANALYSE: {}, ENGINEER: {}, MARKET: {}, VERDICT: {} });
  const [analysis, setAnalysis] = useState(null);
  const [delta, setDelta] = useState([]);
  const [createModeCritique, setCreateModeCritique] = useState(null);
  const [preproduction, setPreproduction] = useState({
    core: { title: "", subtitle: "", genre: "", wc: "", wcCurrent: "", constraint: "", theme: "", argument: "", falseBelief: "", trueBelief: "", structure: "", hook: "", midpoint: "", ending: "" },
    voice: { length: "mixed", fragments: "medium", metaphor: "medium", dialogue: "natural", banned: ["very", "suddenly", "felt"] },
    rules: [],
    chars: [],
    beats: DEFAULT_BEATS,
    scenes: [],
    settings: { ollamaModel: ENV_KEYS.model, openaiModel: "gpt-4o-mini" }
  });
  const [lastAnalyzedText, setLastAnalyzedText] = useState("");
  const [preTab, setPreTab] = useState("core");
  const [editingChar, setEditingChar] = useState(null);
  const [editingScene, setEditingScene] = useState(null);
  const [preflightId, setPreflightId] = useState("");
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState(null);
  const [cacheStats, setCacheStats] = useState(getCacheStats());
  const [costStats, setCostStats] = useState(getTodayStats());
  const [envStatus, setEnvStatus] = useState({ ollamaReachable: false });
  const [now, setNow] = useState(new Date());
  const outputRef = useRef(null);

  // Load saved state
  useEffect(() => {
    const d = load();
    if (d) {
      if (d.text) setText(d.text);
      if (d.preproduction) setPreproduction(prev => ({ ...prev, ...d.preproduction }));
    }
  }, []);

  // Save state
  useEffect(() => { save({ text, preproduction }); }, [text, preproduction]);

  // Live Analysis
  useEffect(() => {
    if (text.trim()) {
      setAnalysis(analyze(text));
    } else {
      setAnalysis(null);
    }
  }, [text]);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const checkOllamaReachability = async (modelName) => {
    if (!modelName) return false;
    try {
      const res = await fetch("http://localhost:11434/api/tags");
      if (!res.ok) return false;
      const data = await res.json();
      return data.models?.some(m => m.name === modelName || m.name.startsWith(modelName + ":"));
    } catch {
      return false;
    }
  };

  useEffect(() => {
    checkOllamaReachability(preproduction.settings.ollamaModel).then(isReachable => {
      setEnvStatus(prev => ({ ...prev, ollamaReachable: isReachable }));
    });
  }, [preproduction.settings.ollamaModel]);

  const envStatusState = {
    openai: ENV_KEYS.openai && ENV_KEYS.openai !== "your_openai_key_here",
    ollamaModel: Boolean(preproduction.settings.ollamaModel?.trim()),
    ollamaReachable: envStatus?.ollamaReachable ?? false,
  };

  const getModeConfigWarnings = (mode) => {
    const warnings = [];
    if (mode === "CREATE") {
      if (!envStatusState.ollamaModel) warnings.push("Create mode needs an Ollama model name in Settings.");
      if (envStatusState.ollamaModel && !envStatusState.ollamaReachable) warnings.push("Ollama model is set, but the server is unreachable or the model is not installed.");
      if (!envStatusState.openai) warnings.push("Create mode needs `VITE_OPENAI_KEY` in `proselab/.env`.");
    }
    if (["ANALYSE", "ENGINEER", "MARKET", "VERDICT"].includes(mode) && !envStatusState.openai) {
      warnings.push(`${mode} mode needs \`VITE_OPENAI_KEY\` in \`proselab/.env\`.`);
    }
    return warnings;
  };

  const getModeLockReason = (mode) => {
    if (mode === "ENGINEER") {
      const hasFeedback = Object.keys(modeFeedback.ANALYSE).length > 0;
      const hasEdited = text.trim() !== lastAnalyzedText.trim();
      if (!hasFeedback) return "Run ANALYSE first to generate Margaret and Rafael feedback.";
      if (!hasEdited) return "Edit the text after ANALYSE before starting ENGINEER.";
    }
    if (mode === "VERDICT") {
      if (Object.keys(modeFeedback.ANALYSE).length === 0) return "Run ANALYSE before requesting VERDICT.";
      if (Object.keys(modeFeedback.ENGINEER).length === 0) return "Run ENGINEER before requesting VERDICT.";
    }
    return "";
  };

  const getModeInfo = (mode) => {
    const configWarnings = getModeConfigWarnings(mode);
    const lockReason = getModeLockReason(mode);
    return {
      configWarnings,
      lockReason,
      isConfigReady: configWarnings.length === 0,
      isLocked: Boolean(lockReason),
    };
  };

  const dateStr = now.toLocaleDateString("en-AU", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const activeModeInfo = getModeInfo(activeMode);

  const run = async () => {
    if (!text.trim() || running || !activeModeInfo.isConfigReady || activeModeInfo.isLocked) return;
    setRunning(true); setStage("analysis");

    if (activeMode === "CREATE") {
      await runCreateMode();
    } else {
      await runEditorialMode();
    }
    setRunning(false);
  };

  const runCreateMode = async () => {
    setOutput(""); setAnalysis(null); setDelta([]);
    setStages({ draft: "", refined: "", final: "" });

    const voiceProfile = `
VOICE PROFILE:
- Sentence Length: ${preproduction.voice.length}
- Fragment Tolerance: ${preproduction.voice.fragments}
- Metaphor Density: ${preproduction.voice.metaphor}
- Dialogue Style: ${preproduction.voice.dialogue}
`;

    let context = "";
    const activeScene = preproduction.scenes.find(s => s.id === parseInt(preflightId));

    if (activeScene) {
      context = `
CHAPTER BRIEF:
Title: ${activeScene.title}
Chapter: ${activeScene.chapter}
Location: ${activeScene.location}
Causality: ${activeScene.causality}
Required Output: ${activeScene.output}
Stakes: ${activeScene.stakes}
Characters Present: ${activeScene.chars}
`;
    } else {
      context = `
PROJECT CORE:
Title: ${preproduction.core.title}
Genre: ${preproduction.core.genre}
Constraint: ${preproduction.core.constraint}
Theme: ${preproduction.core.theme}
False Belief: ${preproduction.core.falseBelief}
Midpoint: ${preproduction.core.midpoint}
`;
    }

    try {
      const res = await runPipeline({
        text: text, // Use the actual user text as input
        keys: { openai: ENV_KEYS.openai },
        model: preproduction.settings.ollamaModel,
        onStage: setStage,
        onUpdate: (data) => {
          if (data.analysis) setAnalysis(data.analysis);
          if (data.delta) setDelta(data.delta);
        },
        sceneContext: context,
        voiceSpec: mapVoiceToPromptSpec(preproduction.voice, delta)
      });

      console.log("PIPELINE TRACE", {
        attempts: res.attempts,
        finalVerdict: res.critique?.verdict,
        finalScore: res.critique?.score?.overall,
      });

      setAnalysis(res.analysis);
      setDelta(res.delta);
      setStages({ draft: res.traces?.[0]?.draft || "", refined: "", final: res.final });
      setCreateModeCritique({ 
        verdict: res.critique?.verdict, 
        score: res.critique?.score, 
        failures: res.critique?.failures,
        attempts: res.attempts,
        traces: res.traces 
      });
      setOutput(res.final);
      setCacheStats(getCacheStats());
      setCostStats(getTodayStats());
      if (outputRef.current) outputRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
      setActiveTab("output");
    } catch (e) {
      setOutput("Error: " + e.message);
    }
  };

  const runEditorialMode = async () => {
    setStage("editorial");
    const sourceText = text; // Always review the current text in the editor
    const personaMap = {
      ANALYSE: ["margaret", "rafael"],
      ENGINEER: ["james", "yuki"],
      MARKET: ["saoirse"],
      VERDICT: ["victor"]
    };

    if (activeMode === "ANALYSE") setLastAnalyzedText(sourceText);

    const activePersonas = personaMap[activeMode] || [];
    const feedback = { ...modeFeedback[activeMode] };
    const intensity = PERSONA_INTENSITY[activeMode] || "";

    // Bridge context for ENGINEER mode
    let bridgeContext = "";
    if (activeMode === "ENGINEER") {
      bridgeContext = `
KEY FAILURES FROM ANALYSE PASS:
- Prose/Rhythm Issues (Margaret): ${modeFeedback.ANALYSE?.margaret || "None recorded"}
- Character/Truth Issues (Rafael): ${modeFeedback.ANALYSE?.rafael || "None recorded"}
`;
    }

    for (const pKey of activePersonas) {
      setStage(pKey);
      const persona = PERSONAS[pKey];
      let prompt = `${persona.prompt(intensity)}\n\n${bridgeContext}\n\nCONTENT TO REVIEW:\n${sourceText}`;
      
      if (pKey === "victor") {
        const allFeedback = JSON.stringify(modeFeedback);
        prompt += `\n\nPREVIOUS EDITORIAL FEEDBACK:\n${allFeedback}`;
      }

      try {
        const cacheName = `persona::${pKey}::${activeMode}`;
        const result = await cachedInference({
          name: cacheName,
          input: prompt,
          context: {
            version: INFERENCE_CACHE_CONTEXT_VERSION,
            promptId: PROMPT_IDS[pKey] || `${pKey}_v1`,
            voiceSpec: preproduction.voice,
            activeMode,
            persona: pKey,
          },
          fn: () => callOpenAI(ENV_KEYS.openai, prompt),
          enabled: shouldCacheInference(cacheName),
        });
        feedback[pKey] = result;
      } catch (e) {
        feedback[pKey] = "Error: " + e.message;
      }
    }

    setModeFeedback(prev => ({ ...prev, [activeMode]: feedback }));
    setStage("done");
    setActiveTab("output");
  };

  const copyToEditor = (content) => {
    setText(content);
    setActiveTab("write");
    // Pulse effect or notification?
  };

  const isModeLocked = (mode) => {
    return Boolean(getModeLockReason(mode));
  };

  const runTargetedRewrite = async () => {
    if (running || !modeFeedback.ANALYSE?.margaret) return;
    setRunning(true); setStage("margaret-rewrite");
    
    const prompt = `You are a high-craft prose surgeon. 
Analyze the original text and the feedback from Margaret. 
Rewrite ONLY the specific sentences or rhythmic structures Margaret flagged as problematic. 
DO NOT touch any other part of the text. Preserve the author's voice and intent perfectly.

MARGARET'S FEEDBACK:
${modeFeedback.ANALYSE.margaret}

ORIGINAL TEXT:
${text}`;

    try {
      const result = await callOpenAI(ENV_KEYS.openai, prompt);
      setOutput(result);
      setStages(prev => ({ ...prev, final: result }));
      setActiveTab("output");
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
    localStorage.removeItem(COST_KEY);
    setCostStats(getTodayStats());
  };

  const updatePre = (sec, key, val) => {
    setPreproduction(prev => ({
      ...prev,
      [sec]: typeof prev[sec] === "object" && !Array.isArray(prev[sec]) 
        ? { ...prev[sec], [key]: val } 
        : val
    }));
  };

  const addRule = () => {
    const newRule = { id: Date.now(), rule: "", cost: "", limit: "", consequence: "", category: "physics" };
    setPreproduction(prev => ({ ...prev, rules: [...prev.rules, newRule] }));
  };

  const updateRule = (id, key, val) => {
    setPreproduction(prev => ({
      ...prev,
      rules: prev.rules.map(r => r.id === id ? { ...r, [key]: val } : r)
    }));
  };

  const deleteRule = (id) => {
    setPreproduction(prev => ({ ...prev, rules: prev.rules.filter(r => r.id !== id) }));
  };

  const saveChar = (char) => {
    setPreproduction(prev => {
      const exists = prev.chars.find(c => c.id === char.id);
      return {
        ...prev,
        chars: exists ? prev.chars.map(c => c.id === char.id ? char : c) : [...prev.chars, char]
      };
    });
    setEditingChar(null);
  };

  const deleteChar = (id) => {
    setPreproduction(prev => ({ ...prev, chars: prev.chars.filter(c => c.id !== id) }));
    setEditingChar(null);
  };

  const saveScene = (scene) => {
    setPreproduction(prev => {
      const exists = prev.scenes.find(s => s.id === scene.id);
      const newScenes = exists ? prev.scenes.map(s => s.id === scene.id ? scene : s) : [...prev.scenes, scene];
      return {
        ...prev,
        scenes: newScenes.sort((a, b) => (parseFloat(a.chapter) || 0) - (parseFloat(b.chapter) || 0))
      };
    });
    setEditingScene(null);
  };

  const deleteScene = (id) => {
    setPreproduction(prev => ({ ...prev, scenes: prev.scenes.filter(s => s.id !== id) }));
    setEditingScene(null);
  };

  const updateBeat = (id, key, val) => {
    setPreproduction(prev => ({
      ...prev,
      beats: prev.beats.map(b => b.id === id ? { ...b, [key]: parseInt(val) || 0 } : b)
    }));
  };

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const savedPct = costStats.today.calls > 0 ? Math.round((cacheStats.entries / (cacheStats.entries + costStats.today.calls)) * 100) : 0;
  const cacheDiagnostics = getCacheDiagnostics();

  return (
    <div className="app-container">
      {/* HEADER */}
      <header className="header">
        <div className="header-left">
          <div className="logo-mark">P</div>
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
        </div>
      </header>

      {/* ENV STATUS BAR */}
      <div className="env-status">
        <div className="env-item">
          <div className={`env-dot ${envStatusState.openai ? "connected" : "missing"}`} />
          <span>OpenAI {envStatusState.openai ? "Configured" : "Missing `VITE_OPENAI_KEY`"}</span>
        </div>
        <div className="env-item">
          <div className={`env-dot ${envStatusState.ollamaReachable ? "connected" : "missing"}`} />
          <span>Ollama {envStatusState.ollamaReachable ? `Model connected: ${preproduction.settings.ollamaModel}` : "Unreachable or Missing"}</span>
        </div>
        <div className="env-item env-note">
          <div className="env-dot info" />
          <span>No login flow. ProseLab uses local `.env` provider keys and local Ollama access.</span>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <div className="env-item env-note">
            <div className="env-dot info" />
            <span>Cache {cacheDiagnostics.enabled ? "On" : "Off"} | {cacheDiagnostics.version} | TTL {Math.round(cacheDiagnostics.ttlMs / 3600000)}h</span>
          </div>
          <button className="btn btn-ghost" onClick={handleClearCache} style={{ padding: "4px 10px", fontSize: 11 }}>Clear Cache</button>
          <button className="btn btn-ghost" onClick={handleClearCosts} style={{ padding: "4px 10px", fontSize: 11 }}>Reset Costs</button>
        </div>
      </div>

      {/* DASHBOARD STATS */}
      <div className="dashboard-grid">
        <StatCard label="Today's API Calls" value={costStats.today.calls} detail={`${costStats.allTime.calls} all time`} accent="purple" />
        <StatCard label="Tokens Used Today" value={(costStats.today.inputTokens + costStats.today.outputTokens).toLocaleString()} detail={`In: ${costStats.today.inputTokens.toLocaleString()} | Out: ${costStats.today.outputTokens.toLocaleString()}`} accent="blue" />
        <StatCard label="Est. Cost Today" value={`$${costStats.today.cost.toFixed(4)}`} detail={`$${costStats.allTime.cost.toFixed(4)} all time`} accent={costStats.today.cost > 0.1 ? "amber" : "green"} />
        <StatCard label="Cache Efficiency" value={`${cacheStats.entries}`} detail={`${cacheStats.sizeKB} KB used | ~${savedPct}% hit rate`} accent="green" />
      </div>

      {/* TABS NAVIGATION */}
      <div className="tabs-container">
        <button className={`tab-trigger ${activeTab === "preproduction" ? "active" : ""}`} onClick={() => setActiveTab("preproduction")}>Preproduction</button>
        <button className={`tab-trigger ${activeTab === "write" ? "active" : ""}`} onClick={() => setActiveTab("write")}>Write</button>
        <button className={`tab-trigger ${activeTab === "output" ? "active" : ""}`} onClick={() => setActiveTab("output")}>Output</button>
        <button className={`tab-trigger ${activeTab === "logs" ? "active" : ""}`} onClick={() => setActiveTab("logs")}>Logs</button>
      </div>

      {/* MAIN CONTENT BY TAB */}
      <main>
        {activeTab === "preproduction" && (
          <div className="preproduction-kit">
            {/* SUB NAV */}
            <div className="tabs-container" style={{ borderBottom: "1px solid var(--border-subtle)", marginBottom: "20px" }}>
              {["core", "world", "dossiers", "beats", "inventory", "preflight", "settings"].map(t => (
                <button key={t} className={`tab-trigger ${preTab === t ? "active" : ""}`} onClick={() => setPreTab(t)} style={{ fontSize: "10px" }}>
                  {t.toUpperCase()}
                </button>
              ))}
            </div>

            {/* CORE */}
            {preTab === "core" && (
              <div className="preproduction-section">
                <div className="preproduction-title">01 CORE LOCK</div>
                <div className="grid-2">
                  <div className="field-group">
                    <label className="field-label">Project Title</label>
                    <input className="field-input" value={preproduction.core.title} onChange={e => updatePre("core", "title", e.target.value)} />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Subtitle / Working Name</label>
                    <input className="field-input" value={preproduction.core.subtitle} onChange={e => updatePre("core", "subtitle", e.target.value)} />
                  </div>
                </div>
                <div className="grid-3">
                  <div className="field-group">
                    <label className="field-label">Genre</label>
                    <input className="field-input" value={preproduction.core.genre} onChange={e => updatePre("core", "genre", e.target.value)} />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Target WC</label>
                    <input className="field-input" value={preproduction.core.wc} onChange={e => updatePre("core", "wc", e.target.value)} />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Current WC</label>
                    <input className="field-input" value={preproduction.core.wcCurrent} onChange={e => updatePre("core", "wcCurrent", e.target.value)} />
                  </div>
                </div>
                <div className="field-group">
                  <label className="field-label">The Central Constraint (The "Price")</label>
                  <textarea className="field-textarea" value={preproduction.core.constraint} onChange={e => updatePre("core", "constraint", e.target.value)} />
                </div>
                <div className="grid-2">
                  <div className="field-group">
                    <label className="field-label">The Argument (Theme)</label>
                    <textarea className="field-textarea" value={preproduction.core.theme} onChange={e => updatePre("core", "theme", e.target.value)} />
                  </div>
                  <div className="field-group">
                    <label className="field-label">The False Belief</label>
                    <textarea className="field-textarea" value={preproduction.core.falseBelief} onChange={e => updatePre("core", "falseBelief", e.target.value)} />
                  </div>
                </div>

                <div className="divider" />
                <div className="preproduction-title">VOICE PROFILE</div>
                <div className="grid-4">
                  <div className="field-group">
                    <label className="field-label">Sentence Length</label>
                    <select className="field-select" value={preproduction.voice.length} onChange={e => updatePre("voice", "length", e.target.value)}>
                      <option value="short">Short/Punchy</option>
                      <option value="mixed">Mixed/Fluid</option>
                      <option value="long">Long/Lush</option>
                    </select>
                  </div>
                  <div className="field-group">
                    <label className="field-label">Fragment Tolerance</label>
                    <select className="field-select" value={preproduction.voice.fragments} onChange={e => updatePre("voice", "fragments", e.target.value)}>
                      <option value="low">Low (Formal)</option>
                      <option value="medium">Medium (Modern)</option>
                      <option value="high">High (Stylized)</option>
                    </select>
                  </div>
                  <div className="field-group">
                    <label className="field-label">Metaphor Density</label>
                    <select className="field-select" value={preproduction.voice.metaphor} onChange={e => updatePre("voice", "metaphor", e.target.value)}>
                      <option value="low">Low (Direct)</option>
                      <option value="medium">Medium (Balanced)</option>
                      <option value="high">High (Poetic)</option>
                    </select>
                  </div>
                  <div className="field-group">
                    <label className="field-label">Dialogue Style</label>
                    <select className="field-select" value={preproduction.voice.dialogue} onChange={e => updatePre("voice", "dialogue", e.target.value)}>
                      <option value="tight">Tight/Action-led</option>
                      <option value="natural">Natural/Messy</option>
                      <option value="verbose">Verbose/Literary</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* WORLD */}
            {preTab === "world" && (
              <div className="preproduction-section">
                <div className="preproduction-title">02 WORLD RULES</div>
                <button className="btn btn-ghost btn-sm" onClick={addRule} style={{ marginBottom: "16px" }}>+ Add World Rule</button>
                <div className="rules-list">
                  {preproduction.rules.map(r => (
                    <div key={r.id} className="rule-item" style={{ gridTemplateColumns: "1fr 1fr 1fr 100px auto", alignItems: "center" }}>
                      <div className="field-group">
                        <label className="field-label">Rule</label>
                        <input className="field-input" value={r.rule} onChange={e => updateRule(r.id, "rule", e.target.value)} />
                      </div>
                      <div className="field-group">
                        <label className="field-label">Cost</label>
                        <input className="field-input" value={r.cost} onChange={e => updateRule(r.id, "cost", e.target.value)} />
                      </div>
                      <div className="field-group">
                        <label className="field-label">Limit</label>
                        <input className="field-input" value={r.limit} onChange={e => updateRule(r.id, "limit", e.target.value)} />
                      </div>
                      <div className="field-group">
                        <label className="field-label">Category</label>
                        <select className="field-select" value={r.category} onChange={e => updateRule(r.id, "category", e.target.value)}>
                          <option value="physics">Physics</option>
                          <option value="biology">Biology</option>
                          <option value="social">Social</option>
                          <option value="narrative">Narrative</option>
                        </select>
                      </div>
                      <button className="btn btn-danger btn-icon" onClick={() => deleteRule(r.id)} title="Delete Rule">×</button>
                    </div>
                  ))}
                  {preproduction.rules.length === 0 && <div className="output-placeholder">No world rules defined.</div>}
                </div>
              </div>
            )}

            {/* DOSSIERS */}
            {preTab === "dossiers" && (
              <div className="preproduction-section">
                <div className="preproduction-title">03 CHARACTER DOSSIERS</div>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditingChar({ id: Date.now(), name: "", role: "protagonist", function: "", wound: "", falseBelief: "", trueBelief: "", arc: "", objects: "", constraints: "", notes: "" })} style={{ marginBottom: "16px" }}>+ Add Character</button>
                <div className="grid-3">
                  {preproduction.chars.map(c => (
                    <div key={c.id} className={`char-card ${c.role}`} onClick={() => setEditingChar(c)}>
                      <div className="char-name">{c.name || "Unnamed"}</div>
                      <div className="char-role">{c.role.toUpperCase()}</div>
                      <div className="char-field">
                        <div className="char-field-label">Function</div>
                        <div className="char-field-val">{c.function || "—"}</div>
                      </div>
                    </div>
                  ))}
                </div>
                {preproduction.chars.length === 0 && <div className="output-placeholder">No characters defined.</div>}
              </div>
            )}

            {/* BEATS */}
            {preTab === "beats" && (
              <div className="preproduction-section">
                <div className="preproduction-title">04 ACT BEAT MAP</div>
                <div className="beats-container">
                  {preproduction.beats.map(b => (
                    <div key={b.id} className="beat-row">
                      <div className="beat-pct">{b.pct}</div>
                      <div style={{ flex: 1 }}>
                        <div className="beat-title">{b.title}</div>
                        <div className="beat-desc">{b.desc}</div>
                      </div>
                      <div className="field-group" style={{ width: "100px" }}>
                        <label className="field-label">Target WC</label>
                        <input className="field-input" type="number" value={b.target} onChange={e => updateBeat(b.id, "target", e.target.value)} />
                      </div>
                      <div className="field-group" style={{ width: "100px" }}>
                        <label className="field-label">Actual WC</label>
                        <input className="field-input" type="number" value={b.actual} onChange={e => updateBeat(b.id, "actual", e.target.value)} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* INVENTORY */}
            {preTab === "inventory" && (
              <div className="preproduction-section">
                <div className="preproduction-title">05 SCENE INVENTORY</div>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditingScene({ id: Date.now(), chapter: "", title: "", status: "pending", location: "", time: "", duration: "", wcTarget: "", chars: "", objects: "", causalityType: "revelation", stakes: "", causality: "", output: "", rules: "", notes: "" })} style={{ marginBottom: "16px" }}>+ Add Scene</button>
                <div className="scene-table-wrap">
                  <table className="scene-table">
                    <thead>
                      <tr>
                        <th>CH</th>
                        <th>TITLE</th>
                        <th>LOCATION</th>
                        <th>CHARACTERS</th>
                        <th>CAUSALITY</th>
                        <th>STATUS</th>
                        <th>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preproduction.scenes.map(s => (
                        <tr key={s.id}>
                          <td className="ch-num">{s.chapter}</td>
                          <td><strong>{s.title}</strong></td>
                          <td>{s.location}</td>
                          <td>{s.chars}</td>
                          <td><span className={`causality-badge tag-${s.causalityType}`}>{s.causalityType.toUpperCase()}</span></td>
                          <td><span className={`status-badge tag-${s.status}`}>{s.status.toUpperCase()}</span></td>
                          <td>
                            <button className="btn btn-ghost btn-sm" onClick={() => setEditingScene(s)}>Edit</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {preproduction.scenes.length === 0 && <div className="output-placeholder">No scenes defined.</div>}
              </div>
            )}

            {/* PREFLIGHT */}
            {preTab === "preflight" && (
              <div className="preproduction-section">
                <div className="preproduction-title">06 PREFLIGHT BRIEF</div>
                <div className="field-group">
                  <label className="field-label">Select Scene to Brief</label>
                  <select className="field-select" value={preflightId} onChange={e => setPreflightId(e.target.value)}>
                    <option value="">— Select a scene —</option>
                    {preproduction.scenes.map(s => (
                      <option key={s.id} value={s.id}>Ch.{s.chapter} — {s.title}</option>
                    ))}
                  </select>
                </div>
                {preflightId && (
                  <div className="preflight-doc" style={{ marginTop: "20px" }}>
                    <PreflightBrief scene={preproduction.scenes.find(s => s.id === parseInt(preflightId))} preproduction={preproduction} />
                  </div>
                )}
                {!preflightId && <div className="output-placeholder">Select a scene to generate the preflight brief.</div>}
              </div>
            )}

            {/* SETTINGS */}
            {preTab === "settings" && (
              <div className="preproduction-section">
                <div className="preproduction-title">PIPELINE SETTINGS</div>
                <div className="grid-3">
                  <div className="field-group">
                    <label className="field-label">Ollama Model</label>
                    <input className="field-input" value={preproduction.settings.ollamaModel} onChange={e => updatePre("settings", "ollamaModel", e.target.value)} />
                  </div>
                  <div className="field-group">
                    <label className="field-label">OpenAI Model</label>
                    <select className="field-select" value={preproduction.settings.openaiModel} onChange={e => updatePre("settings", "openaiModel", e.target.value)}>
                      <option value="gpt-4o-mini">gpt-4o-mini</option>
                      <option value="gpt-4o">gpt-4o</option>
                    </select>
                  </div>
                  <div className="field-group" style={{ gridColumn: "1 / -1" }}>
                    <label className="field-label">Banned Words (Comma Separated)</label>
                    <input className="field-input" value={preproduction.voice.banned.join(", ")} onChange={e => updatePre("voice", "banned", e.target.value.split(",").map(w => w.trim()))} />
                  </div>
                </div>
              </div>
            )}
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
                  title={(getModeInfo(m).lockReason || getModeInfo(m).configWarnings[0] || "")}
                  style={{ fontSize: "11px", padding: "8px 12px", opacity: isModeLocked(m) ? 0.4 : 1, cursor: isModeLocked(m) ? "not-allowed" : "pointer" }}
                  disabled={isModeLocked(m)}
                >
                  {m}
                  {isModeLocked(m) && <span style={{ fontSize: "8px", marginLeft: "4px" }}>🔒</span>}
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
            
            {stage && <PipelineTracker currentStage={stage} />}
            
            <div className="content-grid" style={{ gridTemplateColumns: "1fr" }}>
              <div className="panel">
                <div className="panel-header">
                  <span className="panel-title">{activeMode === "CREATE" ? "Active Scene / Paragraph" : `Editorial Review — ${activeMode}`}</span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{wordCount} words</span>
                </div>
                <textarea
                  id="prose-input"
                  className="prose-textarea"
                  placeholder="Paste your paragraph here..."
                  value={text}
                  onChange={e => setText(e.target.value)}
                  style={{ minHeight: "400px" }}
                />
                <div className="actions-bar">
                  <button id="run-btn" className="btn btn-primary" onClick={run} disabled={running || !text.trim() || !activeModeInfo.isConfigReady || activeModeInfo.isLocked}>
                    {running && <span className="spinner" />}
                    {running ? "Running Mode..." : `Start ${activeMode} Mode`}
                  </button>
                  <div style={{ marginLeft: "auto", fontSize: "11px", color: "var(--text-muted)", maxWidth: "300px", textAlign: "right" }}>
                    {activeMode === "CREATE" && "Ollama → Critic → OpenAI"}
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
                    <span className="panel-title">Final Output (Pipeline Attempt {stages.final ? (createModeCritique?.attempts || "Complete") : "—"})</span>
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
                  {stages.final ? (
                    <div className="output-content" style={{ fontSize: "17px", fontStyle: "italic", borderLeft: "4px solid var(--accent-primary)" }}>{stages.final}</div>
                  ) : (
                    <div className="output-placeholder">No output yet. Run the pipeline in the Write tab.</div>
                  )}
                </div>

                <div className="content-grid" style={{ gridTemplateColumns: "1fr" }}>
                  {createModeCritique?.traces?.map((t, idx) => (
                    <div key={idx} className="panel" style={{ borderLeft: `4px solid ${t.critique.verdict === "APPROVE" ? "var(--success)" : "var(--error)"}` }}>
                      <div className="panel-header">
                        <span className="panel-title">Pass {idx + 1} — {t.critique.verdict} ({t.critique.score?.overall}/10)</span>
                        <div style={{ fontSize: "10px", opacity: 0.7 }}>
                          R: {t.critique.score?.rhythm} | S: {t.critique.score?.specificity} | G: {t.critique.score?.physical_grounding}
                        </div>
                      </div>
                      <div className="output-content" style={{ fontSize: "14px", marginBottom: "12px", opacity: 0.9 }}>{t.draft}</div>
                      {t.critique.verdict === "REWRITE" && (
                        <div className="failures-list" style={{ background: "rgba(255,255,255,0.03)", padding: "10px", borderRadius: "4px" }}>
                          <div style={{ fontSize: "10px", fontWeight: "bold", color: "var(--accent-primary)", marginBottom: "4px" }}>REWRITE INSTRUCTIONS:</div>
                          {t.critique.rewrite?.instructions?.map((inst, i) => (
                            <div key={i} style={{ fontSize: "11px", color: "var(--text-secondary)", marginLeft: "8px" }}>• {inst}</div>
                          ))}
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
      {editingScene && <SceneModal scene={editingScene} onSave={saveScene} onClose={() => setEditingScene(null)} onDelete={deleteScene} />}
    </div>
  );
}
ingChar && <CharModal char={editingChar} onSave={saveChar} onClose={() => setEditingChar(null)} onDelete={deleteChar} />}
      {editingScene && <SceneModal scene={editingScene} onSave={saveScene} onClose={() => setEditingScene(null)} onDelete={deleteScene} />}
    </div>
  );
}
l)} onDelete={deleteScene} />}
    </div>
  );
}
