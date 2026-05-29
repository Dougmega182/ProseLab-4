// @ts-nocheck
export const CLICHES = [
  "a testament to", "palpable", "not just", "but also", 
  "shattered", "piercing", "heart pounded", "breath hitched", 
  "let out a breath she didn't know she was holding",
  "eyes widened", "jaw tightened", "blood ran cold",
  "spine tingled", "sent shivers", "couldn't help but",
  "a symphony of", "a cacophony of", "dance of",
  "toxic", "validate", "process", "gaslight", "boundaries", "closure"
];

export function splitSentences(text) { 
  return text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean); 
}

export function detectCliches(text) {
  const lowerText = text.toLowerCase();
  const matches = CLICHES.filter(c => lowerText.includes(c));
  return {
    count: matches.length,
    matched: matches,
    density: matches.length / (text.split(/\s+/).length || 1)
  };
}

export function analyzeRhythm(text) {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return { varianceScore: 0, isUniform: false };
  
  const lengths = sentences.map(s => s.split(/\s+/).length);
  const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  
  // Calculate variance
  const squareDiffs = lengths.map(l => Math.pow(l - avg, 2));
  const variance = squareDiffs.reduce((a, b) => a + b, 0) / lengths.length;
  const stdDev = Math.sqrt(variance);
  
  // A low standard deviation means all sentences are the same length (highly uniform/robotic)
  const isUniform = stdDev < 4.0; 
  
  return { 
    stdDev: parseFloat(stdDev.toFixed(2)),
    avgLength: parseFloat(avg.toFixed(2)),
    isUniform
  };
}

export function analyzeEmotion(text) {
  const words = text.toLowerCase().split(/\s+/);
  const wc = words.length || 1;
  const abstractWords = ["felt", "fear", "sad", "angry", "happy", "despair", "thought", "knew", "realized", "wanted", "anxiety", "depression", "joy"];
  const bodyWords = ["stomach", "hands", "breath", "jaw", "pulse", "skin", "sweat", "shiver", "chest", "throat", "muscle", "blood"];
  
  let abs = 0, phys = 0;
  words.forEach(w => {
    if (abstractWords.some(aw => w.includes(aw))) abs++;
    if (bodyWords.some(bw => w.includes(bw))) phys++;
  });
  
  return { 
    abstractCount: abs,
    physicalCount: phys,
    ratio: abs / ((phys + abs) || 1),
    isOverlyAbstract: abs > 0 && phys === 0 || (abs / ((phys + abs) || 1)) > 0.6
  };
}

export function analyzeDialogueSymmetry(text) {
  const sentences = splitSentences(text);
  let dialogueLines = 0;
  let actionLines = 0;
  
  sentences.forEach(s => {
    if (s.includes('"') || s.includes("'")) {
      dialogueLines++;
    } else {
      actionLines++;
    }
  });

  const totalLines = dialogueLines + actionLines;
  if (totalLines === 0) return { isPingPong: false };

  // If >80% of lines are purely dialogue, it might be ping-ponging without subtext/action
  const dialogueRatio = dialogueLines / totalLines;
  const isPingPong = dialogueRatio > 0.8;

  return {
    dialogueRatio: parseFloat(dialogueRatio.toFixed(2)),
    isPingPong
  };
}

export function runHeuristics(text) {
  return {
    cliches: detectCliches(text),
    rhythm: analyzeRhythm(text),
    emotion: analyzeEmotion(text),
    dialogue: analyzeDialogueSymmetry(text)
  };
}
