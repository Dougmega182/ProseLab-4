// flow.js — Rhythmic flow analyzer
// Analyzes sentence length variation, rhythm patterns, pacing,
// and flags monotonous or jarring sequences

import { countSyllables, splitSentences } from './readability.js';

function tokenize(text) {
  return text.match(/\b[a-zA-Z''\-]+\b/g) || [];
}

/**
 * Classify sentence length into a rhythm "beat"
 */
function classifyBeat(wordCount) {
  if (wordCount <= 5) return 'staccato'; // punchy, short
  if (wordCount <= 12) return 'short'; // brisk
  if (wordCount <= 20) return 'medium'; // standard
  if (wordCount <= 35) return 'long'; // flowing
  return 'sprawling'; // needs attention
}

/**
 * Calculate standard deviation for an array of numbers
 */
function standardDeviation(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => (v - mean) * (v - mean));
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
}

/**
 * Detect monotonous runs — sequences where sentence lengths
 * stay within a narrow band (low variation)
 */
function detectMonotony(sentenceLengths, windowSize = 5) {
  const runs = [];
  if (sentenceLengths.length < windowSize) return runs;

  for (let i = 0; i <= sentenceLengths.length - windowSize; i++) {
    const window = sentenceLengths.slice(i, i + windowSize);
    const sd = standardDeviation(window);
    const mean = window.reduce((a, b) => a + b, 0) / window.length;

    // Coefficient of variation < 0.15 = monotonous
    const cv = mean > 0 ? sd / mean : 0;
    if (cv < 0.15) {
      // Avoid overlapping runs — extend existing if adjacent
      const last = runs[runs.length - 1];
      if (last && last.end >= i) {
        last.end = i + windowSize - 1;
        last.lengths = sentenceLengths.slice(last.start, last.end + 1);
      } else {
        runs.push({
          start: i,
          end: i + windowSize - 1,
          lengths: window,
          avgLength: Math.round(mean * 10) / 10,
          cv: Math.round(cv * 1000) / 1000,
        });
      }
    }
  }
  return runs;
}

/**
 * Detect jarring transitions — large jumps in sentence length
 */
function detectJarringTransitions(sentenceLengths, threshold = 3.0) {
  const transitions = [];
  if (sentenceLengths.length < 2) return transitions;

  const mean = sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length;
  const sd = standardDeviation(sentenceLengths);
  if (sd === 0) return transitions;

  for (let i = 1; i < sentenceLengths.length; i++) {
    const diff = Math.abs(sentenceLengths[i] - sentenceLengths[i - 1]);
    const zDiff = diff / sd;

    if (zDiff > threshold) {
      transitions.push({
        index: i,
        from: sentenceLengths[i - 1],
        to: sentenceLengths[i],
        delta: diff,
        zScore: Math.round(zDiff * 100) / 100,
      });
    }
  }
  return transitions;
}

/**
 * Calculate a rhythm variance score (0–100)
 * Higher = more varied = generally better prose rhythm
 */
function rhythmScore(sentenceLengths) {
  if (sentenceLengths.length < 3) return 50; // neutral for tiny samples

  const sd = standardDeviation(sentenceLengths);
  const mean = sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length;
  const cv = mean > 0 ? sd / mean : 0;

  // Map CV to a 0–100 score
  // CV of ~0.4–0.6 is ideal for prose; too low = monotonous, too high = chaotic
  if (cv < 0.1) return Math.round(cv * 200); // 0–20: very monotonous
  if (cv < 0.25) return Math.round(20 + (cv - 0.1) * 200); // 20–50
  if (cv < 0.5) return Math.round(50 + (cv - 0.25) * 160); // 50–90
  if (cv < 0.7) return Math.round(90 + (cv - 0.5) * 50); // 90–100
  return Math.max(100 - Math.round((cv - 0.7) * 100), 40); // declining past 0.7
}

/**
 * Compute syllabic density per sentence for pacing analysis
 */
function syllabicPacing(sentences) {
  return sentences.map(s => {
    const words = tokenize(s);
    if (words.length === 0) return 0;
    const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
    return Math.round((syllables / words.length) * 100) / 100;
  });
}

export function analyzeFlow(text) {
  if (!text || text.trim().length === 0) {
    return {
      metrics: { variance: 0, rhythmScore: 0, avgSyllablesPerWord: 0 },
      patterns: [],
      monotony: [],
      jarring: [],
    };
  }

  const sentences = splitSentences(text);
  const sentenceLengths = sentences.map(s => tokenize(s).length);
  const pacing = syllabicPacing(sentences);
  
  const score = rhythmScore(sentenceLengths);
  const monotony = detectMonotony(sentenceLengths);
  const jarring = detectJarringTransitions(sentenceLengths);
  
  const beats = sentenceLengths.map(classifyBeat);

  const issues = [
    ...monotony.map(m => ({
      type: 'monotonous-passage',
      severity: 'medium',
      offset: null, // Index-based in current impl
      message: `Monotonous passage (sentences ${m.start + 1}-${m.end + 1}) detected.`,
      data: m
    })),
    ...jarring.map(j => ({
      type: 'jarring-transition',
      severity: 'low',
      offset: null,
      message: `Jarring length jump between sentences ${j.index} and ${j.index + 1}.`,
      data: j
    }))
  ];

  return {
    metrics: {
      variance: Math.round(standardDeviation(sentenceLengths) * 10) / 10,
      rhythmScore: score,
      avgSyllablesPerWord: Math.round((pacing.reduce((a, b) => a + b, 0) / Math.max(1, pacing.length)) * 100) / 100,
      monotonyRuns: monotony,
      jarringTransitions: jarring,
    },
    patterns: beats,
    issues,
    sentenceLengths,
    syllabicPacing: pacing
  };
}
