// @ts-nocheck
export function arbitrate(sceneIntent, structuralCritique, frictionResult) {
  // 1. Scene Intent Parsing (Placeholder for determining scene weight)
  // Action/Suspense scenes might tolerate higher predictability if momentum requires it, 
  // but generally, we want to enforce high friction across the board for now.
  const isAction = sceneIntent?.objective?.toLowerCase().includes("escape") || sceneIntent?.objective?.toLowerCase().includes("fight");
  
  // Baseline thresholds
  let predictabilityThreshold = 6;
  let coherenceThreshold = 5;
  
  if (isAction) {
    predictabilityThreshold = 7; // Slightly more tolerant of structural predictability in high action
  }

  const failures = [];
  let verdict = "APPROVE";
  let delta = [];

  // 2. Friction Veto (High Priority)
  // If prose is too predictable, we veto regardless of structural score.
  if (frictionResult.scores.predictability > predictabilityThreshold) {
    verdict = "REWRITE";
    failures.push({ type: "FRICTION_PREDICTABILITY", reason: `Predictability score (${frictionResult.scores.predictability}) exceeded threshold (${predictabilityThreshold}). Prose is too statistically safe.` });
  }

  // If prose is incoherent, we veto (Bad friction)
  if (frictionResult.scores.structuralCoherence < coherenceThreshold) {
    verdict = "REWRITE";
    failures.push({ type: "FRICTION_INCOHERENCE", reason: `Structural Coherence (${frictionResult.scores.structuralCoherence}) fell below threshold (${coherenceThreshold}). The prose became unintelligible noise.` });
  }

  if (frictionResult.overallVerdict === "FAIL") {
    verdict = "REWRITE";
    if (frictionResult.frictionViolations) {
      frictionResult.frictionViolations.forEach(v => {
        failures.push({ type: "FRICTION_VIOLATION", reason: v });
      });
    }
  }

  // 3. Structural Critics (Lower Priority, but still required to pass)
  if (structuralCritique.verdict === "REWRITE") {
    verdict = "REWRITE";
    if (structuralCritique.failures) {
      structuralCritique.failures.forEach(f => failures.push(f));
    }
  }

  // 4. Build Delta Instructions based on failures
  if (verdict === "REWRITE") {
    failures.forEach(f => {
      if (f.type.startsWith("FRICTION")) {
        delta.push(`FRICTION DIRECTIVE: ${f.reason}`);
      } else {
        delta.push(`STRUCTURAL DIRECTIVE: ${f.reason}`);
      }
    });

    if (frictionResult.answers) {
      if (frictionResult.answers.tooEasy) delta.push(`AVOID THIS: ${frictionResult.answers.tooEasy}`);
      if (frictionResult.answers.resolvesPredictably) delta.push(`AVOID PREDICTABLE RESOLUTION: ${frictionResult.answers.resolvesPredictably}`);
      if (frictionResult.answers.soundsGenerated) delta.push(`REMOVE GENERATED TONE: ${frictionResult.answers.soundsGenerated}`);
    }
  }

  return {
    verdict,
    delta,
    failures
  };
}
