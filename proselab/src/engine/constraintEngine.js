// E:\Ai\ProseLabV2\proselab\src\engine\constraintEngine.js
import { runHeuristics } from './heuristics.js';

// Layer 1: Canonical Baseline (Global Truth)
// These define what counts as acceptable prose at all.
// Also establishes the Constraint Authority Hierarchy (type + priority).
const BASE_CONSTRAINTS = {
  rhythmVarianceMin: { value: 4.0, type: "STRUCTURAL", priority: 8 },
  clicheMaxHits: { value: 2, type: "STYLISTIC", priority: 6 },
  physicalRatioMin: { value: 0.60, type: "STRUCTURAL", priority: 10 },
  dialogueSymmetryMax: { value: 0.80, type: "LOCAL", priority: 3 }
};

// Layer 2: Scene Modifiers (Controlled Elasticity)
// Derived from scene intent categories, applied as multipliers.
const SCENE_MODIFIERS = {
  action: {
    rhythmVarianceMin: 1.3,
    clicheMaxHits: 1.0,
    physicalRatioMin: 1.2,
    dialogueSymmetryMax: 0.8
  },
  dialogue: {
    rhythmVarianceMin: 1.1,
    clicheMaxHits: 1.0,
    physicalRatioMin: 0.9,
    dialogueSymmetryMax: 1.1
  },
  introspection: {
    rhythmVarianceMin: 0.85,
    clicheMaxHits: 1.0,
    physicalRatioMin: 1.1,
    dialogueSymmetryMax: 1.0
  },
  default: {
    rhythmVarianceMin: 1.0,
    clicheMaxHits: 1.0,
    physicalRatioMin: 1.0,
    dialogueSymmetryMax: 1.0
  }
};

/**
 * Derives the Layer 3 Effective Constraints for a given scene intent.
 */
export function getEffectiveConstraints(sceneIntent) {
  const intentType = determineIntentType(sceneIntent);
  const mods = SCENE_MODIFIERS[intentType] || SCENE_MODIFIERS.default;

  return {
    rhythmVarianceMin: {
      ...BASE_CONSTRAINTS.rhythmVarianceMin,
      value: parseFloat((BASE_CONSTRAINTS.rhythmVarianceMin.value * mods.rhythmVarianceMin).toFixed(2))
    },
    clicheMaxHits: {
      ...BASE_CONSTRAINTS.clicheMaxHits,
      value: Math.floor(BASE_CONSTRAINTS.clicheMaxHits.value * mods.clicheMaxHits)
    },
    physicalRatioMin: {
      ...BASE_CONSTRAINTS.physicalRatioMin,
      value: parseFloat((BASE_CONSTRAINTS.physicalRatioMin.value * mods.physicalRatioMin).toFixed(2))
    },
    dialogueSymmetryMax: {
      ...BASE_CONSTRAINTS.dialogueSymmetryMax,
      value: parseFloat((BASE_CONSTRAINTS.dialogueSymmetryMax.value * mods.dialogueSymmetryMax).toFixed(2))
    }
  };
}

/**
 * Basic categorization of scene intent for modifier selection.
 */
function determineIntentType(sceneIntent) {
  const obj = (sceneIntent?.objective || '').toLowerCase();
  if (obj.includes('escape') || obj.includes('fight') || obj.includes('chase') || obj.includes('survive')) {
    return 'action';
  }
  if (obj.includes('convince') || obj.includes('argue') || obj.includes('negotiate') || obj.includes('interrogate')) {
    return 'dialogue';
  }
  if (obj.includes('realize') || obj.includes('reflect') || obj.includes('mourn') || obj.includes('decide')) {
    return 'introspection';
  }
  return 'default';
}

/**
 * Calculates severity based on deviation magnitude.
 */
function getSeverity(actual, target, isMaxRule) {
  let deviationRatio;
  if (isMaxRule) {
    deviationRatio = target === 0 ? actual : (actual - target) / target;
  } else {
    deviationRatio = target === 0 ? 0 : (target - actual) / target;
  }

  if (deviationRatio >= 0.5) return "HIGH";
  if (deviationRatio >= 0.2) return "MEDIUM";
  return "LOW";
}

/**
 * Runs the heuristics and compares them against the effective constraints.
 * Outputs a strict structured diagnostic object. No English instructions.
 */
export function evaluateConstraints(prose, sceneIntent) {
  const effective = getEffectiveConstraints(sceneIntent);
  const metrics = runHeuristics(prose); // from heuristics.js
  
  const failures = [];
  let passed = true;

  // 1. Rhythm Check
  if (metrics.rhythm.stdDev < effective.rhythmVarianceMin.value) {
    passed = false;
    failures.push({
      name: "rhythm",
      variance: metrics.rhythm.stdDev,
      minRequired: effective.rhythmVarianceMin.value,
      status: "FAIL",
      severity: getSeverity(metrics.rhythm.stdDev, effective.rhythmVarianceMin.value, false),
      type: effective.rhythmVarianceMin.type,
      priority: effective.rhythmVarianceMin.priority,
      delta: Math.abs(metrics.rhythm.stdDev - effective.rhythmVarianceMin.value)
    });
  }

  // 2. Cliché Check
  if (metrics.cliches.hits > effective.clicheMaxHits.value) {
    passed = false;
    failures.push({
      name: "cliches",
      hits: metrics.cliches.hits,
      maxAllowed: effective.clicheMaxHits.value,
      status: "FAIL",
      severity: getSeverity(metrics.cliches.hits, effective.clicheMaxHits.value, true),
      type: effective.clicheMaxHits.type,
      priority: effective.clicheMaxHits.priority,
      delta: Math.abs(metrics.cliches.hits - effective.clicheMaxHits.value)
    });
  }

  // 3. Physical vs Abstract Ratio Check
  if (metrics.emotion.physicalRatio < effective.physicalRatioMin.value) {
    passed = false;
    failures.push({
      name: "emotion",
      physicalRatio: metrics.emotion.physicalRatio,
      minRequired: effective.physicalRatioMin.value,
      status: "FAIL",
      severity: getSeverity(metrics.emotion.physicalRatio, effective.physicalRatioMin.value, false),
      type: effective.physicalRatioMin.type,
      priority: effective.physicalRatioMin.priority,
      delta: Math.abs(metrics.emotion.physicalRatio - effective.physicalRatioMin.value)
    });
  }

  // 4. Dialogue Symmetry (Frictionless ping-pong)
  if (metrics.dialogue.symmetryScore > effective.dialogueSymmetryMax.value) {
    passed = false;
    failures.push({
      name: "dialogue_symmetry",
      symmetryScore: metrics.dialogue.symmetryScore,
      maxAllowed: effective.dialogueSymmetryMax.value,
      status: "FAIL",
      severity: getSeverity(metrics.dialogue.symmetryScore, effective.dialogueSymmetryMax.value, true),
      type: effective.dialogueSymmetryMax.type,
      priority: effective.dialogueSymmetryMax.priority,
      delta: Math.abs(metrics.dialogue.symmetryScore - effective.dialogueSymmetryMax.value)
    });
  }

  // Calculate composite score for sorting: priority * severity weight
  const severityWeight = { "HIGH": 3, "MEDIUM": 2, "LOW": 1 };
  
  const sortedFailures = [...failures].sort((a, b) => {
    const scoreA = a.priority * severityWeight[a.severity];
    const scoreB = b.priority * severityWeight[b.severity];
    return scoreB - scoreA; // Descending
  });

  // Keep top 2 failures maximum to avoid constraint stacking
  const topFailures = sortedFailures.slice(0, 2);

  return {
    passed,
    effectiveConstraints: effective,
    metrics,
    failures,
    actionableFailures: topFailures
  };
}

/**
 * Stateful tracker instantiated per generation loop.
 * Detects incompatible constraint topologies (oscillation) over a rolling window.
 */
export class ConstraintTracker {
  constructor() {
    this.history = []; // Array of iteration snapshots
  }

  /**
   * Evaluates prose and tracks the result across attempts.
   */
  trackAndEvaluate(prose, sceneIntent) {
    const result = evaluateConstraints(prose, sceneIntent);
    
    // Calculate composite severity score for the actionable failures to measure the trend
    const severityWeight = { "HIGH": 3, "MEDIUM": 2, "LOW": 1 };
    let currentSeverityScore = 0;
    result.actionableFailures.forEach(f => {
      currentSeverityScore += severityWeight[f.severity];
    });
    
    this.history.push({
      attempt: this.history.length + 1,
      failures: result.actionableFailures.map(f => f.name),
      severityScore: currentSeverityScore
    });

    result.exhaustionState = this.checkExhaustion();
    return result;
  }

  /**
   * Analyzes the history window for Intractable states.
   * Window size N = 4.
   */
  checkExhaustion() {
    if (this.history.length < 4) {
      return { status: "NORMAL" };
    }

    // Rolling window of the last 4 attempts
    const window = this.history.slice(-4);
    
    // 1. Detect Alternating Cluster
    // Collect all constraint names that fired in this window
    const allNamesInWindow = window.flatMap(h => h.failures);
    const uniqueNames = new Set(allNamesInWindow);
    
    // If we've seen multiple failures but they are entirely composed of the same 2-3 constraints
    // over 4 iterations, we are locked in an oscillation topology.
    const isAlternatingCluster = uniqueNames.size <= 3 && allNamesInWindow.length >= 4;

    // 2. Detect Severity Trend
    // If the severity score of the latest attempt is NOT lower than the start of the window,
    // the system is failing to converge.
    const startScore = window[0].severityScore;
    const currentScore = window[3].severityScore;
    const noImprovement = currentScore >= startScore;

    if (isAlternatingCluster && noImprovement) {
      return {
        status: "INTRACTABLE",
        reason: "Oscillation detected: no severity improvement across 4-step rolling window.",
        conflictingSet: Array.from(uniqueNames)
      };
    }

    return { 
      status: "DEGRADED",
      reason: "System is struggling to satisfy constraints but still showing minor trend improvement."
    };
  }
}

