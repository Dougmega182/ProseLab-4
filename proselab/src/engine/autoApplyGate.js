/**
 * AUTO-APPLY GATE
 *
 * Single authoritative decision function for whether output can be
 * applied without human review. Separated from the critic because
 * "approved by critic" and "safe to auto-apply" are different questions.
 *
 * All orchestration paths that auto-apply MUST route through this.
 * No exceptions. No bypasses. No inline reimplementations.
 */

// ═══════════════════════════════════════════════════════════
// GATE TELEMETRY
// Records every decision with all condition values.
// Without this, you cannot tell which condition is useful.
// ═══════════════════════════════════════════════════════════

const GATE_LOG_KEY = "proselab_gate_telemetry";
const GATE_LOG_MAX = 500;

export function logGateDecision(conditionValues, decision, context = {}) {
  const entry = {
    timestamp: Date.now(),
    conditions: conditionValues,
    decision,
    context,
  };

  try {
    const raw = localStorage.getItem(GATE_LOG_KEY);
    const log = raw ? JSON.parse(raw) : [];
    log.push(entry);
    if (log.length > GATE_LOG_MAX) log.splice(0, log.length - GATE_LOG_MAX);
    localStorage.setItem(GATE_LOG_KEY, JSON.stringify(log));
  } catch {
    // Storage full or unavailable — don't break the gate.
  }

  return entry;
}

export function getGateTelemetry() {
  try {
    const raw = localStorage.getItem(GATE_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearGateTelemetry() {
  localStorage.removeItem(GATE_LOG_KEY);
}

// ═══════════════════════════════════════════════════════════
// FAILURE COST CATEGORIES — Concrete, not interpretive.
// HIGH = story-breaking. Requires undoing downstream work.
// LOW  = quality degradation without structural damage.
// ═══════════════════════════════════════════════════════════

export const FAILURE_COST = {
  // HIGH: structural damage to story logic
  ROLE_INVERSION: "ROLE_INVERSION",
  CAUSALITY_BREAK: "CAUSALITY_BREAK",
  ACTION_IMPOSSIBILITY: "ACTION_IMPOSSIBILITY",
  MISSING_REQUIRED_EVENT: "MISSING_REQUIRED_EVENT",
  ENTITY_HALLUCINATION: "ENTITY_HALLUCINATION",
  // LOW: quality degradation, non-destructive
  TONE_MISMATCH: "TONE_MISMATCH",
  MINOR_AMBIGUITY: "MINOR_AMBIGUITY",
  STYLISTIC_VARIANCE: "STYLISTIC_VARIANCE",
};

const HIGH_COST = new Set([
  FAILURE_COST.ROLE_INVERSION,
  FAILURE_COST.CAUSALITY_BREAK,
  FAILURE_COST.ACTION_IMPOSSIBILITY,
  FAILURE_COST.MISSING_REQUIRED_EVENT,
  FAILURE_COST.ENTITY_HALLUCINATION,
]);

// Strings in intent_failures that indicate structural damage
const HIGH_COST_KEYWORDS = [
  "causality", "impossible", "hallucinated", "missing required",
  "role violation", "constraint violation", "not satisfied",
  "entity mismatch", "action impossibility",
];

/**
 * Classifies the highest failure cost present.
 * Returns "HIGH" or "LOW". Not "MEDIUM". No grey zone.
 */
export function classifyFailureCost(failures = [], intentFailures = []) {
  for (const f of failures) {
    const type = typeof f === "string" ? f : f?.type;
    if (type && HIGH_COST.has(type)) return "HIGH";
  }
  for (const f of intentFailures) {
    if (typeof f !== "string") continue;
    const lower = f.toLowerCase();
    if (HIGH_COST_KEYWORDS.some(kw => lower.includes(kw))) return "HIGH";
  }
  return "LOW";
}

/**
 * Normalizes confidence to a number between 0 and 1.
 * Handles both string ("high"/"low") and numeric formats.
 */
function normalizeConfidence(confidence) {
  if (typeof confidence === "number") {
    return Math.max(0, Math.min(1, confidence));
  }
  if (confidence === "high") return 0.9;
  if (confidence === "medium") return 0.6;
  if (confidence === "low") return 0.3;
  return 0;
}

// ═══════════════════════════════════════════════════════════
// LOCKED THRESHOLDS
// Change ONLY with documented justification in this file.
// ═══════════════════════════════════════════════════════════
const THRESHOLDS = {
  INTENT_ALIGNMENT_MIN: 0.7,
  CONFIDENCE_MIN: 0.0, // Decoupled: now telemetry only.
  PHASE_SCORE_MIN: 6,
  OVERALL_SCORE_MIN: 6,
};

/**
 * Determines if a critique result is safe to auto-apply.
 *
 * Accepts both pipeline-level shape (verdict/score/checks) and
 * agent-level shape (confidence/phase_scores/intent_alignment).
 *
 * @param {Object} critique - Critic output or agent action meta.
 * @returns {{ ok: boolean, reason: string|null, cost_tier: string|null }}
 */
export function shouldAutoApply(critique, context = {}) {
  if (!critique) {
    const decision = {
      ok: false, reason: "No critique provided", cost_tier: null,
    };
    logGateDecision({}, decision, context);
    return decision;
  }

  const {
    confidence = 0,
    risk_flags = [],
    phase_scores = {},
    intent_alignment = 0,
    intent_verdict,
    score = {},
    failures = [],
    intent_failures = [],
    verdict,
    checks = {},
  } = critique || {};

  const safeChecks = (checks && typeof checks === "object") ? checks : {};
  const safeScore = (score && typeof score === "object") ? score : {};
  const safePhaseScores = (phase_scores && typeof phase_scores === "object") ? phase_scores : {};
  const safeFailures = Array.isArray(failures) ? failures : [];
  const safeIntentFailures = Array.isArray(intent_failures) ? intent_failures : [];
  const safeRiskFlags = Array.isArray(risk_flags) ? risk_flags : [];

  // Collect all condition values once for telemetry.
  const numConf = normalizeConfidence(confidence);
  const checkEntries = Object.entries(safeChecks);
  const failedChecks = checkEntries
    .filter(([, s]) => s !== "PASS")
    .map(([k]) => k);
  const phases = Object.values(safePhaseScores);
  const minPhase = phases.length > 0 ? Math.min(...phases) : null;
  const costTier = classifyFailureCost(safeFailures, safeIntentFailures);

  const conditionValues = {
    verdict: verdict || "N/A",
    intent_verdict: intent_verdict || "N/A",
    intent_alignment,
    confidence: numConf,
    confidence_raw: confidence,
    risk_flags_count: safeRiskFlags.length,
    phase_scores_min: minPhase,
    overall_score: safeScore.overall ?? null,
    failed_checks: failedChecks,
    failure_cost: costTier,
  };

  // Helper: log and return in one step.
  function reject(reason, cost, conditionKey = null) {
    const decision = {
      ok: false,
      reason,
      cost_tier: cost,
      failed_condition: conditionKey,
    };
    logGateDecision(conditionValues, decision, context);
    return decision;
  }

  // 0. Verdict must be APPROVE
  if (verdict && verdict !== "APPROVE") {
    return reject(`Verdict is ${verdict}, not APPROVE`, null, "VERDICT_NOT_APPROVE");
  }

  // 1. Intent must pass
  if (intent_verdict && intent_verdict !== "PASS") {
    return reject(`Intent verdict: ${intent_verdict}`, "HIGH", "INTENT_VERDICT_FAIL");
  }

  // 2. All intent checks must pass
  if (failedChecks.length > 0) {
    return reject(`Failed checks: ${failedChecks.join(", ")}`, "HIGH", "INTENT_CHECK_FAIL");
  }

  // 3. Intent alignment threshold
  if (intent_alignment < THRESHOLDS.INTENT_ALIGNMENT_MIN) {
    return reject(
      `Intent alignment ${intent_alignment} < ${THRESHOLDS.INTENT_ALIGNMENT_MIN}`,
      "HIGH",
      "INTENT_ALIGNMENT_LOW",
    );
  }

  // 4. Confidence Threshold
  if (numConf < 0.75) {
    return reject(`Confidence ${numConf} < 0.75`, "LOW", "LOW_CONFIDENCE");
  }

  // 5. Risk flags
  if (safeRiskFlags.length > 0) {
    return reject(`Risk flags: ${safeRiskFlags.join(", ")}`, "HIGH", "RISK_FLAGS_PRESENT");
  }

  // 6. Phase score check (agent-level)
  if (minPhase !== null && minPhase < THRESHOLDS.PHASE_SCORE_MIN) {
    return reject(
      `Phase score below ${THRESHOLDS.PHASE_SCORE_MIN}`,
      "LOW",
      "PHASE_SCORE_LOW",
    );
  }

  // 7. Overall score floor (pipeline-level)
  if (typeof safeScore.overall === "number"
      && safeScore.overall < THRESHOLDS.OVERALL_SCORE_MIN) {
    return reject(
      `Overall score ${safeScore.overall} < ${THRESHOLDS.OVERALL_SCORE_MIN}`,
      "LOW",
      "OVERALL_SCORE_LOW",
    );
  }

  // 8. Failure cost classification
  if (costTier === "HIGH") {
    return reject("High-cost failures detected", "HIGH", "HIGH_COST_FAILURE");
  }

  const decision = {
    ok: true,
    reason: null,
    cost_tier: "LOW",
    failed_condition: null,
  };
  logGateDecision(conditionValues, decision, context);
  return decision;
}

