// src/services/classificationService.js

const CATEGORY_LABELS = {
  manuscript: 'Manuscript / Prose',
  characters: 'Character Profiles',
  worldRules: 'World Rules / Lore',
  beatMap: 'Beat Map / Outline',
  notes: 'Notes / Reference',
  skip: 'Skip (Do Not Import)'
};

export function classifyFile(file, content) {
  const fileName = file.name.toLowerCase();
  const ext = fileName.split('.').pop();

  // First try filename-based classification
  const filenameCategory = classifyByFilename(fileName);
  if (filenameCategory) {
    return {
      fileName: file.name,
      category: filenameCategory,
      confidence: 'high',
      reason: `Filename suggests ${CATEGORY_LABELS[filenameCategory]}`,
      content,
      parsedData: null
    };
  }

  // Then try content-based classification
  const contentCategory = classifyByContent(content, ext);
  return {
    fileName: file.name,
    category: contentCategory.category,
    confidence: contentCategory.confidence,
    reason: contentCategory.reason,
    content,
    parsedData: contentCategory.parsedData || null
  };
}

function classifyByFilename(fileName) {
  const manuscriptPatterns = [
    /manuscript/i, /chapter/i, /draft/i, /prose/i, /novel/i,
    /book/i, /story/i, /part[\s_-]?\d/i
  ];
  const characterPatterns = [
    /character/i, /cast/i, /dramatis/i, /persona/i, /profile/i
  ];
  const worldPatterns = [
    /world/i, /lore/i, /rule/i, /magic[\s_-]?system/i,
    /setting/i, /geography/i, /history/i, /faction/i
  ];
  const beatPatterns = [
    /beat/i, /outline/i, /structure/i, /plot/i, /synopsis/i,
    /timeline/i, /arc/i
  ];
  const notePatterns = [
    /note/i, /reference/i, /research/i, /todo/i, /idea/i, /scratch/i
  ];

  if (manuscriptPatterns.some(p => p.test(fileName))) return 'manuscript';
  if (characterPatterns.some(p => p.test(fileName))) return 'characters';
  if (worldPatterns.some(p => p.test(fileName))) return 'worldRules';
  if (beatPatterns.some(p => p.test(fileName))) return 'beatMap';
  if (notePatterns.some(p => p.test(fileName))) return 'notes';

  return null;
}

function classifyByContent(content, ext) {
  if (!content || content.trim().length === 0) {
    return {
      category: 'skip',
      confidence: 'high',
      reason: 'File is empty'
    };
  }

  // Try JSON parsing
  if (ext === 'json') {
    try {
      const parsed = JSON.parse(content);
      return classifyJsonContent(parsed);
    } catch {
      // Not valid JSON, treat as text
    }
  }

  const text = content.toLowerCase();
  const wordCount = content.split(/\s+/).length;

  // Score each category
  const scores = {
    manuscript: 0,
    characters: 0,
    worldRules: 0,
    beatMap: 0,
    notes: 0
  };

  // Manuscript indicators
  if (wordCount > 1000) scores.manuscript += 3;
  if (wordCount > 5000) scores.manuscript += 2;
  if (/chapter\s+\d/i.test(content)) scores.manuscript += 3;
  if (/[""][^""]+[""]\s*(he|she|they|I)\s+(said|asked|whispered|shouted)/i.test(content)) scores.manuscript += 4;
  if (/\b(walked|looked|felt|thought|knew|said|asked)\b/gi.test(content)) scores.manuscript += 1;
  // Check for paragraph density (prose tends to have longer paragraphs)
  const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim());
  const avgParagraphLength = wordCount / Math.max(paragraphs.length, 1);
  if (avgParagraphLength > 50) scores.manuscript += 2;

  // Character indicators
  if (/\b(character|protagonist|antagonist|hero|heroine|villain)\b/i.test(content)) scores.characters += 2;
  if (/\b(age|height|appearance|personality|motivation|backstory|background)\b/i.test(content)) scores.characters += 2;
  if (/\b(name|role|description|traits|goals|flaws)\b/i.test(content)) scores.characters += 1;
  // Pattern: "Name: description" repeated
  const nameColonPattern = /^[\w\s]+:\s+.+$/gm;
  const nameColonMatches = content.match(nameColonPattern);
  if (nameColonMatches && nameColonMatches.length >= 3) scores.characters += 2;

  // World rules indicators
  if (/\b(magic|system|rule|law|physics|power|ability|element)\b/i.test(content)) scores.worldRules += 1;
  if (/\b(world|realm|kingdom|empire|continent|geography|climate)\b/i.test(content)) scores.worldRules += 1;
  if (/\b(history|era|epoch|age|calendar|timeline)\b/i.test(content)) scores.worldRules += 1;
  if (/\b(faction|guild|order|clan|tribe|race|species)\b/i.test(content)) scores.worldRules += 1;
  if (/\b(lore|mythology|religion|deity|god|goddess)\b/i.test(content)) scores.worldRules += 2;

  // Beat map indicators
  if (/\b(act\s+[123ivIV]|inciting\s+incident|climax|resolution|midpoint|turning\s+point)\b/i.test(content)) scores.beatMap += 3;
  if (/\b(beat|scene|sequence|plot\s+point)\b/i.test(content)) scores.beatMap += 2;
  if (/\b(setup|confrontation|denouement|rising\s+action|falling\s+action)\b/i.test(content)) scores.beatMap += 2;
  // Numbered/bulleted lists suggest outline
  const listItems = content.match(/^\s*(?:\d+[.)]\s|[-*•]\s)/gm);
  if (listItems && listItems.length >= 5 && wordCount < 2000) scores.beatMap += 2;

  // Notes indicators
  if (/\b(todo|note|idea|research|reference|reminder|question)\b/i.test(content)) scores.notes += 2;
  if (wordCount < 200) scores.notes += 1;

  // Find the highest scoring category
  let bestCategory = 'notes'; // default
  let bestScore = 0;
  for (const [category, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  let confidence;
  if (bestScore >= 5) confidence = 'high';
  else if (bestScore >= 3) confidence = 'medium';
  else confidence = 'low';

  const reasons = {
    manuscript: 'Content appears to be narrative prose',
    characters: 'Content appears to contain character descriptions',
    worldRules: 'Content appears to describe world-building elements',
    beatMap: 'Content appears to be a story outline or beat map',
    notes: 'Content appears to be notes or reference material'
  };

  return {
    category: bestCategory,
    confidence,
    reason: reasons[bestCategory]
  };
}

function classifyJsonContent(parsed) {
  // Check for array of objects with known shapes
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      return { category: 'skip', confidence: 'high', reason: 'Empty array', parsedData: parsed };
    }

    const sample = parsed[0];

    if (sample.name && (sample.description || sample.traits || sample.backstory || sample.role)) {
      return { category: 'characters', confidence: 'high', reason: 'JSON array of character objects', parsedData: parsed };
    }

    if (sample.title && (sample.content || sample.text || sample.body)) {
      // Could be chapters or beats
      if (sample.content && sample.content.length > 500) {
        return { category: 'manuscript', confidence: 'medium', reason: 'JSON array of content objects (long text)', parsedData: parsed };
      }
      return { category: 'beatMap', confidence: 'medium', reason: 'JSON array of titled items', parsedData: parsed };
    }

    if (sample.beat || sample.scene || sample.sequence) {
      return { category: 'beatMap', confidence: 'high', reason: 'JSON array of beat/scene objects', parsedData: parsed };
    }

    if (sample.rule || sample.law || sample.lore) {
      return { category: 'worldRules', confidence: 'high', reason: 'JSON array of world rule objects', parsedData: parsed };
    }
  }

  // Check for object with known top-level keys
  if (typeof parsed === 'object' && !Array.isArray(parsed)) {
    if (parsed.characters) {
      return { category: 'characters', confidence: 'high', reason: 'JSON object with characters key', parsedData: parsed.characters };
    }
    if (parsed.chapters || parsed.manuscript) {
       return { category: 'manuscript', confidence: 'high', reason: 'JSON object with manuscript/chapters key', parsedData: parsed.chapters || parsed.manuscript };
    }
    if (parsed.beats || parsed.outline || parsed.plotPoints) {
      return { category: 'beatMap', confidence: 'high', reason: 'JSON object with beats/outline key', parsedData: parsed.beats || parsed.outline || parsed.plotPoints };
    }
    if (parsed.worldRules || parsed.lore || parsed.worldBuilding) {
      return { category: 'worldRules', confidence: 'high', reason: 'JSON object with world rules key', parsedData: parsed.worldRules || parsed.lore || parsed.worldBuilding };
    }
    if (parsed.notes) {
      return { category: 'notes', confidence: 'high', reason: 'JSON object with notes key', parsedData: parsed.notes };
    }
  }

  return {
    category: 'notes',
    confidence: 'low',
    reason: 'JSON structure not recognized, defaulting to notes',
    parsedData: parsed
  };
}

export { CATEGORY_LABELS, classifyByFilename, classifyByContent };
