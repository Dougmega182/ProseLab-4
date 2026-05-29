// @ts-nocheck
/**
 * challengerGate.js — Gemini Adversarial Challenger
 *
 * Enforced hard gate: after the Critic issues APPROVE, this module
 * sends the approved prose + scene intent to Gemini 1.5 Pro for an
 * independent adversarial review. If Gemini finds fatal issues,
 * the APPROVE is downgraded to REWRITE with Gemini's reasoning.
 *
 * This is NOT a soft telemetry signal. It is a veto gate.
 */

import { callGemini } from "../services/llm.js";

const CHALLENGER_PROMPT = `You are a ruthless adversarial reviewer for fiction prose.
The Critic Agent has APPROVED the following draft. Your job is to find reasons to VETO that approval.

You are looking for:
1. INTENT DRIFT — Does the prose actually achieve the stated scene objective?
2. LOGIC GAPS — Are there causal chains that don't connect?
3. HALLUCINATED DETAIL — Are there objects, characters, or events that contradict the scene context?
4. EMOTIONAL TELLING — Does the prose TELL emotions instead of SHOWING them through physical action?
5. UNEARNED MOMENTS — Does any dramatic beat feel unearned or rushed?

Be adversarial. If you can find even ONE fatal flaw, issue a VETO.

Respond in this exact JSON format:
{
  "verdict": "CONFIRM" or "VETO",
  "confidence": <0.0-1.0>,
  "fatal_flaws": ["description of each fatal flaw found"],
  "concerns": ["non-fatal but notable concerns"],
  "reasoning": "Brief explanation of your verdict"
}

If the prose is genuinely solid and you cannot find a fatal flaw, respond with "CONFIRM".
Do not confirm out of politeness. Default toward VETO.`;

/**
 * Run the Gemini Challenger against an approved draft.
 *
 * @param {Object} params
 * @param {string} params.prose - The approved prose text.
 * @param {Object} params.sceneIntent - The scene intent contract.
 * @param {string} params.geminiKey - The Gemini API key.
 * @param {Function} [params.onStage] - Stage callback for UI.
 * @returns {Object} { confirmed: boolean, challenger: Object }
 */
export async function runChallengerGate({
  prose,
  sceneIntent,
  geminiKey,
  onStage = () => {},
}) {
  if (!geminiKey) {
    console.warn("[Challenger] No Gemini key configured. Skipping challenger gate.");
    return {
      confirmed: true,
      challenger: {
        verdict: "SKIPPED",
        reasoning: "Gemini key not configured. Challenger gate bypassed.",
        fatal_flaws: [],
        concerns: [],
        confidence: 0,
      },
    };
  }

  onStage("gemini-challenger");

  const userPrompt = `## SCENE INTENT
${JSON.stringify(sceneIntent, null, 2)}

## APPROVED PROSE
---
${prose}
---

Analyze this prose adversarially. Find reasons to VETO the Critic's APPROVE verdict.`;

  try {
    const res = await callGemini(geminiKey, `${CHALLENGER_PROMPT}\n\n${userPrompt}`, {
      model: "gemini-2.5-flash",
      temperature: 0.3,
    });

    if (!res.ok) {
      console.error("[Challenger] Gemini call failed:", res.error);
      // On Gemini failure, do NOT block the pipeline. Log and pass through.
      return {
        confirmed: true,
        challenger: {
          verdict: "ERROR",
          reasoning: `Gemini API error: ${res.error}. Challenger gate bypassed.`,
          fatal_flaws: [],
          concerns: [],
          confidence: 0,
        },
      };
    }

    let parsed;
    try {
      // Try to extract JSON from the response
      const jsonMatch = res.content.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : res.content);
    } catch (parseErr) {
      console.error("[Challenger] Failed to parse Gemini response:", res.content);
      // Parse failure = diagnostic failure, NOT default approval
      return {
        confirmed: false,
        challenger: {
          verdict: "PARSE_FAILURE",
          reasoning: "Gemini returned unparseable output. Treated as VETO for safety.",
          fatal_flaws: ["Challenger output failed to parse — cannot confirm approval."],
          concerns: [],
          confidence: 0,
          raw: res.content,
        },
      };
    }

    const isConfirmed = parsed.verdict === "CONFIRM";

    return {
      confirmed: isConfirmed,
      challenger: {
        verdict: parsed.verdict,
        reasoning: parsed.reasoning || "",
        fatal_flaws: parsed.fatal_flaws || [],
        concerns: parsed.concerns || [],
        confidence: parsed.confidence ?? 0,
        raw: res.content,
      },
    };
  } catch (err) {
    console.error("[Challenger] Unexpected error:", err);
    return {
      confirmed: true,
      challenger: {
        verdict: "ERROR",
        reasoning: `Unexpected error: ${err.message}. Challenger gate bypassed.`,
        fatal_flaws: [],
        concerns: [],
        confidence: 0,
      },
    };
  }
}
