export class EntityExtractor {
  constructor(aiService) {
    this.aiService = aiService;
  }

  async extractEntities(text, existingEntities = []) {
    if (!this.aiService.isConfigured()) {
      throw new Error('AI not configured');
    }

    const existingNames = existingEntities.map(e => e.name);

    const systemPrompt = `You are a precise text analysis tool. Extract all named entities from the provided fiction text. Categorize each as: character, location, item, faction, or concept.

For each entity provide:
- name: The primary name used
- type: character | location | item | faction | concept
- aliases: Any other names/titles used for this entity
- description: A brief description based on what's revealed in the text

${existingNames.length > 0 ? `\nAlready known entities (update if new info found, don't re-list unchanged): ${existingNames.join(', ')}` : ''}

Respond ONLY with valid JSON in this format:
{
  "entities": [
    {
      "name": "string",
      "type": "string",
      "aliases": ["string"],
      "description": "string",
      "isNew": true
    }
  ]
}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Extract entities from this text:\n\n${text}` }
    ];

    const result = await this.aiService.client.chat(messages, {
      temperature: 0.1,
      max_tokens: 2000
    });

    return this.parseEntityResponse(result.content, existingEntities);
  }

  parseEntityResponse(responseText, existingEntities) {
    try {
      // Try to extract JSON from the response
      let jsonStr = responseText;

      // Handle markdown code blocks
      const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1];
      }

      const parsed = JSON.parse(jsonStr.trim());

      if (!parsed.entities || !Array.isArray(parsed.entities)) {
        console.warn('Invalid entity extraction response format');
        return [];
      }

      const existingNameSet = new Set(existingEntities.map(e => e.name.toLowerCase()));

      return parsed.entities.map(entity => ({
        name: entity.name || 'Unknown',
        type: this.normalizeEntityType(entity.type),
        aliases: Array.isArray(entity.aliases) ? entity.aliases : [],
        description: entity.description || '',
        isNew: !existingNameSet.has((entity.name || '').toLowerCase()),
        confidence: entity.confidence || 1.0
      }));
    } catch (e) {
      console.warn('Failed to parse entity extraction response:', e);
      return this.fallbackExtraction(responseText);
    }
  }

  normalizeEntityType(type) {
    const normalized = (type || '').toLowerCase().trim();
    const validTypes = ['character', 'location', 'item', 'faction', 'concept'];
    if (validTypes.includes(normalized)) return normalized;

    // Fuzzy matching
    if (normalized.includes('char') || normalized.includes('person')) return 'character';
    if (normalized.includes('loc') || normalized.includes('place')) return 'location';
    if (normalized.includes('item') || normalized.includes('object') || normalized.includes('thing')) return 'item';
    if (normalized.includes('faction') || normalized.includes('group') || normalized.includes('org')) return 'faction';

    return 'concept';
  }

  fallbackExtraction(text) {
    // Simple regex-based extraction as fallback
    const entities = [];
    const seen = new Set();

    // Find capitalized multi-word names (likely characters or places)
    const namePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
    let match;

    // Common words to exclude
    const excludeWords = new Set([
      'The', 'This', 'That', 'These', 'Those', 'What', 'When', 'Where',
      'Which', 'While', 'With', 'Would', 'Could', 'Should', 'After',
      'Before', 'About', 'Above', 'Below', 'Between', 'Through',
      'During', 'Without', 'Against', 'Along', 'Around', 'Behind',
      'Beyond', 'Inside', 'Outside', 'Under', 'Until', 'Upon',
      'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday',
      'Saturday', 'Sunday', 'January', 'February', 'March', 'April',
      'May', 'June', 'July', 'August', 'September', 'October',
      'November', 'December', 'Chapter', 'Scene', 'Part',
      'However', 'Perhaps', 'Already', 'Finally', 'Suddenly',
      'Something', 'Nothing', 'Everything', 'Everyone', 'Someone',
      'Anyone', 'Nobody', 'Everybody', 'Anything', 'Sometimes'
    ]);

    while ((match = namePattern.exec(text)) !== null) {
      const name = match[1];
      if (!seen.has(name) && !excludeWords.has(name) && name.length > 1) {
        seen.add(name);
        entities.push({
          name,
          type: 'character', // Default assumption
          aliases: [],
          description: '',
          isNew: true,
          confidence: 0.5
        });
      }
    }

    return entities;
  }

  async suggestEntityUpdates(sceneText, entities) {
    if (!this.aiService.isConfigured()) {
      throw new Error('AI not configured');
    }

    const entitySummaries = entities.map(e =>
      `${e.name} (${e.type}): ${e.description || 'No description'}`
    ).join('\n');

    const messages = [
      {
        role: 'system',
        content: `You are a continuity editor. Compare the scene text against the known entity descriptions. Identify any new information revealed about existing entities that should be added to their descriptions. Also flag any potential continuity issues.

Respond with JSON:
{
  "updates": [
    {
      "entityName": "string",
      "newInfo": "string",
      "field": "description"
    }
  ],
  "issues": [
    {
      "entityName": "string",
      "issue": "string"
    }
  ]
}`
      },
      {
        role: 'user',
        content: `## Known Entities\n${entitySummaries}\n\n## Scene Text\n${sceneText}`
      }
    ];

    const result = await this.aiService.client.chat(messages, {
      temperature: 0.2,
      max_tokens: 1500
    });

    try {
      let jsonStr = result.content;
      const codeBlockMatch = result.content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1];
      }

      return JSON.parse(jsonStr.trim());
    } catch (e) {
      console.warn('Failed to parse entity update suggestions:', e);
      return { updates: [], issues: [] };
    }
  }
}
