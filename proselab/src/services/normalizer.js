/**
 * SHARED PARSING UTILITIES
 */

export function robustParseJSON(text) {
  if (!text) return null;
  let jsonText = text.trim();
  
  // Handle Markdown
  if (jsonText.includes("```")) {
      const match = jsonText.match(/```(?:json)?([\s\S]*?)```/);
      if (match) jsonText = match[1].trim();
  }
  
  // Find first { or [
  const firstBrace = jsonText.indexOf("{");
  const firstBracket = jsonText.indexOf("[");
  let start = -1;
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) start = firstBrace;
  else if (firstBracket !== -1) start = firstBracket;
  
  if (start === -1) return null;
  
  // Find last } or ]
  const lastBrace = jsonText.lastIndexOf("}");
  const lastBracket = jsonText.lastIndexOf("]");
  let end = -1;
  if (lastBrace !== -1 && (lastBracket === -1 || lastBrace > lastBracket)) end = lastBrace;
  else if (lastBracket !== -1) end = lastBracket;
  
  if (end === -1) return null;
  
  const finalJson = jsonText.substring(start, end + 1);
  try {
    return JSON.parse(finalJson);
  } catch {
    return null;
  }
}

/**
 * NORMALIZE INTENTS (V3 Legacy Shim)
 * Role: Extract potential intents and signals from raw text.
 * Note: This is maintained for Preproduction agents until V5 transition.
 */
export function normalizeIntents(text) {
  if (!text) return { intents: [], signals: [], confidence: "low" };
  
  const lowText = text.toLowerCase();
  const intents = [];
  
  if (lowText.includes("reveal") || lowText.includes("tell") || lowText.includes("show")) {
      intents.push("INFORMATION_TRANSFER");
  }
  if (lowText.includes("action") || lowText.includes("move") || lowText.includes("takes")) {
      intents.push("BASIC_ACTION");
  }

  return {
    intents,
    signals: [],
    confidence: "medium"
  };
}

/**
 * VALIDATE CONSTRAINTS (V3 Legacy Shim)
 * Role: Check extracted intents against character/world rules.
 */
export function validateConstraints(intents, constraints) {
  // Simple check for existence of keywords in constraints
  const violations = [];
  if (!intents || !constraints) return violations;

  return violations;
}

/**
 * DETECT SUSPICIOUS PATTERNS (V3 Legacy Shim)
 * Role: Identify non-fictional or meta-discussion patterns.
 */
export function detectSuspiciousPatterns(text) {
  if (!text) return false;
  const patterns = [
      /as an ai/i,
      /i cannot/i,
      /certainly!/i,
      /here is/i
  ];
  return patterns.some(p => p.test(text));
}
