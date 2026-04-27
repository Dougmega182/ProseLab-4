import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { callCritic } from "../src/engine/critic.js";
import { CRITIC_CHALLENGE_SET } from "../src/engine/criticChallengeSet.js";

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

function buildSummary(results) {
  const approve = results.filter((r) => r.result.verdict === "APPROVE").length;
  const rewrite = results.filter((r) => r.result.verdict === "REWRITE").length;
  const avgOverall =
    results.reduce((sum, r) => sum + r.result.score.overall, 0) / results.length;
  const highConfidenceApprovals = results.filter(
    (r) =>
      r.result.verdict === "APPROVE" && r.result.confidence === "high",
  ).length;
  const mismatches = results.filter(
    (r) => r.result.verdict !== r.expectedVerdict,
  ).length;

  return {
    total: results.length,
    approve,
    rewrite,
    avgOverall: Number(avgOverall.toFixed(2)),
    highConfidenceApprovals,
    mismatches,
  };
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

  const results = [];

  for (const sample of CRITIC_CHALLENGE_SET) {
    const result = await callCritic({
      text: sample.text,
      keys: { openai },
    });

    results.push({
      ...sample,
      result,
    });
  }

  const summary = buildSummary(results);

  console.log("CRITIC CHALLENGE SUMMARY");
  console.log(JSON.stringify(summary, null, 2));
  console.log("");

  console.log("CRITIC CHALLENGE DETAILS");
  for (const item of results) {
    console.log(
      JSON.stringify(
        {
          id: item.id,
          bucket: item.bucket,
          expectedVerdict: item.expectedVerdict,
          actualVerdict: item.result.verdict,
          confidence: item.result.confidence,
          valid: item.result.meta.valid,
          reason: item.result.meta.reason,
          overall: item.result.score.overall,
          failures: item.result.failures.map((f) => f.type),
          rewriteDirective: item.result.rewrite_directive,
        },
        null,
        2,
      ),
    );
  }
}

main().catch((err) => {
  console.error("CRITIC CHALLENGE FAILED");
  console.error(err.message);
  process.exitCode = 1;
});
