import fs from "node:fs";
import path from "node:path";
import { callCritic } from "../src/engine/critic.js";
import { estimateSimilarity, generateRewrite } from "../src/engine/rewrite.js";

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
  "He felt very sad and everything was overwhelming as he stood in the room and thought about how bad things had become.";

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
  });

  const rewriteResult = await generateRewrite({
    original: input,
    instructions: critique1.rewrite.instructions,
    voiceSpec,
    key: openai,
    temperature: 0.75,
  });

  const draft2 = rewriteResult.text;

  const critique2 = await callCritic({
    text: draft2,
    keys: { openai },
  });

  const similarity = estimateSimilarity(input, draft2);

  console.log(
    JSON.stringify(
      {
        input,
        critique1,
        draft2,
        critique2,
        similarity,
        weakRewrite: similarity > 0.8,
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
