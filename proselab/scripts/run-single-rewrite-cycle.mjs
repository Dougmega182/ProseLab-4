import fs from "node:fs";
import path from "node:path";
import { callCritic } from "../src/engine/critic.js";
import { estimateSimilarity, generateRewrite } from "../src/engine/rewrite.js";

const SIMILARITY_THRESHOLD = 0.75;

function readEnvFile(filePath) {
  const vars = {};
  if (!fs.existsSync(filePath)) return vars;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    vars[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return vars;
}

const voiceSpec = {
  style: [
    "mix short and long sentences",
    "allow fragments",
  ],
  constraints: [
    "no generic emotional statements",
    "prefer physical over abstract",
  ],
  banned: [
    "very",
    "suddenly",
    "felt",
  ],
};

const input =
  "He felt very sad and everything was overwhelming as he sat at the desk and thought about how bad things had become.";

const sceneContext = `
Scene: A detective sits at a metal desk in a police interview room.
Objects present: fluorescent light, manila folder, cold coffee in a paper cup, a pen with a cracked cap.
`;

async function main() {
  const rootEnv = readEnvFile(path.resolve("..", ".env"));
  const appEnv = readEnvFile(path.resolve(".env"));
  const openai =
    appEnv.VITE_OPENAI_KEY ||
    rootEnv.OPENAI_KEY ||
    rootEnv.VITE_OPENAI_KEY ||
    appEnv.OPENAI_KEY ||
    "";

  if (!openai) {
    throw new Error("Missing OpenAI key in root or app env file.");
  }
const critique1 = await callCritic({
  text: input,
  keys: { openai },
  sceneContext,
});

const rewrite1 = await generateRewrite({
  original: input,
  instructions: critique1.rewrite.instructions,
  voiceSpec,
  sceneContext,
  key: openai,
  temperature: 0.75,
});

const draft2 = rewrite1.text;
const similarity1 = estimateSimilarity(input, draft2);
const tooSimilar = similarity1 > SIMILARITY_THRESHOLD;

let finalDraft = draft2;
let similarityGateFired = false;
let rewrite2 = null;

if (tooSimilar) {
  similarityGateFired = true;
  rewrite2 = await generateRewrite({
    original: input,
    instructions: critique1.rewrite.instructions,
    voiceSpec,
    sceneContext,
    key: openai,
    temperature: 0.85,
    similarityRejection: true,
  });
  finalDraft = rewrite2.text;
}

const critique2 = await callCritic({
  text: finalDraft,
  keys: { openai },
  sceneContext,
});

  const similarity = estimateSimilarity(input, finalDraft);

  console.log(
    JSON.stringify(
      {
        input,
        critique1,
        draft2,
        similarity1,
        similarityGateFired,
        ...(similarityGateFired ? { draft3: finalDraft } : {}),
        critique2,
        similarity,
        weakRewrite: similarity > SIMILARITY_THRESHOLD,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error("SINGLE REWRITE CYCLE FAILED");
  console.error(err.message);
  process.exitCode = 1;
});
