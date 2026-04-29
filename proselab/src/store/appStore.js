import { saveProject, loadProject, getTokenLog, saveTokenLog } from "../services/storage.js";
import { initialPreproduction } from "../domains/preproduction/preproduction.store.js";

let state = {
  project: { ...initialPreproduction, ...loadProject() },
  shadowActions: [], // Actions proposed by agents but not yet applied
  compositionMetrics: [], // Tracking interaction stability
};

let listeners = [];

export function subscribe(fn) {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter(l => l !== fn);
  };
}

function notify() {
  listeners.forEach(fn => fn(state));
}

export function getState() {
  return state;
}

export function updateState(fn) {
  fn(state.project);
  saveProject(state.project);
  notify();
  return state.project;
}

export function updateProject(patch) {
  state.project = { ...state.project, ...patch };
  saveProject(state.project);
  notify();
  return state.project;
}

export function updateProjectDeep(section, patch) {
  state.project[section] = { ...state.project[section], ...patch };
  saveProject(state.project);
  notify();
  return state.project;
}

export function logTokenUsage(provider, inputTokens, outputTokens) {
  const log = getTokenLog();
  log.push({ provider, inputTokens, outputTokens, timestamp: Date.now() });
  saveTokenLog(log);
}

export function logShadowAction(action) {
  state.shadowActions.push({
    id: Date.now().toString(),
    timestamp: Date.now(),
    ...action
  });
  notify();
}

export function removeShadowAction(id, resolution = 'dismissed', reason = 'n/a', expectedViolation = null, detected = true, missReason = null, isDegradation = false, ephemeralMisclass = false, criticAccuracy = 'correct', degradationReason = null, classification = 'violation', missingSignals = []) {
  const action = state.shadowActions.find(a => a.id === id);
  if (action) {
    const metric = {
      id,
      agent: action.meta?.agent || 'unknown',
      res: resolution.toUpperCase(),
      reason,
      expected: expectedViolation,
      detected,
      miss_reason: missReason,
      is_degradation: isDegradation,
      degradation_reason: degradationReason,
      ephemeral_misclassification: ephemeralMisclass,
      critic_accuracy: criticAccuracy,
      classification, // violation | non_violation | ambiguous
      missing_signals: missingSignals,
      timestamp: Date.now()
    };
    console.log(`📊 COMPOSITION METRIC:`, metric);
    state.compositionMetrics.push(metric);
    state.shadowActions = state.shadowActions.filter(a => a.id !== id);
    notify();
  }
}

export function generateValidationReport() {
  const metrics = state.compositionMetrics;
  const loopMetrics = state.loopMetrics || [];
  if (metrics.length === 0 && loopMetrics.length === 0) return null;

  const summary = {
    phrasing_robustness: {
      tested: metrics.filter(m => m.classification === 'violation').length,
      detected: metrics.filter(m => m.critic_accuracy === 'correct').length,
      missed: metrics.filter(m => m.critic_accuracy === 'miss').length,
      robustness_rate: 0
    },
    loop_stability: {
      total_iterations: loopMetrics.length,
      escape_to_miss_rate: 0,
      unflagged_and_missed: loopMetrics.filter(l => l.escape_leading_to_miss && !l.high_risk_flagged).length,
      convergence_rate: 0,
      false_positive_rate: 0,
      quality_degradation_rate: 0,
      adaptation_instances: loopMetrics.filter(l => l.generator_adaptation).length
    },
    failure_mechanisms: {
      total_misses: metrics.filter(m => m.critic_accuracy === 'miss').length,
      breakdown: {},
      dominant: "n/a"
    }
  };

  const robustTested = summary.phrasing_robustness.tested;
  summary.phrasing_robustness.robustness_rate = robustTested > 0 ? ((summary.phrasing_robustness.detected / robustTested) * 100).toFixed(1) : 0;
  
  const totalEscapes = summary.loop_stability.adaptations?.total || 0;
  summary.loop_stability.escape_to_miss_rate = totalEscapes > 0 ? ((summary.loop_stability.adaptations.escape_leading_to_miss / totalEscapes) * 100).toFixed(1) : 0;

  const totalLoops = loopMetrics.length;
  if (totalLoops > 0) {
    const converged = loopMetrics.filter(l => l.converged).length;
    summary.loop_stability.convergence_rate = ((converged / totalLoops) * 100).toFixed(1);
    
    const falsePositives = loopMetrics.filter(l => l.false_positive).length;
    summary.loop_stability.false_positive_rate = ((falsePositives / totalLoops) * 100).toFixed(1);
    
    const degradation = loopMetrics.filter(l => l.quality_degradation).length;
    summary.loop_stability.quality_degradation_rate = ((degradation / totalLoops) * 100).toFixed(1);
  }

  return summary;
}

export function logLoopIteration(metric) {
  if (!state.loopMetrics) state.loopMetrics = [];
  state.loopMetrics.push({
    ...metric,
    timestamp: Date.now()
  });
  notify();
}
