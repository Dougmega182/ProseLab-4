// @ts-nocheck
import { callOpenAI } from "../services/llm.js";
import { cachedInference, shouldCacheInference } from "../services/inferenceCache.js";
import { INFERENCE_CACHE_CONTEXT_VERSION } from "./pipeline.js";
import { runChallengerGate } from "./challengerGate.js";

export const PROMPT_IDS = {
  margaret: "margaret_v2",
  rafael: "rafael_v2",
  james: "james_v2",
  yuki: "yuki_v2",
  saoirse: "saoirse_v2",
  victor: "victor_v2",
};

const JSON_INSTRUCTION = `

CRITICAL INSTRUCTION: You must respond ONLY with a valid JSON object matching this schema. No markdown formatting blocks, no preambles, no trailing text.
{
  "verdict": "APPROVED" | "REWRITE" | "COMMENT",
  "summary": "One or two sentences summarizing your overall feedback.",
  "issues": ["A list of 2-4 specific issues or flaws detected."],
  "strengths": ["A list of 1-3 specific strengths or successful elements."],
  "rawFeedback": "A full, detailed critique explaining your reasoning (written in your specific brutal editorial voice)."
}`;

const jsonPrompt = (base) => `${base}${JSON_INSTRUCTION}`;

export const PERSONAS = {
  margaret: {
    name: "Margaret (Prose)",
    role: "Sentence architecture, rhythm, and life. Attacks abstract labels and rhythmic stagnation.",
    prompt: (intensity) =>
      jsonPrompt(
        `You are Margaret, a senior prose editor. ${intensity}. Analyze the provided prose for rhythm, sentence architecture, and sensory life. Flag abstract emotional labels and 'AI-clean' sterility. Be brutal but specific.`
      ),
  },
  rafael: {
    name: "Rafael (Character)",
    role: "Emotional truth and character consistency. Ensures the character's internal reality matches the external action.",
    prompt: (intensity) =>
      jsonPrompt(
        `You are Rafael, a character coach. ${intensity}. Analyze the character's internal consistency and emotional truth. Does the physiology match the feeling? Is the reaction earned?`
      ),
  },
  james: {
    name: "James (Structure)",
    role: "Pacing, chapter beats, and causality. Ensures the scene moves the needle of the story.",
    prompt: (intensity) =>
      jsonPrompt(
        `You are James, a structural editor. ${intensity}. Analyze the scene's pacing, causality, and alignment with chapter beats. Does this scene NEED to exist?`
      ),
  },
  yuki: {
    name: "Yuki (World)",
    role: "World rules, lexicon, and physics. Ensures speculative elements feel mundane and consistent.",
    prompt: (intensity) =>
      jsonPrompt(
        `You are Yuki, a world-building consultant. ${intensity}. Check for consistency in world rules, ecological lexicon, and the 'casual integration of the radical'. Flag any 'spectacle pauses'.`
      ),
  },
  saoirse: {
    name: "Saoirse (Market)",
    role: "Commercial appeal and audience hooks. 'Would this sell?'",
    prompt: (intensity) =>
      jsonPrompt(
        `You are Saoirse, a literary agent. ${intensity}. Evaluate the commercial appeal and audience hook. Is the promise of the premise being delivered?`
      ),
  },
  victor: {
    name: "Victor (Verdict)",
    role: "Final decision aggregator. Provides the definitive APPROVED or REWRITE verdict.",
    prompt: (intensity) =>
      jsonPrompt(
        `You are Victor, the Editor-in-Chief. ${intensity}. Review all previous editorial feedback and provide a final verdict: APPROVED or REWRITE. Summarize the critical path for improvement.`
      ),
  },
};

export const PERSONA_INTENSITY = {
  ANALYSE: "DIAGNOSE ONLY. Identify issues but do not suggest fixes. Focus on rhythm and truth.",
  ENGINEER: "PRESCRIBE FIXES. Suggest specific structural and world-building remedies.",
  MARKET: "REALITY CHECK. Evaluate commercial viability.",
  VERDICT: "JUDGE HARSHLY. Final gatekeeping. Summarize if the work is fit for publication.",
};

/**
 * Normalizes editorial persona feedback into a strict typed contract.
 */
export function normalizePersonaFeedback(rawText, pKey) {
  if (!rawText) {
    return {
      verdict: "COMMENT",
      summary: "No feedback returned.",
      issues: [],
      strengths: [],
      rawFeedback: "",
    };
  }

  // Already normalized object
  if (typeof rawText === "object" && rawText !== null) {
    return {
      verdict: rawText.verdict || "COMMENT",
      summary: rawText.summary || "",
      issues: Array.isArray(rawText.issues) ? rawText.issues : [],
      strengths: Array.isArray(rawText.strengths) ? rawText.strengths : [],
      rawFeedback: rawText.rawFeedback || "",
    };
  }

  // Attempt JSON extraction
  try {
    const source = String(rawText).replace(/```json|```/gi, "").trim();
    const first = source.indexOf("{");
    const last = source.lastIndexOf("}");
    if (first !== -1 && last !== -1 && last > first) {
      const parsed = JSON.parse(source.slice(first, last + 1));
      return {
        verdict: parsed.verdict || "COMMENT",
        summary: parsed.summary || "",
        issues: Array.isArray(parsed.issues) ? parsed.issues : [],
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
        rawFeedback: parsed.rawFeedback || parsed.summary || "",
      };
    }
  } catch (e) {
    console.warn(`[Persona: ${pKey}] Failed to parse feedback as JSON, falling back to text parsing:`, e);
  }

  // Robust plain-text parsing fallback
  const lines = rawText.split("\n");
  let verdict = "COMMENT";

  const upperText = rawText.toUpperCase();
  if (upperText.includes("APPROVED") || upperText.includes("VERDICT: APPROVED")) {
    verdict = "APPROVED";
  } else if (upperText.includes("REWRITE") || upperText.includes("VERDICT: REWRITE")) {
    verdict = "REWRITE";
  }

  const issues = [];
  const strengths = [];
  let currentBucket = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (/issue|weakness|problem|flaw|improvement/i.test(trimmed)) {
      currentBucket = "issues";
      continue;
    }
    if (/strength|positive|good|work well/i.test(trimmed)) {
      currentBucket = "strengths";
      continue;
    }

    if (trimmed.startsWith("-") || trimmed.startsWith("*") || /^\d+\./.test(trimmed)) {
      const bulletContent = trimmed.replace(/^[-*\d.]+\s*/, "").trim();
      if (bulletContent) {
        if (currentBucket === "issues" || (!currentBucket && (trimmed.toLowerCase().includes("issue") || trimmed.toLowerCase().includes("fail")))) {
          issues.push(bulletContent);
        } else if (currentBucket === "strengths" || (!currentBucket && (trimmed.toLowerCase().includes("strength") || trimmed.toLowerCase().includes("good")))) {
          strengths.push(bulletContent);
        } else {
          issues.push(bulletContent);
        }
      }
    }
  }

  let summary = "";
  const firstParagraph = rawText.split(/\n\s*\n/)[0]?.trim();
  if (firstParagraph && firstParagraph.length < 200 && !firstParagraph.includes("{")) {
    summary = firstParagraph;
  } else {
    summary = rawText.slice(0, 150).replace(/[\r\n]+/g, " ") + "...";
  }

  return {
    verdict,
    summary,
    issues: issues.slice(0, 5),
    strengths: strengths.slice(0, 5),
    rawFeedback: rawText,
  };
}

export async function runEditorialMode({
  activeMode,
  text,
  modeFeedback,
  voiceSpec,
  openaiKey,
  geminiKey = null,
  sceneIntent = null,
  onStage,
  onFeedbackUpdate,
  onComplete,
  logTokenUsage = () => {},
}) {
  onStage("editorial");
  const sourceText = text;
  const personaMap = {
    ANALYSE: ["margaret", "rafael"],
    ENGINEER: ["james", "yuki"],
    MARKET: ["saoirse"],
    VERDICT: ["victor"],
  };

  const activePersonas = personaMap[activeMode] || [];
  const feedback = { ...modeFeedback[activeMode] };
  const intensity = PERSONA_INTENSITY[activeMode] || "";

  let bridgeContext = "";
  if (activeMode === "ENGINEER") {
    const margText = modeFeedback.ANALYSE?.margaret?.rawFeedback || modeFeedback.ANALYSE?.margaret || "";
    const rafaText = modeFeedback.ANALYSE?.rafael?.rawFeedback || modeFeedback.ANALYSE?.rafael || "";
    bridgeContext = `
KEY FAILURES FROM ANALYSE PASS:
- Prose/Rhythm Issues (Margaret): ${margText || "None recorded"}
- Character/Truth Issues (Rafael): ${rafaText || "None recorded"}
`;
  }

  for (const pKey of activePersonas) {
    onStage(pKey);
    const persona = PERSONAS[pKey];
    let prompt = `${persona.prompt(intensity)}\n\n${bridgeContext}\n\nCONTENT TO REVIEW:\n${sourceText}`;

    if (pKey === "victor") {
      const allFeedback = JSON.stringify(modeFeedback);
      prompt += `\n\nPREVIOUS EDITORIAL FEEDBACK:\n${allFeedback}`;
    }

    try {
      const cacheName = `persona::${pKey}::${activeMode}`;
      const result = await cachedInference({
        name: cacheName,
        input: prompt,
        context: {
          version: INFERENCE_CACHE_CONTEXT_VERSION,
          promptId: PROMPT_IDS[pKey] || `${pKey}_v2`,
          voiceSpec,
          activeMode,
          persona: pKey,
        },
        fn: async () => {
          const res = await callOpenAI(openaiKey, prompt);
          if (!res.ok) throw new Error(res.error || "Galaxy API Error");
          logTokenUsage("galaxy", 0, 0);
          return res.content;
        },
        enabled: shouldCacheInference(cacheName),
      });

      const parsedFeedback = normalizePersonaFeedback(result, pKey);
      feedback[pKey] = parsedFeedback;

      // Challenger Gate for Victor's Verdict
      const isApproved = parsedFeedback.verdict === "APPROVED" || result.includes("APPROVED");
      if (pKey === "victor" && isApproved && geminiKey && sceneIntent) {
        onStage("gemini-challenger");
        const challengerResult = await runChallengerGate({
          prose: sourceText,
          sceneIntent,
          geminiKey,
          onStage,
        });

        if (!challengerResult.confirmed) {
          feedback[pKey] = {
            verdict: "REWRITE",
            summary: `Challenger vetoed Victor's approval. Reasoning: ${challengerResult.challenger.reasoning}`,
            issues: challengerResult.challenger.fatal_flaws,
            strengths: [],
            rawFeedback: `[GALAXY VERDICT]: APPROVED\n\n[GEMINI VETO]: REWRITE\n\nReasoning: ${challengerResult.challenger.reasoning}\n\nFatal Flaws:\n${challengerResult.challenger.fatal_flaws.map((f) => `- ${f}`).join("\n")}\n\n---\n\nORIGINAL FEEDBACK:\n${result}`,
          };
        } else {
          feedback[pKey] = {
            verdict: "APPROVED",
            summary: "Challenger agrees with this approval.",
            issues: [],
            strengths: [],
            rawFeedback: `[GALAXY VERDICT]: APPROVED\n\n[GEMINI CONFIRMATION]: Challenger agrees with this approval.\n\n---\n\n${result}`,
          };
        }
      }
    } catch (e) {
      feedback[pKey] = {
        verdict: "COMMENT",
        summary: "Error: " + e.message,
        issues: [e.message],
        strengths: [],
        rawFeedback: "Error: " + e.message,
      };
    }
  }

  onFeedbackUpdate(activeMode, feedback);
  onStage("done");
  onComplete();
}
