import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateRewrite } from "../src/engine/rewrite.js";
import { callCritic } from "../src/engine/critic.js";
import { THROUGHPUT_TEST_SET } from "./throughputTestSet.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

function readEnvFile(filePath) {
  const vars = {};
  if (!fs.existsSync(filePath)) return vars;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    vars[key] = value;
  }
  return vars;
}

async function main() {
  const env = {
    ...readEnvFile(path.join(projectRoot, ".env")),
    ...process.env,
  };
  const openai = env.VITE_OPENAI_KEY || env.OPENAI_KEY;

  if (!openai) {
    throw new Error("Missing VITE_OPENAI_KEY or OPENAI_KEY in proselab/.env or process environment.");
  }

  console.log(`🚀 STARTING THROUGHPUT TEST (${THROUGHPUT_TEST_SET.length} samples)\n`);

  const results = [];
  const startAll = Date.now();

  for (const sample of THROUGHPUT_TEST_SET) {
    const startSample = Date.now();
    
    // 1. GENERATE
    const genRes = await generateRewrite({
      original: sample.text,
      instructions: ["Increase specificity and physical detail."],
      voiceSpec: {
        style: ["Sentence Length: short"],
        constraints: [],
        banned: []
      },
      key: openai,
      sceneContext: sample.sceneContext,
      sceneIntent: sample.sceneIntent,
      mode: "intent-repair"
    });

    const rewriteTime = Date.now() - startSample;

    // 2. CRITIQUE
    const criticStart = Date.now();
    const criticRes = await callCritic({
      text: genRes.text,
      sceneIntent: sample.sceneIntent,
      keys: { openai }
    });
    const critiqueTime = Date.now() - criticStart;

    const totalTime = Date.now() - startSample;

    results.push({
      id: sample.id,
      complexity: sample.complexity,
      rewriteTime,
      critiqueTime,
      totalTime,
      verdict: criticRes.verdict,
      overallScore: criticRes.score?.overall || 0,
      tokens: (genRes.response?.usage?.total_tokens || 0) + (criticRes.meta?.usage?.total_tokens || 0)
    });

    console.log(`[${sample.id}] ${sample.complexity} | ${totalTime}ms | Verdict: ${criticRes.verdict} | Score: ${criticRes.score?.overall}`);
  }

  const duration = Date.now() - startAll;
  
  const summary = {
    totalSamples: results.length,
    totalDurationMs: duration,
    avgTimePerSampleMs: duration / results.length,
    verdicts: {
      APPROVE: results.filter(r => r.verdict === "APPROVE").length,
      REWRITE: results.filter(r => r.verdict === "REWRITE").length
    },
    avgScore: results.reduce((s, r) => s + r.overallScore, 0) / results.length,
    totalTokens: results.reduce((s, r) => s + r.tokens, 0)
  };

  console.log("\n📈 THROUGHPUT SUMMARY");
  console.log(JSON.stringify(summary, null, 2));

  // Save results
  const reportPath = path.join(projectRoot, "throughput_report.json");
  fs.writeFileSync(reportPath, JSON.stringify({ summary, results }, null, 2));
  console.log(`\nReport saved to ${reportPath}`);
}

main().catch(err => {
  console.error("❌ THROUGHPUT TEST FAILED");
  console.error(err.message);
  process.exitCode = 1;
});
