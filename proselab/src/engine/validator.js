/**
 * Semantic Validator Agent
 * Verifies that generated prose respects established lore and narrative consistency.
 */

function parseFirstJSONObject(raw) {
  const source = String(raw || '').replace(/```json|```/gi, '').trim();
  const starts = [];
  let inString = false;
  let escaped = false;

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') {
      starts.push(i);
    }
  }

  for (let s = 0; s < starts.length; s += 1) {
    const start = starts[s];
    let depth = 0;
    inString = false;
    escaped = false;

    for (let i = start; i < source.length; i += 1) {
      const ch = source[i];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch === '\\') {
          escaped = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }

      if (ch === '"') {
        inString = true;
        continue;
      }

      if (ch === '{') depth += 1;
      if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          const candidate = source.slice(start, i + 1);
          try {
            return JSON.parse(candidate);
          } catch {
            break;
          }
        }
      }
    }
  }

  return null;
}

export async function validateScene(prose, sceneConfig, providers) {
  const relevantEntities = sceneConfig.relevantEntities || [];
  
  if (relevantEntities.length === 0) {
    return {
      passed: true,
      issues: [],
      usage: { inputTokens: 0, outputTokens: 0 }
    };
  }

  // Build a lore reference document
  const loreReference = buildLoreReference(relevantEntities);

  const response = await providers.callLLM({
    role: 'validation',
    messages: [
      {
        role: 'system',
        content: `You are a continuity editor for fiction. Your job is to check prose against established lore for contradictions.

You will receive:
1. A LORE REFERENCE containing established facts about characters, locations, and objects
2. A PROSE PASSAGE to check

Check for:
- Physical description contradictions (eye color, hair, height, scars, etc.)
- Location contradictions (geography, layout, distances)
- Timeline contradictions (events happening in wrong order, impossible timing)
- Character knowledge contradictions (character knows something they shouldn't)
- Relationship contradictions (wrong names, wrong roles)
- Object contradictions (items appearing that were destroyed, wrong descriptions)
- State contradictions (character is injured but acts fine, dead character appears)

Do NOT flag:
- Stylistic choices
- Metaphorical language (e.g., "her eyes burned" is not an eye color contradiction)
- Intentional contradictions marked in the lore

Respond in JSON format:
{
  "passed": boolean,
  "severity": "none" | "minor" | "major" | "critical",
  "issues": [
    {
      "type": "contradiction" | "anachronism" | "knowledge_violation" | "state_error",
      "severity": "minor" | "major" | "critical",
      "entity": "entity name",
      "attribute": "what's contradicted",
      "lore_says": "what the lore establishes",
      "prose_says": "what the prose states",
      "prose_location": "quote from prose showing the issue",
      "suggestion": "how to fix it"
    }
  ]
}`
      },
      {
        role: 'user',
        content: `## LORE REFERENCE\n${loreReference}\n\n## PROSE TO CHECK\n${prose}`
      }
    ],
    temperature: 0.2, // Very low — we want precise, consistent checking
    max_tokens: 2000,
    response_format: { type: 'json_object' }
  });

  if (!response.ok) {
    console.error('Validation failed:', response.error);
    return { passed: true, issues: [], severity: 'none' };
  }

  const result = parseFirstJSONObject(response.content);
  if (!result) {
    console.error('Failed to parse validation response');
    return { passed: true, issues: [], severity: 'none' };
  }

  return {
    passed: result.passed,
    severity: result.severity,
    issues: result.issues || [],
    usage: response.usage
  };
}

function buildLoreReference(entities) {
  const parts = [];

  for (const entity of entities) {
    parts.push(`### ${entity.name} [${entity.type}]`);
    parts.push(entity.description);
    
    if (entity.currentState && typeof entity.currentState === 'object') {
      parts.push('Current state:');
      for (const [key, value] of Object.entries(entity.currentState)) {
        parts.push(`  ${key}: ${value}`);
      }
    }

    if (entity.physicalDescription) {
      parts.push(`Physical: ${entity.physicalDescription}`);
    }

   if (entity.relationships && Array.isArray(entity.relationships)) {
      parts.push('Relationships:');
      for (const rel of entity.relationships) {
        parts.push(`  ${rel.targetName || rel.targetId}: ${rel.description}`);
      }
    }

    if (entity.history && Array.isArray(entity.history) && entity.history.length > 0) {
      parts.push('Key history:');
      for (const event of entity.history.slice(-5)) { // last 5 events
        parts.push(`  - ${event.description} (scene: ${event.sceneId})`);
      }
    }

    parts.push(''); // blank line separator
  }

  return parts.join('\n');
}
