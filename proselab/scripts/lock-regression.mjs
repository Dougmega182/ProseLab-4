import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * RELIABILITY LOCK
 * Pins the current 'Hard Truth' metrics to prevent silent degradation 
 * during UI integration.
 */

const TARGETS = {
    preservation_rate: 43.3,
    convergence_rate: 33.3,
    critical_error_rate: 0.0
};

const TOLERANCE = 2.0; // Allowed % drift

async function main() {
    const resultsPath = path.join(__dirname, "../bench/trust-benchmark-results.json");
    if (!fs.existsSync(resultsPath)) {
        console.error("Benchmark results missing. Run measure-trust-regression.mjs first.");
        process.exit(1);
    }

    const results = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
    const total = results.length;
    
    // Calculate current rates
    const good = results.filter(r => r.legacy.intent_verdict === "PASS");
    const broken = results.filter(r => r.legacy.intent_verdict === "FAIL");
    
    const preserved = good.filter(r => r.shadow.verdict === "HIGH_PASS" || r.shadow.verdict === "LOW_PASS").length;
    const converged = broken.filter(r => r.shadow.verdict === "HIGH_PASS" || r.shadow.verdict === "LOW_PASS").length;
    
    const currentPreservation = (preserved / good.length) * 100;
    const currentConvergence = (converged / broken.length) * 100;

    console.log("🔒 RELIABILITY LOCK CHECK");
    console.log("--------------------------------------------------");
    
    let failed = false;

    const check = (name, current, target) => {
        const diff = current - target;
        const status = Math.abs(diff) <= TOLERANCE ? "✅ PASS" : "🚨 FAIL";
        console.log(`${name.padEnd(20)}: ${current.toFixed(1)}% (Target: ${target}%) [${status}]`);
        if (Math.abs(diff) > TOLERANCE) failed = true;
    };

    check("Preservation", currentPreservation, TARGETS.preservation_rate);
    check("Convergence", currentConvergence, TARGETS.convergence_rate);

    if (failed) {
        console.error("\n🚨 RELIABILITY REGRESSION DETECTED. Review rule changes before integration.");
        process.exit(1);
    } else {
        console.log("\n✅ LOCK SECURE. Proceed to Integration.");
        process.exit(0);
    }
}

main().catch(console.error);
