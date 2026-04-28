import { callCritic } from "../src/engine/critic.js";
import { generateRewrite, estimateSimilarity } from "../src/engine/rewrite.js";
import { callOpenAI } from "../src/services/llm.js";
import fs from "node:fs";
import path from "node:path";

function readEnvFile(p) {
  try {
    const c = fs.readFileSync(p, "utf-8");
    return Object.fromEntries(
      c.split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"))
        .map((l) => {
          const idx = l.indexOf("=");
          return [l.slice(0, idx), l.slice(idx + 1).replace(/^["']|["']$/g, "")];
        }),
    );
  } catch {
    return {};
  }
}

async function callOllama(model, prompt) {
  const r = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, stream: false })
  });
  const d = await r.json();
  return d.response;
}

async function runPipeline({ text, keys, model, sceneContext }) {
  const SIMILARITY_THRESHOLD = 0.75;
  const MAX_ATTEMPTS = 3;

  const delta = ["Replace vague words with concrete sensory detail", "Replace abstract emotions with physical reactions"];
  const initialInstruction = `Rewrite this paragraph with these constraints:\n${delta.join("\n")}\n\n${text}`;

  const draft1 = await callOllama(model, initialInstruction);
  let currentDraft = draft1?.trim() ? draft1 : text;
  
  let attempts = 0;
  let finalCritique = null;

  while (attempts < MAX_ATTEMPTS) {
    attempts++;
    
    const critique = await callCritic({
      text: currentDraft,
      keys,
      sceneContext
    });
    
    finalCritique = critique;

    if (critique.verdict === "APPROVE") break;
    if (attempts === MAX_ATTEMPTS) break;

    const similarity = estimateSimilarity(text, currentDraft);
    const tooSimilar = similarity > SIMILARITY_THRESHOLD;

    const rewriteResult = await generateRewrite({
      original: text,
      instructions: critique.rewrite.instructions,
      voiceSpec: { constraints: delta },
      sceneContext,
      key: keys.openai,
      temperature: tooSimilar ? 0.85 : 0.75,
      similarityRejection: tooSimilar
    });

    if (rewriteResult.ok) currentDraft = rewriteResult.text;
    else break;
  }

  return { final: currentDraft, critique: finalCritique, attempts };
}

async function main() {
  const rootEnv = readEnvFile(path.resolve("..", ".env"));
  const appEnv = readEnvFile(path.resolve(".env"));
  const openai = appEnv.VITE_OPENAI_KEY || rootEnv.OPENAI_KEY || rootEnv.VITE_OPENAI_KEY || appEnv.OPENAI_KEY;

  const sceneContext = `
CHAPTER BRIEF:
Title: The Interrogation
Chapter: 4
Location: Precinct 9, Interrogation Room B
Causality: The detective breaks the suspect's alibi.
Required Output: Suspect confesses to the location of the weapon.
Stakes: If he fails, the suspect walks in 20 minutes.
Characters Present: Detective Miller, Suspect Vance
Objects present: fluorescent light, manila folder, cold coffee in a paper cup, a pen with a cracked cap.
`;

  const input = "He felt very sad and everything was overwhelming as he sat at the desk and thought about how bad things had become.";

  const res = await runPipeline({
    text: input,
    keys: { openai },
    model: "llama3", // Assuming llama3 is available
    sceneContext
  });

  console.log(JSON.stringify(res, null, 2));
}

main().catch(console.error);