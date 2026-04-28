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
