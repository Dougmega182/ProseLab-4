import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderProgressBar } from "./progress.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * MANUAL AUDIT HARNESS
 * Presents borderline cases to the human expert for labeling.
 */

async function main() {
  const logPath = path.join(__dirname, "../bench/trust-benchmark-results.json");
  if (!fs.existsSync(logPath)) {
      console.error(`Benchmark results not found at ${logPath}. Run measure-trust-regression.mjs first.`);
      process.exit(1);
  }
  const results = JSON.parse(fs.readFileSync(logPath, "utf8"));
  
  // Filter for Borderline / Divergent cases
  const candidates = results.filter(r => 
    r.divergence.is_critical || 
    r.shadow.verdict === "UNCERTAIN" || 
    r.shadow.verdict === "LOW_FAIL"
  ).slice(0, 30);

  console.log(`🧐 MANUAL AUDIT: ${candidates.length} BORDERLINE CASES`);
  console.log("--------------------------------------------------\n");

  const audited = [];
  let current = 0;

  for (const c of candidates) {
      current++;
      renderProgressBar(current, candidates.length, `Auditing ${c.id}`);
      
      audited.push({
          ...c,
          human_label: "PENDING",
          human_style_tag: "PENDING",
          human_improvement: "PENDING"
      });
  }

  const reviewPath = path.join(__dirname, "../bench/manual-audit-review.json");
  fs.writeFileSync(reviewPath, JSON.stringify(audited, null, 2));
  console.log(`\n✅ Audit file saved to ${reviewPath}.`);
  console.log("ACTION: Manually edit 'human_label' (PASS/FAIL) and add a 'justification' field in the JSON file.");
}

main().catch(console.error);
