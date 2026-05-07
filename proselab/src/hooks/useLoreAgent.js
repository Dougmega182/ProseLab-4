// src/hooks/useLoreAgent.js
import { useState, useCallback, useMemo, useEffect } from 'react';
import { extractEntities, buildExtractionPrompt, normalizeLoreOutput, chunkText } from '../engine/lore/extractionEngine';
import { runConsistencyChecks, autoFixIssues } from '../engine/lore/consistencyChecker';
import { getLoreStore } from '../engine/lore/loreStore';
import { callOpenAI } from '../services/llm';

// Use the singleton instance
const globalLoreStore = getLoreStore();

export function useLoreAgent(projectData, onProjectUpdate) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [foundEntities, setFoundEntities] = useState([]);
  const [foundRelationships, setFoundRelationships] = useState([]);
  const [issues, setIssues] = useState([]);
  const [error, setError] = useState(null);

  // Sync store with project data on load
  useEffect(() => {
    if (projectData?.lore) {
      globalLoreStore.import(projectData.lore);
    }
  }, [projectData?.id]);

  const lore = useMemo(() => globalLoreStore.entities, [globalLoreStore.entities, projectData?.lore]);
  const relationships = useMemo(() => globalLoreStore.relationships, [globalLoreStore.relationships]);

  /**
   * Scans text segments and updates found entities
   */
  const scanText = useCallback(async (text, options = {}) => {
    const { useLLM = true, minConfidence = 0.4 } = options;
    
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setError(null);

    try {
      // Chunk text for better performance and LLM context limits
      const chunks = chunkText(text, 3000);
      let allNewEntities = [];
      let allNewRels = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        setAnalysisProgress(Math.round((i / chunks.length) * 50));

        // Pass 1: Heuristic extraction
        const { entities, relationships } = extractEntities(chunk, { minConfidence });
        allNewEntities.push(...entities);
        allNewRels.push(...relationships);

        if (useLLM) {
          // Pass 2: LLM Refinement for specific high-confidence candidates
          // We only refine the most promising candidates to save tokens
          const topCandidates = entities.filter(e => e.confidence > 0.6).slice(0, 5);
          if (topCandidates.length > 0) {
            const prompt = buildExtractionPrompt(chunk, topCandidates);
            const response = await callOpenAI(prompt, { temperature: 0.1, response_format: { type: 'json_object' } });
            const refined = normalizeLoreOutput(response);
            
            // Update confidence and attributes for refined entities
            refined.forEach(r => {
              const idx = allNewEntities.findIndex(e => e.name.toLowerCase() === r.name.toLowerCase());
              if (idx !== -1) {
                allNewEntities[idx] = { ...allNewEntities[idx], ...r, confidence: 0.95 };
              }
            });
          }
        }
      }

      setAnalysisProgress(90);
      
      // Deduplicate result set
      const seen = new Set();
      const uniqueEntities = allNewEntities.filter(e => {
        const key = e.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setFoundEntities(uniqueEntities);
      setFoundRelationships(allNewRels);
      
      // Check for consistency issues in the new set
      const checkResults = runConsistencyChecks(uniqueEntities, allNewRels);
      setIssues(checkResults.issues);

      setAnalysisProgress(100);
      return { entities: uniqueEntities, relationships: allNewRels };

    } catch (err) {
      setError(`Scan failed: ${err.message}`);
      console.error(err);
      return { entities: [], relationships: [] };
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  /**
   * Commits selected entities to the permanent store
   */
  const commitEntities = useCallback((entitiesToCommit) => {
    const currentStore = globalLoreStore.export();
    const updatedEntities = [...currentStore.entities];
    
    entitiesToCommit.forEach(entity => {
      const idx = updatedEntities.findIndex(e => e.name.toLowerCase() === entity.name.toLowerCase());
      if (idx !== -1) {
        updatedEntities[idx] = { ...updatedEntities[idx], ...entity, verified: true };
      } else {
        updatedEntities.push({ ...entity, verified: true });
      }
    });

    globalLoreStore.setEntities(updatedEntities);
    
    // Update project state
    if (onProjectUpdate) {
      onProjectUpdate({
        ...projectData,
        lore: globalLoreStore.export()
      });
    }

    // Clear committed from found list
    setFoundEntities(prev => prev.filter(p => !entitiesToCommit.find(e => e.name === p.name)));
  }, [projectData, onProjectUpdate]);

  const runMaintenance = useCallback(() => {
    const results = runConsistencyChecks(globalLoreStore.entities, globalLoreStore.relationships);
    setIssues(results.issues);
    return results;
  }, []);

  const applyFixes = useCallback(() => {
    const results = autoFixIssues(issues, globalLoreStore.entities, globalLoreStore.relationships);
    globalLoreStore.setEntities(results.entities);
    globalLoreStore.setRelationships(results.relationships);
    
    if (onProjectUpdate) {
      onProjectUpdate({
        ...projectData,
        lore: globalLoreStore.export()
      });
    }
    
    setIssues([]); // Clear issues after fixing
    return results.fixed;
  }, [issues, projectData, onProjectUpdate]);

  return {
    lore,
    relationships,
    foundEntities,
    issues,
    isAnalyzing,
    analysisProgress,
    error,
    scanText,
    commitEntities,
    runMaintenance,
    applyFixes,
    removeFoundEntity: (name) => setFoundEntities(prev => prev.filter(e => e.name !== name)),
    updateFoundEntity: (name, updates) => setFoundEntities(prev => prev.map(e => e.name === name ? { ...e, ...updates } : e))
  };
}
