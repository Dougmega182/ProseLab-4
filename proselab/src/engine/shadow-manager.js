/**
 * Shadow Manager
 * Handles the review, modification, and application of proposed lore updates (Shadow Actions).
 */

export class ShadowManager {
  constructor(db) {
    this.db = db;
  }

  async getPendingActions(projectId) {
    return this.db.shadowActions
      .where({ projectId, status: 'pending' })
      .sortBy('createdAt');
  }

  async getPendingActionsForScene(sceneId) {
    return this.db.shadowActions
      .where({ sceneId, status: 'pending' })
      .sortBy('createdAt');
  }

  async approveAction(actionId) {
    const action = await this.db.shadowActions.get(actionId);
    if (!action) throw new Error(`Action not found: ${actionId}`);

    await this.applyAction(action, action.payload);

    await this.db.shadowActions.update(actionId, {
      status: 'approved',
      reviewedAt: Date.now()
    });
  }

  async approveWithModification(actionId, modifiedPayload) {
    const action = await this.db.shadowActions.get(actionId);
    if (!action) throw new Error(`Action not found: ${actionId}`);

    await this.applyAction(action, modifiedPayload);

    await this.db.shadowActions.update(actionId, {
      status: 'modified',
      modifiedPayload,
      reviewedAt: Date.now()
    });
  }

  async rejectAction(actionId) {
    await this.db.shadowActions.update(actionId, {
      status: 'rejected',
      reviewedAt: Date.now()
    });
  }

  async approveAll(projectId) {
    const pending = await this.getPendingActions(projectId);
    for (const action of pending) {
      await this.approveAction(action.id);
    }
    return pending.length;
  }

  async applyAction(action, payload) {
    switch (action.type) {
      case 'ADD_ENTITY':
        await this.applyAddEntity(action, payload);
        break;
      case 'UPDATE_STATE':
        await this.applyUpdateState(action, payload);
        break;
      case 'UPDATE_RELATIONSHIP':
        await this.applyUpdateRelationship(action, payload);
        break;
      case 'FLAG_CONTRADICTION':
        // Contradictions are informational — no automatic application
        // But we can store them as notes on the entity
        await this.applyFlagContradiction(action, payload);
        break;
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  async applyAddEntity(action, payload) {
    // Check if entity already exists (by name, case-insensitive)
    const existing = await this.db.entities
      .where('projectId').equals(action.projectId)
      .filter(e => e.name.toLowerCase() === payload.name.toLowerCase())
      .first();

    if (existing) {
      // Merge new info into existing entity instead of creating duplicate
      const updates = {};
      if (payload.description && !existing.description) {
        updates.description = payload.description;
      }
      if (payload.physicalDescription && !existing.physicalDescription) {
        updates.physicalDescription = payload.physicalDescription;
      }
      if (payload.initialState) {
        updates.currentState = { ...(existing.currentState || {}), ...payload.initialState };
      }
      if (payload.permanentTraits) {
        updates.permanentTraits = { ...(existing.permanentTraits || {}), ...payload.permanentTraits };
      }
      if (payload.aliases && payload.aliases.length > 0) {
        const existingAliases = existing.aliases || [];
        const newAliases = payload.aliases.filter(a =>
          !existingAliases.some(ea => ea.toLowerCase() === a.toLowerCase())
        );
        updates.aliases = [...existingAliases, ...newAliases];
      }
      updates.updatedAt = Date.now();
      updates.lastModifiedScene = action.sceneId;

      if (Object.keys(updates).length > 1) { // more than just updatedAt
        await this.db.entities.update(existing.id, updates);
      }
      return;
    }

    await this.db.entities.add({
      projectId: action.projectId,
      name: payload.name,
      type: payload.type || 'character',
      description: payload.description || '',
      physicalDescription: payload.physicalDescription || '',
      currentState: payload.initialState || {},
      permanentTraits: payload.permanentTraits || {},
      relationships: [],
      aliases: payload.aliases || [],
      tags: [],
      notes: '',
      firstAppearance: action.sceneId,
      lastModifiedScene: action.sceneId,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }

  async applyUpdateState(action, payload) {
    const entity = await this.db.entities
      .where('projectId').equals(action.projectId)
      .filter(e => e.name.toLowerCase() === payload.entityName.toLowerCase())
      .first();

    if (!entity) {
      console.warn(`Entity not found for state update: ${payload.entityName}`);
      return;
    }

    // Store the state change with scene provenance
    const stateHistory = entity.stateHistory || [];
    stateHistory.push({
      attribute: payload.attribute,
      previousValue: payload.previousValue,
      newValue: payload.newValue,
      sceneId: action.sceneId,
      timestamp: Date.now()
    });

    const currentState = { ...(entity.currentState || {}) };
    currentState[payload.attribute] = payload.newValue;

    await this.db.entities.update(entity.id, {
      currentState,
      stateHistory,
      lastModifiedScene: action.sceneId,
      updatedAt: Date.now()
    });
  }

  async applyUpdateRelationship(action, payload) {
    const entity = await this.db.entities
      .where('projectId').equals(action.projectId)
     .filter(e => e.name.toLowerCase() === payload.entityName.toLowerCase())
      .first();

    if (!entity) {
      console.warn(`Entity not found for relationship update: ${payload.entityName}`);
      return;
    }

    const relationships = [...(entity.relationships || [])];

    const existingIdx = relationships.findIndex(r =>
      r.targetName.toLowerCase() === payload.targetName.toLowerCase() &&
      r.relationshipType.toLowerCase() === payload.relationshipType.toLowerCase()
    );

    if (existingIdx >= 0) {
      // Update existing relationship
      relationships[existingIdx] = {
        ...relationships[existingIdx],
        description: payload.description || relationships[existingIdx].description,
        updatedAt: Date.now(),
        lastModifiedScene: action.sceneId
      };
    } else {
      // Add new relationship
      relationships.push({
        targetName: payload.targetName,
        relationshipType: payload.relationshipType,
        description: payload.description || '',
        createdAt: Date.now(),
        lastModifiedScene: action.sceneId
      });
    }

    await this.db.entities.update(entity.id, {
      relationships,
      lastModifiedScene: action.sceneId,
      updatedAt: Date.now()
    });

    // Also add the reciprocal relationship on the target entity if it exists
    const targetEntity = await this.db.entities
      .where('projectId').equals(action.projectId)
      .filter(e => e.name.toLowerCase() === (payload.targetName || '').toLowerCase())
      .first();

    if (targetEntity) {
      const targetRels = [...(targetEntity.relationships || [])];
      const reciprocalExists = targetRels.some(r =>
        r.targetName.toLowerCase() === payload.entityName.toLowerCase() &&
        r.relationshipType.toLowerCase() === payload.relationshipType.toLowerCase()
      );

      if (!reciprocalExists) {
        targetRels.push({
          targetName: payload.entityName,
          relationshipType: payload.relationshipType,
          description: payload.description || '',
          createdAt: Date.now(),
          lastModifiedScene: action.sceneId,
          isReciprocal: true
        });

        await this.db.entities.update(targetEntity.id, {
          relationships: targetRels,
          updatedAt: Date.now()
        });
      }
    }
  }

  async applyFlagContradiction(action, payload) {
    const entity = await this.db.entities
      .where('projectId').equals(action.projectId)
      .filter(e => e.name.toLowerCase() === payload.entityName.toLowerCase())
      .first();

    if (!entity) return;

    const contradictions = entity.contradictions || [];
    contradictions.push({
      attribute: payload.attribute,
      establishedValue: payload.establishedValue,
      contradictingValue: payload.contradictingValue,
      suggestedResolution: payload.suggestedResolution,
      sceneId: action.sceneId,
      citation: action.citation,
      timestamp: Date.now(),
      resolved: false
    });

    await this.db.entities.update(entity.id, {
      contradictions,
      updatedAt: Date.now()
    });
  }
}
