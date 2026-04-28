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
  style: ["mix short and long sentences", "allow fragments"],
  constraints: ["no generic emotional statements", "prefer physical over abstract"],
  banned: ["very", "suddenly", "felt"],
};

const SAMPLES = [
  {
    id: "p1",
    text: "He felt very sad and everything was overwhelming as he stood in the room and thought about how bad things had become.",
  },
  {
    id: "p2",
    text: "She was scared of what might happen next, so she tried to stay calm and not let anyone see how afraid she was.",
  },
  {
    id: "p3",
    text: "The situation was getting worse and he knew it. There was nothing he could do about it.",
  },
  {
    id: "p4",
    text: "It was a dark and difficult time. She struggled every day just to get through it.",
  },
  {
    id: "p5",
    text: "He walked down the hall. He looked around. He was nervous. It was bad.",
  },
];

async function runCycle(input, openai) {
  const critique1 = await callCritic({ text: input, keys: { openai } });

  const rewrite1 = await generateRewrite({
    original: input,
    instructions: critique1.rewrite.instructions,
    voiceSpec,
    key: openai,
    temperature: 0.75,
  });

  const draft2 = rewrite1.text;
  const similarity1 = estimateSimilarity(input, draft2);
  const tooSimilar = similarity1 > SIMILARITY_THRESHOLD;

  let finalDraft = draft2;
  let similarityGateFired = false;
  let draft3 = null;

  if (tooSimilar) {
    similarityGateFired = true;
    const rewrite2 = await generateRewrite({
      original: input,
      instructions: critique1.rewrite.instructions,
      voiceSpec,
      key: openai,
      temperature: 0.85,
      similarityRejection: true,
    });
    draft3 = rewrite2.text;
    finalDraft = draft3;
  }

  const critique2 = await callCritic({ text: finalDraft, keys: { openai } });
  const finalSimilarity = estimateSimilarity(input, finalDraft);

  return {
    input,
    critique1,
    draft2,
    similarity1,
    similarityGateFired,
    ...(draft3 ? { draft3 } : {}),
    finalDraft,
    critique2,
    finalSimilarity,
    weakRewrite: finalSimilarity > SIMILARITY_THRESHOLD,
  };
}

function buildSummary(results) {
  const rejected = results.filter((r) => r.critique2.verdict === "REWRITE").length;
  const approved = results.filter((r) => r.critique2.verdict === "APPROVE").length;
  const gatesFired = results.filter((r) => r.similarityGateFired).length;
  const weakRewrites = results.filter((r) => r.weakRewrite).length;
  const avgSimilarity1 =
    results.reduce((s, r) => s + r.similarity1, 0) / results.length;
  const avgFinalSimilarity =
    results.reduce((s, r) => s + r.finalSimilarity, 0) / results.length;

  return {
    total: results.length,
    approved,
    rejected,
    gatesFired,
    weakRewrites,
    avgSimilarity1: Number(avgSimilarity1.toFixed(4)),
    avgFinalSimilarity: Number(avgFinalSimilarity.toFixed(4)),
  };
}

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

  const results = [];

  for (const sample of SAMPLES) {
    console.error(`Running ${sample.id}...`);
    const result = await runCycle(sample.text, openai);
    results.push({ id: sample.id, ...result });
  }

  const summary = buildSummary(results);

  console.log(JSON.stringify({ summary, results }, null, 2));
}

main().catch((err) => {
  console.error("FIVE CYCLE RUN FAILED");
  console.error(err.message);
  process.exitCode = 1;
});
