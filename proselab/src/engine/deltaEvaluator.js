// @ts-nocheck
// E:\Ai\ProseLabV2\proselab\src\engine\deltaEvaluator.js
import { calculateExpectedManifold } from './stateEngine.js';

/**
 * Checks if the extracted events move the character plausibly within the allowed emotional manifold.
 */
export function evaluateDeltas(startStates, expectedManifolds, extractedEvents) {
  const evaluation = {
    verdict: "APPROVE",
    failures: [],
    actualDeltas: {}
  };

  // Group events by character
  const eventsByChar = {};
  extractedEvents.forEach(e => {
    if (!eventsByChar[e.character]) eventsByChar[e.character] = [];
    eventsByChar[e.character].push(e);
  });

  for (const [char, startState] of Object.entries(startStates)) {
    const expectedManifold = expectedManifolds[char];
    if (!expectedManifold) continue; // Character not in attendance or no manifold defined

    const charEvents = eventsByChar[char] || [];
    
    // Calculate actual resulting state applying ONLY these extracted events
    const actualManifold = calculateExpectedManifold(startState, charEvents);
    const actualDelta = actualManifold.targetDelta;
    
    evaluation.actualDeltas[char] = actualDelta;

    // Is the actual delta outside the expected bounded manifold?
    if (actualDelta < expectedManifold.minDelta || actualDelta > expectedManifold.maxDelta) {
      evaluation.verdict = "REWRITE";
      evaluation.failures.push({
        type: "DELTA_VIOLATION",
        reason: `Character [${char}] emotional delta (${actualDelta}) fell outside the allowed manifold [${expectedManifold.minDelta} to ${expectedManifold.maxDelta}]. Prose failed to achieve expected psychological trajectory.`
      });
    }
  }

  return evaluation;
}
