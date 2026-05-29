// @ts-check
/**
 * Prompt Budget Control Engine
 * Enforces strict, non-negotiable word limits on prompts and directives to prevent token explosions.
 */

/**
 * Standalone safe text truncation utility.
 * Truncates text strictly at complete newline/sentence boundaries before the word limit is reached.
 * 
 * @param {string} text - The input text
 * @param {number} wordLimit - Strict maximum words
 * @returns {string} Budgeted string
 */
export function truncateText(text, wordLimit) {
  const raw = String(text || "").trim();
  const words = raw.split(/\s+/).filter(Boolean);
  if (words.length <= wordLimit) return raw;

  console.warn(`[PROMPT BUDGET] Word count of ${words.length} exceeds limit ${wordLimit}. Truncating safely.`);

  // Truncate to the nearest full line before the word limit
  const lines = raw.split("\n");
  let currentText = "";
  let currentWordCount = 0;
  
  for (const line of lines) {
    const lineWords = line.trim().split(/\s+/).filter(Boolean).length;
    if (currentWordCount + lineWords > wordLimit) {
      // If the first line itself exceeds the limit, truncate at the word boundary
      if (!currentText) {
        return words.slice(0, wordLimit).join(" ") + " ...";
      }
      break;
    }
    currentText += (currentText ? "\n" : "") + line;
    currentWordCount += lineWords;
  }
  return currentText.trim();
}

/**
 * Budgets and limits prompts and arrays of directives to secure token safety bounds.
 * 
 * @param {object} params - Inputs containing voice, scene context, rewrite directives, or repair instructions.
 * @param {string[] | string} [params.voice]
 * @param {string} [params.scene]
 * @param {string[]} [params.rewrite]
 * @param {string[]} [params.repair]
 * @returns {{
 *   voice: string[] | string,
 *   scene: string,
 *   rewrite: string[],
 *   repair: string[]
 * }} Safe budgeted prompt payloads
 */
export function buildPromptBudget({
  voice = [],
  scene = "",
  rewrite = [],
  repair = []
} = {}) {
  // Word limits as defined by narrative infrastructure safety
  const limits = {
    voice: 120,
    scene: 80,
    rewrite: 100,
    repair: 60
  };

  const getWordCount = (/** @type {any} */ text) => String(text || "").trim().split(/\s+/).filter(Boolean).length;

  /**
   * @param {string[] | undefined} arr
   * @param {number} limit
   * @returns {string[]}
   */
  const budgetArray = (arr, limit) => {
    if (!Array.isArray(arr)) return [];
    let currentWords = 0;
    const budgeted = [];
    for (const item of arr) {
      const words = getWordCount(item);
      if (currentWords + words > limit) {
        console.warn(`[PROMPT BUDGET] Directive limit of ${limit} reached. Omitting subsequent rules.`);
        break;
      }
      budgeted.push(item);
      currentWords += words;
    }
    return budgeted;
  };

  return {
    voice: Array.isArray(voice) ? budgetArray(voice, limits.voice) : truncateText(voice, limits.voice),
    scene: truncateText(scene, limits.scene),
    rewrite: budgetArray(rewrite, limits.rewrite),
    repair: budgetArray(repair, limits.repair)
  };
}

