/**
 * Entity Extractor
 * Parses prose to identify world-state changes and new entities.
 * Includes fuzzy-matching reconciliation to maintain lore integrity.
 */

export class EntityExtractor {
  constructor(db, llmProvider) {
    this.db = db;
    this.llm = llmProvider;
  }

  async extractFromProse(text, knownEntities) {
    const entityList = knownEntities
      .map(e => `- ${e.name} (${e.type})${e.aliases?.length > 0 ? ` [aliases: ${e.aliases.join(', ')}]` : ''}`)
      .join('\n');

    const messages = [
      {
        role: 'system',
        content: `You are a story continuity tracker. Analyze the prose below and extract:

1. State changes for known entities (emotional shifts, physical changes, location changes, new information revealed, relationship changes)
2. Any new named entities that appear (characters, locations, objects) that aren't in the known list

Known entities:
${entityList || '(none yet)'}

Respond in JSON format:
{
  "existingEntityUpdates": [
    {
      "name": "entity name",
      "stateChanges": { "key": "value" },
      "context": "brief quote or description of what happened"
    }
  ],
  "newEntities": [
    {
      "name": "entity name",
      "type": "character|location|object|faction|concept",
      "description": "brief description based on what's in the text",
      "suggestedAliases": []
    }
  ]
}

Only include meaningful state changes, not trivial actions. If nothing significant changed, return empty arrays.`
      },
      {
        role: 'user',
        content: text
      }
    ];

    try {
      const response = await this.llm.callLLM({
        model: this.llm.getModel('utility'),
        messages,
        temperature: 0.2,
        max_tokens: 2000,
        stream: false,
        response_format: { type: 'json_object' }
      });

      if (!response.ok) throw new Error(response.error || 'LLM call failed');

      return JSON.parse(response.content);
    } catch (err) {
      console.warn('Entity extraction error:', err);
      return { existingEntityUpdates: [], newEntities: [] };
    }
  }

  async reconcileEntities(projectId) {
    // Find potential duplicates
    const entities = await this.db.entities
      .where('projectId').equals(projectId)
      .toArray();

    const duplicates = [];

    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const similarity = this.nameSimilarity(entities[i].name, entities[j].name);
        if (similarity > 0.8) {
          duplicates.push({
            entity1: entities[i],
            entity2: entities[j],
            similarity
          });
        }

        // Check if one entity's name matches another's alias
        const aliases1 = entities[i].aliases || [];
        const aliases2 = entities[j].aliases || [];

        if (aliases1.some(a => a.toLowerCase() === entities[j].name.toLowerCase()) ||
            aliases2.some(a => a.toLowerCase() === entities[i].name.toLowerCase())) {
          duplicates.push({
            entity1: entities[i],
            entity2: entities[j],
            similarity: 0.95,
            reason: 'alias_match'
          });
        }
      }
    }

    return duplicates;
  }

  nameSimilarity(a, b) {
    const la = a.toLowerCase();
    const lb = b.toLowerCase();
    if (la === lb) return 1;
    if (la.includes(lb) || lb.includes(la)) return 0.85;

    // Levenshtein-based similarity
    const distance = this.levenshtein(la, lb);
    const maxLen = Math.max(la.length, lb.length);
    return 1 - distance / maxLen;
  }

  levenshtein(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b[i - 1] === a[j - 1]) {
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
}
