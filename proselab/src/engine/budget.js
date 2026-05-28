/**
 * Instruction Budgeting Engine
 * Deduplicates, merges, and caps prompt directives to prevent context accretion and instruction collision.
 */

/**
 * Deduplicates and semantically merges style instructions, capping them to a safe budget envelope.
 * 
 * @param {string[]} directives - Array of raw directives or style instructions
 * @param {number} maxCount - Safe maximum limit of directives (default: 5)
 * @returns {string[]} Budgeted and optimized directives list
 */
export function compileInstructionBudget(directives = [], maxCount = 5) {
  if (!Array.isArray(directives)) return [];

  // 1. Clean and trim
  let list = directives
    .map(d => String(d || "").trim())
    .filter(d => d.length > 0);

  // 2. Exact case-insensitive deduplication
  const unique = [];
  const seen = new Set();
  for (const item of list) {
    const lower = item.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      unique.push(item);
    }
  }

  // 3. Rule-based semantic consolidation/merging
  let consolidated = [];
  let mergedConcise = false;
  let mergedMetaphors = false;
  let mergedAdjectives = false;
  let mergedVerbs = false;

  for (const item of unique) {
    const lower = item.toLowerCase();

    // Check concise/short sentences
    if (lower.includes("concise") || lower.includes("short sentence") || lower.includes("staccato") || lower.includes("declarative sentence")) {
      if (!mergedConcise) {
        consolidated.push("Write in short, concise, declarative sentences.");
        mergedConcise = true;
      }
      continue;
    }

    // Check metaphors/similes
    if (lower.includes("metaphor") || lower.includes("simile") || lower.includes("ornate figure")) {
      if (!mergedMetaphors) {
        consolidated.push("Avoid ornate metaphors, similes, or abstract chest/stomach sensations.");
        mergedMetaphors = true;
      }
      continue;
    }

    // Check concrete nouns/adjectives
    if (lower.includes("adjective") || lower.includes("abstract label") || lower.includes("emotional label")) {
      if (!mergedAdjectives) {
        consolidated.push("Favor concrete nouns; strictly avoid abstract adjectives or emotional labels.");
        mergedAdjectives = true;
      }
      continue;
    }

    // Check active verbs
    if (lower.includes("verb") || lower.includes("action") || lower.includes("grounding")) {
      if (!mergedVerbs) {
        consolidated.push("Prioritize strong, active physical verbs and sensory grounding.");
        mergedVerbs = true;
      }
      continue;
    }

    // Otherwise, keep as is
    consolidated.push(item);
  }

  // 4. Cap instruction counts (take the top maxCount)
  if (consolidated.length > maxCount) {
    console.warn(`[INSTRUCTION BUDGET] Cap exceeded (${consolidated.length} > ${maxCount}). Trimming low-priority directives.`);
    consolidated = consolidated.slice(0, maxCount);
  }

  return consolidated;
}
