/**
 * Generator Engine
 * Handles the construction of prompts and execution of LLM calls for scene generation.
 */

export async function generateScene(config, providers) {
  const prompt = buildGenerationPrompt(config);
  
  const response = await providers.callLLM({
    role: 'generation',
    messages: prompt.messages,
    temperature: config.temperature || 0.8,
    max_tokens: config.maxTokens || 4000,
    // No JSON mode — we want natural prose
  });

  if (!response.ok) {
    throw new Error(`Generation failed: ${response.error}`);
  }

  return {
    prose: response.content,
    usage: response.usage
  };
}

function buildGenerationPrompt(config) {
  const systemPrompt = buildSystemPrompt(config);
  const messages = [{ role: 'system', content: systemPrompt }];

  // If this is a revision, include the previous attempt
  if (config.previousAttempt) {
    messages.push({
      role: 'assistant',
      content: config.previousAttempt
    });

    if (config.revisionInstructions) {
      messages.push({
        role: 'user',
        content: `Please revise the above scene with the following changes:\n\n${config.revisionInstructions}`
      });
    } else if (config.validationFeedback) {
      const feedbackText = Array.isArray(config.validationFeedback) 
        ? config.validationFeedback.map(i => `- ${i.description}`).join('\n')
        : config.validationFeedback;

      messages.push({
        role: 'user',
        content: `The scene has consistency issues that need fixing:\n\n${feedbackText}\n\nPlease regenerate the scene fixing these issues while preserving the overall quality and direction.`
      });
    }
  } else {
    messages.push({
      role: 'user',
      content: buildUserPrompt(config)
    });
  }

  return { messages };
}

function buildSystemPrompt(config) {
  const parts = [];

  // Core identity
  parts.push(`You are a skilled fiction writer. You write prose for a novel, one scene at a time.`);

  // Voice calibration
  if (config.voiceProfile) {
    parts.push(`\n## VOICE & STYLE\n${config.voiceProfile.description || config.voiceProfile}`);
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

function buildUserPrompt(config) {
  const parts = [];

  parts.push(`Write the following scene:\n`);

  if (config.sceneTitle) {
    parts.push(`Scene: ${config.sceneTitle}`);
  }

  if (config.sceneBeat) {
    parts.push(`\nScene beat / purpose:\n${config.sceneBeat}`);
  }

  if (config.sceneOutline) {
    parts.push(`\nOutline:\n${config.sceneOutline}`);
  }

  if (config.pov) {
    parts.push(`\nPOV: ${config.pov.character} (${config.pov.type})`);
  }

  if (config.targetWordCount) {
    parts.push(`\nTarget length: approximately ${config.targetWordCount} words`);
  }

  if (config.writerNotes) {
    parts.push(`\nWriter's notes:\n${config.writerNotes}`);
  }

  parts.push(`\nWrite ONLY the scene prose. No commentary, no scene headers, no meta-text.`);

  return parts.join('\n');
}
