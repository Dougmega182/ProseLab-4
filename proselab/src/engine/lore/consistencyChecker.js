// src/engine/lore/consistencyChecker.js

/**
 * Types of consistency issues
 */
export const ISSUE_TYPES = {
  CONTRADICTION: 'contradiction',
  TIMELINE_ERROR: 'timeline_error',
  ORPHAN_REFERENCE: 'orphan_reference',
  DUPLICATE_ENTITY: 'duplicate_entity',
  MISSING_DETAIL: 'missing_detail',
  RELATIONSHIP_CONFLICT: 'relationship_conflict',
  ATTRIBUTE_CHANGE: 'attribute_change',
};

export const SEVERITY = {
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
};

/**
 * Check for potential duplicate entities
 */
function checkDuplicates(entities) {
  const issues = [];
  
  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      const a = entities[i];
      const b = entities[j];
      
      if (a.type !== b.type) continue;

      const nameA = a.name.toLowerCase();
      const nameB = b.name.toLowerCase();

      // Check for similar names
      const similarity = calculateSimilarity(nameA, nameB);
      if (similarity > 0.7) {
        issues.push({
          id: `dup_${a.id}_${b.id}`,
          type: ISSUE_TYPES.DUPLICATE_ENTITY,
          severity: similarity > 0.9 ? SEVERITY.ERROR : SEVERITY.WARNING,
          message: `Possible duplicate entities: "${a.name}" and "${b.name}" (similarity: ${(similarity * 100).toFixed(0)}%)`,
          entityIds: [a.id, b.id],
          suggestion: `Consider merging "${a.name}" and "${b.name}" into a single entity`,
          autoFixable: true,
          fixAction: 'merge',
        });
      }

      // Check if one name contains the other (alias candidate)
      if (nameA.includes(nameB) || nameB.includes(nameA)) {
        if (nameA !== nameB) {
          issues.push({
            id: `alias_${a.id}_${b.id}`,
            type: ISSUE_TYPES.DUPLICATE_ENTITY,
            severity: SEVERITY.INFO,
            message: `"${a.name}" may be an alias for "${b.name}" or vice versa`,
            entityIds: [a.id, b.id],
            suggestion: `Consider adding one as an alias of the other`,
            autoFixable: true,
            fixAction: 'alias',
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Levenshtein-based string similarity
 */
function calculateSimilarity(a, b) {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

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

  const maxLen = Math.max(a.length, b.length);
  return 1 - matrix[b.length][a.length] / maxLen;
}

/**
 * Check for orphan references - entities mentioned but not well-defined
 */
function checkOrphanReferences(entities, relationships) {
  const issues = [];
  const entityIds = new Set(entities.map(e => e.id));

  // Check relationships pointing to non-existent entities
  for (const rel of relationships) {
    if (!entityIds.has(rel.sourceId)) {
      issues.push({
        id: `orphan_rel_src_${rel.id}`,
        type: ISSUE_TYPES.ORPHAN_REFERENCE,
        severity: SEVERITY.WARNING,
        message: `Relationship references unknown source entity: "${rel.sourceName}"`,
        entityIds: [rel.sourceId],
        relationshipId: rel.id,
        suggestion: `Create entity for "${rel.sourceName}" or remove this relationship`,
        autoFixable: false,
      });
    }
    if (!entityIds.has(rel.targetId)) {
      issues.push({
        id: `orphan_rel_tgt_${rel.id}`,
        type: ISSUE_TYPES.ORPHAN_REFERENCE,
        severity: SEVERITY.WARNING,
        message: `Relationship references unknown target entity: "${rel.targetName}"`,
        entityIds: [rel.targetId],
        relationshipId: rel.id,
        suggestion: `Create entity for "${rel.targetName}" or remove this relationship`,
        autoFixable: false,
      });
    }
  }

  // Check for entities with very low confidence and few mentions
  for (const entity of entities) {
    if (entity.confidence < 0.4 && entity.mentions < 3) {
      issues.push({
        id: `weak_${entity.id}`,
        type: ISSUE_TYPES.ORPHAN_REFERENCE,
        severity: SEVERITY.INFO,
        message: `Entity "${entity.name}" has low confidence (${(entity.confidence * 100).toFixed(0)}%) and few mentions (${entity.mentions})`,
        entityIds: [entity.id],
        suggestion: `Verify if "${entity.name}" is a real entity or a false positive`,
        autoFixable: false,
      });
    }
  }

  return issues;
}

/**
 * Check for relationship conflicts
 */
function checkRelationshipConflicts(entities, relationships) {
  const issues = [];

  // Group relationships by entity pair
  const pairMap = new Map();
  for (const rel of relationships) {
    const pairKey = [rel.sourceId, rel.targetId].sort().join('_');
    if (!pairMap.has(pairKey)) {
      pairMap.set(pairKey, []);
    }
    pairMap.get(pairKey).push(rel);
  }

  for (const [pairKey, rels] of pairMap) {
    if (rels.length < 2) continue;

    // Check for conflicting relationship types
    const types = new Set(rels.map(r => r.type));
    if (types.has('social')) {
      const subtypes = rels.filter(r => r.type === 'social').map(r => r.subtype);
      if (subtypes.includes('friend') && subtypes.includes('enemy')) {
        issues.push({
          id: `rel_conflict_${pairKey}`,
          type: ISSUE_TYPES.RELATIONSHIP_CONFLICT,
          severity: SEVERITY.WARNING,
          message: `"${rels[0].sourceName}" is marked as both friend and enemy of "${rels[0].targetName}"`,
          entityIds: [rels[0].sourceId, rels[0].targetId],
          relationshipIds: rels.map(r => r.id),
          suggestion: `This could be a character arc (friend turned enemy) or an extraction error. Please verify.`,
          autoFixable: false,
        });
      }
    }
  }

  return issues;
}

/**
 * Check for attribute contradictions within entity descriptions
 */
function checkAttributeContradictions(entities) {
  const issues = [];

  for (const entity of entities) {
    if (!entity.attributes) continue;

    // Check for contradictory traits
    if (entity.attributes.traits && entity.attributes.traits.length > 1) {
      const contradictions = [
        ['brave', 'cowardly'],
        ['kind', 'cruel'],
        ['honest', 'deceitful'],
        ['proud', 'humble'],
        ['patient', 'reckless'],
        ['gentle', 'fierce'],
        ['warm', 'cold'],
        ['ruthless', 'merciful'],
        ['arrogant', 'modest'],
        ['ambitious', 'lazy'],
        ['tall', 'short'],
        ['old', 'young'],
      ];

      const traits = entity.attributes.traits.map(t => t.toLowerCase());
      for (const [a, b] of contradictions) {
        if (traits.includes(a) && traits.includes(b)) {
          issues.push({
            id: `attr_contra_${entity.id}_${a}_${b}`,
            type: ISSUE_TYPES.CONTRADICTION,
            severity: SEVERITY.WARNING,
            message: `Entity "${entity.name}" has contradictory traits: "${a}" and "${b}"`,
            entityIds: [entity.id],
            suggestion: `Review the contexts where these traits were extracted. One may be incorrect or they may represent character development.`,
            autoFixable: false,
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Check new text against existing lore for contradictions
 */
export function checkNewTextConsistency(newText, entities, relationships) {
  const issues = [];

  for (const entity of entities) {
    if (!newText.includes(entity.name)) continue;

    // Check if the entity is described differently in new text
    const sentences = newText
      .replace(/([.!?])\s+/g, '$1\n')
      .split('\n')
      .filter(s => s.includes(entity.name));

    for (const sentence of sentences) {
      const sentenceLower = sentence.toLowerCase();

      // Check for death/alive contradictions
      if (entity.attributes.status === 'alive' &&
          /(?:died|killed|slain|dead|perished|fell in battle|breathed .* last)/.test(sentenceLower)) {
        issues.push({
          id: `status_${entity.id}_${Date.now()}`,
          type: ISSUE_TYPES.CONTRADICTION,
          severity: SEVERITY.ERROR,
          message: `"${entity.name}" was previously marked as alive but new text suggests death: "${sentence.substring(0, 150)}"`,
          entityIds: [entity.id],
          context: sentence,
          suggestion: `Update entity status or verify the new text is correct`,
          autoFixable: false,
        });
      }

      // Check location contradictions
      if (entity.type === 'location' && entity.attributes.locationType) {
        const locTypes = ['city', 'town', 'village', 'kingdom', 'castle', 'fortress', 'tower', 'temple', 'forest', 'mountain', 'river', 'sea', 'desert', 'island'];
        for (const lt of locTypes) {
          if (lt !== entity.attributes.locationType && sentenceLower.includes(`${entity.name.toLowerCase()} was a ${lt}`)) {
            issues.push({
              id: `loc_type_${entity.id}_${lt}`,
              type: ISSUE_TYPES.CONTRADICTION,
              severity: SEVERITY.WARNING,
              message: `"${entity.name}" was classified as "${entity.attributes.locationType}" but new text calls it a "${lt}"`,
              entityIds: [entity.id],
              context: sentence,
              suggestion: `Verify the correct location type for "${entity.name}"`,
              autoFixable: false,
            });
          }
        }
      }
    }
  }

  return issues;
}

/**
 * Run all consistency checks
 */
export function runConsistencyChecks(entities, relationships) {
  const allIssues = [
    ...checkDuplicates(entities),
    ...checkOrphanReferences(entities, relationships),
    ...checkRelationshipConflicts(entities, relationships),
    ...checkAttributeContradictions(entities),
  ];

  // Sort by severity
  const severityOrder = { [SEVERITY.ERROR]: 0, [SEVERITY.WARNING]: 1, [SEVERITY.INFO]: 2 };
  allIssues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return {
    issues: allIssues,
    summary: {
      total: allIssues.length,
      errors: allIssues.filter(i => i.severity === SEVERITY.ERROR).length,
      warnings: allIssues.filter(i => i.severity === SEVERITY.WARNING).length,
      info: allIssues.filter(i => i.severity === SEVERITY.INFO).length,
      autoFixable: allIssues.filter(i => i.autoFixable).length,
    },
    checkedAt: Date.now(),
  };
}

/**
 * Auto-fix issues that are marked as autoFixable
 */
export function autoFixIssues(issues, entities, relationships) {
  const fixed = [];
  const updatedEntities = [...entities];
  const updatedRelationships = [...relationships];

  for (const issue of issues) {
    if (!issue.autoFixable) continue;

    if (issue.fixAction === 'merge' && issue.entityIds.length === 2) {
      const [idA, idB] = issue.entityIds;
      const entityA = updatedEntities.find(e => e.id === idA);
      const entityB = updatedEntities.find(e => e.id === idB);

      if (!entityA || !entityB) continue;

      // Keep the one with more mentions
      const keeper = entityA.mentions >= entityB.mentions ? entityA : entityB;
      const removed = keeper === entityA ? entityB : entityA;

      // Merge data
      if (!keeper.aliases) keeper.aliases = [];
      keeper.aliases.push(removed.name);
      if (removed.aliases) keeper.aliases.push(...removed.aliases);
      keeper.aliases = [...new Set(keeper.aliases)];
      keeper.mentions += removed.mentions;
      keeper.contexts.push(...removed.contexts);
      keeper.contexts = keeper.contexts.slice(-10);
      keeper.confidence = Math.max(keeper.confidence, removed.confidence);

      // Merge attributes
      for (const [key, value] of Object.entries(removed.attributes || {})) {
        if (!keeper.attributes[key]) {
          keeper.attributes[key] = value;
        }
      }

      // Update relationships to point to keeper
      for (const rel of updatedRelationships) {
        if (rel.sourceId === removed.id) rel.sourceId = keeper.id;
        if (rel.targetId === removed.id) rel.targetId = keeper.id;
      }

      // Remove the duplicate
      const removeIdx = updatedEntities.findIndex(e => e.id === removed.id);
      if (removeIdx !== -1) updatedEntities.splice(removeIdx, 1);

      fixed.push({
        issueId: issue.id,
        action: 'merged',
        details: `Merged "${removed.name}" into "${keeper.name}"`,
      });
    }

    if (issue.fixAction === 'alias' && issue.entityIds.length === 2) {
      const [idA, idB] = issue.entityIds;
      const entityA = updatedEntities.find(e => e.id === idA);
      const entityB = updatedEntities.find(e => e.id === idB);

      if (!entityA || !entityB) continue;

      // The longer name is the primary, shorter is alias
      const primary = entityA.name.length >= entityB.name.length ? entityA : entityB;
      const alias = primary === entityA ? entityB : entityA;

      if (!primary.aliases) primary.aliases = [];
      if (!primary.aliases.includes(alias.name)) {
        primary.aliases.push(alias.name);
        fixed.push({
          issueId: issue.id,
          action: 'aliased',
          details: `Added "${alias.name}" as alias of "${primary.name}"`,
        });
      }
    }
  }

  return {
    entities: updatedEntities,
    relationships: updatedRelationships,
    fixed,
  };
}
