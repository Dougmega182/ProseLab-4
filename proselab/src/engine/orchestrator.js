/**
 * Pipeline Orchestrator
 * Manages the multi-agent editorial loop: Generate -> Validate -> Critique -> Approved.
 * Handles retries, revision instructions, and post-approval lore extraction.
 */

import { generateScene } from './generator.js';
import { validateScene } from './validator.js';
import { Providers } from './providers.js';

export class Pipeline {
  constructor(config) {
    this.keys = config.keys;
    this.models = config.models;
    this.providers = new Providers(this.keys, this.models);
    this.onStatusChange = config.onStatusChange || (() => {});
    this.onStageComplete = config.onStageComplete || (() => {});
    this.maxRetries = config.maxRetries || 3;
  }

  async run(sceneConfig) {
    let attempts = 0;
    let currentAttempt = null;
    let validationFeedback = null;
    let revisionInstructions = sceneConfig.revisionInstructions || null;
    
    const trace = {
      id: crypto.randomUUID(),
      sceneId: sceneConfig.sceneId,
      attempts: [],
      startedAt: Date.now()
    };

    while (attempts < this.maxRetries) {
      attempts++;
      this.onStatusChange({ stage: 'generation', status: 'running', attempt: attempts });
      
      // Step 1: Generate (or Revise)
      const genConfig = {
        ...sceneConfig,
        previousAttempt: currentAttempt,
        validationFeedback: validationFeedback,
        revisionInstructions: revisionInstructions
      };

      const generation = await generateScene(genConfig, this.providers);
      currentAttempt = generation.prose;
      
      this.onStageComplete({ stage: 'generation', result: generation, attempt: attempts });

      // Step 2: Validate
      this.onStatusChange({ stage: 'validation', status: 'running', attempt: attempts });
      
      const validation = await validateScene(currentAttempt, sceneConfig, this.providers);
      this.onStageComplete({ stage: 'validation', result: validation, attempt: attempts });

      if (validation.passed) {
        // SUCCESS: The scene is semantically aligned
        trace.status = 'approved';
        trace.finalProse = currentAttempt;
        trace.completedAt = Date.now();
        
        this.onStatusChange({ stage: 'complete', status: 'approved' });
        
        return {
          status: 'approved',
          prose: currentAttempt,
          validation,
          trace
        };
      }

      // FAILURE: Validation failed, prepare for retry
      validationFeedback = validation.violations;
      revisionInstructions = null; // Clear manual instructions once the loop takes over
      
      trace.attempts.push({
        attempt: attempts,
        prose: currentAttempt,
        validation
      });

      if (attempts >= this.maxRetries) {
        break;
      }
      
      this.onStatusChange({ stage: 'retrying', status: 'running', attempt: attempts });
    }

    // EXHAUSTED: Max retries reached without validation pass
    trace.status = 'failed';
    trace.completedAt = Date.now();
    
    this.onStatusChange({ stage: 'complete', status: 'failed' });

    return {
      status: 'failed',
      prose: currentAttempt, // Return the last attempt anyway
      validationFeedback,
      trace
    };
  }
}
