// @ts-nocheck
/* global process, Buffer */
export const TraceManager = {
  mode: "LIVE", // LIVE | RECORD | REPLAY
  currentTrace: null,
  
  startRecording() {
    this.mode = "RECORD";
    this.currentTrace = [];
  },
  
  startReplay(trace) {
    this.mode = "REPLAY";
    this.currentTrace = [...trace];
  },

  async intercept(fn) {
    if (this.mode === "REPLAY") {
      const entry = this.currentTrace.shift();
      if (!entry) throw new Error("REPLAY_ERROR: Trace exhausted.");
      return entry;
    }

    const result = await fn();

    if (this.mode === "RECORD") {
      this.currentTrace.push(result);
    }

    return result;
  }
};

export const CircuitBreaker = {
  window: [],
  windowSize: 40,
  errorThreshold: 0.25, // 25% error rate
  latencyThreshold: 120000, // 120s p90 (generous for multi-model Galaxy pipelines)
  state: "CLOSED", // CLOSED | OPEN | HALF_OPEN
  lastTrip: 0,
  
  record(success, duration, errorType = null) {
    this.window.push({ success, duration, errorType, ts: Date.now() });
    if (this.window.length > this.windowSize) this.window.shift();
    this.evaluate();
  },
  
  evaluate() {
    if (this.window.length < 5) return; // Warmup

    const errors = this.window.filter(w => !w.success).length;
    const errorRate = errors / this.window.length;
    
    const latencies = this.window.map(w => w.duration).sort((a, b) => a - b);
    const p90 = latencies[Math.floor(latencies.length * 0.9)];

    if (errorRate > this.errorThreshold || p90 > this.latencyThreshold) {
      if (this.state !== "OPEN") {
        this.state = "OPEN";
        this.lastTrip = Date.now();
        console.warn(`🚨 CIRCUIT BREAKER TRIPPED: ErrorRate=${(errorRate*100).toFixed(1)}%, p90=${p90}ms`);
      }
    }
  },
  
  isOpen() {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastTrip > 60000) {
        this.state = "HALF_OPEN";
        return false;
      }
      return true;
    }
    if (this.state === "HALF_OPEN") {
      return Math.random() > 0.1; // Allow 10% through
    }
    return false;
  },

  onSuccess() {
    if (this.state === "HALF_OPEN") this.state = "CLOSED";
  }
};

// Galaxy AI configuration from env
const GALAXY_CONFIG = {
  key: (typeof import.meta !== "undefined" && import.meta.env?.VITE_GALAXY_AI_API_KEY) || (typeof process !== "undefined" && process.env?.VITE_GALAXY_AI_API_KEY) || "",
  workflowId: (typeof import.meta !== "undefined" && import.meta.env?.VITE_GALAXY_WORKFLOW_ID) || (typeof process !== "undefined" && process.env?.VITE_GALAXY_WORKFLOW_ID) || "",
  nodeId: (typeof import.meta !== "undefined" && import.meta.env?.VITE_GALAXY_NODE_ID) || (typeof process !== "undefined" && process.env?.VITE_GALAXY_NODE_ID) || "",
};

export function resolveGalaxyUrl(path) {
  if (typeof window === "undefined" || (typeof process !== "undefined" && process.env?.NODE_ENV === "test")) {
    // We are in Node.js, map relative path to direct API endpoint
    return path.replace(/^\/api\/galaxy/, "https://api.galaxy.ai/api/v1");
  }
  return path;
}

/**
 * Call Galaxy AI workflow API.
 * Starts a run, polls for completion, extracts output.
 * Returns the same { ok, content, error, raw } shape as callOpenAI.
 */
export async function callGalaxy(key, prompt, options = {}) {
  const {
    timeout = 180000, // 3 min timeout for polling
    pollInterval = 1200,
  } = options;

  let runId = null;
  let payloadBytesCount = 0;

  // Use passed key if it's a Galaxy key, otherwise use the env config key
  const isGalaxyKey = key && typeof key === 'string' && key.startsWith('gx_');
  const galaxyKey = isGalaxyKey ? key : (GALAXY_CONFIG.key || (typeof process !== "undefined" && process.env?.VITE_GALAXY_AI_API_KEY) || "");
  const workflowId = GALAXY_CONFIG.workflowId || (typeof process !== "undefined" && process.env?.VITE_GALAXY_WORKFLOW_ID) || "";
  const nodeId = GALAXY_CONFIG.nodeId || (typeof process !== "undefined" && process.env?.VITE_GALAXY_NODE_ID) || "";

  if (!galaxyKey || !workflowId || !nodeId) {
    return { ok: false, error: "Galaxy AI not configured (missing key, workflow, or node ID)", raw: null };
  }

  const headers = {
    "Authorization": `Bearer ${galaxyKey}`,
    "Content-Type": "application/json"
  };

  // Aggressive browser vs node runtime instrumentation
  console.log("[GALAXY RUN DIAGNOSTICS]", {
    environment: typeof window !== "undefined" ? "BROWSER" : "NODE",
    keyType: galaxyKey ? (galaxyKey.startsWith("gx_") ? "GALAXY" : galaxyKey.startsWith("sk-") ? "OPENAI" : "OTHER") : "MISSING",
    keyLength: galaxyKey ? galaxyKey.length : 0,
    keyPreview: galaxyKey ? galaxyKey.slice(0, 8) + "..." : "none",
    workflowId,
    nodeId
  });

  const isDebug = (typeof window !== "undefined" && window.PROSELAB_DEBUG_LLM) ||
    (typeof import.meta !== "undefined" && import.meta.env?.PROSELAB_DEBUG_LLM) || true; // Force-enable for active debugging

  if (isDebug) {
    console.log("[GALAXY REQUEST]", { workflowId, nodeId, prompt: prompt.slice(0, 200) + "..." });
  }

  const start = Date.now();

  try {
    const url = resolveGalaxyUrl("/api/galaxy/runs");
    
    const requestBodyObj = {
      workflowId,
      values: {
        [nodeId]: {
          text_field: prompt
        }
      }
    };
    
    const body = requestBodyObj;
    const serializedBody = JSON.stringify(body);

    // Hard payload-byte guardrail to prevent regression (set generously to 100KB to allow full-scene novel prose)
    const MAX_PAYLOAD_BYTES = 100000;
    payloadBytesCount = typeof TextEncoder !== "undefined"
      ? new TextEncoder().encode(serializedBody).length
      : (typeof Buffer !== "undefined" ? Buffer.byteLength(serializedBody, "utf8") : serializedBody.length);

    if (payloadBytesCount > MAX_PAYLOAD_BYTES) {
      throw new Error(`Galaxy request payload size (${payloadBytesCount} bytes) exceeds the safe execution envelope of ${MAX_PAYLOAD_BYTES} bytes. Please compress your prompt instructions or scene context to prevent upstream deadlocks.`);
    }
    let safeBtoaVal = "unsupported";
    if (typeof btoa !== "undefined") {
      try {
        safeBtoaVal = btoa(JSON.stringify(body));
      } catch (e) {
        // Safe UTF-8/Unicode base64 fallback for browser
        safeBtoaVal = btoa(unescape(encodeURIComponent(JSON.stringify(body))));
      }
    } else if (typeof Buffer !== "undefined") {
      safeBtoaVal = Buffer.from(JSON.stringify(body)).toString("base64");
    }
    console.log("RUN PAYLOAD HASH:", safeBtoaVal);
    console.log("RUN PAYLOAD LENGTH:", serializedBody.length);
    console.log("BROWSER COOKIES:", typeof document !== "undefined" ? document.cookie : "none");
    console.log("[GALAXY START RUN] Initiating fetch", { 
      url, 
      headers: { 
        ...headers, 
        "Authorization": headers.Authorization ? headers.Authorization.slice(0, 15) + "..." : "missing" 
      } 
    });
    
    // Step 1: Start the run
    const startRes = await fetch(url, {
      method: "POST",
      headers,
      body: serializedBody
    });

    console.log("[GALAXY START RUN RESPONSE STATUS]", startRes.status, startRes.statusText);

    if (!startRes.ok) {
      const errText = await startRes.text();
      CircuitBreaker.record(false, Date.now() - start, startRes.status);
      console.error("[GALAXY RUN ERROR DETAILS]", {
        status: startRes.status,
        statusText: startRes.statusText,
        errorBody: errText
      });
      return { ok: false, status: startRes.status, error: errText, raw: errText };
    }

    const startData = await startRes.json();
    console.log("[GALAXY START RUN PAYLOAD]", JSON.stringify(startData));
    const runId = startData.runId;

    if (!runId) {
      CircuitBreaker.record(false, Date.now() - start, "NO_RUN_ID");
      return { ok: false, error: "Galaxy returned no runId", raw: JSON.stringify(startData) };
    }

    // Step 2: Poll for completion
    let lastStatus = "";
    let lastStatusChangeTime = Date.now();
    let lastCompletedCount = 0;
    let lastProgressionTime = Date.now();
    let lastPollData = null;
    let completionGraceStart = null;

    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, pollInterval));

      const pollUrl = resolveGalaxyUrl(`/api/galaxy/runs/${runId}?inDetails=true`);
      console.log("[GALAXY POLL REQUEST] Fetching status", { pollUrl, runId });

      const pollRes = await fetch(pollUrl, {
        method: "GET",
        headers
      });

      console.log("[GALAXY POLL RESPONSE STATUS]", pollRes.status, pollRes.statusText);

      if (!pollRes.ok) {
        const errText = await pollRes.text();
        CircuitBreaker.record(false, Date.now() - start, pollRes.status);
        console.error("[GALAXY POLL ERROR DETAILS]", {
          status: pollRes.status,
          statusText: pollRes.statusText,
          errorBody: errText
        });
        return { ok: false, status: pollRes.status, error: errText, raw: errText };
      }

      const pollData = await pollRes.json();
      // Log a concise status summary to prevent massive file bloat
      console.log("[GALAXY POLL DATA]", { status: pollData.status, runId: pollData.id, nodeRunCount: pollData.nodeRuns?.length });
      lastPollData = pollData;
      const status = pollData.status;
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);

      // Node progression tracking
      const nodeRuns = pollData.nodeRuns || [];
      const totalNodes = nodeRuns.length;
      
      // Determine completed nodes: those with output, or explicitly marked COMPLETED/FAILED/CANCELED/finished
      const completedNodes = nodeRuns.filter(node => 
        node.output || 
        node.status === "COMPLETED" || 
        node.status === "FAILED" || 
        node.status === "CANCELED" ||
        node.completedAt
      );
      const completedCount = completedNodes.length;

      // Track status change
      if (status !== lastStatus) {
        lastStatus = status;
        lastStatusChangeTime = Date.now();
      }

      // Track node progression
      if (completedCount !== lastCompletedCount) {
        lastCompletedCount = completedCount;
        lastProgressionTime = Date.now();
      }

      // Heartbeat delta
      const updatedAtStr = pollData.updatedAt || pollData.finishedAt || pollData.createdAt;
      const heartbeatTime = updatedAtStr ? new Date(updatedAtStr).getTime() : Date.now();
      const heartbeatDelta = Date.now() - heartbeatTime;
      const heartbeatDeltaSeconds = (heartbeatDelta / 1000).toFixed(1);

      // Node statuses summary for rich logging
      const nodeStatuses = nodeRuns.map(node => {
        const idOrType = node.nodeId || node.nodeType || "unknown";
        const nodeStatus = node.status || (node.output ? "COMPLETED" : "RUNNING");
        return `${idOrType}(${nodeStatus})`;
      }).join(", ");

      // Verbose telemetry
      console.log(`[GALAXY POLL] Run ${runId} [${status}] | Elapsed: ${elapsed}s | Heartbeat delta: ${heartbeatDeltaSeconds}s | Nodes: ${completedCount}/${totalNodes} | Active: [${nodeStatuses}]`);

      // Proactive stall detection (30s threshold)
      const msSinceLastProgression = Date.now() - lastProgressionTime;
      const msSinceLastStatusChange = Date.now() - lastStatusChangeTime;
      
      if (status === "RUNNING" && msSinceLastProgression > 30000 && msSinceLastStatusChange > 30000) {
        console.warn(`⚠️ STALL DETECTED - Run ID: ${runId} has been in [RUNNING] state for ${elapsed}s with no node progression or status change in the last ${(msSinceLastProgression/1000).toFixed(1)}s (Heartbeat delta: ${heartbeatDeltaSeconds}s)`);
      }

      if (status === "COMPLETED") {
        // Extract output using our parser
        const output = extractGalaxyOutput(pollData);

        console.log("[GALAXY FINAL RAW POLL DATA]", pollData);

        // Extract and log actual executed models/nodes from the completed run nodeRuns
        const nodeRuns = pollData.nodeRuns || [];
        const executedModels = nodeRuns.map(n => `${n.nodeId || n.id || "node"}:${n.nodeType || "unknown"}`);
        console.log("[GALAXY EXECUTED MODELS]", executedModels);

        console.log("[GALAXY EXTRACTED OUTPUT]", {
          length: output?.length,
          preview: output?.slice(0, 300),
          type: typeof output,
        });

        if (!output || !output.trim()) {
          console.error("[GALAXY EMPTY OUTPUT FAILURE]", {
            runId,
            status: pollData.status,
            nodeRuns: pollData.nodeRuns,
            finalOutput: pollData.finalOutput,
          });
        }

        // Safety buffer against late materialisation:
        // If status is completed but the output has not flushed or is empty,
        // we keep polling to allow the backend to materialize the content.
        if (!output || typeof output !== "string" || !output.trim()) {
          if (!completionGraceStart) {
            completionGraceStart = Date.now();
          }

          const graceElapsed = Date.now() - completionGraceStart;
          if (graceElapsed > 15000) { // 15 seconds grace window
            CircuitBreaker.record(false, Date.now() - start, "LATE_MATERIALISATION_TIMEOUT");
            return {
              ok: false,
              error: `Galaxy run completed but output never materialized after ${(graceElapsed / 1000).toFixed(1)}s of grace period.`,
              raw: JSON.stringify(pollData)
            };
          }

          console.warn(`[GALAXY POLL] Run ${runId} is COMPLETED but output has not materialized yet (Grace elapsed: ${(graceElapsed / 1000).toFixed(1)}s). Continuing to poll...`);
          continue;
        }

        const duration = Date.now() - start;
        CircuitBreaker.record(true, duration);
        CircuitBreaker.onSuccess();

        if (isDebug) {
          console.log("[GALAXY RESPONSE]", { status, duration, output: output.slice(0, 500) });
        }

        saveExecutionMetric({
          workflowId,
          nodeId,
          runId,
          promptLength: prompt.length,
          payloadBytes: payloadBytesCount,
          runtime: duration,
          status: "SUCCESS",
          model: "claude-opus-4-6"
        }).catch(() => {});

        return {
          ok: true,
          status: 200,
          content: output,
          usage: null,
          raw: JSON.stringify(pollData)
        };
      }

      if (status === "FAILED" || status === "CANCELED") {
        const duration = Date.now() - start;
        CircuitBreaker.record(false, duration, status);
        const output = extractGalaxyOutput(pollData);

        saveExecutionMetric({
          workflowId,
          nodeId,
          runId,
          promptLength: prompt.length,
          payloadBytes: payloadBytesCount,
          runtime: duration,
          status: `FAILED_${status}`,
          model: "claude-opus-4-6"
        }).catch(() => {});

        return {
          ok: false,
          error: `Galaxy run ${status}: ${pollData.error || "unknown error"}`,
          content: output || "",
          raw: JSON.stringify(pollData)
        };
      }
      // Still running — continue polling
    }

    // Timeout
    CircuitBreaker.record(false, Date.now() - start, "TIMEOUT");

    let errorMsg = "Galaxy run timed out";
    if (lastPollData) {
      const nodeRuns = lastPollData.nodeRuns || [];
      const nodeSummary = nodeRuns.map(node => {
        const idOrType = node.nodeId || node.nodeType || "unknown";
        const nodeStatus = node.status || (node.output ? "COMPLETED" : "RUNNING");
        return `${idOrType}(${nodeStatus})`;
      }).join(", ");
      
      const updatedAtStr = lastPollData.updatedAt || lastPollData.finishedAt || lastPollData.createdAt;
      const heartbeatTime = updatedAtStr ? new Date(updatedAtStr).getTime() : Date.now();
      const heartbeatDeltaSeconds = ((Date.now() - heartbeatTime) / 1000).toFixed(1);
      
      errorMsg = `Galaxy run timed out after ${((Date.now() - start) / 1000).toFixed(1)}s. Status: [${lastPollData.status || "UNKNOWN"}]. Heartbeat delta: ${heartbeatDeltaSeconds}s. Nodes: [${nodeSummary}]`;
    }

    return { ok: false, error: errorMsg, raw: lastPollData ? JSON.stringify(lastPollData) : null };

  } catch (err) {
    const duration = Date.now() - start;
    CircuitBreaker.record(false, duration, "EXCEPTION");

    saveExecutionMetric({
      workflowId,
      nodeId,
      runId,
      promptLength: prompt.length,
      payloadBytes: payloadBytesCount,
      runtime: duration,
      status: "EXCEPTION",
      error: err instanceof Error ? err.message : String(err),
      model: "claude-opus-4-6"
    }).catch(() => {});

    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      raw: null
    };
  }
}

/**
 * Extract text output from Galaxy workflow run data.
 */
export function extractGalaxyOutput(data) {
  const outputs = [];
  const responseNodes = (data.nodeRuns || []).filter(n => n.nodeType === "response");
  
  // If we have explicit response nodes, only parse those to avoid prompt/request pollution.
  const nodesToParse = responseNodes.length > 0 ? responseNodes : (data.nodeRuns || []);
  
  for (const node of nodesToParse) {
    // Skip request nodes entirely to avoid input prompt pollution
    if (node.nodeType === "request") continue;
    
    const out = node.output;
    if (!out) continue;
    if (typeof out === "object") {
      let found = false;
      for (const k of ["output", "text", "content", "response", "result"]) {
        if (typeof out[k] === "string" && out[k]) {
          outputs.push(out[k]);
          found = true;
          break;
        }
      }
      if (!found) {
        const meta = new Set(["model", "usage", "cost_usd", "creditUsed", "provider_used", "status", "id"]);
        for (const k of Object.keys(out)) {
          if (!meta.has(k) && typeof out[k] === "string" && out[k].trim()) {
            outputs.push(out[k]);
            break;
          }
        }
      }
    } else if (typeof out === "string") {
      outputs.push(out);
    }
  }
  return outputs.join("\n").trim();
}

/**
 * callOpenAI — now routes through Galaxy AI unless options.response_format is provided,
 * in which case it routes directly to the native OpenAI chat completions API.
 * Signature preserved so all existing call sites work without changes.
 * 
 * @param {string} key API key
 * @param {string} prompt Prompt text
 * @param {object} [options] Call options
 * @param {object} [options.response_format] Schema constraints
 * @param {string} [options.model] OpenAI model
 * @param {number} [options.temperature] Temperature
 * @returns {Promise<{ ok: boolean, content: string, error?: string, raw: any }>} Standard response shape
 */
export async function callOpenAI(key, prompt, options = {}) {
  if (CircuitBreaker.isOpen()) {
    return { ok: false, error: "CIRCUIT_BREAKER_OPEN", raw: null };
  }

  return TraceManager.intercept(async () => {
    if (options.response_format) {
      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${key}`
          },
          body: JSON.stringify({
            model: options.model || "gpt-4o-mini",
            messages: [
              { role: "user", content: prompt }
            ],
            response_format: options.response_format,
            temperature: options.temperature !== undefined ? options.temperature : 0.7,
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          return { ok: false, error: `Direct OpenAI error: ${response.status} ${errText}`, raw: errText };
        }

        const data = await response.json();
        return {
          ok: true,
          content: data.choices[0].message.content,
          usage: data.usage,
          raw: JSON.stringify(data)
        };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
          raw: null
        };
      }
    }

    return callGalaxy(key, prompt, options);
  });
}


export async function checkOpenAIReachability(key) {
  // Check Galaxy reachability instead of OpenAI
  const isGalaxyKey = key && typeof key === 'string' && key.startsWith('gx_');
  const galaxyKey = isGalaxyKey ? key : (GALAXY_CONFIG.key || (typeof process !== "undefined" && process.env?.VITE_GALAXY_AI_API_KEY) || "");
  const workflowId = GALAXY_CONFIG.workflowId || (typeof process !== "undefined" && process.env?.VITE_GALAXY_WORKFLOW_ID) || "";
  const nodeId = GALAXY_CONFIG.nodeId || (typeof process !== "undefined" && process.env?.VITE_GALAXY_NODE_ID) || "";

  if (!galaxyKey) {
    return { reachable: false, reason: "Missing Galaxy API key" };
  }
  if (!workflowId || !nodeId) {
    return { reachable: false, reason: "Missing Galaxy workflow config" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const pingUrl = resolveGalaxyUrl("/api/galaxy/runs");
    console.log("[GALAXY PING REQUEST]", { pingUrl, keyPreview: galaxyKey ? galaxyKey.slice(0, 8) + "..." : "missing" });
    
    // Ping Galaxy API with a lightweight GET request (lists runs) to check auth without starting a new run
    const response = await fetch(pingUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${galaxyKey}`,
        "Content-Type": "application/json"
      },
      signal: controller.signal
    });

    clearTimeout(timer);

    console.log("[GALAXY PING RESPONSE STATUS]", response.status, response.statusText);

    if (!response.ok) {
      const errText = await response.text();
      console.error("[GALAXY PING ERROR DETAILS]", response.status, errText);
      return { reachable: false, reason: `HTTP ${response.status}: ${errText.slice(0, 100)}` };
    }

    return { reachable: true, reason: "Galaxy AI reachable" };
  } catch (error) {
    clearTimeout(timer);
    return {
      reachable: false,
      reason: error?.name === "AbortError" ? "Timeout" : (error?.message || "Request failed")
    };
  }
}

export async function callGemini(key, prompt, options = {}) {
  const {
    model = "gemini-2.5-flash",
    temperature = 0.7,
  } = options;
  
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
        }
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: JSON.stringify(data),
        raw: JSON.stringify(data),
      };
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return {
      ok: true,
      status: response.status,
      content: text,
      usage: null, // Gemini API usage format differs, keeping simple for now
      raw: JSON.stringify(data),
    };
  } catch (err) {
    return {
      ok: false,
      status: null,
      error: err instanceof Error ? err.message : String(err),
      raw: null,
    };
  }
}

export async function checkGeminiReachability(key) {
  if (!key) {
    return { reachable: false, reason: "Missing API key" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`, {
      method: "GET",
      signal: controller.signal
    });

    clearTimeout(timer);

    if (!response.ok) {
      return { reachable: false, reason: `HTTP ${response.status}` };
    }

    return { reachable: true, reason: "API reachable" };
  } catch (error) {
    clearTimeout(timer);
    return {
      reachable: false,
      reason: error?.name === "AbortError" ? "Timeout" : (error?.message || "Request failed")
    };
  }
}

export async function callOllama(model, prompt, options = {}) {
  try {
    const body = { model, prompt, stream: false };
    if (options.temperature !== undefined) {
      body.options = { temperature: options.temperature };
    }
    const response = await fetch("http://127.0.0.1:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}`, content: "" };
    }
    
    const data = await response.json();
    if (!data || typeof data.response !== "string" || data.response.trim() === "") {
      return { ok: false, error: "Ollama returned empty or invalid response", content: "" };
    }
    
    return { ok: true, content: data.response };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), content: "" };
  }
}

export async function checkOllamaReachability(modelName) {
  if (!modelName) return { reachable: false, reason: "Missing model name" };
  try {
    const res = await fetch("http://127.0.0.1:11434/api/tags");
    if (!res.ok) return { reachable: false, reason: `HTTP ${res.status}` };
    const data = await res.json();
    const found = data.models?.some(m => m.name === modelName || m.name.startsWith(modelName + ":"));
    return found
      ? { reachable: true, reason: "Model available" }
      : { reachable: false, reason: "Model not installed" };
  } catch {
    return { reachable: false, reason: "Ollama offline" };
  }
}

/**
 * Persists live rewrite execution metrics to localStorage (in browser)
 * and E:/Ai/ProseLabV2/rewrite_metrics.jsonl (under Node/test runner environment).
 */
export async function saveExecutionMetric(metric) {
  const ts = new Date().toISOString();
  const entry = { ...metric, timestamp: ts };

  // 1. Browser localStorage persistence
  if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
    try {
      const history = JSON.parse(localStorage.getItem("PROSELAB_REWRITE_METRICS") || "[]");
      history.push(entry);
      if (history.length > 100) history.shift();
      localStorage.setItem("PROSELAB_REWRITE_METRICS", JSON.stringify(history));
      console.log("[METRICS PERSISTED TO BROWSER]", entry);
    } catch (e) {
      console.warn("Failed to write metrics to localStorage:", e);
    }
  }

  // 2. Node.js local file persistence for CLI / test context
  if (typeof process !== "undefined" && process.versions?.node) {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const logPath = path.resolve("E:/Ai/ProseLabV2/rewrite_metrics.jsonl");
      fs.appendFileSync(logPath, JSON.stringify(entry) + "\n", "utf8");
      console.log("[METRICS PERSISTED TO FILE]", entry);
    } catch (e) {
      // safe fallback
    }
  }
}
