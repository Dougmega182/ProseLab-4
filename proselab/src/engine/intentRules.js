import { callOpenAI } from "../services/llm.js";
import { areTypesCompatible } from "./types.js";

/**
 * INTENT RULES ENGINE
 * Implements Gated Two-Phase Logic for narrative intent verification.
 * 
 * CORE PRINCIPLE: 
 * Logic (roles, types, values) overrides Probability (scoring).
 */

const INTENT_TYPES = {
  INFORMATION_TRANSFER: "INFORMATION_TRANSFER",
  BASIC_ACTION: "BASIC_ACTION",
  PHYSICAL_HANDOFF: "PHYSICAL_HANDOFF",
};

/**
 * META-DISCUSSION MARKERS
 * Patterns that indicate a character is talking ABOUT information 
 * rather than actually transferring it.
 */
const META_MARKERS = [
  /\b(need to|want to|going to|will|shall)\s+(tell|give|send|show)\b/i,
  /\b(is|am|are)\s+ready\b/i,
  /\b(have|got)\s+the\s+(code|intel|address|secret)\b/i,
  /\b(prepared|ready)\s+to\s+share\b/i
];

function calculateSubstanceScore(event) {
    if (event.category !== "REVEAL") return 1.0;
    
    const text = (event.trigger?.text || "").toLowerCase();
    const content = (event.roles?.content?.text || "").toLowerCase();
    
    // Check for meta-discussion markers in the trigger text
    const isMeta = META_MARKERS.some(regex => regex.test(text));
    
    // A reveal with no specific content in the 'content' slot is likely meta-discussion
    const hasEmptyContent = content.length < 3 || content === "it" || content === "the information";
    
    if (isMeta || hasEmptyContent) {
        return 0.2; // Significant penalty for meta-discussion
    }
    
    return 1.0;
}

export async function parseIntentContract(rawIntent, keys) {
  if (rawIntent.parsed) return rawIntent.parsed;

  const prompt = `Convert this high-level scene intent into a formal NARRATIVE CONTRACT (JSON).

INTENT:
${JSON.stringify(rawIntent, null, 2)}

SCHEMA:
{
  "intent_type": "INFORMATION_TRANSFER" | "BASIC_ACTION" | "PHYSICAL_HANDOFF",
  "slots": {
    "source": { "type": "entity", "required": true },
    "target": { "type": "entity", "required": true },
    "content": { "type": "info" | "object", "required": true, "exact_value": "optional specific detail" }
  },
  "success_criteria": ["list of boolean conditions"]
}

Return ONLY JSON.`;

  const response = await callOpenAI(keys.openai, prompt, { model: "gpt-4o-mini" });
  if (!response?.ok) return null;

  try {
    return JSON.parse(response.content.trim().replace(/^```json|```$/g, ""));
  } catch {
    return null;
  }
}

function findChainCandidates(contract, events) {
  const candidates = [];
  const roles = Object.keys(contract.slots);
  
  // Phase 1: Identify all valid anchor events (Events that satisfy at least one slot)
  const roleMaps = {};
  roles.forEach(role => {
    roleMaps[role] = events.filter(ev => isEventValidForRole(ev, role, contract.slots[role]));
  });

  // Phase 2: Heuristic Chain Search (Find 2-3 event sequences that satisfy the contract)
  // For simplicity, we prioritize REVEAL + GESTURE/ACTION chains for transfers
  const reveals = roleMaps["source"] || [];
  reveals.forEach(rev => {
    const targetMatches = roleMaps["target"] || [];
    targetMatches.forEach(targetEv => {
       // A valid chain for transfer requires:
       // 1. Reveal (Source shares info)
       // 2. Receipt (Target acknowledges)
       
       if (rev.id === targetEv.id) {
          // Case 1: Single event completion (e.g. "Miller handed Vance the code")
          candidates.push({
             chain: { reveal: rev, receipt: rev },
             score: calculateBaseScore(rev, contract),
             complexity: 1,
             issues: []
          });
       } else if (targetEv.timestamp > rev.timestamp) {
          // Case 2: Temporal sequence (Reveal then Receipt)
          candidates.push({
             chain: { reveal: rev, receipt: targetEv },
             score: (calculateBaseScore(rev, contract) + calculateBaseScore(targetEv, contract)) / 2,
             complexity: 2,
             issues: []
          });
       }
    });
  });

  return candidates;
}

function isEventValidForRole(event, roleName, roleSpec) {
  if (roleName === "source") {
     return event.roles?.source?.resolved_entity === roleSpec.value || 
            event.roles?.agent?.resolved_entity === roleSpec.value;
  }
  if (roleName === "target") {
     return event.roles?.target?.resolved_entity === roleSpec.value ||
            event.roles?.recipient?.resolved_entity === roleSpec.value;
  }
  if (roleName === "content") {
     if (roleSpec.exact_value) {
        return (event.roles?.content?.text || "").toLowerCase().includes(roleSpec.exact_value.toLowerCase());
     }
     return !!event.roles?.content?.text;
  }
  return false;
}

function calculateBaseScore(event, contract) {
    let score = 0.5; // Base confidence for a match
    
    // Precision boost: category alignment
    if (event.category === "REVEAL") score += 0.2;
    
    // Precision boost: exact value match
    const content = contract.slots.content?.exact_value;
    if (content && (event.roles?.content?.text || "").toLowerCase().includes(content.toLowerCase())) {
        score += 0.3;
    }

    return Math.min(1.0, score);
}

export function validateIntentChain(contract, events) {
  const trace = [];
  const validChains = findChainCandidates(contract, events);

  if (validChains.length === 0) {
      return { 
          ok: false, 
          result: "HIGH_FAIL", 
          primary_failure: "NARRATIVE_SIGNAL_MISSING",
          secondary_failures: ["No valid event chain matches the intent contract."], 
          confidence: 0,
          trace
      };
  }

  if (validChains.length > 0) {
    // APPLY SUBSTANCE GUARD TO ALL CHAINS
    const scoredChains = validChains.map(c => {
        let finalScore = c.score;
        const issues = [...(c.issues || [])];
        
        Object.entries(c.chain).forEach(([role, event]) => {
            const substance = calculateSubstanceScore(event);
            if (substance < 1.0) {
                finalScore *= substance;
                issues.push(`SUBSTANCE_FAIL: Event ${event.id} (${role}) appears to be meta-discussion, not content delivery.`);
            }
        });
        
        return { ...c, score: finalScore, issues };
    });

    scoredChains.sort((a, b) => b.score - a.score);
    const bestMatch = scoredChains[0];
    const secondBest = scoredChains[1];

    let ambiguityPenalty = 0;
    if (secondBest && secondBest.score >= 0.5 && (bestMatch.score - secondBest.score) < 0.1) {
       const disagree = Object.keys(bestMatch.chain).some(k => {
          const e1 = bestMatch.chain[k];
          const e2 = secondBest.chain[k];
          if (!e1 || !e2) return false;
          return e1.roles?.source?.resolved_entity !== e2.roles?.source?.resolved_entity;
       });
       if (disagree) ambiguityPenalty = 0.2; 
    }

    const finalScoreRaw = Math.max(0, bestMatch.score - ambiguityPenalty);
    
    const isBasicAction = contract.intent_type === "BASIC_ACTION";
    const finalScore = (bestMatch.complexity === 1 && !isBasicAction) ? Math.min(finalScoreRaw, 0.44) : finalScoreRaw;

    // CALIBRATED THRESHOLDS
    let result = "HIGH_FAIL";
    if (finalScore >= 0.55) result = "HIGH_PASS";
    else if (finalScore >= 0.45) result = "LOW_PASS";
    else if (finalScore >= 0.25) result = "UNCERTAIN";
    else if (finalScore >= 0.10) result = "LOW_FAIL";

    // FINAL SUBSTANCE OVERRIDE: Meta-only reveals can NEVER be PASS
    const hasMetaReveal = Object.values(bestMatch.chain).some(e => calculateSubstanceScore(e) < 0.5);
    if (hasMetaReveal && (result === "HIGH_PASS" || result === "LOW_PASS")) {
        result = "UNCERTAIN";
        bestMatch.issues.push("Result capped: Informational reveal lacks substantive content (Meta-discussion detected).");
    }
    
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
