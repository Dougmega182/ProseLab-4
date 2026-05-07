/**
 * Context Assembler
 * Responsible for gathering and ranking relevant project metadata, lore, 
 * and preceding prose to build the optimal context for generation.
 */

export function assembleContext(config) {
  const parts = [];

  // Voice and Style
  if (config.voiceProfile) {
    parts.push(`## VOICE & STYLE PROFILE\nMaintain the following voice attributes strictly:\n${config.voiceProfile.description || config.voiceProfile}`);
    if (config.voiceProfile.fragments) parts.push(`- Fragment density: ${config.voiceProfile.fragments}`);
    if (config.voiceProfile.sentenceLength) parts.push(`- Preferred sentence length: ${config.voiceProfile.sentenceLength}`);
  }

  // Genre and tone
  if (config.projectMeta) {
    parts.push(`\n## PROJECT\nTitle: ${config.projectMeta.title}\nGenre: ${config.projectMeta.genre}\nTone: ${config.projectMeta.tone}\nThemes: ${config.projectMeta.themes?.join(', ')}`);
  }

  // Lore context — relevant entities
  if (config.relevantEntities && config.relevantEntities.length > 0) {
    parts.push(`\n## WORLD & CHARACTER STATE\nThe following entities are relevant to this scene. Maintain consistency with their established attributes.\n`);
    for (const entity of config.relevantEntities) {
      parts.push(`### ${entity.name} (${entity.type})`);
      parts.push(`${entity.description}`);
      if (entity.currentState && Object.keys(entity.currentState).length > 0) {
        parts.push(`Current state:`);
        for (const [key, value] of Object.entries(entity.currentState)) {
          parts.push(`  - ${key}: ${value}`);
        }
      }
      if (entity.relationships && entity.relationships.length > 0) {
        parts.push(`Relationships:`);
        for (const rel of entity.relationships) {
          parts.push(`  - ${rel.targetName || rel.targetId}: ${rel.description}`);
        }
      }
      parts.push('');
    }
  }

  // Acknowledged contradictions — things the writer has marked as intentional
  if (config.acknowledgedContradictions && config.acknowledgedContradictions.length > 0) {
    parts.push(`\n## INTENTIONAL CONTRADICTIONS\nThe following contradictions are deliberate. Do not "fix" them.\n`);
    for (const c of config.acknowledgedContradictions) {
      parts.push(`- ${c.entityName || c.entityId}: ${c.attribute} — ${c.reason}`);
    }
  }

  // Previous scene context (for continuity)
  if (config.previousSceneSummary) {
    parts.push(`\n## PREVIOUS SCENE\n${config.previousSceneSummary}`);
  }

  // If there's preceding prose (last N paragraphs for continuity)
  if (config.precedingProse) {
    parts.push(`\n## PRECEDING PROSE (for continuity — match the flow)\n...\n${config.precedingProse}`);
  }

  return parts.join('\n');
}

/**
 * Selects and ranks lore entities by relevance to the current scene configuration.
 */
export function selectRelevantEntities(allEntities, sceneConfig, options = {}) {
  const maxEntities = options.maxEntities || 15;
  const maxTokens = options.maxContextTokens || 3000;
  
  const scored = allEntities.map(entity => ({
    entity,
    score: computeRelevanceScore(entity, sceneConfig)
  }));

  // Sort by relevance score descending
  scored.sort((a, b) => b.score - a.score);

  // Take top entities within token budget
  const selected = [];
  let tokenCount = 0;

  for (const { entity, score } of scored) {
    if (score <= 0) break;
    if (selected.length >= maxEntities) break;
    
    const entityTokens = estimateEntityTokens(entity);
    if (tokenCount + entityTokens > maxTokens) continue; // skip large entities if budget tight
    
    selected.push(entity);
    tokenCount += entityTokens;
  }

  return selected;
}

function computeRelevanceScore(entity, sceneConfig) {
  let score = 0;

  // Writer-pinned entities get highest priority
  if (sceneConfig.pinnedEntityIds?.includes(entity.id)) {
    score += 100;
  }

  // Entities explicitly mentioned in scene outline/beat/notes
  const sceneText = [
    sceneConfig.sceneBeat || '',
    sceneConfig.sceneOutline || '',
    sceneConfig.writerNotes || ''
  ].join(' ').toLowerCase();

  if (entity.name && sceneText.includes(entity.name.toLowerCase())) {
    score += 50;
  }

  // Aliases too
  if (entity.aliases) {
    for (const alias of entity.aliases) {
      if (sceneText.includes(alias.toLowerCase())) {
        score += 40;
        break;
      }
    }
  }

  // POV character gets high priority
  if (sceneConfig.pov?.character?.toLowerCase() === entity.name?.toLowerCase()) {
    score += 60;
  }

  // Scene location
  if (entity.type === 'location' && 
      sceneConfig.location?.toLowerCase() === entity.name?.toLowerCase()) {
    score += 45;
  }

  // Characters present in scene
  if (sceneConfig.presentCharacters?.includes(entity.id)) {
    score += 40;
  }

  // Entities with recent state changes (active in narrative)
  if (entity.lastModifiedScene) {
    const sceneDistance = (sceneConfig.sceneIndex || 0) - entity.lastModifiedScene;
    if (sceneDistance >= 0 && sceneDistance <= 3) {
      score += 20 - (sceneDistance * 5); // 20, 15, 10, 5
    }
  }

  // Relationship proximity to scene participants
  if (entity.relationships) {
    for (const rel of entity.relationships) {
      if (sceneConfig.presentCharacters?.includes(rel.targetId)) {
        score += 15;
        break;
      }
    }
  }

  // Entity type weighting — characters are usually more relevant than objects
  const typeWeights = {
    character: 5,
    location: 3,
    faction: 3,
    item: 2,
    concept: 1,
    event: 2
  };
  score += typeWeights[entity.type] || 1;

  return score;
}

function estimateEntityTokens(entity) {
  // Rough estimation: 1 token ≈ 4 characters
  const text = JSON.stringify(entity);
  return Math.ceil(text.length / 4);
}

export function getPrecedingProse(scenes, currentSceneIndex, options = {}) {
  const maxWords = options.maxWords || 400;
  const maxParagraphs = options.maxParagraphs || 5;

  if (currentSceneIndex <= 0) return null;

  const previousScene = scenes[currentSceneIndex - 1];
  if (!previousScene?.prose) return null;

  const paragraphs = previousScene.prose.split(/\n\n+/).filter(p => p.trim());
  
  // Take the last N paragraphs
  const tailParagraphs = paragraphs.slice(-maxParagraphs);
  
  // Trim to word budget
  let result = [];
  let wordCount = 0;
  
  // Work backwards from the end
  for (let i = tailParagraphs.length - 1; i >= 0; i--) {
    const paraWords = tailParagraphs[i].split(/\s+/).length;
    if (wordCount + paraWords > maxWords && result.length > 0) break;
    result.unshift(tailParagraphs[i]);
    wordCount += paraWords;
  }

  return result.join('\n\n');
}
