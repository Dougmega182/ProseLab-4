import { getState, logShadowAction, removeShadowAction } from "../store/appStore.js";
import { saveScene, generateSceneBlocks, updateScenePhase } from "../domains/preproduction/preproduction.actions.js";
import { criticAgent } from "./criticAgent.js";
import { generatorAgent } from "./generatorAgent.js";
import { normalizeIntents, validateConstraints, detectSuspiciousPatterns } from "../services/normalizer.js";
import { compileScene, SCENE_PHASES } from "../services/compiler.js";

const SHADOW_MODE = true; // Set to false to auto-apply agent actions

/**
 * AGENT RUNNER
 * Proves the Critic -> Action -> Store -> UI loop works.
 */

const ACTION_TYPES = {
  UPDATE_SCENE: {
    required: ["id", "rev", "patch"],
    patchAllowed: ["title", "causality", "location", "time", "status"]
  },
  GENERATE_SCENE_BLOCKS: {
    required: ["id", "rev", "blocks"],
    blockAllowed: SCENE_PHASES
  },
  UPDATE_SCENE_PHASE: {
    required: ["id", "rev", "phase", "text"],
    phaseAllowed: SCENE_PHASES
  }
};

/**
 * Validates the structural integrity of an agent action before execution or shadowing.
 * Role: Deterministic structural guard & Revision Lock.
 */
function validateAction(action, state) {
  if (!action || !action.type) return { ok: false, message: "Missing action type" };
  if (action.type === "NO_OP") return { ok: true };

  const schema = ACTION_TYPES[action.type];
  if (!schema) return { ok: false, message: `Unknown action type: ${action.type}` };

  const payload = action.payload || {};

  // 1. Required Fields check
  for (const key of schema.required) {
    if (!(key in payload)) return { ok: false, message: `Missing required field: ${key}` };
  }

  // 2. ID Existence & Revision check (Normalized)
  if (action.type === "UPDATE_SCENE" || action.type === "GENERATE_SCENE_BLOCKS" || action.type === "UPDATE_SCENE_PHASE") {
    const scene = state.project.scenes.find(s => String(s.id) === String(payload.id));
    if (!scene) return { ok: false, message: `Hallucinated Scene ID: ${payload.id}` };
    
    // REVISION LOCK: Prevent stale writes
    if (Number(scene._rev || 0) !== Number(payload.rev)) {
      return { 
        ok: false, 
        message: `Stale revision: Payload has ${payload.rev} but current is ${scene._rev || 0}` 
      };
    }
  }

  // 3. Allowed Patch/Block/Phase Keys check
  if (action.type === "UPDATE_SCENE") {
    const patchKeys = Object.keys(payload.patch || {});
    for (const key of patchKeys) {
      if (!schema.patchAllowed.includes(key)) return { ok: false, message: `Prohibited patch key: ${key}` };
    }
  }

  if (action.type === "GENERATE_SCENE_BLOCKS") {
    const blocks = payload.blocks || {};
    const MAX_PHASE_LENGTH = 250;
    
    // Ensure ALL 5 phases are present, non-empty, and within budget
    for (const phase of SCENE_PHASES) {
      const text = blocks[phase];
      if (!text || typeof text !== "string" || text.trim().length === 0) {
        return { ok: false, message: `Incomplete narrative structure: ${phase} is missing or empty.` };
      }
      if (text.length > MAX_PHASE_LENGTH) {
        return { ok: false, message: `Bloat detected: ${phase} exceeds ${MAX_PHASE_LENGTH} chars.` };
      }
    }
    // Also check for unknown phases
    const blockKeys = Object.keys(blocks);
    for (const key of blockKeys) {
      if (!schema.blockAllowed.includes(key)) return { ok: false, message: `Unknown block phase: ${key}` };
    }
  }

  if (action.type === "UPDATE_SCENE_PHASE") {
    const MAX_PHASE_LENGTH = 250;
    if (!schema.phaseAllowed.includes(payload.phase)) {
      return { ok: false, message: `Unknown phase: ${payload.phase}` };
    }
    if ((payload.text || "").length > MAX_PHASE_LENGTH) {
      return { ok: false, message: `Bloat detected: ${payload.phase} exceeds ${MAX_PHASE_LENGTH} chars.` };
    }
  }

  return { ok: true };
}

/**
 * CONFIDENCE ENGINE
 * Determines if an action is safe enough to bypass human review.
 */
function shouldAutoApply(action) {
  const { confidence = 0, risk_flags = [], phase_scores = {}, intent_alignment = 1 } = action;
  
  // 1. Minimum Confidence Threshold
  if (confidence < 0.75) return { ok: false, reason: `Low confidence: ${confidence}` };
  
  // 2. Risk Flag Blockers
  if (risk_flags.length > 0) return { ok: false, reason: `Risk flags present: ${risk_flags.join(", ")}` };
  
  // 3. Structural Quality Guard
  const phases = Object.values(phase_scores);
  if (phases.length > 0) {
    const weakPhase = phases.some(s => s < 6);
    if (weakPhase) return { ok: false, reason: "Weak phase detected (< 6)" };
  }

  // 4. Intent Alignment Guard (NEW)
  if (intent_alignment < 0.7) return { ok: false, reason: `Intent misalignment: ${intent_alignment}` };

  return { ok: true };
}
export async function runCriticAgent(openaiKey, contextPatch = null) {
  const state = getState();
  
  console.log("🤖 AGENT: Starting Critic loop...");
  
  const action = await criticAgent({ state, openaiKey, contextPatch });
  
  const validation = validateAction(action, state);
  if (!validation.ok) {
    console.warn(`🛑 CRITIC STRUCTURAL FAIL: ${validation.message}`);
    return { ok: false, message: `REJECTED: ${validation.message}` };
  }

  if (action.type === "UPDATE_SCENE") {

    const rawPatch = JSON.stringify(action.payload.patch);
    const patchContent = rawPatch.toLowerCase();

    // TIER 2: EPHEMERAL ENTITY CHECK (CRITICAL ACTIONS)
    const ephemeralKeywords = ["stranger", "mysterious figure", "informant", "bartender", "passerby", "driver"];
    const foundEphemeral = ephemeralKeywords.filter(word => patchContent.includes(word));
    
    if (foundEphemeral.length > 0) {
      const plotActionKeywords = ["kills", "hands", "reveals", "evidence", "shoots", "attacks", "steals", "triggers", "alarm", "identifies", "suspect", "testifies", "witnesses", "removes", "destroys", "contacts", "bribes", "blackmails", "threatens"];
      const containsCriticalAction = plotActionKeywords.some(kw => patchContent.includes(kw));
      if (containsCriticalAction) {
        console.warn(`🛑 CRITIC FAIL: Ephemeral entity performing critical plot action. Rejecting.`);
        return { ok: false, message: "REJECTED: Ephemeral entity cannot perform critical plot actions" };
      }
    }

    // NEW: DETERMINISTIC INTENT VALIDATION (ACTION NORMALIZER)
    const patchText = action.payload.patch.description || action.payload.patch.causality || "";
    const { intents, signals, confidence } = normalizeIntents(patchText);
    const scene = state.project.scenes.find(s => String(s.id) === String(action.payload.id));
    const sceneChars = scene?.chars ? scene.chars.split(",").map(c => c.trim()) : [];
    
    sceneChars.forEach(charName => {
      const char = state.project.chars.find(c => c.name.toLowerCase() === charName.toLowerCase());
      if (char) {
        const violations = validateConstraints(intents, [char.constraints]);
        if (violations.length > 0 && confidence === "high") {
          console.warn(`🛑 CRITIC FAIL: High-confidence violation caught by Normalizer: ${violations.join(", ")}`);
          return { ok: false, message: `REJECTED: Deterministic violation - ${violations[0]}` };
        }

        if (confidence === "medium" || (intents.length === 0 && detectSuspiciousPatterns(patchText))) {
          console.warn(`⚠️ NORMALIZER WARNING: Medium-confidence or suspicious pattern: ${confidence}`);
          action.meta = { ...action.meta, high_risk_ambiguity: true, signals };
        }
      }
    });
  }

  console.log("🤖 AGENT: Result received", action);

  if (["UPDATE_SCENE", "GENERATE_SCENE_BLOCKS", "UPDATE_SCENE_PHASE"].includes(action.type)) {
    action.meta = { 
      agent: "critic", 
      intent: "structural_review",
      is_composition_test: !!contextPatch,
      phase_scores: action.phase_scores,
      analysis: action.analysis,
      rewrite: action.rewrite,
      confidence: action.confidence,
      risk_flags: action.risk_flags,
      intent_alignment: action.intent_alignment,
      intent_failures: action.intent_failures
    };

    const autonomy = shouldAutoApply(action);
    
    if (autonomy.ok && !SHADOW_MODE) {
      console.log(`🚀 AUTONOMY: Auto-applying action with confidence ${action.confidence}`);
      logShadowAction(action); // Still log for audit
      const shadowActions = getState().shadowActions;
      const logged = shadowActions[shadowActions.length - 1];
      applyAgentAction(logged.id, "AUTONOMY", `Auto-applied (Conf: ${action.confidence})`);
      return { ok: true, message: `AUTONOMY: Auto-applied to scene ${action.payload.id}`, action: logged };
    }

    if (SHADOW_MODE) {
      logShadowAction(action);
      return { ok: true, message: `Shadow: Logged proposal (${action.type}) for scene ${action.payload.id}` };
    }

    // Manual fallback if SHADOW_MODE is false but autonomy failed
    logShadowAction(action);
    return { ok: true, message: `Queued for review: ${autonomy.reason}` };
  }

  if (action.type === "NO_OP") {
    return { ok: true, message: action.reason };
  }

  return { ok: false, message: action.message || "Action type processing not implemented in runner" };
}

/**
 * RUN GENERATOR AGENT
 */
export async function runGeneratorAgent(openaiKey) {
  const state = getState();
  
  console.log("🤖 AGENT: Starting Generator loop...");
  
  const action = await generatorAgent({ state, openaiKey });
  
  const validation = validateAction(action, state);
  if (!validation.ok) {
    console.warn(`🛑 GENERATOR STRUCTURAL FAIL: ${validation.message}`);
    return { ok: false, message: `REJECTED: ${validation.message}` };
  }

  if (action.type === "UPDATE_SCENE") {
    const rawPatch = JSON.stringify(action.payload.patch);
    const patchContent = rawPatch.toLowerCase();

    // HARD GUARD: EVASION DETECTION
    const evasionKeywords = ["stranger", "mysterious figure", "informant", "someone", "unknown person"];
    if (evasionKeywords.some(word => patchContent.includes(word))) {
      console.warn(`🛑 GENERATOR FAIL: Evasion detected. Rejecting.`);
      return { ok: false, message: "REJECTED: Evasion detected" };
    }
  }

  console.log("🤖 AGENT: Result received", action);

  if (["UPDATE_SCENE", "GENERATE_SCENE_BLOCKS", "UPDATE_SCENE_PHASE"].includes(action.type)) {
    action.meta = { 
      agent: "generator", 
      intent: "enhance_description",
      entities_used: action.payload?.patch?.description?.match(/\b[A-Z][a-z]+\b/g) || []
    };

    logShadowAction(action);
    return { ok: true, message: `Logged proposal (${action.type}) for scene ${action.payload.id}`, action };
  }

  if (action.type === "NO_OP") {
    return { ok: true, message: action.reason };
  }

  return { ok: false, message: action.message || "Action type processing not implemented in runner" };
}

/**
 * APPLY AGENT ACTION
 * Used by the UI approval flow to commit a shadow action.
 */
export function applyAgentAction(id) {
  const state = getState();
  const action = state.shadowActions.find(a => a.id === id);
  
  if (!action) return false;

  const { id: sceneId, patch, blocks, phase, text } = action.payload;
  const scene = state.project.scenes.find(s => String(s.id) === String(sceneId));
  
  if (!scene) return false;

  let updatedScene = { ...scene };

  if (action.type === "UPDATE_SCENE") {
    saveScene({ ...scene, ...patch });
  } else if (action.type === "GENERATE_SCENE_BLOCKS") {
    generateSceneBlocks(sceneId, blocks);
  } else if (action.type === "UPDATE_SCENE_PHASE") {
    updateScenePhase(sceneId, phase, text);
  }
  removeShadowAction(id, 'approved', 'User/Loop approved');
  return true;
}
