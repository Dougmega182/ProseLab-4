/**
 * NARRATIVE COMPILER
 * Role: Convert structured narrative blocks into final prose.
 * Goal: Ensure structural consistency and rhythmic flow.
 */

export const SCENE_PHASES = [
  "phase_1_physical",
  "phase_2_confusion",
  "phase_3_clue",
  "phase_4_realisation",
  "phase_5_expansion"
];

export function compileScene(scene) {
  const b = scene?.narrative || {};
  return SCENE_PHASES
    .map(phase => b[phase] || "")
    .filter(Boolean)
    .join("\n\n");
}
