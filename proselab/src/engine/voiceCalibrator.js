/**
 * Voice Calibrator Agent
 * Analyzes authorial writing samples to create a structured voice profile.
 * The profile is framed as instructions for direct use in generation prompts.
 */

import { callOpenAI } from "../services/llm.js";

/**
 * Calibrates authorial voice by extracting quantitative metrics and a detailed qualitative profile.
 * Routes LLM calls through the unified callOpenAI.
 */
export async function calibrateVoice(sampleText, openAIKey, llmCaller = callOpenAI) {
  if (!sampleText || !sampleText.trim()) {
    throw new Error("Sample text is required for voice calibration");
  }

  const wordCount = sampleText.trim().split(/\s+/).length;

  const prompt = `You are a world-class literary analyst specializing in authorial voice. Analyze the provided writing sample and produce a structured authorial voice profile.

Calculate a "stabilityScore" from 0 to 100 based on prose consistency, sentence rhythm variance, lexical repetition, punctuation predictability, and dialogue uniformity. A highly cohesive, professional sample gets a higher score; an inconsistent, chaotic, or too-short sample gets a lower score.

Provide your response in EXACTLY this JSON structure (return ONLY pure JSON, no markdown wrapper or extra prose):
{
  "stabilityScore": 85,
  "fingerprint": {
    "avgSentenceLength": "Short" | "Medium" | "Long",
    "fragmentRate": "None" | "Occasional" | "Frequent",
    "metaphorDensity": "Sparse" | "Moderate" | "Heavy",
    "dialogueStyle": "Direct" | "Implicit" | "Theatrical",
    "punctuationHabits": ["list of key distinctive punctuation tags, e.g. em dash, minimal semicolons, fragment cadence"],
    "lexicalPatterns": ["list of key lexical diction tags, e.g. concrete nouns, physical verbs, sparse adjectives"]
  },
  "compressedDirectives": [
    "list of highly focused direct rewrite instructions for prompt calibration, e.g. Use short declarative sentences.",
    "Favor concrete physical nouns.",
    "Avoid ornate metaphors."
  ],
  "profileMarkdown": "### Voice Calibration Report\\n\\nDetailed analysis of sentence rhythm, punctuation signature, lexical diction, and qualitative style guide."
}

Writing Sample:
---
${sampleText}
---`;

  const response = await llmCaller(openAIKey, prompt, {
    temperature: 0.2, // Lower temp for strict structure extraction
  });

  if (!response || !response.ok) {
    console.error("Voice calibration LLM call failed:", response?.error);
    return null;
  }

  try {
    const rawContent = response.content;
    const first = rawContent.indexOf("{");
    const last = rawContent.lastIndexOf("}");
    if (first === -1 || last === -1 || last <= first) {
      throw new Error("Model did not return a valid JSON object.");
    }
    const cleanJson = JSON.parse(rawContent.slice(first, last + 1));

    // Normalize metric values to match our preproduction kit options
    const normalizedLength = mapToDropdown(cleanJson.fingerprint?.avgSentenceLength, ["Short", "Medium", "Long"], "Medium");
    const normalizedFragments = mapToDropdown(cleanJson.fingerprint?.fragmentRate, ["None", "Occasional", "Frequent"], "Occasional");
    const normalizedMetaphor = mapToDropdown(cleanJson.fingerprint?.metaphorDensity, ["Sparse", "Moderate", "Heavy"], "Moderate");
    const normalizedDialogue = mapToDropdown(cleanJson.fingerprint?.dialogueStyle, ["Direct", "Implicit", "Theatrical"], "Direct");

    const stabilityScore = typeof cleanJson.stabilityScore === "number" ? cleanJson.stabilityScore : 75;

    return {
      calibrated: true,
      stabilityScore: Math.max(0, Math.min(100, stabilityScore)),
      fingerprint: {
        avgSentenceLength: normalizedLength,
        fragmentRate: normalizedFragments,
        metaphorDensity: normalizedMetaphor,
        dialogueStyle: normalizedDialogue,
        punctuationHabits: Array.isArray(cleanJson.fingerprint?.punctuationHabits)
          ? cleanJson.fingerprint.punctuationHabits
          : [cleanJson.fingerprint?.punctuationHabits || "standard punctuation"],
        lexicalPatterns: Array.isArray(cleanJson.fingerprint?.lexicalPatterns)
          ? cleanJson.fingerprint.lexicalPatterns
          : [cleanJson.fingerprint?.lexicalPatterns || "standard literary vocabulary"]
      },
      compressedDirectives: Array.isArray(cleanJson.compressedDirectives)
        ? cleanJson.compressedDirectives
        : [],
      profileMarkdown: cleanJson.profileMarkdown || "### Calibration Report\nStandard style profile.",
      calibratedAt: Date.now(),
      sampleWordCount: wordCount
    };
  } catch (err) {
    console.error("Failed to parse calibrated voice profile JSON:", err, response.content);
    return null;
  }
}

function mapToDropdown(value, allowed, fallback) {
  if (!value) return fallback;
  const valLower = String(value).toLowerCase();
  const match = allowed.find(a => a.toLowerCase().includes(valLower) || valLower.includes(a.toLowerCase()));
  return match || fallback;
}
