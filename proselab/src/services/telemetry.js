/**
 * NARRATIVE TELEMETRY
 * Role: Instrument and measure prose quality and structural integrity.
 * Goal: Detect degradation and drift during iterative cycles.
 */

export function scorePhaseIntegrity(blocks = {}) {
  const scores = {
    physical: blocks.phase_1_physical?.length > 0 ? 1 : 0,
    confusion: /\?/.test(blocks.phase_2_confusion || "") ? 1 : 0,
    clue: /noticed|saw|heard|felt|caught|smelled|tasted/i.test(blocks.phase_3_clue || "") ? 1 : 0,
    realisation: /realised|clicked|that’s when|knew|understood/i.test(blocks.phase_4_realisation || "") ? 1 : 0,
    expansion: (blocks.phase_5_expansion?.length || 0) > 40 ? 1 : 0
  };
  
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  return { scores, total };
}

export function redundancyScore(blocks = {}) {
  const all = Object.values(blocks).join(" ").toLowerCase();
  const words = all.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return 0;
  const unique = new Set(words);
  return 1 - unique.size / words.length; // higher = more redundant
}

export function totalLength(blocks = {}) {
  return Object.values(blocks).join(" ").length;
}

export function getSceneMetrics(scene) {
  const blocks = scene.narrative || {};
  const integrity = scorePhaseIntegrity(blocks);
  return {
    rev: scene._rev,
    integrity: integrity.total,
    integrityDetail: integrity.scores,
    redundancy: redundancyScore(blocks).toFixed(4),
    length: totalLength(blocks)
  };
}
