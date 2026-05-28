/**
 * Prompt Budget Control Engine
 * Enforces strict, non-negotiable word limits on prompts and directives to prevent token explosions.
 */

/**
 * Budgets and limits prompts and arrays of directives to secure token safety bounds.
 * 
 * @param {object} params - Inputs containing voice, scene context, rewrite directives, or repair instructions.
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

  const getWordCount = (text) => String(text || "").trim().split(/\s+/).filter(Boolean).length;

  const truncateToWordLimit = (text, limit) => {
    const words = String(text || "").trim().split(/\s+/).filter(Boolean);
    if (words.length <= limit) return text;
    console.warn(`[PROMPT BUDGET] Word count of ${words.length} exceeds limit ${limit}. Truncating.`);
    return words.slice(0, limit).join(" ") + " ...";
  };

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
    voice: Array.isArray(voice) ? budgetArray(voice, limits.voice) : truncateToWordLimit(voice, limits.voice),
    scene: truncateToWordLimit(scene, limits.scene),
    rewrite: budgetArray(rewrite, limits.rewrite),
    repair: budgetArray(repair, limits.repair)
  };
}
