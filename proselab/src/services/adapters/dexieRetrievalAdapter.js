/**
 * dexieRetrievalAdapter.js
 * 
 * Concrete retrieval adapter backing the retrievalService with IndexedDB storage via Dexie (db.js).
 * Enforces the boundary that IndexedDB querying only happens inside this adapter.
 */

import { listScenesByProject, getProject, listDocumentsByProject } from "../db.js";

export const dexieRetrievalAdapter = {
  /**
   * Retrieves scenes/passages for a project matching a search query.
   * Performs a robust keyword matching filter over raw prose.
   * Detects staleness and returns appropriate warnings.
   * 
   * @param {string} projectId - The active project ID.
   * @param {string} query - The search query.
   * @param {Object} [options={}] - Configurable parameters.
   * @param {number} [options.limit=5] - Maximum number of matches to return.
   * @returns {Promise<Object>} The adapter result matching { success, passages, warnings, error }
   */
  async getPassages(projectId, query, options = {}) {
    if (!projectId) {
      return {
        success: false,
        passages: [],
        warnings: ["Missing projectId parameter."],
        error: "ProjectId is required."
      };
    }

    try {
      const limit = options.limit || 5;

      // 1. Fetch project scenes
      const scenes = await listScenesByProject(projectId);
      if (!scenes || scenes.length === 0) {
        return {
          success: true,
          passages: [],
          warnings: ["No scenes found in the project. Retrieval is currently empty."],
          error: null
        };
      }

      // 2. Fetch project and documents to check voice calibration (staleness check)
      const project = await getProject(projectId);
      const warnings = [];

      if (!project) {
        warnings.push("Project not found in database. Context alignment may be stale.");
      } else {
        // Find if voice is calibrated
        const docs = await listDocumentsByProject(projectId);
        const voiceDoc = docs?.find(d => d.type === "voice" || d.domain === "voice");
        if (!voiceDoc || !voiceDoc.compressedDirectives || voiceDoc.compressedDirectives.trim() === "") {
          warnings.push("Voice profile is uncalibrated. Retrieved passages may have lower stylistic alignment.");
        }
      }

      // 3. Simple keyword matching over raw scene text
      let matchedScenes = [];
      
      if (query && query.trim() !== "") {
        const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
        
        if (queryTerms.length === 0) {
          // Fallback to latest scenes if query is too short
          matchedScenes = [...scenes];
        } else {
          // Rank scenes by keyword matches in their raw prose text
          const scoredScenes = scenes.map(scene => {
            const prose = (scene.text || "").toLowerCase();
            let matches = 0;
            
            for (const term of queryTerms) {
              // Count occurrences of the term
              let pos = prose.indexOf(term);
              while (pos !== -1) {
                matches++;
                pos = prose.indexOf(term, pos + term.length);
              }
            }
            
            return { scene, matches };
          });

          // Filter scenes that matched at least one term and sort by score descending
          matchedScenes = scoredScenes
            .filter(item => item.matches > 0)
            .sort((a, b) => b.matches - a.matches)
            .map(item => item.scene);
        }
      } else {
        // If no query is provided, default to returning latest updated scenes
        matchedScenes = [...scenes];
      }

      // 4. Limit results
      const finalScenes = matchedScenes.slice(0, limit);

      // 5. Format to the standard passage shape
      const passages = finalScenes.map(scene => ({
        id: scene.id,
        text: scene.text || "",
        metadata: {
          chapterId: scene.chapterId,
          projectId: scene.projectId,
          title: scene.summary || "Untitled Scene",
          timeOfDay: scene.time || "",
          location: scene.location || "",
          updatedAt: scene.updatedAt || 0
        }
      }));

      return {
        success: true,
        passages,
        warnings,
        error: null
      };
    } catch (err) {
      return {
        success: false,
        passages: [],
        warnings: [],
        error: err instanceof Error ? err.message : String(err)
      };
    }
  }
};
