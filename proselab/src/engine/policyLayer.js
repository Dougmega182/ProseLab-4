import { analyzeProseStyle } from "./proseStyle.js";
import { validateIntentChain } from "./intentRules.js";

/**
 * PROSELAB POLICY LAYER
 * Responsibility: Synthesize logic, style, and risk signals into a single verdict.
 * Separates "What happened" (Logic) from "How it's written" (Style).
 */

export const POLICY_THRESHOLDS = {
    STABLE: {
        logic_min: 0.70,
        style_min: 0.60,
        ambiguity_max: 0.20
    },
    PERMISSIVE: {
        logic_min: 0.45,
        style_min: 0.40,
        ambiguity_max: 0.40
    }
};

export function evaluatePolicy(logicResult, styleResult, mode = "STABLE") {
    const thresholds = POLICY_THRESHOLDS[mode];
    
    const logicScore = logicResult.confidence || 0;
    const styleScore = styleResult.score || 0;
    
    const issues = [...(logicResult.secondary_failures || []), ...(styleResult.issues || [])];
    
    // DECISION MATRIX
    let verdict = "REWRITE";
    let tier = "HIGH_FAIL";

    // STYLE-LOGIC BALANCING: Trust high style when logic is ambiguous
    const isHighStyle = styleScore >= 0.8;
    const balancedLogicMin = isHighStyle ? 0.40 : thresholds.logic_min;

    if (logicResult.result === "LOGICAL_CONTRADICTION") {
        verdict = "REWRITE";
        tier = "HIGH_FAIL";
    } else if (logicScore >= balancedLogicMin && styleScore >= thresholds.style_min) {
        verdict = "APPROVE";
        tier = logicScore >= thresholds.logic_min ? "HIGH_PASS" : "LOW_PASS";
    } else if (logicScore >= thresholds.logic_min && styleScore < thresholds.style_min) {
        verdict = "REWRITE";
        tier = "STYLE_FAIL"; 
    } else if (logicScore >= balancedLogicMin * 0.7 && logicScore < balancedLogicMin) {
        verdict = "REWRITE";
        tier = "UNCERTAIN";
    } else {
        verdict = "REWRITE";
        tier = "LOW_FAIL";
    }

    return {
        verdict,
        tier,
        scores: { logic: logicScore, style: styleScore },
        issues,
        actionable_feedback: synthesizeFeedback(tier, logicResult, styleResult)
    };
}

function synthesizeFeedback(tier, logic, style) {
    if (tier === "HIGH_PASS") return null;

    if (tier === "STYLE_FAIL") {
        return {
            strategy: "PROSE_TRANSFORMATION",
            instruction: `Narrative logic is accepted, but prose quality is low: ${style.issues.join(" ")}. Repair rhythm and grounding.`,
            forbidden: ["abstract labels", "uniform sentence length"]
        };
    }

    // FIX FOR 0.44 PLATEAU: If we have a reveal but no receipt
    if (logic.complexity === 1 && logic.result === "UNCERTAIN") {
        return {
            strategy: "EVIDENCE_COMPLETION",
            instruction: "MUST FIX: Narrative evidence is incomplete. You have provided the reveal but not the receipt. Depict the target character explicitly receiving and acknowledging the information (e.g. a nod, a reply, a widening of eyes).",
            forbidden: ["implicit receipt", "ending on the reveal"]
        };
    }

    if (logic.primary_failure) {
        return logic.minimal_fix; 
    }

    return {
        strategy: "GENERAL_REPAIR",
        instruction: "Clarify the interaction and improve prose grounding.",
        forbidden: []
    };
}
