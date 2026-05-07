// src/engine/lore/queryEngine.js

import { ENTITY_TYPES } from './extractionEngine.js';

/**
 * Parse a natural language query about the lore
 */
function parseQuery(queryText) {
  const lower = queryText.toLowerCase().trim();
  
  // Detect query type
  const queryTypes = {
    WHO: /^who\s+(?:is|was|are|were)\s+/i,
    WHAT: /^what\s+(?:is|was|are|were)\s+/i,
    WHERE: /^where\s+(?:is|was|does|did)\s+/i,
    RELATIONSHIP: /(?:relationship|connection|related|know|friend|enemy|ally|rival)/i,
    LIST: /^(?:list|show|display|all)\s+/i,
    COUNT: /^(?:how many|count|number of)\s+/i,
    SEARCH: /^(?:find|search|look for)\s+/i,
  };

  let type = 'SEARCH';
  for (const [key, pattern] of Object.entries(queryTypes)) {
    if (pattern.test(lower)) {
      type = key;
      break;
    }
  }

  // Extract entity name from query
  const entityName = extractQuerySubject(lower);

  // Extract type filter
  let typeFilter = null;
  if (/characters?|people|persons?/i.test(lower)) typeFilter = ENTITY_TYPES.CHARACTER;
  if (/locations?|places?/i.test(lower)) typeFilter = ENTITY_TYPES.LOCATION;
  if (/items?|objects?|artifacts?|weapons?/i.test(lower)) typeFilter = ENTITY_TYPES.ITEM;
  if (/events?|battles?|wars?/i.test(lower)) typeFilter = ENTITY_TYPES.EVENT;
  if (/factions?|groups?|organizations?/i.test(lower)) typeFilter = ENTITY_TYPES.FACTION;

  return {
    type,
    subject: entityName,
    typeFilter,
    raw: queryText,
  };
}

function extractQuerySubject(query) {
  // Remove common question words
  let subject = query
    .replace(/^(?:who|what|where|when|how|why|tell me about|describe|show me|find|search for|list all|is|was|are|were)\s+/i, '')
    .replace(/\?$/, '')
    .replace(/^(?:the|a|an)\s+/i, '')
    .trim();

  // Try to find quoted names
  const quoted = query.match(/["']([^"']+)["']/);
  if (quoted) return quoted[1];

  return subject;
}

/**
 * Execute a query against the lore store
 */
export function executeQuery(queryText, store) {
  const parsed = parseQuery(queryText);
  const results = {
    query: parsed,
    entities: [],
    relationships: [],
    answer: '',
    suggestions: [],
  };

  switch (parsed.type) {
    case 'WHO':
    case 'WHAT':
    case 'SEARCH': {
      // Find matching entities
      const matches = store.searchEntities(parsed.subject, {
        type: parsed.typeFilter,
      });

      if (matches.length === 0) {
        // Try fuzzy matching
        const allEntities = parsed.typeFilter
          ? store.entities.filter(e => e.type === parsed.typeFilter)
          : store.entities;
        
        const fuzzy = allEntities.filter(e => {
          const nameLower = e.name.toLowerCase();
          const subjectLower = parsed.subject.toLowerCase();
          return nameLower.includes(subjectLower) || subjectLower.includes(nameLower);
        });

        if (fuzzy.length > 0) {
          results.entities = fuzzy;
          results.answer = `Found ${fuzzy.length} possible match(es) for "${parsed.subject}"`;
        } else {
          results.answer = `No entities found matching "${parsed.subject}"`;
          results.suggestions = store.entities
            .slice(0, 5)
            .map(e => `Try asking about "${e.name}"`);
        }
      } else {
        results.entities = matches;
        const primary = matches[0];
        results.answer = formatEntityAnswer(primary, store);
      }
      break;
    }

    case 'WHERE': {
      const entity = store.getEntityByName(parsed.subject);
      if (entity) {
        const locationRels = store.getRelationshipsFor(entity.id)
          .filter(r => r.type === 'location');
        
        if (locationRels.length > 0) {
          const locations = locationRels.map(r => {
            const otherId = r.sourceId === entity.id ? r.targetId : r.sourceId;
            return store.getEntity(otherId);
          }).filter(Boolean);
          
          results.entities = [entity, ...locations];
          results.answer = `${entity.name} is associated with: ${locations.map(l => l.name).join(', ')}`;
        } else if (entity.attributes?.location) {
          results.entities = [entity];
          results.answer = `${entity.name} is located at/in ${entity.attributes.location}`;
        } else {
          results.entities = [entity];
          results.answer = `No location information found for "${entity.name}"`;
        }
      } else {
        results.answer = `Entity "${parsed.subject}" not found`;
      }
      break;
    }

    case 'RELATIONSHIP': {
      const entity = store.getEntityByName(parsed.subject);
      if (entity) {
        const rels = store.getRelationshipsFor(entity.id);
        results.entities = [entity];
        results.relationships = rels;

        if (rels.length > 0) {
          const relDescriptions = rels.map(r => {
            const otherId = r.sourceId === entity.id ? r.targetId : r.sourceId;
            const other = store.getEntity(otherId);
            const otherName = other ? other.name : 'Unknown';
            return `${r.subtype || r.type} with ${otherName}`;
          });
          results.answer = `${entity.name} has ${rels.length} relationship(s):\n${relDescriptions.map(d => `  - ${d}`).join('\n')}`;
        } else {
          results.answer = `No relationships found for "${entity.name}"`;
        }
      } else {
        results.answer = `Entity "${parsed.subject}" not found`;
      }
      break;
    }

    case 'LIST': {
      const filtered = parsed.typeFilter
        ? store.entities.filter(e => e.type === parsed.typeFilter)
        : store.entities;

      results.entities = filtered;
      const typeName = parsed.typeFilter || 'all';
      results.answer = `Found ${filtered.length} ${typeName} entities:\n${filtered.map(e => `  - ${e.name} (${e.type}, confidence: ${(e.confidence * 100).toFixed(0)}%)`).join('\n')}`;
      break;
    }

    case 'COUNT': {
      const filtered = parsed.typeFilter
        ? store.entities.filter(e => e.type === parsed.typeFilter)
        : store.entities;

      results.answer = `There are ${filtered.length} ${parsed.typeFilter || ''} entities in the lore database.`;
      break;
    }

    default:
      results.answer = `I couldn't understand the query. Try asking "Who is [name]?" or "List all characters"`;
  }

  return results;
}

/**
 * Format a detailed answer about an entity
 */
function formatEntityAnswer(entity, store) {
  const lines = [];
  lines.push(`**${entity.name}** (${entity.type})`);

  if (entity.aliases && entity.aliases.length > 0) {
    lines.push(`Also known as: ${entity.aliases.join(', ')}`);
  }

  if (entity.attributes.description) {
    lines.push(`Description: ${entity.attributes.description}`);
  }

  if (entity.attributes.title) {
    lines.push(`Title: ${entity.attributes.title}`);
  }

  if (entity.attributes.traits && entity.attributes.traits.length > 0) {
    lines.push(`Traits: ${entity.attributes.traits.join(', ')}`);
  }

  if (entity.attributes.location) {
    lines.push(`Location: ${entity.attributes.location}`);
  }

  if (entity.attributes.status) {
    lines.push(`Status: ${entity.attributes.status}`);
  }

  // Get relationships
  const rels = store.getRelationshipsFor(entity.id);
  if (rels.length > 0) {
    lines.push(`\nRelationships:`);
    for (const rel of rels.slice(0, 10)) {
      const otherId = rel.sourceId === entity.id ? rel.targetId : rel.sourceId;
      const other = store.getEntity(otherId);
      if (other) {
        lines.push(`  - ${rel.subtype || rel.type}: ${other.name}`);
      }
    }
  }

  lines.push(`\nConfidence: ${(entity.confidence * 100).toFixed(0)}% | Mentions: ${entity.mentions} | Verified: ${entity.verified ? 'Yes' : 'No'}`);

  return lines.join('\n');
}
