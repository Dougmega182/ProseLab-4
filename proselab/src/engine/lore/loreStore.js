// src/engine/lore/loreStore.js

/**
 * In-memory lore database with persistence hooks
 */
export class LoreStore {
  constructor() {
    this.entities = [];
    this.relationships = [];
    this.issues = [];
    this.history = [];
    this.metadata = {
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
      textSegmentsProcessed: 0,
      totalCharactersProcessed: 0,
    };
    this.listeners = new Set();
  }

  /**
   * Subscribe to store changes
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of changes
   */
  _notify(changeType, data) {
    this.metadata.updatedAt = Date.now();
    for (const listener of this.listeners) {
      try {
        listener({ type: changeType, data, store: this });
      } catch (e) {
        console.error('Listener error:', e);
      }
    }
  }

  /**
   * Add or update entities
   */
  setEntities(entities) {
    const previous = this.entities;
    this.entities = entities;
    this._addHistory('entities_updated', {
      previousCount: previous.length,
      newCount: entities.length,
    });
    this._notify('entities_changed', { entities });
  }

  /**
   * Add a single entity
   */
  addEntity(entity) {
    this.entities.push(entity);
    this._addHistory('entity_added', { entity: entity.name });
    this._notify('entity_added', { entity });
  }

  /**
   * Update an entity by ID
   */
  updateEntity(id, updates) {
    const idx = this.entities.findIndex(e => e.id === id);
    if (idx === -1) return false;

    const previous = { ...this.entities[idx] };
    this.entities[idx] = { ...this.entities[idx], ...updates, updatedAt: Date.now() };
    this._addHistory('entity_updated', {
      entity: this.entities[idx].name,
      changes: Object.keys(updates),
    });
    this._notify('entity_updated', { entity: this.entities[idx], previous });
    return true;
  }

  /**
   * Remove an entity by ID
   */
  removeEntity(id) {
    const idx = this.entities.findIndex(e => e.id === id);
    if (idx === -1) return false;

    const removed = this.entities.splice(idx, 1)[0];
    // Also remove related relationships
    this.relationships = this.relationships.filter(
      r => r.sourceId !== id && r.targetId !== id
    );
    this._addHistory('entity_removed', { entity: removed.name });
    this._notify('entity_removed', { entity: removed });
    return true;
  }

  /**
   * Set relationships
   */
  setRelationships(relationships) {
    this.relationships = relationships;
    this._notify('relationships_changed', { relationships });
  }

  /**
   * Add a relationship
   */
  addRelationship(relationship) {
    this.relationships.push(relationship);
    this._notify('relationship_added', { relationship });
  }

  /**
   * Remove a relationship
   */
  removeRelationship(id) {
    const idx = this.relationships.findIndex(r => r.id === id);
    if (idx === -1) return false;
    const removed = this.relationships.splice(idx, 1)[0];
    this._notify('relationship_removed', { relationship: removed });
    return true;
  }

  /**
   * Set consistency issues
   */
  setIssues(issues) {
    this.issues = issues;
    this._notify('issues_changed', { issues });
  }

  /**
   * Dismiss an issue
   */
  dismissIssue(id) {
    this.issues = this.issues.filter(i => i.id !== id);
    this._notify('issue_dismissed', { issueId: id });
  }

  /**
   * Get entity by ID
   */
  getEntity(id) {
    return this.entities.find(e => e.id === id) || null;
  }

  /**
   * Get entity by name (case-insensitive, checks aliases)
   */
  getEntityByName(name) {
    const lower = name.toLowerCase();
    return this.entities.find(e =>
      e.name.toLowerCase() === lower ||
      (e.aliases && e.aliases.some(a => a.toLowerCase() === lower))
    ) || null;
  }

  /**
   * Get relationships for a specific entity
   */
  getRelationshipsFor(entityId) {
    return this.relationships.filter(
      r => r.sourceId === entityId || r.targetId === entityId
    );
  }

  /**
   * Search entities
   */
  searchEntities(query, filters = {}) {
    const queryLower = query.toLowerCase();
    let results = this.entities.filter(e => {
      const nameMatch = e.name.toLowerCase().includes(queryLower);
      const aliasMatch = e.aliases && e.aliases.some(a => a.toLowerCase().includes(queryLower));
      const descMatch = e.attributes?.description?.toLowerCase().includes(queryLower);
      return nameMatch || aliasMatch || descMatch;
    });

    if (filters.type) {
      results = results.filter(e => e.type === filters.type);
    }
    if (filters.minConfidence) {
      results = results.filter(e => e.confidence >= filters.minConfidence);
    }
    if (filters.verified !== undefined) {
      results = results.filter(e => e.verified === filters.verified);
    }

    return results;
  }

  /**
   * Add history entry
   */
  _addHistory(action, details) {
    this.history.push({
      action,
      details,
      timestamp: Date.now(),
    });
    // Keep last 100 history entries
    if (this.history.length > 100) {
      this.history = this.history.slice(-100);
    }
  }

  /**
   * Export store state for persistence
   */
  export() {
    return {
      entities: this.entities,
      relationships: this.relationships,
      issues: this.issues,
      metadata: this.metadata,
      exportedAt: Date.now(),
    };
  }

  /**
   * Import store state
   */
  import(data) {
    if (data.entities) this.entities = data.entities;
    if (data.relationships) this.relationships = data.relationships;
    if (data.issues) this.issues = data.issues;
    if (data.metadata) {
      this.metadata = { ...this.metadata, ...data.metadata };
    }
    this._addHistory('imported', {
      entities: this.entities.length,
      relationships: this.relationships.length,
    });
    this._notify('imported', data);
  }

  /**
   * Clear all data
   */
  clear() {
    this.entities = [];
    this.relationships = [];
    this.issues = [];
    this.history = [];
    this.metadata.version++;
    this._notify('cleared', {});
  }

  /**
   * Get statistics
   */
  getStats() {
    const entityTypes = {};
    for (const e of this.entities) {
      entityTypes[e.type] = (entityTypes[e.type] || 0) + 1;
    }

    const relTypes = {};
    for (const r of this.relationships) {
      relTypes[r.type] = (relTypes[r.type] || 0) + 1;
    }

    return {
      totalEntities: this.entities.length,
      totalRelationships: this.relationships.length,
      totalIssues: this.issues.length,
      entityTypes,
      relationshipTypes: relTypes,
      verifiedEntities: this.entities.filter(e => e.verified).length,
      averageConfidence: this.entities.length > 0
        ? this.entities.reduce((sum, e) => sum + e.confidence, 0) / this.entities.length
        : 0,
      metadata: this.metadata,
    };
  }
}

// Singleton instance
let storeInstance = null;

export function getLoreStore() {
  if (!storeInstance) {
    storeInstance = new LoreStore();
  }
  return storeInstance;
}

export function resetLoreStore() {
  storeInstance = new LoreStore();
  return storeInstance;
}

