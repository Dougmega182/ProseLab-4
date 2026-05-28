// index.js — ProseLab V2 Analysis Orchestrator
// Runs all analyzers and produces a unified report object

import { analyzeReadability } from './analyzers/readability.js';
import { analyzeFlow } from './analyzers/flow.js';
import { analyzeStyle } from './analyzers/style.js';

/**
 * Merge and deduplicate issues by offset to prevent
 * overlapping highlights in the editor
 */
function deduplicateIssues(issues) {
  const seen = new Map();

  for (const issue of issues) {
    if (issue.offset === null) continue;
    const key = `${issue.offset}:${issue.length}:${issue.type}`;
    if (!seen.has(key)) {
      seen.set(key, issue);
    } else {
      // Keep the higher-severity version
      const existing = seen.get(key);
      const rank = { high: 3, medium: 2, low: 1 };
      if ((rank[issue.severity] || 0) > (rank[existing.severity] || 0)) {
        seen.set(key, issue);
      }
    }
  }

  return Array.from(seen.values()).sort((a, b) => (a.offset || 0) - (b.offset || 0));
}

/**
 * Compute an overall prose score (0–100)
 * Weighted blend of sub-scores
 */
function computeOverallScore(readability, flow, style) {
  const weights = {
    readability: 0.30,
    flow: 0.25,
    style: 0.45,
  };

  const gradeLevel = readability.metrics.gradeLevel || 8;
  let readabilityScore;
  if (gradeLevel >= 4 && gradeLevel <= 8) {
    readabilityScore = 100;
  } else if (gradeLevel < 4) {
    readabilityScore = Math.max(0, 100 - (4 - gradeLevel) * 15);
  } else {
    readabilityScore = Math.max(0, 100 - (gradeLevel - 8) * 10);
  }

  const flowScore = flow.metrics.rhythmScore || 50;

  const severityPenalty = { high: 5, medium: 3, low: 1 };
  const totalWords = readability.metrics.wordCount || 1;
  const rawPenalty = style.issues.reduce((sum, issue) => {
    return sum + (severityPenalty[issue.severity] || 1);
  }, 0);
  
  const penaltyPer100 = (rawPenalty / totalWords) * 100;
  const styleScore = Math.max(0, Math.round(100 - penaltyPer100 * 4));

  const overall = Math.round(
    readabilityScore * weights.readability +
    flowScore * weights.flow +
    styleScore * weights.style
  );

  return {
    overall: Math.min(100, Math.max(0, overall)),
    breakdown: {
      readability: Math.round(readabilityScore),
      flow: Math.round(flowScore),
      style: Math.round(styleScore),
    },
  };
}

/**
 * Generate summary insights — top-level takeaways
 */
function generateInsights(readability, flow, style, score) {
  const insights = [];

  // Readability insights
  const grade = readability.metrics.gradeLevel;
  if (grade > 10) {
    insights.push({
      category: 'readability',
      severity: 'high',
      message: `Grade level ${grade.toFixed(1)} is well above fiction target (4–8). Shorten sentences and simplify vocabulary.`,
    });
  } else if (grade > 8) {
    insights.push({
      category: 'readability',
      severity: 'medium',
      message: `Grade level ${grade.toFixed(1)} is slightly above target. Consider trimming your longest sentences.`,
    });
  } else {
    insights.push({
      category: 'readability',
      severity: 'info',
      message: `Grade level ${grade.toFixed(1)} — right in the sweet spot for fiction.`,
    });
  }

  // Flow insights
  const rhythm = flow.metrics.rhythmScore;
  if (rhythm < 30) {
    insights.push({
      category: 'flow',
      severity: 'high',
      message: 'Sentence lengths are very uniform. Vary your rhythm — mix short punches with longer, flowing lines.',
    });
  } else if (rhythm > 90) {
    insights.push({
      category: 'flow',
      severity: 'medium',
      message: 'Sentence lengths swing wildly. Some variation is great, but too much can feel chaotic.',
    });
  }

  if (flow.metrics.monotonyRuns && flow.metrics.monotonyRuns.length > 0) {
    insights.push({
      category: 'flow',
      severity: 'medium',
      message: `${flow.metrics.monotonyRuns.length} monotonous passage(s) detected where sentences drone at similar lengths. Break the pattern with a sharp, short sentence or a longer, winding one.`,
    });
  }

  if (flow.metrics.jarringTransitions && flow.metrics.jarringTransitions.length > 0) {
    insights.push({
      category: 'flow',
      severity: 'low',
      message: `${flow.metrics.jarringTransitions.length} jarring transition(s) found — abrupt jumps in sentence length. Add a bridging sentence to smooth the shift.`,
    });
  }

  // Style insights
  const passiveCount = style.issues.filter(i => i.type === 'passive-voice').length;
  const adverbCount = style.issues.filter(i => i.type === 'adverb').length;
  const clicheCount = style.issues.filter(i => i.type === 'cliche').length;
  const hiddenCount = style.issues.filter(i => i.type === 'hidden-verb').length;

  if (passiveCount > 0) {
    const density = ((passiveCount / (readability.metrics.sentenceCount || 1)) * 100).toFixed(1);
    insights.push({
      category: 'style',
      severity: passiveCount > 5 ? 'high' : 'medium',
      message: `${passiveCount} passive voice construction(s) found (${density}% of sentences). Active voice drives stronger prose.`,
    });
  }

  if (adverbCount > 0) {
    insights.push({
      category: 'style',
      severity: adverbCount > 8 ? 'high' : adverbCount > 3 ? 'medium' : 'low',
      message: `${adverbCount} adverb(s) flagged. Replace with stronger verbs to show rather than tell.`,
    });
  }

  if (clicheCount > 0) {
    insights.push({
      category: 'style',
      severity: 'medium',
      message: `${clicheCount} cliché(s) detected. Find fresh imagery that belongs to your story's world.`,
    });
  }

  if (style.metrics.fillerRatio > 0.05) {
    insights.push({
      category: 'style',
      severity: 'medium',
      message: `High filler word density (${(style.metrics.fillerRatio * 100).toFixed(1)}%). Cut words like "very," "really," and "just" to tighten your prose.`,
    });
  }

  // Overall praise or encouragement
  if (score.overall >= 85) {
    insights.unshift({
      category: 'overall',
      severity: 'info',
      message: `Score: ${score.overall}/100 — Excellent. This prose is clean, rhythmic, and readable.`,
    });
  } else if (score.overall >= 65) {
    insights.unshift({
      category: 'overall',
      severity: 'info',
      message: `Score: ${score.overall}/100 — Solid draft. Focus on the top issues below to refine your style.`,
    });
  } else {
    insights.unshift({
      category: 'overall',
      severity: 'medium',
      message: `Score: ${score.overall}/100 — This draft needs revision. Start with high-severity items and work down.`,
    });
  }

  return insights;
}

/**
 * Main analysis entry point
 */
export { analyze as generateReport };
export function analyze(text, options = {}) {
  const config = {
    targetGradeMin: 4,
    targetGradeMax: 8,
    monotonyWindow: 5,
    jarringThreshold: 3.0,
    ...options,
  };

  if (!text || text.trim().length === 0) {
    return {
      score: { overall: 0, breakdown: { readability: 0, flow: 0, style: 0 } },
      metrics: { readability: {}, flow: {}, style: {} },
      issues: [],
      insights: [{ category: 'overall', severity: 'info', message: 'No text to analyze.' }],
      timestamp: new Date().toISOString()
    };
  }

  const readability = analyzeReadability(text, config);
  const flow = analyzeFlow(text, config);
  const style = analyzeStyle(text, config);

  const score = computeOverallScore(readability, flow, style);
  const insights = generateInsights(readability, flow, style, score);
  
  const allIssues = deduplicateIssues([
    ...readability.issues,
    ...flow.issues,
    ...style.issues,
  ]);

  return {
    score,
    metrics: {
      readability: readability.metrics,
      flow: flow.metrics,
      style: style.metrics,
    },
    issues: allIssues,
    insights,
    timestamp: new Date().toISOString()
  };
}
