export const CRITIC_VERDICTS = {
  APPROVE: "APPROVE",
  REWRITE: "REWRITE",
};

export const FAILURE_TYPES = {
  GENERIC_LANGUAGE: "GENERIC_LANGUAGE",
  LOW_SPECIFICITY: "LOW_SPECIFICITY",
  WEAK_RHYTHM: "WEAK_RHYTHM",
  ABSTRACT_EMOTION: "ABSTRACT_EMOTION",
  OVEREXPLAINING: "OVEREXPLAINING",
  FLAT_TONE: "FLAT_TONE",
};

export const DEFAULT_CRITIC_RESULT = {
  verdict: CRITIC_VERDICTS.REWRITE,
  confidence: "low",
  score: {
    rhythm: 0,
    specificity: 0,
    emotional_concreteness: 0,
    overall: 0,
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
