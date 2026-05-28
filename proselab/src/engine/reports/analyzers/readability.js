// Readability analyzers: Flesch-Kincaid Grade, Flesch Reading Ease,
// sentence/word/syllable counts, paragraph density

export function countSyllables(word) {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 2) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  word = word.replace(/^y/, '');
  const matches = word.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

function tokenize(text) {
  return text.match(/\b[a-zA-Z''-]+\b/g) || [];
}

export function splitSentences(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

function splitParagraphs(text) {
  return text
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
}

export function analyzeReadability(text) {
  if (!text || text.trim().length === 0) {
    return {
      scores: {
        fleschKincaidGrade: 0,
        fleschReadingEase: 0,
      },
      metrics: {
        wordCount: 0,
        sentenceCount: 0,
        syllableCount: 0,
        paragraphCount: 0,
        avgWordsPerSentence: 0,
        avgSyllablesPerWord: 0,
        avgSentencesPerParagraph: 0,
        charCount: 0,
        charCountNoSpaces: 0,
      },
      flagged: {
        longSentences: [],
        shortSentences: [],
        denseParagraphs: [],
      },
      issues: [],
      interpretation: "No content"
    };
  }

  const words = tokenize(text);
  const sentences = splitSentences(text);
  const paragraphs = splitParagraphs(text);

  const wordCount = words.length;
  const sentenceCount = Math.max(sentences.length, 1);
  const syllableCount = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const paragraphCount = paragraphs.length;
  const charCount = text.length;
  const charCountNoSpaces = text.replace(/\s/g, '').length;

  const avgWordsPerSentence = wordCount / sentenceCount;
  const avgSyllablesPerWord = wordCount > 0 ? syllableCount / wordCount : 0;
  const avgSentencesPerParagraph = paragraphCount > 0 ? sentenceCount / paragraphCount : 0;

  // Flesch-Kincaid Grade Level
  const fleschKincaidGrade = wordCount > 0
    ? 0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59
    : 0;

  // Flesch Reading Ease (0–100, higher = easier)
  const fleschReadingEase = wordCount > 0
    ? 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord
    : 0;

  // Flag problematic sentences and paragraphs
  const longSentences = [];
  const shortSentences = [];
  const denseParagraphs = [];
  const issues = [];

  let runningOffset = 0;

  sentences.forEach((sentence, idx) => {
    const sWords = tokenize(sentence);
    const offset = text.indexOf(sentence, runningOffset);
    if (offset !== -1) runningOffset = offset + sentence.length;

    if (sWords.length > 35) {
      const severity = sWords.length > 50 ? 'high' : 'medium';
      longSentences.push({
        index: idx,
        text: sentence,
        wordCount: sWords.length,
        offset: offset !== -1 ? offset : null,
        severity,
      });
      issues.push({
        type: 'long-sentence',
        severity,
        message: `Sentence ${idx + 1} has ${sWords.length} words. Consider breaking it up.`,
        index: idx,
        offset: offset !== -1 ? offset : null,
        length: sentence.length,
        text: sentence,
      });
    }

    if (sWords.length > 0 && sWords.length < 4) {
      shortSentences.push({
        index: idx,
        text: sentence,
        wordCount: sWords.length,
        offset: offset !== -1 ? offset : null,
      });
    }
  });

  paragraphs.forEach((para, idx) => {
    const pSentences = splitSentences(para);
    const pWords = tokenize(para);
    const offset = text.indexOf(para);

    if (pSentences.length > 8) {
      denseParagraphs.push({
        index: idx,
        sentenceCount: pSentences.length,
        wordCount: pWords.length,
        offset: offset !== -1 ? offset : null,
      });
      issues.push({
        type: 'dense-paragraph',
        severity: pSentences.length > 12 ? 'high' : 'medium',
        message: `Paragraph ${idx + 1} has ${pSentences.length} sentences (${pWords.length} words). Consider splitting for readability.`,
        index: idx,
        offset: offset !== -1 ? offset : null,
        length: para.length,
      });
    }
  });

  // Grade level warning
  if (fleschKincaidGrade > 12) {
    issues.push({
      type: 'high-grade-level',
      severity: 'medium',
      message: `Grade level is ${fleschKincaidGrade.toFixed(1)}. Most fiction targets grades 4–8.`,
    });
  }

  return {
    scores: {
      fleschKincaidGrade: Math.round(fleschKincaidGrade * 10) / 10,
      fleschReadingEase: Math.round(fleschReadingEase * 10) / 10,
    },
      metrics: {
        wordCount,
        sentenceCount,
        syllableCount,
        paragraphCount,
        avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
        avgSyllablesPerWord: Math.round(avgSyllablesPerWord * 100) / 100,
        avgSentencesPerParagraph: Math.round(avgSentencesPerParagraph * 10) / 10,
        charCount,
        charCountNoSpaces,
        gradeLevel: Math.round(fleschKincaidGrade * 10) / 10,
      },
    flagged: {
      longSentences,
      shortSentences,
      denseParagraphs,
    },
    issues,
    interpretation: getInterpretation(fleschReadingEase)
  };
}

function getInterpretation(score) {
  if (score > 90) return "Very Easy (5th Grade)";
  if (score > 80) return "Easy (6th Grade)";
  if (score > 70) return "Fairly Easy (7th Grade)";
  if (score > 60) return "Standard (8th-9th Grade)";
  if (score > 50) return "Fairly Difficult (High School)";
  if (score > 30) return "Difficult (College)";
  return "Very Difficult (Graduate)";
}
