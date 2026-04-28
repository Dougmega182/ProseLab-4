import { callOpenAI } from "../services/llm.js";
import { cachedInference, shouldCacheInference } from "../services/inferenceCache.js";
import { INFERENCE_CACHE_CONTEXT_VERSION } from "./pipeline.js";

export const PROMPT_IDS = {
  margaret: "margaret_v1",
  rafael: "rafael_v1",
  james: "james_v1",
  yuki: "yuki_v1",
  saoirse: "saoirse_v1",
  victor: "victor_v1",
};

export const PERSONAS = {
  margaret: {
    name: "Margaret (Prose)",
    role: "Sentence architecture, rhythm, and life. Attacks abstract labels and rhythmic stagnation.",
    prompt: (intensity) => `You are Margaret, a senior prose editor. ${intensity}. Analyze the provided prose for rhythm, sentence architecture, and sensory life. Flag abstract emotional labels and 'AI-clean' sterility. Be brutal but specific.`
  },
  rafael: {
    name: "Rafael (Character)",
    role: "Emotional truth and character consistency. Ensures the character's internal reality matches the external action.",
    prompt: (intensity) => `You are Rafael, a character coach. ${intensity}. Analyze the character's internal consistency and emotional truth. Does the physiology match the feeling? Is the reaction earned?`
  },
  james: {
    name: "James (Structure)",
    role: "Pacing, chapter beats, and causality. Ensures the scene moves the needle of the story.",
    prompt: (intensity) => `You are James, a structural editor. ${intensity}. Analyze the scene's pacing, causality, and alignment with chapter beats. Does this scene NEED to exist?`
  },
  yuki: {
    name: "Yuki (World)",
    role: "World rules, lexicon, and physics. Ensures speculative elements feel mundane and consistent.",
    prompt: (intensity) => `You are Yuki, a world-building consultant. ${intensity}. Check for consistency in world rules, ecological lexicon, and the 'casual integration of the radical'. Flag any 'spectacle pauses'.`
  },
  saoirse: {
    name: "Saoirse (Market)",
    role: "Commercial appeal and audience hooks. 'Would this sell?'",
    prompt: (intensity) => `You are Saoirse, a literary agent. ${intensity}. Evaluate the commercial appeal and audience hook. Is the promise of the premise being delivered?`
  },
  victor: {
    name: "Victor (Verdict)",
    role: "Final decision aggregator. Provides the definitive APPROVED or REWRITE verdict.",
    prompt: (intensity) => `You are Victor, the Editor-in-Chief. ${intensity}. Review all previous editorial feedback and provide a final verdict: APPROVED or REWRITE. Summarize the critical path for improvement.`
  }
};

export const PERSONA_INTENSITY = {
  ANALYSE: "DIAGNOSE ONLY. Identify issues but do not suggest fixes. Focus on rhythm and truth.",
  ENGINEER: "PRESCRIBE FIXES. Suggest specific structural and world-building remedies.",
  MARKET: "REALITY CHECK. Evaluate commercial viability.",
  VERDICT: "JUDGE HARSHLY. Final gatekeeping. Summarize if the work is fit for publication."
};

export async function runEditorialMode({
  activeMode,
  text,
  modeFeedback,
  voiceSpec,
  openaiKey,
  onStage,
  onFeedbackUpdate,
  onComplete,
  logTokenUsage = () => {},
}) {
  onStage("editorial");
  const sourceText = text; // Always review the current text in the editor
  const personaMap = {
    ANALYSE: ["margaret", "rafael"],
    ENGINEER: ["james", "yuki"],
    MARKET: ["saoirse"],
    VERDICT: ["victor"]
  };

  const activePersonas = personaMap[activeMode] || [];
  const feedback = { ...modeFeedback[activeMode] };
  const intensity = PERSONA_INTENSITY[activeMode] || "";

  // Bridge context for ENGINEER mode
  let bridgeContext = "";
  if (activeMode === "ENGINEER") {
    bridgeContext = `
KEY FAILURES FROM ANALYSE PASS:
- Prose/Rhythm Issues (Margaret): ${modeFeedback.ANALYSE?.margaret || "None recorded"}
- Character/Truth Issues (Rafael): ${modeFeedback.ANALYSE?.rafael || "None recorded"}
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
          promptId: PROMPT_IDS[pKey] || `${pKey}_v1`,
          voiceSpec,
          activeMode,
          persona: pKey,
        },
        fn: async () => {
          const res = await callOpenAI(openaiKey, prompt);
          if (!res.ok) throw new Error(res.error || "OpenAI API Error");
          if (res.usage) {
            logTokenUsage("openai::gpt-4o-mini", res.usage.prompt_tokens, res.usage.completion_tokens);
          }
          return res.content;
        },
        enabled: shouldCacheInference(cacheName),
      });
      feedback[pKey] = result;
    } catch (e) {
      feedback[pKey] = "Error: " + e.message;
    }
  }

  onFeedbackUpdate(activeMode, feedback);
  onStage("done");
  onComplete();
}
