import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { callOpenAI } from "../src/services/llm.js";
import { renderProgressBar } from "./progress.js";

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
    vars[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
  }
  return vars;
}

async function generateCase(quality, key) {
  const prompt = `Generate a 100-word prose sample for a writing engine benchmark.
Quality Level: ${quality} (Options: GOOD, MEDIOCRE, BROKEN)

GOOD: High-quality, grounded, literary prose with clear intent.
MEDIOCRE: Slightly clichéd, uniform sentence lengths, okay logic.
BROKEN: Contradictory logic, missing information, repetitive slop.

Return ONLY JSON:
{
  "id": "${quality.toLowerCase()}-${Math.random().toString(36).substr(2, 5)}",
  "text": "...",
  "intent": {
    "intent_type": "INFORMATION_TRANSFER",
    "roles": { "source": "Miller", "target": "Vance", "content": "the code" }
  },
  "gold_label": "${quality === 'GOOD' ? 'PASS' : (quality === 'MEDIOCRE' ? 'PARTIAL' : 'FAIL')}",
  "metadata": { "quality": "${quality}" }
}`;

  const response = await callOpenAI(key, prompt, { model: "gpt-4o" });
  if (!response?.ok) return null;
  try {
     let content = response.content.trim();
     if (content.startsWith("```json")) content = content.replace(/^```json/, "").replace(/```$/, "");
     else if (content.startsWith("```")) content = content.replace(/^```/, "").replace(/```$/, "");
     return JSON.parse(content);
  } catch { return null; }
}

async function main() {
  const env = { ...readEnvFile(path.join(projectRoot, ".env")), ...process.env };
  const openai = env.VITE_OPENAI_KEY || env.OPENAI_KEY;
  if (!openai) { console.error("Missing key"); process.exit(1); }

  console.log("💎 GENERATING TRUST BENCHMARK (100 samples)...");
  const dataset = [];

  const qualities = ["GOOD", "MEDIOCRE", "BROKEN"];
  let current = 0;
  const total = 100;

  for (const q of qualities) {
    const count = q === "GOOD" ? 30 : (q === "MEDIOCRE" ? 40 : 30);
    for (let i = 0; i < count; i++) {
      const test = await generateCase(q, openai);
      if (test) dataset.push(test);
      current++;
      renderProgressBar(current, total, `Generating ${q}`);
      await new Promise(r => setTimeout(r, 800));
    }
  }

  const outPath = path.join(__dirname, "../bench/trust-benchmark.json");
  fs.writeFileSync(outPath, JSON.stringify(dataset, null, 2));
  console.log(`\n✅ Trust Benchmark saved to ${outPath} (${dataset.length} samples)`);
}

main().catch(console.error);
