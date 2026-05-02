import { EngineV1 } from "./v1/api.js";

/**
 * SHADOW LAYER
 * Responsibility: Run the new hardened engine in parallel with the legacy pipeline.
 * Collects divergence data to detect regression and false positives before cutover.
 */

export const ShadowManager = {
    state: {
        consecutive_failures: 0,
        disabled_until: 0
    },

    getLog() {
        try {
            return JSON.parse(localStorage.getItem("proselab_shadow_log") || "[]");
        } catch {
            return [];
        }
    },

    record({ input, output, legacyResult, sceneIntent, keys }) {
        if (Date.now() < this.state.disabled_until) return;

        const log = this.getLog();
        
        // Non-blocking shadow execution
        this.runShadowAnalysis({ input, legacyResult, sceneIntent, keys }).then(shadowResult => {
            if (shadowResult.error) {
                this.state.consecutive_failures++;
                if (this.state.consecutive_failures >= 3) {
                    this.state.disabled_until = Date.now() + (1000 * 60 * 10); // Disable for 10 mins
                    console.error("🚨 SHADOW LAYER CIRCUIT BREAKER TRIPPED. Disabling for 10 minutes.");
                }
                return;
            }
            this.state.consecutive_failures = 0;

            const entry = {
                timestamp: Date.now(),
                id: `shadow-${Math.random().toString(36).substr(2, 5)}`,
                input_sample: input.substring(0, 100) + "...",
                legacy: {
                    verdict: legacyResult.verdict,
                    intent_verdict: legacyResult.intent_verdict,
                    attempts: legacyResult.attempts
                },
                shadow: shadowResult,
                divergence: this.calculateDivergence(legacyResult, shadowResult, input, output)
            };
            
            log.push(entry);
            const trimmed = log.slice(-100);
            localStorage.setItem("proselab_shadow_log", JSON.stringify(trimmed));
            
            if (entry.divergence.is_critical) {
                console.warn("🚨 SHADOW DIVERGENCE DETECTED", entry);
            }
        }).catch(err => {
            this.state.consecutive_failures++;
        });
    },

    async runShadowAnalysis({ input, legacyResult, sceneIntent, keys }) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

        try {
            const start = Date.now();
            const res = await EngineV1.evaluate({
                text: input,
                sceneIntent,
                keys,
                flags: {
                    MAX_ITERATIONS: 1,
                    USE_STYLE_REFINEMENT: false,
                    ABORT_SIGNAL: controller.signal
                }
            });
            clearTimeout(timeout);
            
            return {
                verdict: res.intent?.result || "FAIL",
                confidence: res.intent?.confidence || 0,
                latency: Date.now() - start,
                primary_failure: res.intent?.primary_failure || null
            };
        } catch (e) {
            clearTimeout(timeout);
            return { error: e.message };
        }
    },

    calculateDivergence(legacy, shadow, input, output) {
        if (shadow.error) return { is_critical: false, type: "ERROR" };
        
        const legacyPass = (legacy.verdict === "APPROVE" || legacy.intent_verdict === "PASS");
        const shadowPass = (shadow.verdict === "HIGH_PASS" || shadow.verdict === "LOW_PASS");
        
        const drift = this.calculateStyleDrift(input, output);
        const style_tags = this.detectStyleCluster(input);
        
        let type = "ALIGNMENT";
        let is_critical = false;
        let desc = "";

        if (legacyPass && !shadowPass) {
            is_critical = true;
            type = "FALSE_POSITIVE_RISK";
            desc = "Legacy approved, but Shadow rejected/uncertain (Potential False Abstain).";
        } else if (!legacyPass && shadowPass) {
            is_critical = true;
            type = "OVER_EDITING_RISK";
            desc = "Legacy rejected, but Shadow approved (Potential False Pass).";
        } else if (shadow.verdict === "UNCERTAIN") {
            type = "AMBIGUITY";
            desc = "Shadow is uncertain.";
        }

        return { 
            is_critical, 
            type, 
            desc, 
            drift,
            style_tags,
            score_band: Math.floor(shadow.confidence * 10) / 10 
        };
    },

    detectStyleCluster(text) {
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const words = text.toLowerCase().split(/\s+/);
        
        const lengths = sentences.map(s => s.trim().split(/\s+/).length);
        const avgLen = lengths.reduce((a,b)=>a+b,0) / lengths.length;
        const variance = lengths.reduce((a,b) => a + Math.pow(b-avgLen, 2), 0) / lengths.length;
        const stdDev = Math.sqrt(variance);

        const tags = [];
        if (stdDev < 3) tags.push("MINIMALIST");
        if (text.includes('"') || text.includes("'")) tags.push("DIALOGUE_HEAVY");
        
        const receipts = ["nodded", "replied", "said", "responded", "heard", "knew"];
        const explicitCount = words.filter(w => receipts.includes(w)).length;
        if (explicitCount > 2) tags.push("EXPLICIT_FUNCTIONAL");
        
        return tags;
    },

    calculateStyleDrift(input, output) {
        if (!output) return null;
        const getSentences = (t) => t.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const inSents = getSentences(input);
        const outSents = getSentences(output);
        
        const getAvgLen = (sents) => sents.reduce((a, b) => a + b.split(/\s+/).length, 0) / (sents.length || 1);
        
        const inAvg = getAvgLen(inSents);
        const outAvg = getAvgLen(outSents);
        
        return {
            length_shift: outAvg - inAvg,
            complexity_delta: outSents.length - inSents.length
        };
    },

    getTailMetrics() {
        const log = this.getLog();
        if (log.length === 0) return null;
        
        const latencies = log.map(e => e.shadow.latency).sort((a,b) => a - b);
        const p95 = latencies[Math.floor(latencies.length * 0.95)];
        
        const bands = {};
        log.forEach(e => {
            const b = e.divergence.score_band;
            if (!bands[b]) bands[b] = { total: 0, critical: 0 };
            bands[b].total++;
            if (e.divergence.is_critical) bands[b].critical++;
        });

        return { p95, bands, total: log.length };
    },

    clear() {
        localStorage.removeItem("proselab_shadow_log");
    }
};
