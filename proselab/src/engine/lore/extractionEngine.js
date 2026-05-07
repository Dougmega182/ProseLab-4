// src/engine/lore/extractionEngine.js

export { ENTITY_TYPES } from './entityTypes';

// Pattern libraries for entity extraction
const EXTRACTION_PATTERNS = {
  // Character detection patterns
  characterIndicators: [
    /(?:said|spoke|whispered|shouted|muttered|replied|asked|answered|exclaimed|murmured)\s/i,
    /(?:he|she|they)\s+(?:walked|ran|stood|sat|looked|turned|smiled|frowned|nodded)/i,
    /(?:King|Queen|Prince|Princess|Lord|Lady|Sir|Dame|Captain|General|Doctor|Professor|Master|Elder)\s+([A-Z][a-z]+)/,
    /([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s+(?:was|were|is|had|has)\s+(?:a|an|the)\s/,
    /(?:the\s+)?(?:old|young|tall|short|beautiful|handsome|wise|brave|cunning)\s+(?:man|woman|boy|girl|warrior|mage|wizard|witch|knight|thief|priest|healer)\s+(?:named|called|known as)\s+([A-Z][a-z]+)/i,
  ],

  // Location detection patterns
  locationIndicators: [
    /(?:in|at|near|from|to|toward|towards|through|across|beyond|within)\s+(?:the\s+)?([A-Z][a-z]+(?:\s+(?:of|the)\s+)?(?:[A-Z][a-z]+)?)/,
    /(?:city|town|village|kingdom|realm|land|forest|mountain|river|sea|ocean|lake|castle|tower|temple|dungeon|cave|valley|desert|island|continent)\s+(?:of|called|named)\s+([A-Z][a-z]+)/i,
    /([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s+(?:was|is)\s+(?:a\s+)?(?:city|town|village|kingdom|realm|land|region|province|territory)/i,
    /(?:the\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:Mountains?|Forest|Woods|Plains?|Desert|Swamp|Marsh|Sea|Ocean|River|Lake|Bay|Gulf|Isle|Island)/,
  ],

  // Item detection patterns
  itemIndicators: [
    /(?:the\s+)?(?:ancient|legendary|magical|enchanted|cursed|sacred|holy|dark|powerful)\s+([A-Z][a-z]+(?:\s+(?:of|the)\s+)?(?:[A-Z][a-z]+)?)/,
    /(?:sword|blade|staff|wand|ring|amulet|crown|shield|armor|cloak|book|tome|scroll|orb|gem|stone|crystal|potion|elixir)\s+(?:of|called|named|known as)\s+([A-Z][a-z]+)/i,
    /([A-Z][a-z]+(?:'s)?)\s+(?:sword|blade|staff|wand|ring|amulet|crown|shield|armor|cloak)/,
  ],

  // Faction detection patterns
  factionIndicators: [
    /(?:the\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:Order|Guild|Brotherhood|Sisterhood|Council|Alliance|Legion|Clan|Tribe|House|Court|Circle|Covenant|Syndicate|Collective)/,
    /(?:Order|Guild|Brotherhood|Council|Alliance|Legion|Clan|House|Circle)\s+(?:of\s+)?(?:the\s+)?([A-Z][a-z]+)/,
    /(?:joined|served|betrayed|led|founded|disbanded)\s+(?:the\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/,
  ],

  // Relationship indicators
  relationshipIndicators: [
    /([A-Z][a-z]+)(?:'s)?\s+(?:father|mother|brother|sister|son|daughter|wife|husband|spouse|child|parent)/,
    /(?:father|mother|brother|sister|son|daughter)\s+(?:of|to)\s+([A-Z][a-z]+)/,
    /([A-Z][a-z]+)\s+(?:loved|hated|feared|trusted|betrayed|served|followed|taught|mentored)\s+([A-Z][a-z]+)/,
  ],
};

// Common words to exclude from entity detection
const STOP_WORDS = new Set([
  'The', 'This', 'That', 'These', 'Those', 'There', 'Then', 'Than',
  'They', 'Their', 'Them', 'What', 'When', 'Where', 'Which', 'While',
  'Who', 'Whom', 'Whose', 'Why', 'How', 'Here', 'Have', 'Has', 'Had',
  'Will', 'Would', 'Could', 'Should', 'Shall', 'May', 'Might', 'Must',
  'Can', 'Does', 'Did', 'Done', 'Being', 'Been', 'About', 'Above',
  'After', 'Again', 'Against', 'Along', 'Also', 'Although', 'Always',
  'Among', 'Another', 'Any', 'Anyone', 'Anything', 'Around', 'Away',
  'Back', 'Because', 'Before', 'Behind', 'Below', 'Between', 'Beyond',
  'Both', 'But', 'Each', 'Either', 'Else', 'Even', 'Every', 'Everyone',
  'Everything', 'Few', 'First', 'For', 'From', 'Get', 'Give', 'Going',
  'Gone', 'Good', 'Got', 'Great', 'Her', 'Him', 'His', 'However',
  'If', 'In', 'Into', 'It', 'Its', 'Just', 'Keep', 'Last', 'Let',
  'Like', 'Long', 'Look', 'Made', 'Make', 'Many', 'More', 'Most',
  'Much', 'Never', 'New', 'Next', 'No', 'None', 'Nor', 'Not', 'Nothing',
  'Now', 'Of', 'Off', 'Often', 'On', 'Once', 'One', 'Only', 'Or',
  'Other', 'Our', 'Out', 'Over', 'Own', 'Part', 'Perhaps', 'Place', 'Point',
  'Put', 'Rather', 'Right', 'Same', 'Say', 'Second', 'See', 'Seem',
  'She', 'Since', 'So', 'Some', 'Something', 'Sometimes', 'Still',
  'Such', 'Take', 'Tell', 'Through', 'Time', 'To', 'Too', 'Turn',
  'Under', 'Until', 'Up', 'Upon', 'Us', 'Use', 'Very', 'Want',
  'Was', 'Way', 'We', 'Well', 'Were', 'With', 'Without', 'Work',
  'Yet', 'You', 'Your', 'And', 'Are', 'As', 'At', 'Be', 'By',
  'Do', 'He', 'I', 'My', 'No', 'So', 'An', 'Or', 'It',
  'Chapter', 'Part', 'Book', 'Section', 'Prologue', 'Epilogue',
  'Note', 'Notes', 'Scene', 'Act',
]);

/**
 * Generate a unique ID
 */
let idCounter = 0;
function generateId(prefix = 'ent') {
  return `${prefix}_${Date.now()}_${++idCounter}`;
}

/**
 * Split text into sentences for granular analysis
 */
function splitSentences(text) {
  return text
    .replace(/([.!?])\s+/g, '$1\n')
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * Split text into manageable chunks for processing
 */
export function chunkText(text, maxChunkSize = 2000) {
  const paragraphs = text.split(/\n\s*\n/);
  const chunks = [];
  let current = '';

  for (const para of paragraphs) {
    if (current.length + para.length > maxChunkSize && current.length > 0) {
      chunks.push(current.trim());
      current = '';
    }
    current += para + '\n\n';
  }
  if (current.trim()) {
    chunks.push(current.trim());
  }
  return chunks;
}

/**
 * Extract proper nouns from text using capitalization heuristics
 */
function extractProperNouns(text) {
  const results = [];
  // Match capitalized words not at sentence start
  const regex = /(?<=[a-z.!?]\s)([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})*)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const name = match[1].trim();
    if (!STOP_WORDS.has(name) && !STOP_WORDS.has(name.split(' ')[0])) {
      results.push({
        text: name,
        index: match.index,
        context: text.substring(Math.max(0, match.index - 80), match.index + name.length + 80),
      });
    }
  }

  // Also match sentence-starting capitalized words that appear multiple times
  const sentenceStartRegex = /(?:^|[.!?]\s+)([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})*)/gm;
  while ((match = sentenceStartRegex.exec(text)) !== null) {
    const name = match[1].trim();
    if (!STOP_WORDS.has(name) && !STOP_WORDS.has(name.split(' ')[0])) {
      results.push({
        text: name,
        index: match.index,
        context: text.substring(Math.max(0, match.index - 80), match.index + name.length + 80),
      });
    }
  }

  return results;
}

/**
 * Score how likely a proper noun is to be a specific entity type
 */
function scoreEntityType(name, context, text) {
  const scores = {};
  const lowerContext = context.toLowerCase();
  const fullTextLower = text.toLowerCase();
  const nameLower = name.toLowerCase();

  // Character scoring
  let charScore = 0;
  const dialoguePattern = new RegExp(`${name}\\s+(?:said|spoke|whispered|shouted|asked|replied|muttered|exclaimed|murmured|growled|sighed|laughed|cried)`, 'gi');
  const dialogueMatches = text.match(dialoguePattern);
  if (dialogueMatches) charScore += dialogueMatches.length * 3;

  const pronounPattern = new RegExp(`${name}[^.]*?\\b(?:he|she|they|his|her|their|him)\\b`, 'gi');
  const pronounMatches = text.match(pronounPattern);
  if (pronounMatches) charScore += pronounMatches.length * 2;

  const actionPattern = new RegExp(`${name}\\s+(?:walked|ran|stood|sat|looked|turned|smiled|frowned|nodded|shook|drew|raised|lowered|held|took|gave|felt|thought|knew|saw|heard|wanted|needed|decided|remembered)`, 'gi');
  const actionMatches = text.match(actionPattern);
  if (actionMatches) charScore += actionMatches.length * 2;

  if (/(?:King|Queen|Prince|Princess|Lord|Lady|Sir|Captain|General|Doctor|Professor|Master|Elder)\s/i.test(name)) {
    charScore += 5;
  }

  scores[ENTITY_TYPES.CHARACTER] = charScore;

  // Location scoring
  let locScore = 0;
  const locPrepositions = new RegExp(`(?:in|at|near|from|to|toward|through|across|beyond|within|outside|inside)\\s+(?:the\\s+)?${name}`, 'gi');
  const locMatches = text.match(locPrepositions);
  if (locMatches) locScore += locMatches.length * 3;

  if (/(?:Mountains?|Forest|Woods|Plains?|Desert|Swamp|Sea|Ocean|River|Lake|Bay|Isle|Island|Valley|Canyon|Peak|Tower|Castle|Keep|Gate|Bridge|Road|Path|Street|Square|Harbor|Port|Wall|Hall|Palace|Temple|Shrine|Ruins?|Citadel|Fortress)/i.test(name)) {
    locScore += 5;
  }

  const locDescPattern = new RegExp(`${name}[^.]*?(?:city|town|village|kingdom|realm|land|region|province|territory|capital|border|walls|gates|streets)`, 'gi');
  const locDescMatches = text.match(locDescPattern);
  if (locDescMatches) locScore += locDescMatches.length * 2;

  scores[ENTITY_TYPES.LOCATION] = locScore;

  // Item scoring
  let itemScore = 0;
  const possessionPattern = new RegExp(`(?:held|carried|wielded|wore|drew|sheathed|raised|swung|gripped|clutched|grasped)\\s+(?:the\\s+)?${name}`, 'gi');
  const possessionMatches = text.match(possessionPattern);
  if (possessionMatches) itemScore += possessionMatches.length * 3;

  if (/(?:Blade|Sword|Staff|Wand|Ring|Amulet|Crown|Shield|Armor|Cloak|Tome|Scroll|Orb|Gem|Stone|Crystal|Hammer|Bow|Arrow|Dagger|Spear|Axe)/i.test(name)) {
    itemScore += 5;
  }

  const itemDescPattern = new RegExp(`${name}[^.]*?(?:glowed|pulsed|hummed|shimmered|ancient|magical|enchanted|cursed|forged|crafted|powerful)`, 'gi');
  const itemDescMatches = text.match(itemDescPattern);
  if (itemDescMatches) itemScore += itemDescMatches.length * 2;

  scores[ENTITY_TYPES.ITEM] = itemScore;

  // Faction scoring
  let factionScore = 0;
  if (/(?:Order|Guild|Brotherhood|Sisterhood|Council|Alliance|Legion|Clan|Tribe|House|Court|Circle|Covenant|Syndicate|Collective|Society|Assembly|Conclave)/i.test(name)) {
    factionScore += 5;
  }

  const factionPattern = new RegExp(`(?:joined|served|betrayed|led|founded|member|members|ranks)\\s+(?:of\\s+)?(?:the\\s+)?${name}`, 'gi');
  const factionMatches = text.match(factionPattern);
  if (factionMatches) factionScore += factionMatches.length * 3;

  scores[ENTITY_TYPES.FACTION] = factionScore;

  // Find the highest scoring type
  let bestType = ENTITY_TYPES.CHARACTER; // default
  let bestScore = 0;
  for (const [type, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  }

  // If no strong signal, check frequency - frequent proper nouns are likely characters
  if (bestScore === 0) {
    const nameRegex = new RegExp(`\\b${name}\\b`, 'g');
    const frequency = (text.match(nameRegex) || []).length;
    if (frequency >= 3) {
      bestType = ENTITY_TYPES.CHARACTER;
      bestScore = frequency;
    }
  }

  return { type: bestType, score: bestScore, allScores: scores };
}

/**
 * Extract relationships between detected entities
 */
export function extractRelationships(text, entities) {
  const relationships = [];
  const entityNames = entities.map(e => e.name);

  for (let i = 0; i < entityNames.length; i++) {
    for (let j = i + 1; j < entityNames.length; j++) {
      const nameA = entityNames[i];
      const nameB = entityNames[j];

      // Check co-occurrence within sentences
      const sentences = splitSentences(text);
      let coOccurrences = 0;
      const sharedContexts = [];

      for (const sentence of sentences) {
        const hasA = sentence.includes(nameA);
        const hasB = sentence.includes(nameB);
        if (hasA && hasB) {
          coOccurrences++;
          sharedContexts.push(sentence);
        }
      }

      if (coOccurrences === 0) continue;

      // Determine relationship type from context
      let relType = 'associated';
      let relSubtype = null;
      let confidence = Math.min(coOccurrences / 5, 1);

      for (const ctx of sharedContexts) {
        const ctxLower = ctx.toLowerCase();

        // Family relationships
        if (/(?:father|mother|parent|son|daughter|child|brother|sister|sibling)/.test(ctxLower)) {
          relType = 'family';
          const familyMatch = ctxLower.match(/(?:father|mother|parent|son|daughter|child|brother|sister|sibling)/);
          relSubtype = familyMatch ? familyMatch[0] : null;
          confidence = Math.max(confidence, 0.8);
          break;
        }

        // Social relationships
        if (/(?:friend|enemy|rival|mentor|student|apprentice|lover|beloved|companion|ally|foe)/.test(ctxLower)) {
          relType = 'social';
          const socialMatch = ctxLower.match(/(?:friend|enemy|rival|mentor|student|apprentice|lover|beloved|companion|ally|foe)/);
          relSubtype = socialMatch ? socialMatch[0] : null;
          confidence = Math.max(confidence, 0.7);
          break;
        }

        // Organizational relationships
        if (/(?:served|led|commanded|followed|joined|member|leader|founded|ruled)/.test(ctxLower)) {
          relType = 'organizational';
          const orgMatch = ctxLower.match(/(?:served|led|commanded|followed|joined|member|leader|founded|ruled)/);
          relSubtype = orgMatch ? orgMatch[0] : null;
          confidence = Math.max(confidence, 0.6);
        }

        // Conflict relationships
        if (/(?:fought|attacked|killed|defeated|struck|clashed|battled|dueled)/.test(ctxLower)) {
          relType = 'social';
          relSubtype = 'enemy';
          confidence = Math.max(confidence, 0.65);
        }

        // Spatial relationships (for locations)
        if (/(?:in|at|near|within|inside|outside|above|below|beneath|beyond)/.test(ctxLower)) {
          const entityA = entities.find(e => e.name === nameA);
          const entityB = entities.find(e => e.name === nameB);
          if (entityA?.type === ENTITY_TYPES.LOCATION || entityB?.type === ENTITY_TYPES.LOCATION) {
            relType = 'spatial';
            relSubtype = 'located-in';
            confidence = Math.max(confidence, 0.5);
          }
        }
      }

      relationships.push({
        id: generateId('rel'),
        sourceId: entities[i].id,
        targetId: entities[j].id,
        sourceName: nameA,
        targetName: nameB,
        type: relType,
        subtype: relSubtype,
        confidence,
        coOccurrences,
        evidence: sharedContexts.slice(0, 3),
        verified: false,
      });
    }
  }

  return relationships.filter(r => r.confidence >= 0.3);
}

/**
 * Extract attribute details for a detected entity
 */
function extractAttributes(name, type, text) {
  const attributes = {};
  const nameLower = name.toLowerCase();

  // Find sentences containing this entity
  const sentences = splitSentences(text);
  const relevantSentences = sentences.filter(s => s.includes(name));

  if (type === ENTITY_TYPES.CHARACTER) {
    // Extract appearance
    const appearanceWords = [];
    const appearancePattern = new RegExp(`${name}[^.]*?(?:was|appeared|looked|had|with)\\s+([^.]+)`, 'gi');
    let match;
    while ((match = appearancePattern.exec(text)) !== null) {
      const desc = match[1].trim();
      if (/(?:tall|short|thin|broad|dark|pale|fair|scarred|old|young|beautiful|handsome|muscular|slender|stocky|gaunt|weathered|wrinkled|freckled|bearded)/.test(desc.toLowerCase())) {
        appearanceWords.push(desc.substring(0, 100));
      }
    }
    if (appearanceWords.length > 0) {
      attributes.appearance = appearanceWords.join('. ');
    }

    // Extract traits
    const traits = new Set();
    const traitPatterns = [
      new RegExp(`${name}\\s+(?:was|is|seemed|appeared)\\s+(?:very\\s+)?([a-z]+)`, 'gi'),
      new RegExp(`(?:brave|cunning|wise|foolish|loyal|treacherous|kind|cruel|proud|humble|fierce|gentle|stubborn|patient|reckless|cautious|ambitious|lazy|honest|deceitful|noble|cowardly|clever|naive|stoic|passionate|cold|warm|ruthless|merciful|arrogant|modest)`, 'gi'),
    ];
    for (const sentence of relevantSentences) {
      for (const pattern of traitPatterns) {
        pattern.lastIndex = 0;
        while ((match = pattern.exec(sentence)) !== null) {
          const trait = (match[1] || match[0]).toLowerCase();
          if (trait.length > 2 && trait.length < 20) {
            traits.add(trait);
          }
        }
      }
    }
    if (traits.size > 0) {
      attributes.traits = Array.from(traits);
    }

    // Detect role
    const titleMatch = name.match(/^(King|Queen|Prince|Princess|Lord|Lady|Sir|Captain|General|Doctor|Professor|Master|Elder)\s/);
    if (titleMatch) {
      attributes.title = titleMatch[1];
    }

    // Count mentions to estimate importance
    const mentionCount = (text.match(new RegExp(`\\b${name}\\b`, 'g')) || []).length;
    if (mentionCount > 20) attributes.role = 'protagonist';
    else if (mentionCount > 10) attributes.role = 'supporting';
    else if (mentionCount > 3) attributes.role = 'minor';
    else attributes.role = 'mentioned';
  }

  if (type === ENTITY_TYPES.LOCATION) {
    // Extract location type
    const locTypePattern = new RegExp(`${name}[^.]*?(?:was|is)\\s+(?:a|an|the)\\s+([a-z]+(?:\\s+[a-z]+)?)`, 'gi');
    let match;
    while ((match = locTypePattern.exec(text)) !== null) {
      const desc = match[1].toLowerCase();
      const locTypes = ['city', 'town', 'village', 'kingdom', 'realm', 'castle', 'fortress', 'tower', 'temple', 'forest', 'mountain', 'river', 'sea', 'ocean', 'lake', 'desert', 'island', 'continent', 'region', 'province', 'capital'];
      for (const lt of locTypes) {
        if (desc.includes(lt)) {
          attributes.locationType = lt;
          break;
        }
      }
    }

    // Extract atmosphere/description
    const descSentences = relevantSentences.filter(s => 
      /(?:dark|bright|ancient|crumbling|bustling|quiet|peaceful|dangerous|mysterious|sacred|cursed|beautiful|desolate|frozen|burning|lush|barren|sprawling|hidden|forgotten)/.test(s.toLowerCase())
    );
    if (descSentences.length > 0) {
      attributes.climate = descSentences[0].substring(0, 200);
    }
  }

  if (type === ENTITY_TYPES.ITEM) {
    // Extract item properties
    const propSentences = relevantSentences.filter(s =>
      /(?:glowed|pulsed|hummed|ancient|magical|enchanted|cursed|forged|crafted|powerful|sharp|heavy|light|ornate|simple|rusted|gleaming|shimmering)/.test(s.toLowerCase())
    );
    if (propSentences.length > 0) {
      attributes.properties = propSentences.map(s => s.substring(0, 150)).join('. ');
    }
  }

  // Extract description from first meaningful mention
  const firstMention = relevantSentences[0];
  if (firstMention) {
    attributes.description = firstMention.substring(0, 300);
    attributes.firstMention = firstMention;
  }

  return attributes;
}

/**
 * Deduplicate entities by merging similar names
 */
function deduplicateEntities(rawEntities) {
  const merged = new Map();

  for (const entity of rawEntities) {
    const normalizedName = entity.name.toLowerCase().trim();
    let found = false;

    for (const [key, existing] of merged) {
      // Exact match
      if (key === normalizedName) {
        existing.mentions += entity.mentions;
        existing.contexts.push(...entity.contexts);
        existing.confidence = Math.max(existing.confidence, entity.confidence);
        found = true;
        break;
      }

      // Substring match (e.g., "Gandalf" and "Gandalf the Grey")
      if (key.includes(normalizedName) || normalizedName.includes(key)) {
        const longerName = key.length > normalizedName.length ? existing.name : entity.name;
        const shorterName = key.length > normalizedName.length ? entity.name : existing.name;
        existing.name = longerName;
        if (!existing.aliases) existing.aliases = [];
        existing.aliases.push(shorterName);
        existing.mentions += entity.mentions;
        existing.contexts.push(...entity.contexts);
        existing.confidence = Math.max(existing.confidence, entity.confidence);
        found = true;
        break;
      }
    }

    if (!found) {
      merged.set(normalizedName, { ...entity });
    }
  }

  return Array.from(merged.values());
}

/**
 * Main extraction pipeline
 */
export function extractEntities(text, options = {}) {
  const {
    minConfidence = 0.3,
    minMentions = 2,
    includeTypes = Object.values(ENTITY_TYPES),
  } = options;

  if (!text || text.trim().length === 0) {
    return { entities: [], relationships: [], stats: { totalProcessed: 0 } };
  }

  // Step 1: Extract all proper nouns
  const properNouns = extractProperNouns(text);

  // Step 2: Count frequencies and gather contexts
  const nounFrequency = new Map();
  for (const pn of properNouns) {
    const key = pn.text;
    if (!nounFrequency.has(key)) {
      nounFrequency.set(key, { name: key, mentions: 0, contexts: [] });
    }
    const entry = nounFrequency.get(key);
    entry.mentions++;
    if (entry.contexts.length < 5) {
      entry.contexts.push(pn.context);
    }
  }

  // Step 3: Score and classify each candidate
  const rawEntities = [];
  for (const [name, data] of nounFrequency) {
    if (data.mentions < minMentions) continue;

    const { type, score, allScores } = scoreEntityType(name, data.contexts.join(' '), text);
    
    if (!includeTypes.includes(type)) continue;

    const confidence = Math.min(
      (score / 10 + data.mentions / 20) * 0.5 + 0.3,
      1.0
    );

    if (confidence < minConfidence) continue;

    const attributes = extractAttributes(name, type, text);

    rawEntities.push({
      id: generateId('ent'),
      name,
      type,
      confidence,
      mentions: data.mentions,
      contexts: data.contexts,
      allScores,
      attributes,
      aliases: attributes.aliases || [],
      verified: false,
      source: 'auto-extracted',
      createdAt: Date.now(),
    });
  }

  // Step 4: Deduplicate
  const entities = deduplicateEntities(rawEntities);

  // Step 5: Extract relationships
  const relationships = extractRelationships(text, entities);

  // Step 6: Sort by confidence and mentions
  entities.sort((a, b) => {
    const scoreA = a.confidence * 10 + a.mentions;
    const scoreB = b.confidence * 10 + b.mentions;
    return scoreB - scoreA;
  });

  return {
    entities,
    relationships,
    stats: {
      totalProcessed: text.length,
      candidatesFound: nounFrequency.size,
      entitiesExtracted: entities.length,
      relationshipsFound: relationships.length,
    },
  };
}

/**
 * Merge a set of new entities into an existing set
 */
export function mergeEntities(existingEntities, newEntities) {
  const merged = [...existingEntities];

  for (const newEntity of newEntities) {
    const existing = merged.find(e =>
      e.name.toLowerCase() === newEntity.name.toLowerCase() ||
      (e.aliases && e.aliases.some(a => a.toLowerCase() === newEntity.name.toLowerCase())) ||
      (newEntity.aliases && newEntity.aliases.some(a => a.toLowerCase() === e.name.toLowerCase()))
    );

    if (existing) {
      // Merge into existing
      existing.mentions += newEntity.mentions;
      if (newEntity.contexts) {
        existing.contexts = [...(existing.contexts || []), ...newEntity.contexts].slice(-10);
      }
      existing.confidence = Math.max(existing.confidence, newEntity.confidence);
      if (newEntity.aliases) {
        existing.aliases = [...new Set([...(existing.aliases || []), ...newEntity.aliases])];
      }
      // Merge attributes
      if (newEntity.attributes) {
        for (const [key, value] of Object.entries(newEntity.attributes)) {
          if (!existing.attributes[key]) {
            existing.attributes[key] = value;
          } else if (Array.isArray(value)) {
            existing.attributes[key] = [...new Set([...existing.attributes[key], ...value])];
          }
        }
      }
      existing.updatedAt = Date.now();
    } else {
      merged.push(newEntity);
    }
  }

  return merged;
}

/**
 * Merge a set of new relationships into an existing set
 */
export function mergeRelationships(existingRelationships, newRelationships, entities) {
  const merged = [...existingRelationships];

  for (const newRel of newRelationships) {
    // Map new relationship entity IDs to merged entity IDs
    const source = entities.find(e =>
      e.name === newRel.sourceName || (e.aliases && e.aliases.includes(newRel.sourceName))
    );
    const target = entities.find(e =>
      e.name === newRel.targetName || (e.aliases && e.aliases.includes(newRel.targetName))
    );

    if (!source || !target) continue;

    const existingRel = merged.find(r =>
      (r.sourceId === source.id && r.targetId === target.id) ||
      (r.sourceId === target.id && r.targetId === source.id)
    );

    if (existingRel) {
      existingRel.confidence = Math.max(existingRel.confidence, newRel.confidence);
      existingRel.coOccurrences = (existingRel.coOccurrences || 0) + (newRel.coOccurrences || 0);
      if (newRel.evidence) {
        existingRel.evidence = [...(existingRel.evidence || []), ...newRel.evidence].slice(-5);
      }
      if (newRel.subtype && !existingRel.subtype) {
        existingRel.type = newRel.type;
        existingRel.subtype = newRel.subtype;
      }
    } else {
      newRel.sourceId = source.id;
      newRel.targetId = target.id;
      merged.push(newRel);
    }
  }

  return merged;
}

/**
 * Incrementally extract from new text, merging with existing entities
 */
export function incrementalExtract(newText, existingEntities, existingRelationships) {
  const { entities: newEntities, relationships: newRelationships } = extractEntities(newText);
  const mergedEntities = mergeEntities(existingEntities, newEntities);
  const mergedRelationships = mergeRelationships(existingRelationships, newRelationships, mergedEntities);

  return {
    entities: mergedEntities,
    relationships: mergedRelationships,
  };
}

/**
 * Builds a prompt for the LLM to refine candidates and extract attributes.
 */
export function buildExtractionPrompt(text, existingCandidates = []) {
  const candidateNames = existingCandidates.map(c => c.name).join(', ');
  
  return `
EXTRACT LORE ENTITIES
Target Text:
"""
${text.substring(0, 4000)}
"""

Known Candidates: ${candidateNames}

TASK:
1. Identify all unique entities mentioned in the text (Characters, Locations, Items, Factions, Species, Concepts, Events).
2. For each entity, extract:
   - Full Name
   - Type
   - Brief Description (based only on the text)
   - Key attributes (e.g. traits for characters, type for locations)
   - Relationships to other entities mentioned.

RETURN JSON ONLY in this format:
{
  "entities": [
    {
      "name": "...",
      "type": "character|location|item|faction|species|concept|event",
      "description": "...",
      "attributes": { "key": "value" },
      "relationships": [
        { "target": "name of other entity", "type": "family|social|spatial|etc", "description": "how they relate" }
      ]
    }
  ]
}
`.trim();
}

/**
 * Normalizes LLM output into project lore format.
 */
export function normalizeLoreOutput(llmJson) {
  try {
    const data = typeof llmJson === 'string' ? JSON.parse(llmJson) : llmJson;
    return (data.entities || []).map(e => ({
      id: `lore-${Math.random().toString(36).substr(2, 9)}`,
      ...e,
      lastUpdated: new Date().toISOString(),
      source: 'auto-extracted'
    }));
  } catch (err) {
    console.error('Failed to normalize lore output:', err);
    return [];
  }
}
