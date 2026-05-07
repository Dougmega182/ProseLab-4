// src/engine/lore/graphBuilder.js

/**
 * Build a graph data structure suitable for visualization
 */
export function buildGraph(entities, relationships, options = {}) {
  const {
    minConfidence = 0.3,
    maxNodes = 100,
    includeOrphans = false,
    typeFilter = null,
    centerEntityId = null,
    depth = 2,
  } = options;

  let filteredEntities = entities.filter(e => e.confidence >= minConfidence);

  if (typeFilter) {
    filteredEntities = filteredEntities.filter(e => e.type === typeFilter);
  }

  // If centering on an entity, do BFS to find connected nodes
  if (centerEntityId) {
    const connected = new Set([centerEntityId]);
    let frontier = [centerEntityId];

    for (let d = 0; d < depth; d++) {
      const nextFrontier = [];
      for (const nodeId of frontier) {
        for (const rel of relationships) {
          if (rel.sourceId === nodeId && !connected.has(rel.targetId)) {
            connected.add(rel.targetId);
            nextFrontier.push(rel.targetId);
          }
          if (rel.targetId === nodeId && !connected.has(rel.sourceId)) {
            connected.add(rel.sourceId);
            nextFrontier.push(rel.sourceId);
          }
        }
      }
      frontier = nextFrontier;
    }

    filteredEntities = filteredEntities.filter(e => connected.has(e.id));
  }

  // Remove orphans if requested
  if (!includeOrphans) {
    const connectedIds = new Set();
    for (const rel of relationships) {
      connectedIds.add(rel.sourceId);
      connectedIds.add(rel.targetId);
    }
    filteredEntities = filteredEntities.filter(e => connectedIds.has(e.id));
  }

  // Limit nodes
  if (filteredEntities.length > maxNodes) {
    filteredEntities.sort((a, b) => b.mentions - a.mentions);
    filteredEntities = filteredEntities.slice(0, maxNodes);
  }

  const entityIds = new Set(filteredEntities.map(e => e.id));

  // Build nodes
  const nodes = filteredEntities.map(entity => ({
    id: entity.id,
    label: entity.name,
    type: entity.type,
    size: Math.max(10, Math.min(50, entity.mentions * 3)),
    color: getTypeColor(entity.type),
    confidence: entity.confidence,
    verified: entity.verified,
    attributes: entity.attributes,
    aliases: entity.aliases,
  }));

  // Build edges
  const filteredRelationships = relationships.filter(
    r => entityIds.has(r.sourceId) && entityIds.has(r.targetId)
  );

  const edges = filteredRelationships.map(rel => ({
    id: rel.id,
    source: rel.sourceId,
    target: rel.targetId,
    label: rel.subtype || rel.type,
    type: rel.type,
    color: getRelationshipColor(rel.type, rel.subtype),
    width: Math.max(1, Math.min(5, rel.confidence * 5)),
    confidence: rel.confidence,
  }));

  // Compute layout hints
  const clusters = computeClusters(nodes, edges);

  return {
    nodes,
    edges,
    clusters,
    stats: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      clusterCount: clusters.length,
      density: nodes.length > 1
        ? (2 * edges.length) / (nodes.length * (nodes.length - 1))
        : 0,
    },
  };
}

/**
 * Get color for entity type
 */
function getTypeColor(type) {
  const colors = {
    character: '#4A90D9',
    location: '#2ECC71',
    item: '#E67E22',
    event: '#9B59B6',
    faction: '#E74C3C',
    concept: '#1ABC9C',
    creature: '#F39C12',
    unknown: '#95A5A6',
  };
  return colors[type] || colors.unknown;
}

/**
 * Get color for relationship type
 */
function getRelationshipColor(type, subtype) {
  if (subtype === 'enemy' || subtype === 'rival') return '#E74C3C';
  if (subtype === 'friend' || subtype === 'ally') return '#2ECC71';
  if (subtype === 'family' || subtype === 'parent' || subtype === 'child' || subtype === 'sibling') return '#3498DB';
  if (subtype === 'romantic' || subtype === 'spouse') return '#E91E63';
  if (type === 'location') return '#8BC34A';
  if (type === 'membership') return '#FF9800';
  if (type === 'ownership') return '#795548';
  return '#9E9E9E';
}

/**
 * Simple community detection using connected components
 */
function computeClusters(nodes, edges) {
  const parent = {};
  const rank = {};

  for (const node of nodes) {
    parent[node.id] = node.id;
    rank[node.id] = 0;
  }

  function find(x) {
    if (parent[x] !== x) {
      parent[x] = find(parent[x]);
    }
    return parent[x];
  }

  function union(x, y) {
    const px = find(x);
    const py = find(y);
    if (px === py) return;
    if (rank[px] < rank[py]) {
      parent[px] = py;
    } else if (rank[px] > rank[py]) {
      parent[py] = px;
    } else {
      parent[py] = px;
      rank[px]++;
    }
  }

  for (const edge of edges) {
    union(edge.source, edge.target);
  }

  const clusters = {};
  for (const node of nodes) {
    const root = find(node.id);
    if (!clusters[root]) {
      clusters[root] = [];
    }
    clusters[root].push(node.id);
  }

  return Object.values(clusters).map((memberIds, index) => ({
    id: `cluster_${index}`,
    members: memberIds,
    size: memberIds.length,
  }));
}

/**
 * Build a timeline from event entities
 */
export function buildTimeline(entities, relationships) {
  const events = entities
    .filter(e => e.type === 'event' && e.attributes)
    .map(e => ({
      id: e.id,
      name: e.name,
      date: e.attributes.date || e.attributes.time || null,
      description: e.attributes.description || '',
      participants: [],
      locations: [],
      confidence: e.confidence,
    }));

  // Enrich events with participants and locations from relationships
  for (const event of events) {
    const rels = relationships.filter(
      r => r.sourceId === event.id || r.targetId === event.id
    );

    for (const rel of rels) {
      const otherId = rel.sourceId === event.id ? rel.targetId : rel.sourceId;
      const other = entities.find(e => e.id === otherId);
      if (!other) continue;

      if (other.type === 'character' || other.type === 'faction') {
        event.participants.push({ id: other.id, name: other.name, type: other.type });
      }
      if (other.type === 'location') {
        event.locations.push({ id: other.id, name: other.name });
      }
    }
  }

  // Sort by date if available, otherwise by order of appearance
  events.sort((a, b) => {
    if (a.date && b.date) return String(a.date).localeCompare(String(b.date));
    if (a.date) return -1;
    if (b.date) return 1;
    return 0;
  });

  return events;
}
