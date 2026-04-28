export async function callOpenAI(key, prompt, options = {}) {
  const {
    model = "gpt-4o-mini",
    temperature,
    presence_penalty,
    frequency_penalty,
  } = options;
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        ...(typeof temperature === "number" ? { temperature } : {}),
        ...(typeof presence_penalty === "number" ? { presence_penalty } : {}),
        ...(typeof frequency_penalty === "number" ? { frequency_penalty } : {}),
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const raw = await response.text();

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: raw,
        raw,
      };
    }

    const data = JSON.parse(raw);

    return {
      ok: true,
      status: response.status,
      content: data?.choices?.[0]?.message?.content || "",
      usage: data?.usage || null,
      raw,
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
