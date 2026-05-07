/**
 * modeRules.js
 * 
 * Logic for determining mode availability, lock reasons, and configuration warnings.
 * Extracted from App.jsx to reduce monolith complexity.
 */

export const getModeConfigWarnings = (mode, envStatusState) => {
  const warnings = [];
  
  if (mode === "CREATE") {
    if (!envStatusState.openai) {
      warnings.push("Create mode needs `VITE_OPENAI_KEY` in `proselab/.env`.");
    }
  }
  
  if (["ANALYSE", "ENGINEER", "MARKET", "VERDICT"].includes(mode) && !envStatusState.openai) {
    warnings.push(`${mode} mode needs \`VITE_OPENAI_KEY\` in \`proselab/.env\`.`);
  }
  
  return warnings;
};

export const getModeLockReason = (mode, { text, lastAnalyzedText, modeFeedback }) => {
  if (mode === "ENGINEER") {
    const hasFeedback = Object.keys(modeFeedback.ANALYSE || {}).length > 0;
    const hasEdited = text.trim() !== lastAnalyzedText.trim();
    
    if (!hasFeedback) return "Run ANALYSE first to generate Margaret and Rafael feedback.";
    if (!hasEdited) return "Edit the text after ANALYSE before starting ENGINEER.";
  }
  
  if (mode === "VERDICT") {
    if (Object.keys(modeFeedback.ANALYSE || {}).length === 0) return "Run ANALYSE before requesting VERDICT.";
    if (Object.keys(modeFeedback.ENGINEER || {}).length === 0) return "Run ENGINEER before requesting VERDICT.";
  }
  
  return "";
};

export const getModeInfo = (mode, state) => {
  if (!state) return { configWarnings: [], lockReason: "", isConfigReady: false, isLocked: false };
  const configWarnings = getModeConfigWarnings(mode, state.envStatusState);

  const lockReason = getModeLockReason(mode, state);
  
  return {
    configWarnings,
    lockReason,
    isConfigReady: configWarnings.length === 0,
    isLocked: Boolean(lockReason),
  };
};
