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
  } catch (e) {
    // console.error("robustParseJSON FAILED:", e.message, "Text sample:", finalJson.substring(0, 100));
    return null;
  }
}
