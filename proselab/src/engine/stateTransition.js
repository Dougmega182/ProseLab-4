// @ts-nocheck
// E:\Ai\ProseLabV2\proselab\src\engine\stateTransition.js
import { calculateExpectedManifold } from './stateEngine.js';

/**
 * Derives psychological constraints and emotional targets before a scene is generated.
 * This effectively acts as the "State-Lock" constraint generator.
 */
export function buildStateConstraints(sceneIntent, characterStates) {
  const constraints = {
    attendance: sceneIntent.attendance || [],
    expectedManifolds: {},
    leakageDirectives: []
  };

  constraints.attendance.forEach(characterName => {
    const startState = characterStates[characterName];
    if (!startState) return;

    // Use LLM (or heuristics from sceneIntent) to estimate EXPECTED events.
    // For now, we mock the expected events based on scene tension if defined.
    // In a full implementation, a fast LLM pass might propose expected events.
    const expectedEvents = sceneIntent.expectedEvents?.[characterName] || [];
    
    const manifold = calculateExpectedManifold(startState, expectedEvents);
    constraints.expectedManifolds[characterName] = manifold;

    if (manifold.leakageExpected) {
      constraints.leakageDirectives.push(
        `MANDATORY PROSE CONSTRAINT [${characterName}]: Suppression Leakage Active. ${characterName} is heavily suppressing emotional pressure. The prose must reflect this indirectly via clipped dialogue, narrowed sensory focus on mundane details, or displaced irritation.`
      );
    }
  });

  return constraints;
}

/**
 * Injects the state constraints into the generator prompt context.
 */
export function injectStateConstraints(basePrompt, stateConstraints) {
  let constraintText = "\n\n=== PSYCHOLOGICAL STATE-LOCK CONSTRAINTS ===\n";
  constraintText += "You must obey the following emotional physics. Do not resolve trauma instantly. Do not ignore suppression.\n";
  
  if (stateConstraints.leakageDirectives.length > 0) {
    constraintText += "\nSUPPRESSION LEAKAGE:\n" + stateConstraints.leakageDirectives.join('\n') + "\n";
  }

  for (const [char, manifold] of Object.entries(stateConstraints.expectedManifolds)) {
    constraintText += `\nCHARACTER: ${char}\n`;
    constraintText += `Target Emotional Delta: ${manifold.targetDelta > 0 ? '+' : ''}${manifold.targetDelta}\n`;
    constraintText += `Allowed Manifold: [${manifold.minDelta} to ${manifold.maxDelta}]\n`;
  }

  return basePrompt + constraintText;
}
