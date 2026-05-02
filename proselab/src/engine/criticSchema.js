export const CRITIC_VERDICTS = {
  APPROVE: "APPROVE",
  REWRITE: "REWRITE",
};

export const INTENT_VERDICTS = {
  PASS: "PASS",
  FAIL: "FAIL",
};

export const FAILURE_TYPES = {
  GENERIC_LANGUAGE: "GENERIC_LANGUAGE",
  LOW_SPECIFICITY: "LOW_SPECIFICITY",
  WEAK_RHYTHM: "WEAK_RHYTHM",
  ABSTRACT_EMOTION: "ABSTRACT_EMOTION",
  OVEREXPLAINING: "OVEREXPLAINING",
  FLAT_TONE: "FLAT_TONE",
  RESTATEMENT: "RESTATEMENT",
};

export const DEFAULT_CRITIC_RESULT = {
  verdict: CRITIC_VERDICTS.REWRITE,
  confidence: "low",
  score: {
    rhythm: 0,
    specificity: 0,
    physical_grounding: 0,
    overall: 0,
  },
  intent_alignment: 0,
  intent_verdict: INTENT_VERDICTS.FAIL,
  intent_failures: [],
  minimal_fix: {
    instruction: "State the scene outcome more concretely and remove ornamental prose.",
  },
  failures: [],
  rewrite_directive: "Rewrite with stronger specificity, concrete detail, and varied sentence rhythm.",
  rewrite: {
    instructions: [
      "Replace abstract emotion with physical reaction.",
      "Add one specific sensory detail.",
      "Increase sentence rhythm variation.",
    ],
  },
  meta: {
    valid: false,
    reason: "UNPARSEABLE",
  },
};
