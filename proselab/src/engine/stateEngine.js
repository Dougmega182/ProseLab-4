// @ts-nocheck
// E:\Ai\ProseLabV2\proselab\src\engine\stateEngine.js

export const STATE_CONSTANTS = {
  PASSIVE_DECAY_RATE: 0.03, // 3% decay per scene
  TRIGGER_MULTIPLIER_BASE: 1.25,
  SUPPRESSION_LEAKAGE_THRESHOLD: 0.80,
  BASE_INERTIA_MASS: 1.0,
  MAX_PRESSURE: 1.0
};

/**
 * Creates a transactional clone of the state to prevent double-decay during retries.
 */
export function beginTransaction(characterState) {
  return JSON.parse(JSON.stringify(characterState));
}

/**
 * Applies passive decay to a character's state.
 * If the character is not in attendance, they only receive passive decay.
 */
export function applyPassiveDecay(state) {
  // Suppression rebound: high suppression slows visible decay but increases latent instability
  const suppressionFactor = state.suppression_index || 0;
  const effectiveDecay = STATE_CONSTANTS.PASSIVE_DECAY_RATE * (1 - (suppressionFactor * 0.5));

  // Decay current load
  let newLoad = (state.current_load || 0) - effectiveDecay;
  if (newLoad < 0) newLoad = 0;
  
  // Accumulate latent instability if suppressing
  let latentInstability = state.latent_instability || 0;
  if (suppressionFactor > 0.5) {
    latentInstability += (suppressionFactor * 0.05);
  }

  // Decay trauma echoes slightly
  const newEchoes = (state.trauma_echoes || []).map(echo => ({
    ...echo,
    residual_pressure: Math.max(0, echo.residual_pressure - (effectiveDecay * 0.5))
  }));

  return {
    ...state,
    current_load: newLoad,
    latent_instability: latentInstability,
    trauma_echoes: newEchoes
  };
}

/**
 * Applies active math based on LLM-extracted candidate events.
 * Only runs if the character was in canonical attendance.
 */
export function applyEvents(state, events) {
  let newState = { ...state };
  let leakageFlag = false;

  events.forEach(event => {
    const inertiaMass = newState.inertia_mass || STATE_CONSTANTS.BASE_INERTIA_MASS;
    
    switch (event.type) {
      case 'DIRECT_TRIGGER':
      case 'INDIRECT_TRIGGER': {
        const triggerStrength = event.confidence || 1.0;
        const multiplier = 1 + ((STATE_CONSTANTS.TRIGGER_MULTIPLIER_BASE - 1) * triggerStrength);
        newState.current_load = Math.min(STATE_CONSTANTS.MAX_PRESSURE, newState.current_load * multiplier);
        break;
      }
      
      case 'REINTEGRATION': {
        const releaseStrength = event.confidence || 0.2;
        // High inertia reduces the effectiveness of reintegration
        const effectiveRelease = releaseStrength / inertiaMass;
        newState.current_load = Math.max(0, newState.current_load - effectiveRelease);
        break;
      }
      
      case 'SUPPRESSION': {
        // Increases suppression index and latent instability
        newState.suppression_index = Math.min(1.0, (newState.suppression_index || 0) + 0.1);
        newState.latent_instability = Math.min(1.0, (newState.latent_instability || 0) + 0.15);
        break;
      }

      case 'ANTICIPATORY_LOAD': {
        // Future-oriented pressure increases load without a direct trigger
        newState.current_load = Math.min(STATE_CONSTANTS.MAX_PRESSURE, newState.current_load + 0.1);
        break;
      }

      case 'DISPLACEMENT': {
        // Modifies relationship vectors rather than releasing pressure
        if (event.target && newState.relationship_vectors?.[event.target]) {
          newState.relationship_vectors[event.target].resentment = 
            Math.min(1.0, (newState.relationship_vectors[event.target].resentment || 0) + 0.1);
        }
        break;
      }
    }
  });

  // Check for Leakage
  if ((newState.suppression_index || 0) > STATE_CONSTANTS.SUPPRESSION_LEAKAGE_THRESHOLD || 
      (newState.latent_instability || 0) > STATE_CONSTANTS.SUPPRESSION_LEAKAGE_THRESHOLD) {
    leakageFlag = true;
  }

  return { finalState: newState, leakageFlag };
}

/**
 * Calculates the expected delta manifold for constraints
 */
export function calculateExpectedManifold(startState, expectedEvents) {
  // Apply math transactionally to find the "target"
  let projectedState = beginTransaction(startState);
  projectedState = applyPassiveDecay(projectedState);
  
  if (expectedEvents && expectedEvents.length > 0) {
    const res = applyEvents(projectedState, expectedEvents);
    projectedState = res.finalState;
  }

  const delta = projectedState.current_load - startState.current_load;
  
  // Create bounded manifold
  return {
    targetDelta: parseFloat(delta.toFixed(3)),
    minDelta: parseFloat((delta - 0.15).toFixed(3)),
    maxDelta: parseFloat((delta + 0.15).toFixed(3)),
    leakageExpected: (projectedState.suppression_index > STATE_CONSTANTS.SUPPRESSION_LEAKAGE_THRESHOLD)
  };
}
