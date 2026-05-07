/**
 * search.js - Cross-document search service for ProseLab V4
 * 
 * Provides full-text search across all scenes in a project, 
 * returning matches with contextual snippets.
 */
import { listScenesByProject } from "./db.js";

export async function searchProject(projectId, query) {
  if (!query || query.trim().length < 2) return [];
  
  const scenes = await listScenesByProject(projectId);
  const results = [];
  const regex = new RegExp(query, 'gi');

  scenes.forEach(scene => {
    const titleMatch = scene.title?.match(regex);
    const textMatch = scene.text?.match(regex);
    
    if (titleMatch || textMatch) {
      const snippets = [];
      if (scene.text) {
        // Find snippets for matches
        let match;
        // Reset regex index for exec
        regex.lastIndex = 0;
        
        while ((match = regex.exec(scene.text)) !== null && snippets.length < 3) {
          const start = Math.max(0, match.index - 30);
          const end = Math.min(scene.text.length, match.index + query.length + 30);
          let snippet = scene.text.substring(start, end);
          
          // Add ellipses if truncated
          if (start > 0) snippet = "..." + snippet;
          if (end < scene.text.length) snippet = snippet + "...";
          
          snippets.push(snippet);
        }
      }
      
      results.push({
        sceneId: scene.id,
        sceneTitle: scene.title || "Untitled Scene",
        chapterId: scene.chapterId,
        matchCount: (titleMatch?.length || 0) + (textMatch?.length || 0),
        snippets
      });
    }
  });

  return results.sort((a, b) => b.matchCount - a.matchCount);
}
