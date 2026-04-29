/**
 * ACTION NORMALIZER
 * Role: Convert raw scene descriptions into structured intent categories.
 * Goal: Stabilize semantic detection beyond prompt-only inference.
 */

const SIGNAL_MAP = {
  proximity_escalation: {
    high: ["within striking range", "razor's edge", "knife's edge", "closed the gap", "within an arm's reach", "inches away", "pressed against"],
    medium: ["distance narrowed", "steps closer", "within reach", "closing in", "moves toward"],
    low: ["closes in", "approaches", "watches from the threshold"]
  },
  target_lock: [
    "measures the distance", "eyes the exit", "target focus", "locks gaze", "fixed on his target", "tracking her movement", "unblinking stare", "never broke eye contact"
  ],
  threshold_tension: [
    "razor's edge", "breaking point", "knife's edge", "strained silence", "air grew thick", "static in the room", "pressure built"
  ],
  de_escalation: [
    "steps back", "retreats", "lowers his hands", "turns away", "exhales slowly", "breaks the gaze"
  ]
};

/**
 * Extracts weighted conceptual signals.
 */
export function extractWeightedSignals(text) {
  const normalizedText = text.toLowerCase();
  const signals = {
    proximity: 0,
    lock: 0,
    tension: 0,
    de_escalation: 0
  };
  
  // Proximity weighting
  if (SIGNAL_MAP.proximity_escalation.high.some(p => normalizedText.includes(p))) signals.proximity = 3;
  else if (SIGNAL_MAP.proximity_escalation.medium.some(p => normalizedText.includes(p))) signals.proximity = 2;
  else if (SIGNAL_MAP.proximity_escalation.low.some(p => normalizedText.includes(p))) signals.proximity = 1;

  // Target lock weighting
  if (SIGNAL_MAP.target_lock.some(p => normalizedText.includes(p))) signals.lock = 2;

  // Threshold tension
  if (SIGNAL_MAP.threshold_tension.some(p => normalizedText.includes(p))) signals.tension = 2;

  // De-escalation (Negative signal)
  if (SIGNAL_MAP.de_escalation.some(p => normalizedText.includes(p))) signals.de_escalation = 3;

  return signals;
}

/**
 * Calculates intent confidence based on signal composition.
 */
export function calculateIntentConfidence(signals) {
  // Score = Proximity + Lock + Tension - De-escalation
  const score = (signals.proximity + signals.lock + signals.tension) - signals.de_escalation;
  
  if (score >= 4) return { intent: "prepare_violence", confidence: "high" };
  if (score >= 2) return { intent: "prepare_violence", confidence: "medium" };
  return { intent: "none", confidence: "low" };
}

/**
 * Normalizes a scene description with Signal Composition.
 */
export function normalizeIntents(text) {
  const weightedSignals = extractWeightedSignals(text);
  const composition = calculateIntentConfidence(weightedSignals);
  
  return {
    intents: composition.intent !== "none" ? [composition.intent] : [],
    confidence: composition.confidence,
    signals: weightedSignals
  };
}

/**
 * Validates intents against character constraints.
 */
export function validateConstraints(intents, constraints = []) {
  const violations = [];
  
  if (constraints.includes("pacifist")) {
    const violentIntents = ["prepare_violence", "threaten_violence", "initiate_violence"];
    const foundViolent = intents.filter(i => violentIntents.includes(i));
    if (foundViolent.length > 0) {
      violations.push(`Pacifist violation: found ${foundViolent.join(", ")}`);
    }
  }
  
  return violations;
}

/**
 * Detects patterns that imply intent without direct mapping.
 * Role: Flag 'Taxonomy Escapes' or high-risk ambiguity.
 */
export function detectSuspiciousPatterns(text) {
  const normalizedText = text.toLowerCase();
  
  // Pattern: Physical posture or emotional hardening suggesting readiness
  const highRiskKeywords = [
    "posture sharpens", "focus hardens", "eyes narrow", "muscles tense",
    "room narrows", "measures the exit", "shadows lengthen", "breath hitches"
  ];
  
  const found = highRiskKeywords.filter(kw => normalizedText.includes(kw));
  return found.length > 0 ? "ambiguous_high_risk" : null;
}
