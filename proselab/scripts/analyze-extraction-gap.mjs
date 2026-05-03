import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * RE-AUDIT ANALYSIS
 * Compares the latest benchmark run against the manual audit.
 * Measures if Substance Guard reduced False Positives.
 */

async function main() {
    const auditPath = path.join(__dirname, "../bench/manual-audit-review.json");
    const benchPath = path.join(__dirname, "../bench/trust-benchmark-results.json");

    if (!fs.existsSync(auditPath) || !fs.existsSync(benchPath)) {
        console.error("Audit or Bench results missing.");
        process.exit(1);
    }

    const audit = JSON.parse(fs.readFileSync(auditPath, "utf8"));
    const bench = JSON.parse(fs.readFileSync(benchPath, "utf8"));

    console.log("🧐 SUBSTANCE GUARD RE-AUDIT ANALYSIS");
    console.log("--------------------------------------------------");

    let corrected = 0;
    let leaked = 0;
    let totalFails = audit.filter(a => a.human_label === "FAIL").length;

    audit.forEach(a => {
        if (a.human_label === "FAIL") {
            const b = bench.find(item => item.id === a.id);
            if (b) {
                const shadowPass = (b.shadow.verdict === "HIGH_PASS" || b.shadow.verdict === "LOW_PASS");
                if (!shadowPass) {
                    corrected++;
                    // console.log(`[CORRECTED] ${a.id}: Now rejected. Reason: ${b.shadow.primary_failure}`);
                } else {
                    leaked++;
                    // console.log(`[LEAKED]    ${a.id}: Still passing. Conf: ${b.shadow.confidence}`);
                }
            }
        }
    });

    console.log(`False Positive Suppression: ${((corrected / totalFails) * 100).toFixed(1)}%`);
    console.log(`Total Corrected:           ${corrected} / ${totalFails}`);
    console.log(`Still Leaking:             ${leaked}`);

    if (leaked > 0) {
        console.log("\n💡 INSIGHT: Some meta-discussion still bypasses the guard. Check for novel phrasing.");
    } else {
        console.log("\n✅ SUCCESS: All audited false positives suppressed.");
    }
}

main().catch(console.error);
