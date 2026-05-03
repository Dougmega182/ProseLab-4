import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runPipeline } from "../src/engine/pipeline.js";
import { ShadowManager } from "../src/engine/shadowLayer.js";
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

async function main() {
  const env = { ...readEnvFile(path.join(projectRoot, ".env")), ...process.env };
  const openai = env.VITE_OPENAI_KEY || env.OPENAI_KEY;
  if (!openai) { console.error("Missing key"); process.exit(1); }
  const keys = { openai };

  const benchPath = path.join(__dirname, "../bench/trust-benchmark.json");
  if (!fs.existsSync(benchPath)) {
      console.error("Trust benchmark not found. Run generate-trust-benchmark.mjs first.");
      process.exit(1);
  }
  const dataset = JSON.parse(fs.readFileSync(benchPath, "utf8"));

  console.log(`🛡️  FULL TRUST & UTILITY BENCHMARK (${dataset.length} samples)`);
  console.log("Goal: High preservation for GOOD, High improvement for MEDIOCRE/BROKEN.\n");

  const stats = {
      good: { total: 0, regressed: 0, preserved: 0 },
      mediocre: { total: 0, improved: 0, unchanged: 0, degraded: 0 },
      broken: { total: 0, converged: 0, improved: 0, failed: 0 },
      total_attempts: 0,
      total_time: 0
  };

  let current = 0;
  const shadowEntries = [];

  for (const item of dataset) {
    const quality = item.metadata.quality.toLowerCase();
    current++;
    renderProgressBar(current, dataset.length, `Testing ${item.id}`);

    const start = Date.now();
    const res = await runPipeline({
      text: item.text,
      sceneIntent: item.intent,
      sceneContext: "A noir scene with strict narrative integrity.",
      keys,
      onStage: () => {}
    });
    const duration = Date.now() - start;
    stats.total_time += duration;
    stats.total_attempts += res.attempts;

    const firstTrace = res.traces[0];
    const startStyle = firstTrace?.critique?.meta?.style?.score || 0;
    const finalStyle = (res.intent?.meta?.style?.score || res.critique?.meta?.style?.score) || 0;
    const converged = (res.intent?.result === "HIGH_PASS" || res.intent?.result === "LOW_PASS" || res.critique?.verdict === "APPROVE");
    
    // RECORD FOR SHADOW LOG
    shadowEntries.push({
        timestamp: Date.now(),
        id: `bench-${item.id}`,
        input_sample: item.text.substring(0, 100) + "...",
        full_input: item.text,
        full_output: res.final,
        legacy: {
            verdict: "N/A (Bench)",
            intent_verdict: item.gold_label,
            attempts: res.attempts
        },
        shadow: {
            verdict: res.intent?.result || "FAIL",
            confidence: res.intent?.confidence || 0,
            latency: duration,
            primary_failure: res.intent?.primary_failure || null
        },
        divergence: ShadowManager.calculateDivergence(
            { verdict: item.gold_label === 'PASS' ? 'APPROVE' : 'REWRITE', intent_verdict: item.gold_label },
            { verdict: res.intent?.result || "FAIL", confidence: res.intent?.confidence || 0 },
            item.text,
            res.final
        )
    });

    if (quality === "good") {
        stats.good.total++;
        if (converged && finalStyle >= startStyle * 0.9) {
            stats.good.preserved++;
        } else {
            stats.good.regressed++;
        }
    } else if (quality === "mediocre") {
        stats.mediocre.total++;
        if (converged) {
            stats.mediocre.improved++;
        } else if (finalStyle < startStyle) {
            stats.mediocre.degraded++;
        } else {
            stats.mediocre.unchanged++;
        }
    } else if (quality === "broken") {
        stats.broken.total++;
        if (converged) {
            stats.broken.converged++;
        } else if (finalStyle > startStyle) {
            stats.broken.improved++;
        } else {
            stats.broken.failed++;
        }
    }
  }

  console.log(`\n📊 FINAL TRUST SUMMARY:`);
  console.log(`[GOOD PROSE] Preservation Rate: ${(stats.good.preserved/stats.good.total*100 || 0).toFixed(1)}%`);
  console.log(`             Regression Rate:   ${(stats.good.regressed/stats.good.total*100 || 0).toFixed(1)}%`);
  console.log(`[MEDIOCRE]   Improvement Rate:  ${(stats.mediocre.improved/stats.mediocre.total*100 || 0).toFixed(1)}%`);
  console.log(`[BROKEN]     Convergence Rate:  ${(stats.broken.converged/stats.broken.total*100 || 0).toFixed(1)}%`);
  console.log(`\n[EFFICIENCY] Avg Time: ${(stats.total_time/dataset.length).toFixed(0)}ms`);
  console.log(`             Avg Attempts: ${(stats.total_attempts/dataset.length).toFixed(2)}`);

  // EXPORT FOR MANUAL AUDIT
  const resultsPath = path.join(__dirname, "../bench/trust-benchmark-results.json");
  fs.writeFileSync(resultsPath, JSON.stringify(shadowEntries, null, 2));
  console.log(`\n✅ Benchmark results exported to ${resultsPath} for manual audit.`);
}

main().catch(console.error);
