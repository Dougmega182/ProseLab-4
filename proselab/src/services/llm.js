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
  latencyThreshold: 30000, // 30s p90
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
  key: (typeof import.meta !== "undefined" && import.meta.env?.VITE_GALAXY_AI_API_KEY) || "",
  workflowId: (typeof import.meta !== "undefined" && import.meta.env?.VITE_GALAXY_WORKFLOW_ID) || "",
  nodeId: (typeof import.meta !== "undefined" && import.meta.env?.VITE_GALAXY_NODE_ID) || "",
};

/**
 * Call Galaxy AI workflow API.
 * Starts a run, polls for completion, extracts output.
 * Returns the same { ok, content, error, raw } shape as callOpenAI.
 */
export async function callGalaxy(key, prompt, options = {}) {
  const {
    timeout = 120000, // 2 min timeout for polling
    pollInterval = 1200,
  } = options;

  // Use passed key if it's a Galaxy key, otherwise use the env config key
  const isGalaxyKey = key && typeof key === 'string' && key.startsWith('gx_');
  const galaxyKey = isGalaxyKey ? key : GALAXY_CONFIG.key;
  const workflowId = GALAXY_CONFIG.workflowId;
  const nodeId = GALAXY_CONFIG.nodeId;

  if (!galaxyKey || !workflowId || !nodeId) {
    return { ok: false, error: "Galaxy AI not configured (missing key, workflow, or node ID)", raw: null };
  }

  const headers = {
    "Authorization": `Bearer ${galaxyKey}`,
    "Content-Type": "application/json"
  };

  const isDebug = (typeof window !== "undefined" && window.PROSELAB_DEBUG_LLM) ||
    (typeof import.meta !== "undefined" && import.meta.env?.PROSELAB_DEBUG_LLM);

  if (isDebug) {
    console.log("[GALAXY REQUEST]", { workflowId, nodeId, prompt: prompt.slice(0, 200) + "..." });
  }

  const start = Date.now();

  try {
    // Step 1: Start the run
    const startRes = await fetch("/api/galaxy/runs", {
      method: "POST",
      headers,
      body: JSON.stringify({
        workflowId,
        values: {
          [nodeId]: {
            text_field: prompt
          }
        }
      })
    });

    if (!startRes.ok) {
      const errText = await startRes.text();
      CircuitBreaker.record(false, Date.now() - start, startRes.status);
      console.error("[GALAXY RUN ERROR]", startRes.status, errText);
      return { ok: false, status: startRes.status, error: errText, raw: errText };
    }

    const startData = await startRes.json();
    const runId = startData.runId;

    if (!runId) {
      CircuitBreaker.record(false, Date.now() - start, "NO_RUN_ID");
      return { ok: false, error: "Galaxy returned no runId", raw: JSON.stringify(startData) };
    }

    // Step 2: Poll for completion
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, pollInterval));

      const pollRes = await fetch(`/api/galaxy/runs/${runId}?inDetails=true`, {
        method: "GET",
        headers
      });

      if (!pollRes.ok) {
        const errText = await pollRes.text();
        CircuitBreaker.record(false, Date.now() - start, pollRes.status);
        return { ok: false, status: pollRes.status, error: errText, raw: errText };
      }

      const pollData = await pollRes.json();
      const status = pollData.status;

      if (status === "COMPLETED") {
        const duration = Date.now() - start;
        CircuitBreaker.record(true, duration);
        CircuitBreaker.onSuccess();

        // Extract output from nodeRuns
        const output = extractGalaxyOutput(pollData);

        if (isDebug) {
          console.log("[GALAXY RESPONSE]", { status, duration, output: output.slice(0, 500) });
        }

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
    return { ok: false, error: "Galaxy run timed out", raw: null };

  } catch (err) {
    const duration = Date.now() - start;
    CircuitBreaker.record(false, duration, "EXCEPTION");
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
function extractGalaxyOutput(data) {
  const outputs = [];
  for (const node of (data.nodeRuns || [])) {
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
 * callOpenAI — now routes through Galaxy AI.
 * Signature preserved so all existing call sites work without changes.
 */
export async function callOpenAI(key, prompt, options = {}) {
  if (CircuitBreaker.isOpen()) {
    return { ok: false, error: "CIRCUIT_BREAKER_OPEN", raw: null };
  }

  return TraceManager.intercept(async () => {
    return callGalaxy(key, prompt, options);
  });
}

export async function checkOpenAIReachability(key) {
  // Check Galaxy reachability instead of OpenAI
  const isGalaxyKey = key && typeof key === 'string' && key.startsWith('gx_');
  const galaxyKey = isGalaxyKey ? key : GALAXY_CONFIG.key;

  if (!galaxyKey) {
    return { reachable: false, reason: "Missing Galaxy API key" };
  }
  if (!GALAXY_CONFIG.workflowId || !GALAXY_CONFIG.nodeId) {
    return { reachable: false, reason: "Missing Galaxy workflow config" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    // Ping Galaxy API with a lightweight GET request (lists runs) to check auth without starting a new run
    const response = await fetch("/api/galaxy/runs", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${galaxyKey}`,
        "Content-Type": "application/json"
      },
      signal: controller.signal
    });

    clearTimeout(timer);

    if (!response.ok) {
      const errText = await response.text();
      console.error("[GALAXY PING ERROR]", response.status, errText);
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

export async function callOllama(model, prompt) {
  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, stream: false })
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
    const res = await fetch("http://localhost:11434/api/tags");
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
