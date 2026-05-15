"use strict";
/**
 * galaxyClient.ts
 *
 * Direct port of galaxy_cli.py run/poll logic.
 * Uses the same workflow run → poll → delta extract flow.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfig = getConfig;
exports.runWorkflow = runWorkflow;
exports.buildPrompt = buildPrompt;
exports.trimMemory = trimMemory;
const vscode = __importStar(require("vscode"));
function getConfig() {
    const cfg = vscode.workspace.getConfiguration('galaxy');
    const apiKey = cfg.get('apiKey') || process.env.GALAXY_AI_API_KEY || '';
    if (!apiKey) {
        throw new Error('Galaxy AI: API key not set. Add it in Settings → galaxy.apiKey');
    }
    return {
        apiKey,
        baseUrl: cfg.get('baseUrl') || 'https://api.galaxy.ai/api/v1',
        workflowId: cfg.get('workflowId') || '',
        nodeId: cfg.get('nodeId') || '',
        maxTurns: cfg.get('maxTurns') || 6,
        pollInterval: cfg.get('pollInterval') || 1200,
    };
}
// ============================================================
// HTTP helpers (no external deps, uses Node built-ins)
// ============================================================
async function request(method, url, headers, body) {
    const options = {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    };
    const res = await fetch(url, options);
    const text = await res.text();
    try {
        return JSON.parse(text);
    }
    catch {
        return text;
    }
}
// ============================================================
// Output extractor — mirrors extract_output() in CLI
// ============================================================
function extractOutput(data) {
    const outputs = [];
    const nodeRuns = (data.nodeRuns || []);
    for (const node of nodeRuns) {
        const out = node.output;
        if (!out) {
            continue;
        }
        if (typeof out === 'object' && out !== null) {
            const obj = out;
            let found = false;
            for (const k of ['output', 'text', 'content', 'response', 'result']) {
                if (typeof obj[k] === 'string' && obj[k]) {
                    outputs.push(obj[k]);
                    found = true;
                    break;
                }
            }
            if (!found) {
                const meta = new Set(['model', 'usage', 'cost_usd', 'creditUsed', 'provider_used', 'status', 'id']);
                for (const k of Object.keys(obj)) {
                    if (!meta.has(k) && typeof obj[k] === 'string' && obj[k].trim()) {
                        outputs.push(obj[k]);
                        break;
                    }
                }
            }
        }
        else if (typeof out === 'string' && out.trim()) {
            outputs.push(out);
        }
    }
    return outputs.join('\n').trim();
}
// ============================================================
// Core run + poll — mirrors run_polling() in CLI
// onDelta fires whenever new text arrives (for live UI updates)
// ============================================================
async function runWorkflow(prompt, onDelta, cancelToken) {
    const cfg = getConfig();
    const headers = {
        'Authorization': `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
    };
    // Start run — same payload structure as CLI
    const payload = {
        workflowId: cfg.workflowId,
        values: {
            [cfg.nodeId]: {
                text_field: prompt,
            },
        },
    };
    const startRes = await request('POST', `${cfg.baseUrl}/runs`, headers, payload);
    const runId = startRes.runId;
    if (!runId) {
        throw new Error(`Galaxy AI: run start failed — ${JSON.stringify(startRes)}`);
    }
    const pollUrl = `${cfg.baseUrl}/runs/${runId}?inDetails=true`;
    let lastOutput = '';
    let fullOutput = '';
    // Poll loop — mirrors while True: in CLI
    while (true) {
        if (cancelToken?.isCancellationRequested) {
            throw new Error('Cancelled');
        }
        await sleep(cfg.pollInterval);
        const poll = await request('GET', pollUrl, headers);
        const status = poll.status;
        const current = extractOutput(poll);
        // Fire delta callback for live streaming feel in UI
        if (current && current !== lastOutput) {
            const delta = current.slice(lastOutput.length);
            if (delta && onDelta) {
                onDelta(delta);
            }
            lastOutput = current;
            fullOutput = current;
        }
        if (status === 'COMPLETED') {
            return fullOutput;
        }
        if (status === 'FAILED' || status === 'CANCELED') {
            throw new Error(`Galaxy AI: run ${status} — ${poll.error || 'no detail'}`);
        }
    }
}
// ============================================================
// Prompt builder — mirrors build_prompt() in CLI
// ============================================================
function buildPrompt(memory, userInput, maxTurns) {
    const turns = [...memory, { role: 'user', content: userInput }];
    const trimmed = turns.slice(-(maxTurns * 2));
    let prompt = '';
    for (const msg of trimmed) {
        const label = msg.role === 'user' ? 'USER' : 'ASSISTANT';
        prompt += `${label}:\n${msg.content}\n\n`;
    }
    return prompt.trim();
}
function trimMemory(memory, maxTurns) {
    return memory.slice(-(maxTurns * 2));
}
// ============================================================
// Utility
// ============================================================
function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}
//# sourceMappingURL=galaxyClient.js.map