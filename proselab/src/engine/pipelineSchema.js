// @ts-nocheck
export const PIPELINE_SCHEMA = {
  stages: {
    analysis: {
      shape: "{ rhythm: object, emotion: object, specificity: object }",
      validate: (data) => {
        if (!data || typeof data !== "object") return false;
        if (!data.rhythm || typeof data.rhythm !== "object") return false;
        if (!data.emotion || typeof data.emotion !== "object") return false;
        if (!data.specificity || typeof data.specificity !== "object") return false;
        return true;
      }
    },
    delta: {
      shape: "string[]",
      validate: (data) => Array.isArray(data) && data.every(item => typeof item === "string")
    },
    ollama: {
      shape: "string",
      validate: (data) => typeof data === "string" && data.trim().length > 0
    },
    openai: {
      shape: "string",
      validate: (data) => typeof data === "string" && data.trim().length > 0
    },
    gemini: {
      shape: "string",
      validate: (data) => typeof data === "string" && data.trim().length > 0
    }
  },
  transitions: {
    "analysis->delta": {
      validate: (analysisData, deltaData) => {
        // Delta must be generated and be an array of strings
        if (!Array.isArray(deltaData) || deltaData.length === 0) return false;
        return true;
      }
    },
    "delta->ollama": {
      validate: (deltaData, ollamaData) => {
        // Ollama output must be a non-empty string
        if (typeof ollamaData !== "string" || ollamaData.trim().length === 0) return false;
        return true;
      }
    }
  }
};

export function validateStage(stageName, data) {
  const schema = PIPELINE_SCHEMA.stages[stageName];
  if (!schema) {
    throw new Error(`Pipeline Schema Error: Unknown stage '${stageName}'`);
  }
  const isValid = schema.validate(data);
  if (!isValid) {
    throw new Error(`Pipeline Schema Error: Stage '${stageName}' violated contract. Expected shape: ${schema.shape}`);
  }
}

export function validateTransition(fromStage, toStage, fromData, toData) {
  const transitionKey = `${fromStage}->${toStage}`;
  const transition = PIPELINE_SCHEMA.transitions[transitionKey];
  
  if (transition) {
    const isValid = transition.validate(fromData, toData);
    if (!isValid) {
      throw new Error(`Pipeline Schema Error: Transition contract violated between '${fromStage}' and '${toStage}'.`);
    }
  }
}
