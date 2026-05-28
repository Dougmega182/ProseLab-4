/**
 * Lore Extraction Agent
 * Analyzes approved prose to identify new entities, state changes, 
 * and narrative contradictions. Proposes updates via Shadow Actions.
 */

function parseFirstJSONObject(raw) {
  const source = String(raw || '').replace(/```json|```/gi, '').trim();
  const starts = [];
  let inString = false;
  let escaped = false;

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') {
      starts.push(i);
    }
  }

  for (let s = 0; s < starts.length; s += 1) {
    const start = starts[s];
    let depth = 0;
    inString = false;
    escaped = false;

    for (let i = start; i < source.length; i += 1) {
      const ch = source[i];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch === '\\') {
          escaped = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }

      if (ch === '"') {
        inString = true;
        continue;
      }

      if (ch === '{') depth += 1;
      if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          const candidate = source.slice(start, i + 1);
          try {
            return JSON.parse(candidate);
          } catch {
            break;
          }
        }
      }
    }
  }

  return null;
}

export async function extractLore(prose, context, projectId, providers) {
  const { sceneId, relevantEntities } = context;

  const existingEntitySummaries = relevantEntities.map(e => {
    let summary = `${e.name} (${e.type}): ${e.description || 'No description'}`;
    if (e.currentState && Object.keys(e.currentState).length > 0) {
      summary += ` | Current state: ${JSON.stringify(e.currentState)}`;
    }
    if (e.relationships && e.relationships.length > 0) {
      summary += ` | Relationships: ${e.relationships.map(r => `${r.relationshipType} with ${r.targetName}`).join(', ')}`;
    }
    return summary;
  }).join('\n');

  const systemPrompt = `You are a lore extraction engine for fiction. You read a scene and identify changes to the story's world state. You compare against known entities and detect:

1. **New entities** introduced (characters, locations, items, factions, concepts)
2. **State changes** to existing entities (injuries, mood shifts, location changes, possession changes, knowledge gained)
3. **New or changed relationships** between entities
4. **Potential contradictions** with established lore

IMPORTANT RULES:
- Only extract CONCRETE facts, not implications or speculation
- A character being described does NOT mean their traits changed — only flag actual changes
- Distinguish between new information ABOUT an entity vs. a CHANGE to an entity
- Be conservative — when in doubt, don't flag it
- Every extraction must cite the specific text that supports it

Respond in JSON:
{
  "actions": [
    {
      "type": "ADD_ENTITY",
      "confidence": <0.0-1.0>,
      "reasoning": "why this should be added",
      "citation": "quoted text from prose",
      "payload": {
        "name": "...",
        "type": "character|location|item|faction|concept|event",
        "description": "...",
        "physicalDescription": "...",
        "initialState": {},
        "permanentTraits": {},
        "aliases": []
      }
    },
    {
      "type": "UPDATE_STATE",
      "confidence": <0.0-1.0>,
      "reasoning": "why this state changed",
      "citation": "quoted text from prose",
      "payload": {
        "entityName": "...",
        "attribute": "...",
        "previousValue": "...",
        "newValue": "..."
      }
    },
    {
      "type": "UPDATE_RELATIONSHIP",
      "confidence": <0.0-1.0>,
      "reasoning": "why this relationship changed",
      "citation": "quoted text from prose",
      "payload": {
        "entityName": "...",
        "targetName": "...",
        "relationshipType": "...",
        "description": "...",
        "isNew": true
      }
    },
    {
      "type": "FLAG_CONTRADICTION",
      "confidence": <0.0-1.0>,
      "reasoning": "what contradicts what",
      "citation": "quoted text from prose",
      "payload": {
        "entityName": "...",
        "attribute": "...",
        "establishedValue": "...",
        "contradictingValue": "...",
        "suggestedResolution": "..."
      }
    }
  ]
}

If no actions are needed, return {"actions": []}`;

  const userContent = `## KNOWN ENTITIES\n${existingEntitySummaries || 'No entities established yet.'}\n\n## SCENE PROSE\n${prose}`;

  const response = await providers.callLLM({
    role: 'extraction',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent }
    ],
    temperature: 0.2,
    max_tokens: 3000,
    response_format: { type: 'json_object' }
  });

  if (!response.ok) {
    console.error('Lore extraction failed:', response.error);
    return [];
  }

  const parsed = parseFirstJSONObject(response.content);
  if (!parsed) return [];

  const actions = parsed.actions || [];

  return actions.map(action => ({
    ...action,
    projectId,
    sceneId,
    createdAt: Date.now()
  }));
}
