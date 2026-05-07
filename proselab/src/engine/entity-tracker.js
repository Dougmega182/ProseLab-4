/**
 * Entity Tracker
 * Extracts, stores, and tracks characters, locations, and objects across the manuscript.
 * Features background queue processing, alias support, and categorical context generation.
 */

export class EntityTracker {
  constructor(db, llm) {
    this.db = db;
    this.llm = llm;
    this.extractionQueue = [];
    this.isProcessing = false;
  }

  async extractFromContent(projectId, content) {
    this.extractionQueue.push({ projectId, content });
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  async processQueue() {
    if (this.isProcessing || this.extractionQueue.length === 0) return;
    this.isProcessing = true;

    try {
      while (this.extractionQueue.length > 0) {
        const { projectId, content } = this.extractionQueue.shift();
        await this.doExtraction(projectId, content);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  async doExtraction(projectId, content) {
    // Only process substantial content
    if (!content || content.length < 200) return;

    // Take a sample if content is very long
    const sample = content.length > 4000
      ? content.slice(-4000)
      : content;

    const existingEntities = await this.db.entities
      .where('projectId').equals(projectId)
      .toArray();

    const existingNames = existingEntities.map(e => e.name);

    const messages = [
      {
        role: 'system',
        content: `You are a story analysis tool. Extract entities (characters, locations, objects) from the given text. For each entity, provide:
- name: The entity's name
- type: "character", "location", or "object"
- description: Brief description based on what's revealed in the text
- attributes: Key-value pairs of notable attributes (e.g., hair color, age, size)

Already known entities: ${existingNames.join(', ') || 'none'}

For known entities, only include them if the text reveals NEW information about them.

Respond in JSON format:
{
  "entities": [
    {
      "name": "...",
      "type": "...",
      "description": "...",
      "attributes": { "key": "value" },
      "isNew": true/false
    }
  ]
}`
      },
      {
        role: 'user',
        content: sample
      }
    ];

    try {
      const result = await this.llm.chat(messages, {
        purpose: 'analysis',
        temperature: 0.2,
        max_tokens: 1000
      });

      const parsed = this.parseEntityResponse(result.content);
      if (!parsed || !parsed.entities) return;

      for (const entity of parsed.entities) {
        await this.upsertEntity(projectId, entity, existingEntities);
      }
    } catch (e) {
      console.warn('Entity extraction failed:', e);
    }
  }

  parseEntityResponse(content) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return null;
    } catch (e) {
      console.warn('Failed to parse entity response:', e);
      return null;
    }
  }

  async upsertEntity(projectId, entityData, existingEntities) {
    const existing = existingEntities.find(
      e => e.name.toLowerCase() === entityData.name.toLowerCase()
    );

    if (existing) {
      // Merge new information into existing entity
      const mergedAttributes = {
        ...(existing.attributes || {}),
        ...(entityData.attributes || {})
      };

      const mergedDescription = entityData.description && entityData.description !== existing.description
        ? `${existing.description} ${entityData.description}`
        : existing.description;

      await this.db.entities.update(existing.id, {
        attributes: mergedAttributes,
        description: mergedDescription,
        lastUpdated: new Date().toISOString()
      });
    } else if (entityData.isNew !== false) {
      // Add new entity
      await this.db.entities.add({
        id: crypto.randomUUID(),
        projectId,
        name: entityData.name,
        type: entityData.type || 'character',
        description: entityData.description || '',
        attributes: entityData.attributes || {},
        aliases: [],
        notes: '',
        lastUpdated: new Date().toISOString()
      });
    }
  }

  async getEntityContext(projectId) {
    const entities = await this.db.entities
      .where('projectId').equals(projectId)
      .toArray();

    if (entities.length === 0) return null;

    const grouped = {
      character: [],
      location: [],
      object: []
    };

    for (const entity of entities) {
      const group = grouped[entity.type] || grouped.object;
      let entry = `**${entity.name}**`;

      if (entity.description) {
        entry += `: ${entity.description}`;
      }

      if (entity.attributes && Object.keys(entity.attributes).length > 0) {
        const attrs = Object.entries(entity.attributes)
          .map(([k, v]) => `${k}: ${v}`)
          .join('; ');
        entry += ` (${attrs})`;
      }

      group.push(entry);
    }

    const parts = [];

    if (grouped.character.length > 0) {
      parts.push(`### Characters\n${grouped.character.join('\n')}`);
    }
    if (grouped.location.length > 0) {
      parts.push(`### Locations\n${grouped.location.join('\n')}`);
    }
    if (grouped.object.length > 0) {
      parts.push(`### Notable Objects\n${grouped.object.join('\n')}`);
    }

    return parts.join('\n\n');
  }

  async updateEntity(entityId, updates) {
    await this.db.entities.update(entityId, {
      ...updates,
      lastUpdated: new Date().toISOString()
    });
  }

  async deleteEntity(entityId) {
    await this.db.entities.delete(entityId);
  }

  async addAlias(entityId, alias) {
    const entity = await this.db.entities.get(entityId);
    if (!entity) return;

    const aliases = entity.aliases || [];
    if (!aliases.includes(alias)) {
      aliases.push(alias);
      await this.db.entities.update(entityId, { aliases });
    }
  }

  async findEntity(projectId, name) {
    const entities = await this.db.entities
      .where('projectId').equals(projectId)
      .toArray();

    const lower = name.toLowerCase();

    return entities.find(e =>
      e.name.toLowerCase() === lower ||
      (e.aliases || []).some(a => a.toLowerCase() === lower)
    );
  }
}
