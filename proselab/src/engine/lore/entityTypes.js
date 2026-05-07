// src/engine/lore/entityTypes.js

export const ENTITY_TYPES = {
  CHARACTER: 'character',
  LOCATION: 'location',
  ITEM: 'item',
  FACTION: 'faction',
  EVENT: 'event',
  CONCEPT: 'concept',
  SPECIES: 'species',
  CUSTOM: 'custom',
};

export const ENTITY_SCHEMAS = {
  [ENTITY_TYPES.CHARACTER]: {
    type: ENTITY_TYPES.CHARACTER,
    icon: '👤',
    color: '#8b5cf6',
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'aliases', label: 'Aliases', type: 'tags' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'role', label: 'Role', type: 'select', options: ['protagonist', 'antagonist', 'supporting', 'minor', 'mentioned'] },
      { key: 'traits', label: 'Traits', type: 'tags' },
      { key: 'appearance', label: 'Appearance', type: 'textarea' },
      { key: 'motivation', label: 'Motivation', type: 'textarea' },
      { key: 'arc', label: 'Character Arc', type: 'textarea' },
      { key: 'status', label: 'Status', type: 'select', options: ['alive', 'deceased', 'unknown', 'transformed'] },
    ],
  },
  [ENTITY_TYPES.LOCATION]: {
    type: ENTITY_TYPES.LOCATION,
    icon: '📍',
    color: '#10b981',
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'aliases', label: 'Aliases', type: 'tags' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'locationType', label: 'Type', type: 'select', options: ['city', 'town', 'village', 'building', 'room', 'region', 'country', 'continent', 'world', 'plane', 'other'] },
      { key: 'parentLocation', label: 'Parent Location', type: 'entity-ref' },
      { key: 'climate', label: 'Climate/Atmosphere', type: 'textarea' },
      { key: 'significance', label: 'Significance', type: 'textarea' },
    ],
  },
  [ENTITY_TYPES.ITEM]: {
    type: ENTITY_TYPES.ITEM,
    icon: '⚔️',
    color: '#f59e0b',
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'aliases', label: 'Aliases', type: 'tags' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'itemType', label: 'Type', type: 'select', options: ['weapon', 'armor', 'artifact', 'tool', 'document', 'currency', 'consumable', 'other'] },
      { key: 'properties', label: 'Properties', type: 'textarea' },
      { key: 'owner', label: 'Owner', type: 'entity-ref' },
      { key: 'origin', label: 'Origin', type: 'textarea' },
    ],
  },
  [ENTITY_TYPES.FACTION]: {
    type: ENTITY_TYPES.FACTION,
    icon: '🏛️',
    color: '#ef4444',
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'aliases', label: 'Aliases', type: 'tags' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'goals', label: 'Goals', type: 'textarea' },
      { key: 'structure', label: 'Structure', type: 'textarea' },
      { key: 'leader', label: 'Leader', type: 'entity-ref' },
      { key: 'headquarters', label: 'Headquarters', type: 'entity-ref' },
      { key: 'alignment', label: 'Alignment', type: 'select', options: ['ally', 'enemy', 'neutral', 'ambiguous'] },
    ],
  },
  [ENTITY_TYPES.EVENT]: {
    type: ENTITY_TYPES.EVENT,
    icon: '📅',
    color: '#3b82f6',
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'timelinePosition', label: 'Timeline Position', type: 'text' },
      { key: 'participants', label: 'Participants', type: 'entity-ref-list' },
      { key: 'location', label: 'Location', type: 'entity-ref' },
      { key: 'consequences', label: 'Consequences', type: 'textarea' },
      { key: 'eventType', label: 'Type', type: 'select', options: ['battle', 'political', 'personal', 'natural', 'magical', 'historical', 'other'] },
    ],
  },
  [ENTITY_TYPES.CONCEPT]: {
    type: ENTITY_TYPES.CONCEPT,
    icon: '✨',
    color: '#ec4899',
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'rules', label: 'Rules/Laws', type: 'textarea' },
      { key: 'limitations', label: 'Limitations', type: 'textarea' },
      { key: 'source', label: 'Source/Origin', type: 'textarea' },
    ],
  },
  [ENTITY_TYPES.SPECIES]: {
    type: ENTITY_TYPES.SPECIES,
    icon: '🐉',
    color: '#14b8a6',
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'aliases', label: 'Aliases', type: 'tags' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'traits', label: 'Traits', type: 'tags' },
      { key: 'habitat', label: 'Habitat', type: 'entity-ref' },
      { key: 'culture', label: 'Culture', type: 'textarea' },
      { key: 'abilities', label: 'Abilities', type: 'tags' },
    ],
  },
};

export const RELATIONSHIP_TYPES = [
  { key: 'family', label: 'Family', subtypes: ['parent', 'child', 'sibling', 'spouse', 'ancestor', 'descendant'] },
  { key: 'social', label: 'Social', subtypes: ['friend', 'enemy', 'rival', 'mentor', 'student', 'ally', 'lover'] },
  { key: 'organizational', label: 'Organizational', subtypes: ['member', 'leader', 'founder', 'servant', 'employer'] },
  { key: 'spatial', label: 'Spatial', subtypes: ['located-in', 'contains', 'near', 'connected-to'] },
  { key: 'ownership', label: 'Ownership', subtypes: ['owns', 'created', 'guards', 'seeks'] },
  { key: 'causal', label: 'Causal', subtypes: ['caused', 'prevented', 'participated-in', 'witnessed'] },
];
