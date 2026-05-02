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

export async function callOpenAI(key, prompt, options = {}) {
  if (CircuitBreaker.isOpen()) {
    return { ok: false, error: "CIRCUIT_BREAKER_OPEN", raw: null };
  }

  return TraceManager.intercept(async () => {
    const {
      model = "gpt-4o-mini",
      temperature,
      timeout = 15000, // 15s hard timeout
    } = options;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const start = Date.now();
    try {
      const payload = {
        model,
        ...(typeof temperature === "number" ? { temperature } : {}),
        messages: [{ role: "user", content: prompt }],
      };
      
      if (process.env.DEBUG_LLM) {
          console.log("[LLM REQUEST]", JSON.stringify({ model, prompt: prompt.slice(0, 200) + "..." }, null, 2));
      }

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify(payload),
      });

      const duration = Date.now() - start;
      clearTimeout(timer);
      const raw = await response.text();

      if (process.env.DEBUG_LLM || !response.ok) {
          console.log("[LLM RAW RESPONSE]", { status: response.status, ok: response.ok, body: raw.slice(0, 500) + (raw.length > 500 ? "..." : "") });
      }

      if (!response.ok) {
        CircuitBreaker.record(false, duration, response.status);
        return { ok: false, status: response.status, error: raw, raw };
      }

      CircuitBreaker.record(true, duration);
      CircuitBreaker.onSuccess();
      const data = JSON.parse(raw);
      return {
        ok: true,
        status: response.status,
        content: data?.choices?.[0]?.message?.content || "",
        usage: data?.usage || null,
        raw,
      };
    } catch (err) {
      const duration = Date.now() - start;
      clearTimeout(timer);
      const errorType = err.name === "AbortError" ? "TIMEOUT" : "EXCEPTION";
      CircuitBreaker.record(false, duration, errorType);
      return {
        ok: false,
        error: errorType,
        raw: null,
      };
    }
  });
}

export async function callGemini(key, prompt, options = {}) {
  const {
    model = "gemini-1.5-pro",
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
