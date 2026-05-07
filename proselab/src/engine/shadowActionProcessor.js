/**
 * Shadow Action Processor
 * Applies approved shadow actions to the lore database.
 * Handles entity creation, state updates, and relationship management.
 */

export async function applyShadowAction(action, loreDB) {
  switch (action.type) {
    case 'ADD_ENTITY': {
      const entity = {
        id: crypto.randomUUID(),
        projectId: action.projectId,
        name: action.payload.name,
        type: action.payload.type,
        description: action.payload.description,
        currentState: action.payload.attributes || {},
        aliases: action.payload.aliases || [],
        relationships: [],
        history: [{
          description: `First appeared in scene`,
          sceneId: action.sceneId,
          timestamp: Date.now()
        }],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastModifiedScene: action.sceneId
      };
      await loreDB.entities.add(entity);
      return entity;
    }

    case 'UPDATE_STATE': {
      const entity = await loreDB.entities
        .where('name').equalsIgnoreCase(action.payload.entityName)
        .first();
      
      if (!entity) {
        throw new Error(`Entity not found: ${action.payload.entityName}`);
      }

      const previousValue = entity.currentState[action.payload.attribute];
      
      // Record history
      entity.history = entity.history || [];
      entity.history.push({
        description: `${action.payload.attribute} changed from "${previousValue || 'unset'}" to "${action.payload.newValue}"`,
        sceneId: action.sceneId,
        timestamp: Date.now(),
        attribute: action.payload.attribute,
        previousValue,
        newValue: action.payload.newValue
      });

      // Apply the change
      entity.currentState[action.payload.attribute] = action.payload.newValue;
      entity.updatedAt = Date.now();
      entity.lastModifiedScene = action.sceneId;

      await loreDB.entities.put(entity);
      return entity;
    }

    case 'UPDATE_RELATIONSHIP': {
      const source = await loreDB.entities
        .where('name').equalsIgnoreCase(action.payload.sourceEntityName)
        .first();
      
      if (!source) {
        throw new Error(`Entity not found: ${action.payload.sourceEntityName}`);
      }

      source.relationships = source.relationships || [];
      
      // Find existing relationship
      const existingIdx = source.relationships.findIndex(
        r => r.targetName.toLowerCase() === action.payload.targetEntityName.toLowerCase()
      );

      if (existingIdx >= 0) {
        // Update existing
        source.relationships[existingIdx] = {
          ...source.relationships[existingIdx],
          relationshipType: action.payload.relationshipType,
          description: action.payload.description,
          updatedAt: Date.now()
        };
      } else {
        // Add new relationship
        source.relationships.push({
          targetName: action.payload.targetEntityName,
          relationshipType: action.payload.relationshipType,
          description: action.payload.description,
          createdAt: Date.now()
        });
      }

      source.updatedAt = Date.now();
      source.lastModifiedScene = action.sceneId;
      await loreDB.entities.put(source);
      return source;
    }

    case 'FLAG_CONTRADICTION': {
      // Don't modify lore — just record the contradiction for the writer
      const contradiction = {
        id: crypto.randomUUID(),
        projectId: action.projectId,
        entityName: action.payload.entityName,
        attribute: action.payload.attribute,
        loreSays: action.payload.loreSays,
        proseSays: action.payload.proseSays,
        possibleExplanation: action.payload.possibleExplanation,
        sceneId: action.sceneId,
        status: 'unresolved', // unresolved | acknowledged | fixed
        createdAt: Date.now()
      };
      await loreDB.contradictions.add(contradiction);
      return contradiction;
    }

    default:
      throw new Error(`Unknown action type: ${action.type}`);
  }
}
