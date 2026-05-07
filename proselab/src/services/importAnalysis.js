/**
 * importAnalysis.js - LLM-powered analysis functions for post-import processing
 */

export async function extractCharactersFromText(fullText, llmService) {
  // Chunk the text if it's too long for a single prompt
  const chunks = chunkText(fullText, 12000);
  let allCharacters = [];

  for (const chunk of chunks) {
    const prompt = `Analyze the following fiction text and extract all named characters. For each character provide:
- name: Full name as used in the text
- aliases: Any other names, nicknames, or titles
- role: protagonist, antagonist, supporting, minor, mentioned
- description: Physical appearance if described
- personality: Key personality traits observed
- relationships: Array of { character, relationship } pairs
- firstAppearance: Brief note of where they first appear
- arc: Brief character arc summary if discernible

Return ONLY valid JSON as an array of character objects. No markdown formatting.

TEXT:
${chunk}`;

    try {
      const response = await llmService.complete(prompt, {
        temperature: 0.3,
        maxTokens: 4000
      });
      
      const parsed = parseJSONResponse(response);
      if (Array.isArray(parsed)) {
        allCharacters.push(...parsed);
      }
    } catch (err) {
      console.warn('Character extraction failed for chunk:', err);
    }
  }

  // Deduplicate and merge characters found across chunks
  return deduplicateCharacters(allCharacters);
}

export async function extractWorldRulesFromText(fullText, llmService) {
  const chunks = chunkText(fullText, 12000);
  let allRules = [];

  for (const chunk of chunks) {
    const prompt = `Analyze the following fiction text and extract world-building rules and setting details. Categorize each into:
- magic_system: How magic/supernatural elements work, costs, limitations
- geography: Locations, distances, terrain, climate
- politics: Power structures, factions, governments, laws
- technology: Tech level, specific inventions, capabilities
- culture: Customs, religions, languages, social norms
- history: Historical events referenced, timeline
- economics: Currency, trade, resources
- biology: Species, creatures, flora/fauna

For each rule provide:
- title: Short descriptive title
- category: One of the categories above
- description: Detailed description of the rule
- evidence: Quote or reference from the text
- confidence: high, medium, low — how explicitly stated vs inferred

Return ONLY valid JSON as an array. No markdown formatting.

TEXT:
${chunk}`;

    try {
      const response = await llmService.complete(prompt, {
        temperature: 0.3,
        maxTokens: 4000
      });
      
      const parsed = parseJSONResponse(response);
      if (Array.isArray(parsed)) {
        allRules.push(...parsed);
      }
    } catch (err) {
      console.warn('World rule extraction failed for chunk:', err);
    }
  }

  return deduplicateRules(allRules);
}

export async function deriveBeatMapFromChapters(chapters, scenes, llmService) {
  // Build a condensed summary of each chapter for the LLM
  const chapterSummaries = chapters.map(ch => {
    const chScenes = scenes.filter(s => s.chapterTitle === ch.title);
    const sceneTexts = chScenes.map((s, i) => {
      const preview = s.content.substring(0, 500);
      return `  Scene ${i + 1}: ${preview}...`;
    }).join('\n');
    return `Chapter: ${ch.title}\n${sceneTexts}`;
  }).join('\n\n---\n\n');

  const prompt = `Analyze this novel's chapter structure and map it to a three-act story structure with beats.

For each act, identify:
- act: 1, 2, or 3
- title: Name for this act
- startChapter: Which chapter it begins
- endChapter: Which chapter it ends
- beats: Array of story beats, each with:
  - name: Beat name (e.g., "Inciting Incident", "Midpoint Reversal", "Dark Night of the Soul", "Climax")
  - chapter: Which chapter contains this beat
  - scene: Which scene number within the chapter (if identifiable)
  - description: What happens at this beat
  - significance: Why this moment matters to the overall story

Also provide:
- theme: The central theme(s) of the story
- centralConflict: The main conflict driving the narrative
- stakes: What's at stake

Return ONLY valid JSON with structure: { acts: [...], theme, centralConflict, stakes }

CHAPTER SUMMARIES:
${chapterSummaries}`;

  try {
    const response = await llmService.complete(prompt, {
      temperature: 0.4,
      maxTokens: 4000
    });
    return parseJSONResponse(response);
  } catch (err) {
    console.error('Beat map derivation failed:', err);
    return { error: err.message, acts: [] };
  }
}

export async function buildSceneInventory(chapters, llmService) {
  const allScenes = [];

  for (const chapter of chapters) {
    for (let i = 0; i < chapter.scenes.length; i++) {
      const scene = chapter.scenes[i];
      const sceneText = scene.content.substring(0, 3000);

      const prompt = `Analyze this scene from a novel and provide a structured inventory entry.

Scene from "${chapter.title}", Scene ${i + 1}:
${sceneText}

Provide:
- title: A short descriptive title for this scene
- pov: Point-of-view character name
- povType: first, third-limited, third-omniscient, second
- location: Where the scene takes place
- timeOfDay: morning, afternoon, evening, night, unspecified
- timeRelative: How this scene relates temporally to the previous (immediately after, hours later, days later, weeks later, flashback, etc.)
- charactersPresent: Array of character names present in the scene
- charactersMentioned: Array of character names mentioned but not present
- conflict: The primary conflict or tension in this scene
- conflictType: internal, interpersonal, societal, environmental, supernatural
- purpose: What this scene accomplishes for the story (advances plot, reveals character, builds world, creates tension, provides relief, etc.)
- mood: The emotional tone (tense, melancholic, hopeful, humorous, etc.)
- keyEvents: Array of important things that happen
- hooks: Any unresolved questions or tension that carries forward
- wordCount: Approximate word count

Return ONLY valid JSON. No markdown formatting.`;

      try {
        const response = await llmService.complete(prompt, {
          temperature: 0.3,
          maxTokens: 1500
        });
        
        const parsed = parseJSONResponse(response);
        if (parsed) {
          allScenes.push({
            ...parsed,
            chapterTitle: chapter.title,
            chapterOrder: chapter.order,
            sceneIndex: i,
            wordCount: scene.content.split(/\s+/).length
          });
        }
      } catch (err) {
        console.warn(`Scene inventory failed for ${chapter.title} scene ${i + 1}:`, err);
        allScenes.push({
          title: `Scene ${i + 1}`,
          chapterTitle: chapter.title,
          chapterOrder: chapter.order,
          sceneIndex: i,
          wordCount: scene.content.split(/\s+/).length,
          error: err.message
        });
      }
    }
  }

  return allScenes;
}

export async function checkContinuity(scenes, characters, llmService) {
  const sceneTimeline = scenes.map((s, idx) => ({
    index: idx,
    chapter: s.chapterTitle,
    scene: s.sceneIndex,
    title: s.title,
    location: s.location,
    timeRelative: s.timeRelative,
    charactersPresent: s.charactersPresent,
    keyEvents: s.keyEvents
  }));

  const characterSummaries = characters.map(c => ({
    name: c.name,
    aliases: c.aliases,
    description: c.description,
    relationships: c.relationships
  }));

  const timelineStr = JSON.stringify(sceneTimeline, null, 1);
  const charStr = JSON.stringify(characterSummaries, null, 1);

  const prompt = `You are a continuity editor. Analyze the following scene timeline and character data for a novel. 
Identify any continuity errors, contradictions, or inconsistencies.

Check for:
1. Character presence: Is a character in two places at once? Does a character appear after supposedly leaving/dying?
2. Timeline: Do temporal references make sense? Are there impossible time jumps?
3. Location: Do characters travel impossible distances? Are locations described inconsistently?
4. Character details: Do physical descriptions, abilities, or knowledge contradict across scenes?
5. Object tracking: Do important objects appear/disappear without explanation?
6. Relationship consistency: Do character relationships change without justification?

SCENE TIMELINE:
${timelineStr.substring(0, 8000)}

CHARACTERS:
${charStr.substring(0, 4000)}

Return ONLY valid JSON with structure:
{
  "issues": [
    {
      "type": "character_presence" | "timeline" | "location" | "character_detail" | "object" | "relationship",
      "severity": "error" | "warning" | "nitpick",
      "character": "character name if applicable",
      "scenes": [scene indices involved],
      "description": "what the issue is",
      "suggestion": "how to fix it"
    }
  ],
  "summary": "overall continuity assessment"
}`;

  try {
    const response = await llmService.complete(prompt, {
      temperature: 0.3,
      maxTokens: 4000
    });
    return parseJSONResponse(response);
  } catch (err) {
    console.error('Continuity check failed:', err);
    return { issues: [], summary: 'Continuity check failed: ' + err.message };
  }
}

// Helper functions

function chunkText(text, maxChunkSize) {
  if (text.length <= maxChunkSize) return [text];
  
  const chunks = [];
  let remaining = text;
  
  while (remaining.length > 0) {
    if (remaining.length <= maxChunkSize) {
      chunks.push(remaining);
      break;
    }
    
    let breakPoint = remaining.lastIndexOf('\n\n', maxChunkSize);
    if (breakPoint < maxChunkSize * 0.5) {
      breakPoint = remaining.lastIndexOf('. ', maxChunkSize);
    }
    if (breakPoint < maxChunkSize * 0.5) {
      breakPoint = maxChunkSize;
    }
    
    chunks.push(remaining.substring(0, breakPoint));
    remaining = remaining.substring(breakPoint).trim();
  }
  
  return chunks;
}

function parseJSONResponse(response) {
  let cleaned = response.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();
  
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const jsonMatch = cleaned.match(/[\[{][\s\S]*[\]}]/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e2) {
        return null;
      }
    }
    return null;
  }
}

function deduplicateCharacters(characters) {
  const merged = new Map();
  for (const char of characters) {
    const key = normalizeCharacterName(char.name);
    if (merged.has(key)) {
      const existing = merged.get(key);
      existing.aliases = [...new Set([...(existing.aliases || []), ...(char.aliases || [])])];
      existing.relationships = mergeRelationships(existing.relationships, char.relationships);
      if (char.description && (!existing.description || char.description.length > existing.description.length)) {
        existing.description = char.description;
      }
      if (char.personality && (!existing.personality || char.personality.length > existing.personality.length)) {
        existing.personality = char.personality;
      }
      if (char.arc && (!existing.arc || char.arc.length > existing.arc.length)) {
        existing.arc = char.arc;
      }
      const rolePriority = { protagonist: 5, antagonist: 4, supporting: 3, minor: 2, mentioned: 1 };
      if ((rolePriority[char.role] || 0) > (rolePriority[existing.role] || 0)) {
        existing.role = char.role;
      }
    } else {
      merged.set(key, { ...char });
    }
  }
  return Array.from(merged.values());
}

function normalizeCharacterName(name) {
  return (name || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function mergeRelationships(existing = [], incoming = []) {
  const map = new Map();
  for (const rel of [...existing, ...incoming]) {
    const key = normalizeCharacterName(rel.character);
    if (!map.has(key) || (rel.relationship && rel.relationship.length > (map.get(key).relationship || '').length)) {
      map.set(key, rel);
    }
  }
  return Array.from(map.values());
}

function deduplicateRules(rules) {
  const merged = new Map();
  for (const rule of rules) {
    const key = (rule.title || '').toLowerCase().trim();
    if (merged.has(key)) {
      const existing = merged.get(key);
      if (rule.description && rule.description.length > (existing.description || '').length) {
        merged.set(key, { ...existing, ...rule });
      }
    } else {
      merged.set(key, { ...rule });
    }
  }
  return Array.from(merged.values());
}
