/**
 * Lore Extractor Agent
 * Analyzes approved prose to identify new entities, state changes, 
 * and narrative contradictions. Proposes updates via Shadow Actions.
 */

export async function extractLore(prose, sceneConfig, projectId, providers) {
  // First, get the current lore state for comparison
  const currentEntities = sceneConfig.relevantEntities || [];
  
  const response = await providers.callLLM({
    role: 'lore', // Use specialized extraction role
    messages: [
      {
        role: 'system',
        content: `You are a lore extraction system for fiction. You read prose and identify changes to the story's world state.

You will receive:
1. CURRENT LORE STATE — what we currently know about entities
2. PROSE — the newly written scene

Extract:
1. **New entities** — characters, locations, items, factions mentioned for the first time
2. **State changes** — changes to existing entity attributes (injuries, mood shifts, location changes, possession changes)
3. **Relationship changes** — new or changed relationships between entities
4. **Contradictions** — places where the prose contradicts established lore

Rules:
- Only extract CONCRETE facts, not implications or speculation
- For state changes, identify the specific attribute that changed
- For new entities, only include entities with enough detail to be meaningful (not every unnamed passerby)
- For contradictions, note both what the lore says and what the prose says
- Distinguish between temporary states (mood, location) and permanent traits (eye color, species)

Respond in JSON:
{
  "actions": [
    {
      "type": "ADD_ENTITY",
      "confidence": number (0-1),
      "reasoning": "why this should be tracked",
      "payload": {
        "name": "string",
        "type": "character|location|item|faction|concept|event",
        "description": "string",
        "attributes": { "key": "value" },
        "aliases": ["string"]
      }
    },
    {
      "type": "UPDATE_STATE",
      "confidence": number (0-1),
      "reasoning": "what changed and why",
      "payload": {
        "entityName": "string",
        "attribute": "string",
        "previousValue": "string or null",
        "newValue": "string",
        "isPermanent": boolean
      }
    },
    {
      "type": "UPDATE_RELATIONSHIP",
      "confidence": number (0-1),
      "reasoning": "what changed between these entities",
      "payload": {
        "sourceEntityName": "string",
        "targetEntityName": "string",
        "relationshipType": "string",
        "description": "string",
        "previousDescription": "string or null"
      }
    },
    {
      "type": "FLAG_CONTRADICTION",
      "confidence": number (0-1),
      "reasoning": "why this appears contradictory",
      "payload": {
        "entityName": "string",
        "attribute": "string",
        "loreSays": "string",
        "proseSays": "string",
        "possibleExplanation": "string or null"
      }
    }
  ]
}`
      },
      {
        role: 'user',
        content: `## CURRENT LORE STATE\n${buildLoreSnapshot(currentEntities)}\n\n## SCENE PROSE\n${prose}`
      }
    ],
    temperature: 0.2, // Very low — we want precise extraction
    max_tokens: 3000,
    response_format: { type: 'json_object' }
  });

  if (!response.ok) {
    console.error('Lore extraction failed:', response.error);
    return [];
  }

  try {
    const result = JSON.parse(response.content);

    // Enrich each action with metadata
    const actions = (result.actions || []).map(action => ({
      ...action,
      projectId,
      sceneId: sceneConfig.sceneId,
      extractedAt: Date.now()
    }));

    return actions;
  } catch (err) {
    console.error('Failed to parse lore extraction:', err);
    return [];
  }
}

function buildLoreSnapshot(entities) {
  if (entities.length === 0) {
    return '(No established lore yet — this may be an early scene)';
  }

  return entities.map(entity => {
    const parts = [`### ${entity.name} [${entity.type}]`];
    parts.push(entity.description || '(no description)');
    
    if (entity.currentState && Object.keys(entity.currentState).length > 0) {
      parts.push('Attributes:');
      for (const [key, value] of Object.entries(entity.currentState)) {
        parts.push(`  ${key}: ${value}`);
      }
    }

    if (entity.relationships && entity.relationships.length > 0) {
      parts.push('Relationships:');
      for (const rel of entity.relationships) {
        parts.push(`  → ${rel.targetName || rel.targetId}: ${rel.description}`);
      }
    }

    return parts.join('\n');
  }).join('\n\n');
}
