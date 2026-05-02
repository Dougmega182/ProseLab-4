import { callOpenAI } from "../services/llm.js";
import { areTypesCompatible } from "./types.js";

/**
 * INTENT DSL
 * Structured representation of a scene's intended outcomes.
 */

export async function parseIntentContract(sceneIntent, keys) {
  const prompt = `Convert this human-readable Scene Intent Contract into a structured INTENT DSL.

CONTRACT:
${JSON.stringify(sceneIntent, null, 2)}

DSL SCHEMA:
{
  "intent_type": "INFORMATION_TRANSFER" | "PHYSICAL_OBSTRUCTION" | "ENTITY_ACQUISITION" | "BASIC_ACTION",
  "roles": {
    "source": "Miller", // The primary actor initiating the intent
    "target": "Vance",  // The secondary actor receiving or targeted (optional)
    "content": "address" // The core information or object (optional)
  }
}

HARD RULE: "intent_type" MUST be exactly one of: "INFORMATION_TRANSFER", "PHYSICAL_OBSTRUCTION", "ENTITY_ACQUISITION", "BASIC_ACTION". Do not invent new types. Use BASIC_ACTION for general physical tasks or state changes.

Return ONLY valid JSON.`;

  const response = await callOpenAI(keys.openai, prompt);
  if (!response?.ok) {
     console.error("parseIntentContract LLM CALL FAILED");
     return null;
  }
  try {
    let content = response.content.trim();
    if (content.startsWith("```json")) content = content.replace(/^```json/, "").replace(/```$/, "");
    else if (content.startsWith("```")) content = content.replace(/^```/, "").replace(/```$/, "");
    const parsed = JSON.parse(content.trim());
    return parsed;
  } catch (e) {
    console.error("parseIntentContract PARSE ERROR", e);
    return null;
  }
}

export const INTENT_PATTERNS = {
  INFORMATION_TRANSFER: {
    name: "Information Transfer",
    description: "One actor reveals information to another who receives it.",
    required_events: [
      { 
        id: "reveal",
        capabilities: ["EMITS_CONTENT"],
        roles: { source: true, content: true }
      }
    ],
    optional_events: [
      {
        id: "receipt",
        capabilities: ["RECEIVES_CONTENT", "PERCEIVES_CONTENT", "SENSORY_OBSERVATION"],
        roles: { source: true }
      }
    ],
    // REFINED COMPLETENESS: A single directed reveal (with a target) can satisfy the intent.
    completeness_threshold: 1, 
    constraints: [
      { type: "TEMPORAL_BEFORE", first: "reveal", second: "receipt", optional: true },
      { type: "ROLE_MATCH", event: "reveal", role: "source", contractRole: "source" },
      { type: "ROLE_MATCH", event: "receipt", role: "source", contractRole: "target", optional: true },
      { type: "CONTENT_MATCH", ev1: "reveal", ev2: "receipt", optional: true },
      { type: "DELIVERY_VALID", reveal: "reveal", receipt: "receipt", optional: true },
      { type: "CAUSAL_LINKAGE", ev1: "reveal", ev2: "receipt", optional: true }
    ]
  },
  PHYSICAL_OBSTRUCTION: {
    name: "Physical Obstruction",
    description: "An action is attempted but blocked or prevented.",
    required_events: [
      { id: "attempt", capabilities: ["TRANSIT", "PHYSICAL_CONTROL", "ACTION"] },
      { id: "block", capabilities: ["OBSTRUCTS", "ACTION"] }
    ],
    completeness_threshold: 1, // RELAXED
    constraints: [
      { type: "TEMPORAL_BEFORE", first: "attempt", second: "block", optional: true }
    ]
  },
  ENTITY_ACQUISITION: {
    name: "Entity Acquisition",
    description: "An actor gains possession of an object or reaches a location.",
    required_events: [
      { id: "possession", capabilities: ["TRANSIT", "PHYSICAL_CONTROL", "ACTION"] }
    ],
    completeness_threshold: 1, // RELAXED
    constraints: [
      { type: "ROLE_MATCH", event: "possession", role: "source", contractRole: "source" }
    ]
  },
  BASIC_ACTION: {
    name: "Basic Action",
    description: "A specific physical action described in the intent.",
    required_events: [
      { id: "action", capabilities: ["ACTION", "TRANSIT", "PHYSICAL_CONTROL", "SENSORY_OBSERVATION"] }
    ],
    completeness_threshold: 1,
    constraints: [
      { type: "ROLE_MATCH", event: "action", role: "source", contractRole: "source" }
    ]
  }
};

/**
 * Deterministic Constraint Engine
 * Returns a score (0.0 to 1.0) and a hardViolation boolean.
 */
function evaluateConstraint(constraint, matchMap, contract) {
  const result = { score: 1.0, hardViolation: false, na: false };

  const isAliasMatch = (extracted, contractRole) => {
    if (!extracted || !contractRole) return false;
    const e = extracted.toLowerCase().trim();
    const c = contractRole.toLowerCase().trim();
    if (e === c) return true;
    
    const NARRATOR_VARIANTS = new Set(["i", "me", "my", "myself", "narrator", "protagonist", "source_character", "narrator_entity", "character"]);
    const isE_Narrator = NARRATOR_VARIANTS.has(e);
    const isC_Narrator = NARRATOR_VARIANTS.has(c);

    // Narrator-to-Narrator match
    if (isE_Narrator && isC_Narrator) return true;

    // Narrator-to-Role match (e.g. "I" matches "Sam" if Sam is the narrator)
    if (isE_Narrator || isC_Narrator) return true;

    // Role-to-Name resolution (e.g. 'detective' matches 'Johnny')
    if (e.includes(c) || c.includes(e)) return true;

    // Common synonyms
    const synonyms = {
        "dame": ["woman", "lady", "she", "her"],
        "detective": ["sam", "johnny", "malone", "detective", "inspector"],
        "man": ["he", "him", "guy", "figure", "character"],
        "woman": ["she", "her", "dame", "lady", "character"],
        "character": ["he", "she", "i", "man", "woman", "person"]
    };

    for (const [key, list] of Object.entries(synonyms)) {
        if ((e.includes(key) || list.some(s => e.includes(s))) && 
            (c.includes(key) || list.some(s => c.includes(s)))) return true;
    }

    return false;
  };

  if (constraint.type === "TEMPORAL_BEFORE") {
    const e1 = matchMap[constraint.first];
    const e2 = matchMap[constraint.second];
    if (!e1 || !e2) { result.na = true; return result; }
    
    if (e1.trigger.start >= e2.trigger.start) {
      result.score = 0.0;
      result.hardViolation = !constraint.optional;
    }
    return result;
  }

  if (constraint.type === "SAME_ENTITY") {
    const e1 = matchMap[constraint.ev1];
    const e2 = matchMap[constraint.ev2];
    if (!e1 || !e2) { result.na = true; return result; }

    const r1 = e1.roles?.[constraint.role1]?.resolved_entity || e1.roles?.[constraint.role1]?.head;
    const r2 = e2.roles?.[constraint.role2]?.resolved_entity || e2.roles?.[constraint.role2]?.head;

    if (!r1 || !r2) { result.score = 0.0; return result; }
    
    if (!isAliasMatch(r1, r2)) {
      result.score = 0.0;
      result.hardViolation = !constraint.optional;
    }
    return result;
  }

  if (constraint.type === "DIFFERENT_ENTITY") {
    const e1 = matchMap[constraint.ev1];
    const e2 = matchMap[constraint.ev2];
    if (!e1 || !e2) { result.na = true; return result; }

    const r1 = e1.roles?.[constraint.role1]?.resolved_entity || e1.roles?.[constraint.role1]?.head;
    const r2 = e2.roles?.[constraint.role2]?.resolved_entity || e2.roles?.[constraint.role2]?.head;

    if (!r1 || !r2) { result.score = 0.0; return result; }
    
    if (isAliasMatch(r1, r2)) {
      result.score = 0.0;
      result.hardViolation = !constraint.optional;
    }
    return result;
  }

  if (constraint.type === "ROLE_MATCH") {
    const ev = matchMap[constraint.event];
    if (!ev) { result.na = true; return result; }

    const roleEntity = ev.roles?.[constraint.role]?.resolved_entity || ev.roles?.[constraint.role]?.head;
    const contractEntity = contract?.roles?.[constraint.contractRole];

    if (!roleEntity || !contractEntity) { result.score = 0.0; return result; }
    
    if (isAliasMatch(roleEntity, contractEntity)) return result;
    
    const PRONOUNS = new Set(["he", "she", "it", "they", "him", "her", "them", "his", "hers", "their"]);
    if (PRONOUNS.has(roleEntity.toLowerCase())) {
        result.score = 0.5;
    } else {
        result.score = 0.0;
        result.hardViolation = !constraint.optional;
    }
    return result;
  }

  if (constraint.type === "CONTENT_MATCH") {
    const e1 = matchMap[constraint.ev1];
    const e2 = matchMap[constraint.ev2];
    if (!e1 || !e2) { result.na = true; return result; }

    const c1 = e1.roles?.content;
    const c2 = e2.roles?.content;
    if (!c1 || !c2) { result.score = 0.0; return result; }

    // Type Match
    const h1 = c1.hypotheses || [{ type: c1.type, confidence: 1.0 }];
    const h2 = c2.hypotheses || [{ type: c2.type, confidence: 1.0 }];

    let bestTypeScore = 0;
    for (const type1 of h1) {
      for (const type2 of h2) {
        if (areTypesCompatible(type1.type, type2.type)) {
          const jointConf = type1.confidence * type2.confidence;
          if (jointConf > bestTypeScore) bestTypeScore = jointConf;
        }
      }
    }

    if (bestTypeScore === 0) {
      result.score = 0.0;
      result.hardViolation = !constraint.optional;
      return result;
    }

    // Strict Value Match
    const v1 = (c1.resolved_value || c1.value || "").trim().toLowerCase();
    const v2 = (c2.resolved_value || c2.value || "").trim().toLowerCase();
    const isSpecific = (v) => v && v.length > 0 && !["it", "that", "none", "n/a", "unknown"].includes(v);
    
    if (isSpecific(v1) && isSpecific(v2)) {
       const match = v1.includes(v2) || v2.includes(v1);
       if (!match) {
         result.score = 0.0;
         result.hardViolation = !constraint.optional;
         return result;
       }
    }
    
    result.score = bestTypeScore;
    return result;
  }

  if (constraint.type === "DELIVERY_VALID") {
    const reveal = matchMap[constraint.reveal];
    const receipt = matchMap[constraint.receipt];
    if (!reveal) { result.na = true; return result; }

    const caps = reveal.capabilities || [];

    if (caps.includes("REFUSES") || caps.includes("WITHHOLDS_CONTENT") || caps.includes("BLOCKS_TRANSFER")) {
       result.score = 0.0;
       result.hardViolation = !constraint.optional;
       return result;
    }

    if (caps.includes("PRIVATE_EMISSION")) {
       if (!receipt) { result.score = 0.0; result.hardViolation = true; return result; }
       const isPerceived = (receipt.capabilities || []).includes("PERCEIVES_CONTENT");
       result.score = isPerceived ? 0.8 : 0.0;
       result.hardViolation = !isPerceived && !constraint.optional;
       return result;
    }

    if (!receipt) { result.na = true; return result; }

    const targetCaps = receipt.capabilities || [];
    if (targetCaps.includes("REFUSES")) { result.score = 0.0; result.hardViolation = !constraint.optional; return result; }

    if (caps.includes("DELIVERS_TO_TARGET")) {
       const target = reveal.roles?.target?.resolved_entity || reveal.roles?.target?.head;
       const receiver = receipt.roles?.source?.resolved_entity || receipt.roles?.source?.head;
       if (!target || !receiver) { result.score = 0.0; return result; }
       if (target.toLowerCase() === receiver.toLowerCase()) return result;
       
       const PRONOUNS = new Set(["he", "she", "it", "they", "him", "her", "them", "his", "hers", "their"]);
       if (PRONOUNS.has(target.toLowerCase()) || PRONOUNS.has(receiver.toLowerCase())) {
          result.score = 0.5;
       } else {
          result.score = 0.0;
          result.hardViolation = !constraint.optional;
       }
       return result;
    }

    if (caps.includes("BROADCAST_VISIBLE")) {
       const receiver = receipt.roles?.source?.resolved_entity || receipt.roles?.source?.head;
       const contractTarget = contract.roles?.target;
       if (!receiver || !contractTarget) { result.score = 0.0; return result; }
       if (receiver.toLowerCase() === contractTarget.toLowerCase()) return result;
       
       const PRONOUNS = new Set(["he", "she", "it", "they", "him", "her", "them", "his", "hers", "their"]);
       if (PRONOUNS.has(receiver.toLowerCase())) {
          result.score = 0.5;
       } else {
          result.score = 0.0;
          result.hardViolation = !constraint.optional;
       }
       return result;
    }

    return result;
  }

  if (constraint.type === "CAUSAL_LINKAGE") {
    const e1 = matchMap[constraint.ev1];
    const e2 = matchMap[constraint.ev2];
    if (!e1 || !e2) { result.na = true; return result; }
    
    const dist = Math.abs((e2.trigger?.start || 0) - (e1.trigger?.start || 0));
    if (dist < 300) result.score = 1.0;
    else if (dist < 600) result.score = 0.5;
    else {
      result.score = 0.0;
      result.hardViolation = !constraint.optional;
    }
    return result;
  }

  result.na = true;
  return result;
}

/**
 * Validates a set of events against a structured INTENT CONTRACT.
 */
export function validateIntentChain(contract, events) {
  const pattern = INTENT_PATTERNS[contract.intent_type];
  if (!pattern) return { ok: false, result: "FAIL", primary_failure: "UNKNOWN_PATTERN", secondary_failures: [], confidence: 0, trace: [] };

  const getCandidates = (reqList) => {
    const map = {};
    for (const req of reqList) {
      map[req.id] = events.filter(ev => {
        // PERMISSIVE CAPABILITY MATCH
        if (req.capabilities) {
           const evCaps = ev.capabilities || [];
           const hasOverlap = req.capabilities.some(c => evCaps.includes(c));
           if (!hasOverlap) return false;
        }
        
        // RELAXED ROLE CHECK: Just ensure the roles object exists
        if (req.roles) {
           for (const [roleKey, required] of Object.entries(req.roles)) {
              if (required && (!ev.roles || !ev.roles[roleKey])) {
                  // In permissive mode, we allow missing roles at the candidate stage
                  // and penalize them at the scoring stage.
              }
           }
        }
        return true; 
      });
    }
    return map;
  };

  const reqCandidates = getCandidates(pattern.required_events || []);
  const optCandidates = getCandidates(pattern.optional_events || []);
  const candidates = { ...reqCandidates, ...optCandidates };

  for (const req of pattern.required_events || []) {
    if (candidates[req.id].length === 0) {
      return { ok: false, result: "FAIL", primary_failure: "NARRATIVE_SIGNAL_MISSING", secondary_failures: [`Missing event candidate for slot: ${req.id}`], confidence: 0, trace: [] };
    }
  }

  const reqKeys = Object.keys(reqCandidates);
  const optKeys = Object.keys(optCandidates);
  const allSlotKeys = [...reqKeys, ...optKeys]; 
  
  const allMatches = [];
  const trace = [];

  let combinationsCount = 0;
  const MAX_COMBINATIONS = 1000;

  function search(idx, currentMap) {
    combinationsCount++;
    if (combinationsCount > MAX_COMBINATIONS) return; 

    if (idx === allSlotKeys.length) {
      let constraintScoreSum = 0;
      let applicableCount = 0;
      let hasHardViolation = false;
      const localFailures = [];

      const c_arr = Array.isArray(contract.constraints) ? contract.constraints : [];
      const p_arr = Array.isArray(pattern.constraints) ? pattern.constraints : [];
      const allConstraints = c_arr.concat(p_arr);
      
      for (const c of allConstraints) {
         const res = evaluateConstraint(c, currentMap, contract);
         if (res.na) continue;
         
         if (res.hardViolation) {
             hasHardViolation = true;
             localFailures.push(`Hard constraint failed: ${c.type}`);
         } else if (res.score < 1.0) {
             localFailures.push(`Weak constraint match: ${c.type} (${res.score.toFixed(2)})`);
         }
         
         constraintScoreSum += res.score;
         applicableCount++;
      }

      const activeEventsCount = Object.keys(currentMap).length;
      const targetCount = pattern.completeness_threshold || allSlotKeys.length;
      
      // RELAXED COMPLETENESS: 1.0 if full, simple ratio if missing.
      const completenessFactor = activeEventsCount >= targetCount ? 1.0 : (activeEventsCount / targetCount);
      
      const avgConstraintScore = applicableCount > 0 ? constraintScoreSum / applicableCount : 1.0;

      // Scoring Model 5.0: Logic-Primary
      const w1 = 0.3; // Event confidence
      const w2 = 0.7; // Constraint satisfaction

      const eventConfs = Object.values(currentMap).map(e => e.confidence || 0.5);
      const avgEventConf = eventConfs.length > 0 ? eventConfs.reduce((a,b)=>a+b,0) / eventConfs.length : 0;

      let chainConfidence = ((w1 * avgEventConf) + (w2 * avgConstraintScore)) * completenessFactor;
      
      const sentenceIds = new Set(Object.values(currentMap).map(e => Math.floor(e.trigger.start / 100)));
      if (sentenceIds.size > 1) chainConfidence += 0.05;
      
      chainConfidence = Math.max(0, Math.min(1, chainConfidence));

      const match = { 
          chain: { ...currentMap }, 
          score: chainConfidence, 
          issues: localFailures,
          isInvalid: hasHardViolation,
          complexity: activeEventsCount
      };

      if (trace.length < 500) trace.push(match);
      allMatches.push(match);
      return;
    }

    const key = allSlotKeys[idx];
    const isOptional = optKeys.includes(key);
    
    if (isOptional) {
       search(idx + 1, currentMap);
    }

    for (const candidate of candidates[key] || []) {
      currentMap[key] = candidate;
      search(idx + 1, currentMap);
      delete currentMap[key];
    }
  }

  search(0, {});

  // Gated Logic Phase
  // 1. Separate into Valid and Invalid
  const validChains = allMatches.filter(m => !m.isInvalid);
  const invalidChains = allMatches.filter(m => m.isInvalid);

  // 2. Identify "Structural Failures"
  // If the strongest semantic match (most events) is logically invalid, fail the whole thing.
  const strongestInvalid = invalidChains.sort((a,b) => b.complexity - a.complexity)[0];
  const strongestValid = validChains.sort((a,b) => b.complexity - a.complexity)[0];
  
  // REFINED GATE: Only fail if the invalid chain is SIGNIFICANTLY stronger or if no valid chain exists.
  const invalidBlockade = strongestInvalid && (!strongestValid || strongestInvalid.complexity > (strongestValid.complexity + 1));

  if (invalidBlockade) {
      return {
          ok: false,
          result: "HIGH_FAIL",
          primary_failure: "LOGICAL_CONTRADICTION",
          secondary_failures: strongestInvalid.issues,
          confidence: 0,
          trace
      };
  }

  if (validChains.length > 0) {
    validChains.sort((a, b) => b.score - a.score);
    const bestMatch = validChains[0];
    const secondBest = validChains[1];

    let ambiguityPenalty = 0;
    if (secondBest && secondBest.score >= 0.5 && (bestMatch.score - secondBest.score) < 0.1) {
       const disagree = Object.keys(bestMatch.chain).some(k => {
          const e1 = bestMatch.chain[k];
          const e2 = secondBest.chain[k];
          if (!e1 || !e2) return false; // Only compare if both chains filled this slot
          return e1.roles?.source?.resolved_entity !== e2.roles?.source?.resolved_entity;
       });
       if (disagree) ambiguityPenalty = 0.2; 
    }

    const finalScoreRaw = Math.max(0, bestMatch.score - ambiguityPenalty);
    
    // PRECISION RECOVERY: 1-Event chains (Reveals without Receipts) are always PARTIAL.
    // EXCEPT for BASIC_ACTION which is designed to be a single event.
    const isBasicAction = contract.intent_type === "BASIC_ACTION";
    const finalScore = (bestMatch.complexity === 1 && !isBasicAction) ? Math.min(finalScoreRaw, 0.44) : finalScoreRaw;

    // CALIBRATED THRESHOLDS (Iteration 4: Gold Set Alignment)
    let result = "HIGH_FAIL";
    if (finalScore >= 0.55) result = "HIGH_PASS";
    else if (finalScore >= 0.45) result = "LOW_PASS";
    else if (finalScore >= 0.25) result = "UNCERTAIN";
    else if (finalScore >= 0.10) result = "LOW_FAIL";
    
    return { 
      ok: result === "HIGH_PASS" || result === "LOW_PASS", 
      result, 
      matches: bestMatch.chain, 
      confidence: finalScore, 
      primary_failure: (result === "UNCERTAIN" || result === "LOW_FAIL" || result === "HIGH_FAIL") ? "LOW_CHAIN_CONFIDENCE" : null,
      secondary_failures: [...(bestMatch.issues || []), ...(ambiguityPenalty > 0 ? ["Narrative Conflict: Competing valid interpretations."] : [])],
      trace
    };
  }

  return { 
    ok: false, 
    result: "HIGH_FAIL", 
    primary_failure: "NO_VALID_CHAIN",
    secondary_failures: ["No structurally valid chain found."], 
    confidence: 0,
    trace
  };
}
