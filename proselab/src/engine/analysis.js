export const TARGET = {
  rhythm: { shortRatio: 0.2, variance: "high" },
  emotion: { physicalRatio: 0.8 },
  specificity: { concreteRatio: 0.7 }
};

export function splitSentences(text) { 
  return text.split(/[.!?]+/).map(s => s.trim()).filter(Boolean); 
}

export function analyzeRhythm(text) {
  const sentences = splitSentences(text);
  const lengths = sentences.map(s => s.split(" ").length);
  const short = lengths.filter(l => l <= 6).length;
  const avg = lengths.reduce((a, b) => a + b, 0) / (lengths.length || 1);
  const variance = Math.max(...lengths) - Math.min(...lengths);
  return { shortRatio: short / (lengths.length || 1), variance: variance > 10 ? "high" : "low", avg };
}

export function analyzeEmotion(text) {
  const words = text.toLowerCase().split(/\s+/);
  const wc = words.length || 1;
  const abstractWords = ["felt", "fear", "sad", "angry", "happy", "despair", "thought", "knew", "realized", "wanted"];
  const bodyWords = ["stomach", "hands", "breath", "jaw", "pulse", "skin", "sweat", "shiver", "chest", "throat"];
  let abs = 0, phys = 0;
  words.forEach(w => {
    if (abstractWords.some(aw => w.includes(aw))) abs++;
    if (bodyWords.some(bw => w.includes(bw))) phys++;
  });
  return { physicalRatio: phys / ((phys + abs) || 1), totalDensity: (phys + abs) / wc };
}

export function analyzeSpecificity(text) {
  const words = text.toLowerCase().split(/\s+/);
  const wc = words.length || 1;
  const vague = ["thing", "stuff", "something", "everything", "place", "area", "someone", "somehow", "somewhere"];
  let v = 0;
  words.forEach(w => {
    if (vague.some(vw => w.includes(vw))) v++;
  });
  const vagueRatio = v / wc;
  return { concreteRatio: Math.max(0, 1 - (vagueRatio * 20)) };
}

export function analyze(text) {
  return { 
    rhythm: analyzeRhythm(text), 
    emotion: analyzeEmotion(text), 
    specificity: analyzeSpecificity(text),
    wordCount: text.trim().split(/\s+/).length
  };
}

export function buildDelta(a) {
  const instructions = [];
  if (a.rhythm.shortRatio < TARGET.rhythm.shortRatio) instructions.push("Introduce more short, blunt sentences (6 words or fewer)");
  if (a.rhythm.variance !== "high") instructions.push("Increase sentence length variation dramatically");
  if (a.emotion.physicalRatio < TARGET.emotion.physicalRatio) instructions.push("Replace abstract emotions with physical reactions");
  if (a.specificity.concreteRatio < TARGET.specificity.concreteRatio) instructions.push("Replace vague words with concrete sensory detail");
  return instructions;
}
