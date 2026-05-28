// style.js — Prose style analyzer
// Detects passive voice, adverb overuse, clichés, repeated words,
// weak verbs, filler words, and dialogue tag issues

import { splitSentences, countSyllables } from './readability.js';

// ─── Pattern Databases ───────────────────────────────────────

const PASSIVE_PATTERNS = [
  /\b(was|were|been|being|is|are|am|got)\s+([\w]+ed|[\w]+en)\b/gi,
  /\b(was|were|been|being|is|are)\s+being\s+([\w]+ed|[\w]+en)\b/gi,
];

const WEAK_VERBS = new Set([
  'was', 'were', 'is', 'are', 'am', 'been', 'being',
  'had', 'has', 'have', 'having',
  'got', 'get', 'gets', 'getting',
  'went', 'go', 'goes', 'going',
  'made', 'make', 'makes', 'making',
  'did', 'do', 'does', 'doing',
  'said', 'says', 'say',
  'came', 'come', 'comes', 'coming',
  'took', 'take', 'takes', 'taking',
  'put', 'puts', 'putting',
  'seemed', 'seem', 'seems', 'seeming',
  'felt', 'feel', 'feels', 'feeling',
  'looked', 'look', 'looks', 'looking',
]);

const CLICHES = [
  'at the end of the day', 'in the nick of time', 'few and far between',
  'a matter of time', 'better late than never', 'crystal clear',
  'dead of night', 'easier said than done', 'face the music',
  'hit the nail on the head', 'in the blink of an eye', 'last but not least',
  'leave no stone unturned', 'once in a blue moon', 'read between the lines',
  'the calm before the storm', 'tip of the iceberg', 'under the weather',
  'when all is said and done', 'writing on the wall', 'blood ran cold',
  'shivers down his spine', 'shivers down her spine', 'heart skipped a beat',
  'butterflies in her stomach', 'butterflies in his stomach', 'sigh of relief',
  'knot in her stomach', 'knot in his stomach', 'pit of her stomach',
  'pit of his stomach', 'eyes widened in shock', 'darkness consumed',
  'deafening silence', 'piercing scream', 'bolt of lightning',
  'cold as ice', 'white as a sheet', 'quiet as a mouse',
  'avoid like the plague', 'light at the end of the tunnel',
  'stood frozen', 'time stood still', 'tears streamed down',
  'clenched his jaw', 'clenched her jaw', 'let out a breath',
  'didn\'t realize he had been holding', 'didn\'t realize she had been holding',
];

const FILLER_WORDS = new Set([
  'very', 'really', 'just', 'quite', 'rather', 'somewhat',
  'basically', 'actually', 'literally', 'simply', 'totally',
  'completely', 'absolutely', 'definitely', 'certainly',
  'probably', 'possibly', 'perhaps', 'maybe',
  'thing', 'things', 'stuff',
]);

const DIALOGUE_TAGS_WEAK = new Set([
  'said', 'asked', 'replied', 'answered', 'stated',
]);

const DIALOGUE_TAGS_OVERWRITTEN = new Set([
  'exclaimed', 'proclaimed', 'declared', 'announced',
  'bellowed', 'shrieked', 'gasped', 'hissed',
  'snarled', 'growled', 'purred', 'cooed',
  'thundered', 'roared', 'squealed', 'whimpered',
  'ejaculated', 'opined', 'interjected', 'retorted',
]);

const HIDDEN_VERB_SUFFIXES = ['tion', 'sion', 'ment', 'ance', 'ence', 'ity', 'ness'];

// ─── Utility ─────────────────────────────────────────────────

function tokenize(text) {
  return text.match(/\b[a-zA-Z''\-]+\b/g) || [];
}

function lowerTokenize(text) {
  return tokenize(text).map(w => w.toLowerCase());
}

// ─── Detection Functions ─────────────────────────────────────

function findPassiveVoice(text, sentences) {
  const instances = [];
  let runningOffset = 0;

  sentences.forEach((sentence, idx) => {
    const offset = text.indexOf(sentence, runningOffset);
    if (offset !== -1) runningOffset = offset + sentence.length;

    for (const pattern of PASSIVE_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(sentence)) !== null) {
        instances.push({
          type: 'passive-voice',
          severity: 'low',
          text: match[0],
          sentence: sentence,
          sentenceIndex: idx,
          offset: offset !== -1 ? offset + match.index : null,
          length: match[0].length,
          message: `Passive voice: "${match[0]}". Consider active construction.`,
        });
      }
    }
  });

  return instances;
}

function findAdverbOveruse(text, sentences) {
  const instances = [];
  let runningOffset = 0;
  const adverbPattern = /\b(\w+ly)\b/gi;

  const exceptions = new Set([
    'family', 'only', 'early', 'likely', 'lonely', 'friendly', 'holy', 'lily', 'silly', 'ugly',
    'apply', 'reply', 'supply', 'rely', 'fly', 'dry', 'shy', 'sky', 'try', 'why'
  ]);

  sentences.forEach((sentence, idx) => {
    const offset = text.indexOf(sentence, runningOffset);
    if (offset !== -1) runningOffset = offset + sentence.length;

    let match;
    while ((match = adverbPattern.exec(sentence)) !== null) {
      const word = match[0].toLowerCase();
      if (!exceptions.has(word)) {
        instances.push({
          type: 'adverb',
          severity: 'medium',
          text: match[0],
          sentence: sentence,
          sentenceIndex: idx,
          offset: offset !== -1 ? offset + match.index : null,
          length: match[0].length,
          message: `Adverb overuse: "${match[0]}". Show, don't tell.`,
        });
      }
    }
  });

  return instances;
}

function findCliches(text) {
  const instances = [];
  const lower = text.toLowerCase();
  
  CLICHES.forEach(cliche => {
    let startIdx = 0;
    while (true) {
      const idx = lower.indexOf(cliche, startIdx);
      if (idx === -1) break;
      
      const before = idx === 0 ? ' ' : lower[idx - 1];
      const after = idx + cliche.length >= lower.length ? ' ' : lower[idx + cliche.length];
      
      if (/[\s.,;:!?"'\-—(]/.test(before) && /[\s.,;:!?"'\-—)]/.test(after)) {
        instances.push({
          type: 'cliche',
          severity: 'medium',
          text: text.substring(idx, idx + cliche.length),
          offset: idx,
          length: cliche.length,
          message: `Cliché detected: "${cliche}". Consider a more original phrasing.`,
        });
      }
      startIdx = idx + 1;
    }
  });
  
  return instances;
}

function findHiddenVerbs(text) {
  const words = text.match(/\b\w+\b/g) || [];
  const results = [];
  let offset = 0;

  words.forEach(word => {
    const wordIdx = text.indexOf(word, offset);
    HIDDEN_VERB_SUFFIXES.forEach(suffix => {
      if (word.toLowerCase().endsWith(suffix) && word.length > suffix.length + 2) {
        results.push({
          type: 'hidden-verb',
          text: word,
          offset: wordIdx,
          length: word.length,
          message: `Hidden verb (nominalization): "${word}". Can this be a stronger verb?`,
        });
      }
    });
    offset = wordIdx + word.length;
  });
  return results;
}

export function analyzeStyle(text) {
  if (!text || text.trim().length === 0) {
    return { metrics: { glueIndex: 0 }, findings: [], summary: {} };
  }

  const sentences = splitSentences(text);
  const passive = findPassiveVoice(text, sentences);
  const adverbs = findAdverbOveruse(text, sentences);
  const cliches = findCliches(text);
  const hidden = findHiddenVerbs(text);
  
  const tokens = tokenize(text);
  const lowerTokens = lowerTokenize(text);
  
  let weakVerbCount = 0;
  let fillerWordCount = 0;
  
  lowerTokens.forEach(t => {
    if (WEAK_VERBS.has(t)) weakVerbCount++;
    if (FILLER_WORDS.has(t)) fillerWordCount++;
  });

  // Calculate glue index (heuristic: percentage of text that is glue words)
  const glueWords = new Set(['the', 'a', 'an', 'and', 'but', 'or', 'for', 'nor', 'yet', 'so', 'at', 'by', 'from', 'in', 'of', 'on', 'to', 'with', 'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'can', 'could', 'shall', 'should', 'will', 'would', 'may', 'might', 'must']);
  const glueCount = lowerTokens.filter(w => glueWords.has(w)).length;
  const glueIndex = tokens.length > 0 ? glueCount / tokens.length : 0;

  const issues = [...passive, ...adverbs, ...cliches, ...hidden];

  return {
    metrics: {
      passiveCount: passive.length,
      adverbCount: adverbs.length,
      clicheCount: cliches.length,
      weakVerbRatio: Math.round((weakVerbCount / Math.max(1, tokens.length)) * 100) / 100,
      fillerRatio: Math.round((fillerWordCount / Math.max(1, tokens.length)) * 100) / 100,
      glueIndex: Math.round(glueIndex * 100) / 100,
    },
    issues,
    summary: {
      totalIssues: issues.length,
      styleScore: Math.max(0, 100 - (issues.length * 1.5))
    }
  };
}
