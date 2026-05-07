// src/engine/lore/index.js

import { extractEntities, extractRelationships, mergeEntities, mergeRelationships } from './extractionEngine.js';
import { runConsistencyChecks, checkNewTextConsistency, autoFixIssues } from './consistencyChecker.js';
import { getLoreStore } from './loreStore.js';
import { executeQuery } from './queryEngine.js';
import { buildGraph, buildTimeline } from './graphBuilder.js';

/**
 * Main Lore Agent - orchestrates all lore tracking functionality
 */
export class LoreAgent {
  constructor(options = {}) {
    this.store = options.store || getLoreStore();
    this.options = {
      autoCheck: options.autoCheck !== false,
      autoFix: options.autoFix || false,
      minConfidence: options.minConfidence || 0.3,
      maxEntitiesPerExtraction: options.maxEntitiesPerExtraction || 50,
      ...options,
    };
    this.processing = false;
    this.queue = [];
  }

  /**
   * Process a text segment and extract lore
   */
  async processText(text, metadata = {}) {
    if (!text || text.trim().length === 0) {
      return { entities: [], relationships: [], issues: [] };
    }

    this.processing = true;

    try {
      // Extract entities from new text
      const extractionResult = extractEntities(text, { minConfidence: this.options.minConfidence });
      const newEntities = extractionResult.entities;
      const newRelationships = extractionResult.relationships;

      // Check new text against existing lore
      let newTextIssues = [];
      if (this.options.autoCheck && this.store.entities.length > 0) {
        newTextIssues = checkNewTextConsistency(text, this.store.entities, this.store.relationships);
      }

      // Merge with existing entities
      const mergedEntities = mergeEntities(this.store.entities, newEntities);
      const mergedRelationships = mergeRelationships(this.store.relationships, newRelationships, mergedEntities);

      // Update store
      this.store.setEntities(mergedEntities);
      this.store.setRelationships(mergedRelationships);

      // Update metadata
      this.store.metadata.textSegmentsProcessed++;
      this.store.metadata.totalCharactersProcessed += text.length;

      // Run consistency checks
      let checkResult = { issues: [], summary: {} };
      if (this.options.autoCheck) {
        checkResult = runConsistencyChecks(mergedEntities, mergedRelationships);
        const allIssues = [...checkResult.issues, ...newTextIssues];
        this.store.setIssues(allIssues);

        // Auto-fix if enabled
        if (this.options.autoFix && checkResult.summary.autoFixable > 0) {
          const fixResult = autoFixIssues(
            allIssues.filter(i => i.autoFixable),
            mergedEntities,
            mergedRelationships
          );
          this.store.setEntities(fixResult.entities);
          this.store.setRelationships(fixResult.relationships);

          // Re-run checks after fixes
          const recheck = runConsistencyChecks(fixResult.entities, fixResult.relationships);
          this.store.setIssues(recheck.issues);
        }
      }

      return {
        newEntities: newEntities.length,
        totalEntities: this.store.entities.length,
        newRelationships: newRelationships.length,
        totalRelationships: this.store.relationships.length,
        issues: this.store.issues,
        summary: checkResult.summary,
      };
    } finally {
      this.processing = false;
    }
  }

  /**
   * Process multiple text segments in sequence
   */
  async processTexts(texts, metadata = {}) {
    const results = [];
    for (let i = 0; i < texts.length; i++) {
      const result = await this.processText(texts[i], {
        ...metadata,
        segmentIndex: i,
        totalSegments: texts.length,
      });
      results.push(result);
    }
    return results;
  }

  /**
   * Query the lore database
   */
  query(queryText) {
    return executeQuery(queryText, this.store);
  }

  /**
   * Alias for query to match UI component usage
   */
  async queryLore(queryText) {
    return this.query(queryText);
  }

  /**
   * Get the relationship graph
   */
  getGraph(options = {}) {
    return buildGraph(
      this.store.entities,
      this.store.relationships,
      { minConfidence: this.options.minConfidence, ...options }
    );
  }

  /**
   * Get the event timeline
   */
  getTimeline() {
    return buildTimeline(this.store.entities, this.store.relationships);
  }

  /**
   * Manually add an entity
   */
  addEntity(entityData) {
    const entity = {
      id: `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: entityData.name,
      type: entityData.type || 'unknown',
      aliases: entityData.aliases || [],
      attributes: entityData.attributes || {},
      mentions: 1,
      confidence: entityData.confidence || 1.0,
      verified: true,
      contexts: entityData.contexts || [],
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      updatedAt: Date.now(),
    };

    this.store.addEntity(entity);
    return entity;
  }

  /**
   * Manually add a relationship
   */
  addRelationship(relData) {
    const relationship = {
      id: `rel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sourceId: relData.sourceId,
      targetId: relData.targetId,
      type: relData.type || 'social',
      subtype: relData.subtype || 'associated',
      confidence: relData.confidence || 1.0,
      verified: true,
      contexts: relData.contexts || [],
      firstSeen: Date.now(),
      lastSeen: Date.now(),
    };

    this.store.addRelationship(relationship);
    return relationship;
  }

  /**
   * Verify an entity (mark as human-confirmed)
   */
  verifyEntity(entityId) {
    return this.store.updateEntity(entityId, {
      verified: true,
      confidence: 1.0,
    });
  }

  /**
   * Update entity attributes
   */
  updateEntity(entityId, updates) {
    return this.store.updateEntity(entityId, updates);
  }

  /**
   * Remove an entity
   */
  removeEntity(entityId) {
    return this.store.removeEntity(entityId);
  }

  /**
   * Dismiss a consistency issue
   */
  dismissIssue(issueId) {
    this.store.dismissIssue(issueId);
  }

  /**
   * Auto-fix all fixable issues
   */
  autoFix() {
    const fixableIssues = this.store.issues.filter(i => i.autoFixable);
    if (fixableIssues.length === 0) return { fixed: [] };

    const result = autoFixIssues(
      fixableIssues,
      this.store.entities,
      this.store.relationships
    );

    this.store.setEntities(result.entities);
    this.store.setRelationships(result.relationships);

    // Re-run checks
    const recheck = runConsistencyChecks(result.entities, result.relationships);
    this.store.setIssues(recheck.issues);

    return { fixed: result.fixed, remainingIssues: recheck.issues.length };
  }

  /**
   * Get statistics about the lore database
   */
  getStats() {
    return this.store.getStats();
  }

  /**
   * Export all lore data
   */
  export() {
    return this.store.export();
  }

  /**
   * Alias for export to match UI component usage
   */
  exportState() {
    return this.export();
  }

  /**
   * Import lore data
   */
  import(data) {
    this.store.import(data);
  }

  /**
   * Alias for import to match UI component usage
   */
  importState(data) {
    this.import(data);
  }

  /**
   * Clear all lore data
   */
  clear() {
    this.store.clear();
  }

  /**
   * Merge two entities manually
   */
  mergeEntitiesManual(entityIdA, entityIdB) {
    const entityA = this.store.getEntity(entityIdA);
    const entityB = this.store.getEntity(entityIdB);

    if (!entityA || !entityB) {
      return { success: false, error: 'One or both entities not found' };
    }

    // Keep the one with more mentions
    const keeper = entityA.mentions >= entityB.mentions ? entityA : entityB;
    const removed = keeper === entityA ? entityB : entityA;

    // Merge aliases
    if (!keeper.aliases) keeper.aliases = [];
    keeper.aliases.push(removed.name);
    if (removed.aliases) keeper.aliases.push(...removed.aliases);
    keeper.aliases = [...new Set(keeper.aliases)];

    // Merge mentions and contexts
    keeper.mentions += removed.mentions;
    keeper.contexts = [...keeper.contexts, ...removed.contexts].slice(-10);
    keeper.confidence = Math.max(keeper.confidence, removed.confidence);

    // Merge attributes
    for (const [key, value] of Object.entries(removed.attributes || {})) {
      if (!keeper.attributes[key]) {
        keeper.attributes[key] = value;
      }
    }

    // Update relationships
    const updatedRelationships = this.store.relationships.map(rel => {
      const updated = { ...rel };
      if (updated.sourceId === removed.id) updated.sourceId = keeper.id;
      if (updated.targetId === removed.id) updated.targetId = keeper.id;
      return updated;
    });

    // Remove self-referencing relationships
    const cleanedRelationships = updatedRelationships.filter(
      r => r.sourceId !== r.targetId
    );

    // Apply changes
    this.store.updateEntity(keeper.id, keeper);
    this.store.removeEntity(removed.id);
    this.store.setRelationships(cleanedRelationships);

    return {
      success: true,
      kept: keeper.name,
      removed: removed.name,
      mergedEntity: keeper,
    };
  }

  /**
   * Get a summary of the current lore state
   */
  getSummary() {
    const stats = this.getStats();
    const lines = [];

    lines.push(`=== Lore Database Summary ===`);
    lines.push(`Entities: ${stats.totalEntities} (${stats.verifiedEntities} verified)`);
    lines.push(`Relationships: ${stats.totalRelationships}`);
    lines.push(`Issues: ${stats.totalIssues}`);
    lines.push(`Average Confidence: ${(stats.averageConfidence * 100).toFixed(1)}%`);

    if (Object.keys(stats.entityTypes).length > 0) {
      lines.push(`\nEntity Types:`);
      for (const [type, count] of Object.entries(stats.entityTypes)) {
        lines.push(`  ${type}: ${count}`);
      }
    }

    if (Object.keys(stats.relationshipTypes).length > 0) {
      lines.push(`\nRelationship Types:`);
      for (const [type, count] of Object.entries(stats.relationshipTypes)) {
        lines.push(`  ${type}: ${count}`);
      }
    }

    return lines.join('\n');
  }
}

// Factory function
export function createLoreAgent(options = {}) {
  return new LoreAgent(options);
}

// Re-export key modules
export { getLoreStore, resetLoreStore } from './loreStore.js';
export { executeQuery } from './queryEngine.js';
export { buildGraph, buildTimeline } from './graphBuilder.js';
export { ENTITY_TYPES } from './extractionEngine.js';

