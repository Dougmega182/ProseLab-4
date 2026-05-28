/**
 * Simple Emitter
 * Browser-compatible alternative to Node's EventEmitter.
 */
class SimpleEmitter {
  constructor() {
    this.listeners = {};
  }
  on(event, fn) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }
  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(fn => fn(data));
    }
  }
  removeAllListeners() {
    this.listeners = {};
  }
}

/**
 * usePipeline Hook
 * Provides a reactive interface for the GenerationPipeline.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { GenerationPipeline } from '../engine/pipeline.js';
import { db } from '../db/index.js';
import { ProviderManager } from '../providers/index.js';

// Create a singleton ProviderManager using env keys
const providerConfig = {
  openai: { apiKey: import.meta.env.VITE_OPENAI_KEY },
  anthropic: { apiKey: import.meta.env.VITE_ANTHROPIC_KEY },
  gemini: { apiKey: import.meta.env.VITE_GEMINI_KEY },
  ollama: { baseUrl: import.meta.env.VITE_OLLAMA_URL || 'http://127.0.0.1:11434' },
  modelAssignments: {
    generation: import.meta.env.VITE_OLLAMA_MODEL || 'llama3',
    validation: 'gpt-4o-mini',
    critique: 'gpt-4o',
    extraction: 'gpt-4o-mini',
    analysis: 'gpt-4o',
    utility: 'gpt-4o-mini'
  }
};

const providers = new ProviderManager(providerConfig);
const emitter = new SimpleEmitter();

export function usePipeline() {
  const [status, setStatus] = useState('idle'); // idle | running | complete | error
  const [currentStage, setCurrentStage] = useState(null);
  const [stages, setStages] = useState({});
  const [prose, setProse] = useState('');
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);

  const pipeline = useMemo(() => new GenerationPipeline(db, providers, emitter), []);

  useEffect(() => {
    emitter.on('pipeline:start', ({ stages }) => {
      setStatus('running');
      setError(null);
      setResults(null);
      setProse('');
      const stageMap = {};
      stages.forEach(s => stageMap[s] = { status: 'pending' });
      setStages(stageMap);
    });

    emitter.on('pipeline:stage', ({ stage, status }) => {
      setCurrentStage(stage);
      setStages(prev => ({
        ...prev,
        [stage]: { ...prev[stage], status }
      }));
    });

    emitter.on('pipeline:stream', ({ content }) => {
      setProse(prev => prev + content);
    });

    emitter.on('pipeline:prose', ({ prose }) => {
      setProse(prose);
    });

    emitter.on('pipeline:validation', ({ result }) => {
      setStages(prev => ({
        ...prev,
        validate: { ...prev.validate, result }
      }));
    });

    emitter.on('pipeline:critique', ({ result }) => {
      setStages(prev => ({
        ...prev,
        critique: { ...prev.critique, result }
      }));
    });

    emitter.on('pipeline:shadowActions', ({ actions }) => {
      setStages(prev => ({
        ...prev,
        extract: { ...prev.extract, actionCount: actions.length }
      }));
    });

    emitter.on('pipeline:complete', (summary) => {
      setStatus('complete');
      setCurrentStage(null);
      setResults(summary);
    });

    emitter.on('pipeline:error', ({ error, stage }) => {
      setStatus('error');
      setError({ message: error, stage });
    });

    return () => emitter.removeAllListeners();
  }, []);

  const run = useCallback(async (sceneId, options = {}) => {
    try {
      return await pipeline.generateScene(sceneId, options);
    } catch (e) {
      console.error('Pipeline execution failed:', e);
      // Status and Error are handled by emitter listeners
    }
  }, [pipeline]);

  return {
    run,
    status,
    currentStage,
    stages,
    prose,
    error,
    results
  };
}
