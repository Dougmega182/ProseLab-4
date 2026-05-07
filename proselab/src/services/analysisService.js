// src/services/analysisService.js
import * as llm from './llm';

export async function runAnalysis(manuscriptText, options, onProgress) {
  const results = {};
  const tasks = [];

  if (options.extractCharacters) tasks.push('characters');
  if (options.extractWorldRules) tasks.push('worldRules');
  if (options.deriveBeatMap) tasks.push('beats');
  if (options.buildSceneInventory) tasks.push('scenes');
  if (options.checkContinuity) tasks.push('continuity');

  const total = tasks.length;
  let current = 0;

  for (const task of tasks) {
    current++;
    onProgress({
      current,
      total,
      message: `Running ${taskLabels[task]}...`
    });

    try {
      switch (task) {
        case 'characters':
          results.characters = await extractCharacters(manuscriptText);
          break;
        case 'worldRules':
          results.worldRules = await extractWorldRules(manuscriptText);
          break;
        case 'beats':
          results.beats = await deriveBeatMap(manuscriptText);
          break;
        case 'scenes':
          results.scenes = await buildSceneInventory(manuscriptText);
          break;
        case 'continuity':
          results.continuityIssues = await checkContinuity(manuscriptText);
          break;
      }
    } catch (err) {
      results[`${task}Error`] = err.message;
    }
  }

  return results;
}

const taskLabels = {
  characters: 'Character Extraction',
  worldRules: 'World Rules Extraction',
  beats: 'Beat Map Derivation',
  scenes: 'Scene Inventory',
  continuity: 'Continuity Check'
};

async function callLLM(prompt, systemPrompt) {
  // Try to use the app's existing LLM service
  try {
    const openaiKey = import.meta.env.VITE_OPENAI_KEY;
    const geminiKey = import.meta.env.VITE_GEMINI_KEY;
    
    // Combine system and user prompts
    const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;

    // Prefer OpenAI for analysis depth, fallback to Gemini
    if (openaiKey) {
      const res = await llm.callOpenAI(openaiKey, fullPrompt);
      if (res.ok) return res.content;
    } else if (geminiKey) {
      const res = await llm.callGemini(geminiKey, fullPrompt);
      if (res.ok) return res.content;
    }
  } catch (err) {
    console.error("LLM call failed in AnalysisService:", err);
  }

  // Final check for global override
  if (typeof window !== 'undefined' && window.__storyAppLLM) {
    return await window.__storyAppLLM(prompt, systemPrompt);
  }

  return null;
}

async function extractCharacters(text) {
  const systemPrompt = `You are a literary analysis assistant. Extract all characters from the given manuscript text. For each character, provide:
- name: The character's name
- role: protagonist, antagonist, supporting, minor
- description: Physical description if available
- traits: Key personality traits
- relationships: Known relationships to other characters
- firstAppearance: Approximate location of first appearance

Return the result as a JSON array.`;

  const prompt = `Extract all characters from this manuscript:\n\n${truncateForLLM(text)}`;

  const response = await callLLM(prompt, systemPrompt);

  if (response) {
    try {
      const jsonStr = extractJsonFromResponse(response);
      const parsed = JSON.parse(jsonStr);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      // Try to parse partial results
      return parseCharactersFallback(response);
    }
  }

  // Heuristic fallback: extract proper nouns that appear frequently
  return extractCharactersHeuristic(text);
}

async function extractWorldRules(text) {
  const systemPrompt = `You are a literary analysis assistant. Extract world-building rules and lore from the given manuscript. For each rule or lore element, provide:
- title: A short descriptive title
- category: magic, geography, politics, culture, technology, biology, other
- content: The rule or lore description
- evidence: Brief quote or reference from the text

Return the result as a JSON array.`;

  const prompt = `Extract world-building rules and lore from this manuscript:\n\n${truncateForLLM(text)}`;

  const response = await callLLM(prompt, systemPrompt);

  if (response) {
    try {
      const parsed = JSON.parse(extractJsonFromResponse(response));
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return parseWorldRulesFallback(response);
    }
  }

  return extractWorldRulesHeuristic(text);
}

async function deriveBeatMap(text) {
  const systemPrompt = `You are a literary analysis assistant. Analyze the narrative structure of the given manuscript and derive a beat map. For each beat, provide:
- title: A short descriptive title for the beat
- type: setup, inciting_incident, rising_action, midpoint, complication, climax, falling_action, resolution, other
- summary: Brief summary of what happens
- chapter: Which chapter this beat occurs in (if identifiable)
- characters: Characters involved in this beat

Return the result as a JSON array ordered by narrative sequence.`;

  const prompt = `Derive a beat map from this manuscript:\n\n${truncateForLLM(text)}`;

  const response = await callLLM(prompt, systemPrompt);

  if (response) {
    try {
      const parsed = JSON.parse(extractJsonFromResponse(response));
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return parseBeatsFallback(response);
    }
  }

  return deriveBeatMapHeuristic(text);
}

async function buildSceneInventory(text) {
  const systemPrompt = `You are a literary analysis assistant. Build a scene inventory from the given manuscript. For each scene, provide:
- title: A short descriptive title
- location: Where the scene takes place
- timeOfDay: When the scene occurs (if identifiable)
- characters: Characters present in the scene
- summary: Brief summary of the scene
- chapter: Which chapter this scene is in (if identifiable)
- purpose: The narrative purpose of this scene (exposition, action, character development, etc.)

Return the result as a JSON array ordered by appearance.`;

  const prompt = `Build a scene inventory from this manuscript:\n\n${truncateForLLM(text)}`;

  const response = await callLLM(prompt, systemPrompt);

  if (response) {
    try {
      const parsed = JSON.parse(extractJsonFromResponse(response));
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return parseScenesFallback(response);
    }
  }

  return buildSceneInventoryHeuristic(text);
}

async function checkContinuity(text) {
  const systemPrompt = `You are a literary analysis assistant specializing in continuity checking. Analyze the manuscript for continuity errors, inconsistencies, and plot holes. For each issue found, provide:
- type: timeline, character, setting, logic, plot_hole, factual
- severity: minor, moderate, major
- description: Description of the continuity issue
- location: Approximate location in the text
- suggestion: How to fix the issue

Return the result as a JSON array.`;

  const prompt = `Check this manuscript for continuity issues:\n\n${truncateForLLM(text)}`;

  const response = await callLLM(prompt, systemPrompt);

  if (response) {
    try {
      const parsed = JSON.parse(extractJsonFromResponse(response));
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return parseContinuityFallback(response);
    }
  }

  return checkContinuityHeuristic(text);
}

// --- Utility functions ---

function truncateForLLM(text, maxChars = 30000) {
  if (text.length <= maxChars) return text;
  // Take beginning and end, with a note about truncation
  const halfMax = Math.floor(maxChars / 2) - 100;
  return text.substring(0, halfMax) +
    '\n\n[... middle section truncated for analysis ...]\n\n' +
    text.substring(text.length - halfMax);
}

function extractJsonFromResponse(response) {
  if (!response) return "[]";
  
  // Try to find JSON in the response
  const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) return jsonMatch[1].trim();

  // Try to find array or object
  const arrayMatch = response.match(/\[[\s\S]*\]/);
  if (arrayMatch) return arrayMatch[0];

  const objectMatch = response.match(/\{[\s\S]*\}/);
  if (objectMatch) return objectMatch[0];

  return response;
}

// --- Heuristic fallbacks (no LLM available) ---

function extractCharactersHeuristic(text) {
  const characters = [];
  const properNounPattern = /\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?)\b/g;
  const nounCounts = {};
  const commonWords = new Set([
    'The', 'This', 'That', 'These', 'Those', 'There', 'Then', 'They',
    'What', 'When', 'Where', 'Which', 'While', 'With', 'Would', 'Will',
    'About', 'After', 'Again', 'Also', 'Another', 'Any', 'Back', 'Because',
    'Before', 'Between', 'Both', 'But', 'Can', 'Come', 'Could', 'Day',
    'Did', 'Down', 'Each', 'Even', 'Every', 'Find', 'First', 'For',
    'From', 'Get', 'Give', 'Good', 'Great', 'Had', 'Has', 'Have',
    'Her', 'Here', 'Him', 'His', 'How', 'However', 'Into', 'Its',
    'Just', 'Know', 'Last', 'Like', 'Long', 'Look', 'Made', 'Make',
    'Man', 'Many', 'May', 'More', 'Most', 'Much', 'Must', 'Name',
    'Never', 'New', 'Next', 'Not', 'Now', 'Old', 'Only', 'Other',
    'Our', 'Out', 'Over', 'Own', 'Part', 'People', 'Place', 'Point',
    'Right', 'Said', 'Same', 'She', 'Should', 'Show', 'Small', 'Some',
    'Something', 'Still', 'Such', 'Take', 'Tell', 'Than', 'Their',
    'Them', 'Through', 'Time', 'Too', 'Two', 'Under', 'Upon', 'Use',
    'Very', 'Want', 'Way', 'Well', 'Were', 'Who', 'Why', 'Will',
    'Work', 'World', 'Year', 'You', 'Your', 'Chapter', 'Part', 'Book',
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
    'January', 'February', 'March', 'April', 'June', 'July', 'August',
    'September', 'October', 'November', 'December',
    'North', 'South', 'East', 'West', 'One', 'Two', 'Three',
    'Perhaps', 'Already', 'Always', 'Around', 'Away', 'Enough',
    'Everything', 'Nothing', 'Something', 'Someone', 'Sometimes',
    'Although', 'Among', 'Being', 'During', 'Until', 'Without'
  ]);

  let match;
  while ((match = properNounPattern.exec(text)) !== null) {
    const name = match[1];
    if (!commonWords.has(name) && !commonWords.has(name.split(' ')[0])) {
      nounCounts[name] = (nounCounts[name] || 0) + 1;
    }
  }

  // Filter to names that appear at least 3 times
  const frequentNames = Object.entries(nounCounts)
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  // Check for dialogue attribution to confirm character status
  for (const [name, count] of frequentNames) {
    const dialoguePattern = new RegExp(`${name}\\s+(?:said|asked|replied|whispered|shouted|muttered|exclaimed|called|cried|answered|spoke|told|yelled)`, 'gi');
    const dialogueMatches = text.match(dialoguePattern);
    const hasDialogue = dialogueMatches && dialogueMatches.length > 0;

    // Determine role based on frequency
    let role = 'minor';
    if (count > 50 || (count > 20 && hasDialogue)) role = 'protagonist';
    else if (count > 20) role = 'supporting';
    else if (count > 10) role = 'supporting';

    characters.push({
      name,
      role,
      mentions: count,
      hasDialogue,
      description: '',
      traits: [],
      relationships: [],
      source: 'heuristic'
    });
  }

  return characters;
}

function extractWorldRulesHeuristic(text) {
  // Look for explanatory passages that describe how things work
  const rules = [];
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());

  const ruleIndicators = [
    /\b(?:the\s+)?(?:rule|law|principle|custom|tradition)\s+(?:of|that|is|was|states?)\b/i,
    /\b(?:in\s+this\s+world|in\s+(?:the\s+)?(?:realm|kingdom|land))\b/i,
    /\b(?:magic|power|energy|force)\s+(?:works?|flows?|requires?|demands?|allows?)\b/i,
    /\b(?:it\s+is|it\s+was)\s+(?:known|said|believed|forbidden|required|customary)\b/i,
    /\b(?:according\s+to|by\s+(?:the\s+)?(?:law|custom|tradition))\b/i,
    /\b(?:no\s+one\s+(?:can|could|may|was\s+allowed))\b/i,
    /\b(?:every|all)\s+\w+\s+(?:must|had\s+to|were\s+required)\b/i
  ];

  for (const paragraph of paragraphs) {
    for (const pattern of ruleIndicators) {
      if (pattern.test(paragraph)) {
        const title = paragraph.substring(0, 60).replace(/\s+\S*$/, '').trim() + '...';
        rules.push({
          title,
          category: 'other',
          content: paragraph.trim(),
          source: 'heuristic'
        });
        break;
      }
    }
  }

  return rules.slice(0, 20); // Limit to 20 rules
}

function deriveBeatMapHeuristic(text) {
  const beats = [];
  const chapters = text.split(/(?:^|\n)(?:chapter|CHAPTER)\s+\d+/i).filter(c => c.trim());

  if (chapters.length <= 1) {
    // No chapter markers, split by scene breaks
    const scenes = text.split(/\n\s*(?:\*\s*\*\s*\*|#\s*#\s*#|---+|___+)\s*\n/).filter(s => s.trim());
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i].trim();
      const firstLine = scene.split('\n')[0].trim();
      beats.push({
        title: firstLine.substring(0, 80) || `Beat ${i + 1}`,
        type: determineBeatType(i, scenes.length),
        summary: scene.substring(0, 200).trim() + '...',
        source: 'heuristic'
      });
    }
  } else {
    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i].trim();
      const firstLine = chapter.split('\n')[0].trim();
      beats.push({
        title: `Chapter ${i + 1}: ${firstLine.substring(0, 60)}`,
        type: determineBeatType(i, chapters.length),
        summary: chapter.substring(0, 200).trim() + '...',
        chapter: i + 1,
        source: 'heuristic'
      });
    }
  }

  return beats;
}

function determineBeatType(index, total) {
  const position = index / Math.max(total - 1, 1);
  if (position === 0) return 'setup';
  if (position < 0.15) return 'inciting_incident';
  if (position < 0.4) return 'rising_action';
  if (position >= 0.45 && position <= 0.55) return 'midpoint';
  if (position < 0.75) return 'complication';
  if (position < 0.9) return 'climax';
  if (position < 0.95) return 'falling_action';
  return 'resolution';
}

function buildSceneInventoryHeuristic(text) {
  const scenes = [];
  // Split by scene breaks or chapter markers
  const sceneBreakPattern = /\n\s*(?:\*\s*\*\s*\*|#\s*#\s*#|---+|___+|(?:chapter|CHAPTER)\s+\d+)\s*\n/;
  const segments = text.split(sceneBreakPattern).filter(s => s.trim());

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i].trim();
    if (segment.length < 50) continue;

    // Try to detect location
    const locationMatch = segment.match(/\b(?:in\s+(?:the\s+)?|at\s+(?:the\s+)?|inside\s+(?:the\s+)?)([\w\s]{3,30}?)(?:[.,;]|\s+(?:and|where|which|that))/i);
    const location = locationMatch ? locationMatch[1].trim() : 'Unknown';

    // Try to detect time
    const timeMatch = segment.match(/\b(morning|afternoon|evening|night|dawn|dusk|midnight|noon|sunrise|sunset)\b/i);
    const timeOfDay = timeMatch ? timeMatch[1].toLowerCase() : 'unknown';

    // Extract character names present (reuse proper noun logic)
    const properNouns = segment.match(/\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?\b/g) || [];
    const uniqueNames = [...new Set(properNouns)].slice(0, 5);

    const firstLine = segment.split('\n')[0].trim();

    scenes.push({
      title: firstLine.substring(0, 80) || `Scene ${i + 1}`,
      location,
      timeOfDay,
      characters: uniqueNames,
      summary: segment.substring(0, 200).trim() + '...',
      purpose: 'unknown',
      source: 'heuristic'
    });
  }

  return scenes;
}

function checkContinuityHeuristic(text) {
  const issues = [];

  // Check for character name spelling variations
  const properNouns = {};
  const nounPattern = /\b([A-Z][a-z]{2,})\b/g;
  let match;
  while ((match = nounPattern.exec(text)) !== null) {
    const name = match[1];
    properNouns[name] = (properNouns[name] || 0) + 1;
  }

  // Find similar names that might be misspellings
  const names = Object.keys(properNouns).filter(n => properNouns[n] >= 2);
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const dist = levenshteinDistance(names[i], names[j]);
      if (dist === 1 && properNouns[names[i]] >= 3 && properNouns[names[j]] >= 2) {
        issues.push({
          type: 'character',
          severity: 'minor',
          description: `Possible name inconsistency: "${names[i]}" (${properNouns[names[i]]} occurrences) vs "${names[j]}" (${properNouns[names[j]]} occurrences). Could be a typo.`,
          suggestion: `Verify whether "${names[i]}" and "${names[j]}" are the same character.`,
          source: 'heuristic'
        });
      }
    }
  }

  // Check for temporal inconsistencies (basic)
  const timeReferences = [];
  const timePattern = /\b(yesterday|today|tomorrow|last\s+(?:week|month|year)|next\s+(?:week|month|year)|(\d+)\s+(?:days?|weeks?|months?|years?)\s+(?:ago|later|before|after))\b/gi;
  while ((match = timePattern.exec(text)) !== null) {
    timeReferences.push({
      text: match[0],
      position: match.index
    });
  }

  if (timeReferences.length > 2) {
    issues.push({
      type: 'timeline',
      severity: 'minor',
      description: `Found ${timeReferences.length} relative time references. Manual review recommended to ensure timeline consistency.`,
      suggestion: 'Review relative time references to ensure they align with the story timeline.',
      source: 'heuristic'
    });
  }

  return issues;
}

function levenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

// Fallback parsers for when LLM returns non-JSON text
function parseCharactersFallback(response) {
  const characters = [];
  const lines = response.split('\n');
  let current = null;

  for (const line of lines) {
    const nameMatch = line.match(/^(?:\d+[.)]\s*|[-*•]\s*)?(?:\*\*|__)?([\w\s]+?)(?:\*\*|__)?(?:\s*[-–:]\s*(.+))?$/);
    if (nameMatch && nameMatch[1].trim().length > 1 && nameMatch[1].trim().length < 40) {
      if (current) characters.push(current);
      current = {
        name: nameMatch[1].trim(),
        description: nameMatch[2] || '',
        role: 'unknown',
        source: 'llm_parsed'
      };
    } else if (current && line.trim()) {
      current.description += ' ' + line.trim();
    }
  }
  if (current) characters.push(current);

  return characters;
}

function parseWorldRulesFallback(response) {
  const rules = [];
  const sections = response.split(/\n(?=\d+[.)]\s|[-*•]\s|\*\*)/);

  for (const section of sections) {
    if (section.trim().length < 10) continue;
    const firstLine = section.split('\n')[0].trim();
    rules.push({
      title: firstLine.substring(0, 80),
      category: 'other',
      content: section.trim(),
      source: 'llm_parsed'
    });
  }

  return rules;
}

function parseBeatsFallback(response) {
  const beats = [];
  const sections = response.split(/\n(?=\d+[.)]\s|[-*•]\s|\*\*|#{1,3}\s)/);

  for (const section of sections) {
    if (section.trim().length < 10) continue;
    const firstLine = section.split('\n')[0].trim();
    beats.push({
      title: firstLine.substring(0, 80),
      type: 'other',
      summary: section.trim(),
      source: 'llm_parsed'
    });
  }

  return beats;
}

function parseScenesFallback(response) {
  const scenes = [];
  const sections = response.split(/\n(?=\d+[.)]\s|[-*•]\s|\*\*|#{1,3}\s)/);

  for (const section of sections) {
    if (section.trim().length < 10) continue;
    const firstLine = section.split('\n')[0].trim();
    scenes.push({
      title: firstLine.substring(0, 80),
      location: 'Unknown',
      timeOfDay: 'unknown',
      characters: [],
      summary: section.trim(),
      purpose: 'unknown',
      source: 'llm_parsed'
    });
  }

  return scenes;
}

function parseContinuityFallback(response) {
  const issues = [];
  const sections = response.split(/\n(?=\d+[.)]\s|[-*•]\s|\*\*)/);

  for (const section of sections) {
    if (section.trim().length < 10) continue;
    issues.push({
      type: 'unknown',
      severity: 'minor',
      description: section.trim(),
      source: 'llm_parsed'
    });
  }

  return issues;
}

export {
  extractCharacters,
  extractWorldRules,
  deriveBeatMap,
  buildSceneInventory,
  checkContinuity
};
