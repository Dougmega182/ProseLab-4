import { runPipeline, ENGINE_FLAGS } from "../pipeline.js";
import { callCritic } from "../critic.js";

/**
 * ProseLab Engine V1 Decision API.
 * This version freezes the decision semantics and schema for production stability.
 */
export const EngineV1 = {
  version: "1.0.0",
  
  async evaluate(params) {
    const v1Flags = {
      ...ENGINE_FLAGS,
      MAX_ITERATIONS: 3
    };
    
    return runPipeline({
      ...params,
      onStage: params.onStage || (() => {}),
      flags: v1Flags
    });
  },

  async critique(params) {
    return callCritic(params);
  }
};
