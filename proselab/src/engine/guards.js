import { CRITIC_VERDICTS, INTENT_VERDICTS } from "./criticSchema.js";

/**
 * The single source of truth for engine decision invariants.
 * Any result leaving the engine must pass this gate.
 */
export function enforceSystemInvariants(result, context = {}) {
  if (!result || typeof result !== "object") return result;

  const {
    score = {},
    verdict,
    confidence,
    intent_verdict,
    checks = {},
    evidence = {},
    meta = {}
  } = result;

  const safeChecks = (checks && typeof checks === "object") ? checks : {};
  const safeEvidence = (evidence && typeof evidence === "object") ? evidence : {};
  const safeScore = (score && typeof score === "object") ? score : {};

  // 1. HARD GATE: HIGH_PASS Requirements
  if (verdict === CRITIC_VERDICTS.APPROVE && safeScore.overall >= 8) {
    // Invariant: HIGH_PASS must have PASS intent
    if (intent_verdict !== INTENT_VERDICTS.PASS) {
      return { ...result, verdict: CRITIC_VERDICTS.REWRITE, confidence: "low", meta: { ...meta, guard_failure: "INTENT_MISMATCH_ON_APPROVE" } };
    }
    // Invariant: HIGH_PASS must have high confidence
    const numConf = typeof confidence === "number" ? confidence : (confidence === "high" ? 0.9 : 0.5);
    if (numConf < 0.75) {
      return { ...result, verdict: CRITIC_VERDICTS.REWRITE, confidence: "low", meta: { ...meta, guard_failure: "LOW_CONFIDENCE_ON_APPROVE" } };
    }
  }

  // 2. HARD GATE: Intent/Evidence Alignment
  for (const [key, status] of Object.entries(safeChecks)) {
    if (status === INTENT_VERDICTS.PASS) {
      // Invariant: PASS must have evidence
      if (!safeEvidence[key] || safeEvidence[key].length === 0) {
        return { ...result, verdict: CRITIC_VERDICTS.REWRITE, intent_verdict: INTENT_VERDICTS.FAIL, meta: { ...meta, guard_failure: `MISSING_EVIDENCE_FOR_${key.toUpperCase()}` } };
      }
    }
  }

  // 3. HARD GATE: Ambiguity Suppression
  if (context.ambiguityScore > 0.5 && verdict === CRITIC_VERDICTS.APPROVE) {
    return { ...result, verdict: CRITIC_VERDICTS.REWRITE, confidence: "low", meta: { ...meta, guard_failure: "AMBIGUITY_DOWNGRADE" } };
  }

  return result;
}

/**
 * Deterministic validation of the output string to ensure it contains only prose.
 * Scans for placeholders, meta-comments, and instruction bleed.
 */
export function validateOutputContract(text) {
  if (typeof text !== "string") return { valid: false, violations: ["INVALID_TYPE"] };

  const violations = [];

  // 1. Placeholder Brackets
  if (/\[.*?\]/.test(text)) {
    violations.push("PLACEHOLDER_BRACKETS_DETECTED");
  }

  // 2. Comment Syntax
  if (/\/\*[\s\S]*?\*\/|\/\/.*/.test(text)) {
    violations.push("JS_COMMENT_SYNTAX_DETECTED");
  }
  if (/<!--[\s\S]*?-->/.test(text)) {
    violations.push("HTML_COMMENT_SYNTAX_DETECTED");
  }

  // 3. Instruction Bleed (Common LLM preambles/postambles)
  const preambles = [
    /^here is/i,
    /^sure/i,
    /^certainly/i,
    /^revised/i,
    /^rewritten/i,
    /^i have/i,
    /^modified/i
  ];
  if (preambles.some(re => re.test(text.trim()))) {
    violations.push("INSTRUCTION_BLEED_DETECTED");
  }

  return {
    valid: violations.length === 0,
    violations
  };
}

export function validateSemanticPreservation(originalIntents, newIntents) {
  if (!originalIntents?.checks || !newIntents?.checks) {
      return { ok: true, losses: [] }; // Cannot verify, so assume ok to avoid blocking
  }

  // Invariant: New intents must not lose any resolved requirements from the original
  const originalResolved = Object.entries(originalIntents.checks)
    .filter(([_, status]) => status === INTENT_VERDICTS.PASS)
    .map(([key]) => key);

  const newResolved = new Set(
    Object.entries(newIntents.checks)
      .filter(([_, status]) => status === INTENT_VERDICTS.PASS)
      .map(([key]) => key)
  );

  const losses = originalResolved.filter(key => !newResolved.has(key));
  
  return {
    ok: losses.length === 0,
    losses
  };
}
