import { updateState } from "../../store/appStore.js";
import { compileScene } from "../../services/compiler.js";

export function addCharacter(character) {
  updateState((project) => {
    project.chars.push(character);
  });
}

export function saveCharacter(character) {
  updateState((project) => {
    const exists = project.chars.find(c => c.id === character.id);
    if (exists) {
      project.chars = project.chars.map(c => c.id === character.id ? character : c);
    } else {
      project.chars.push(character);
    }
  });
}

export function deleteCharacter(id) {
  updateState((project) => {
    project.chars = project.chars.filter(c => c.id !== id);
  });
}

export function saveScene(scene) {
  updateState((project) => {
    const exists = project.scenes.find(s => s.id === scene.id);
    
    // ENSURE: Description is derived, not stored independently if narrative exists
    const compiledDescription = compileScene(scene);
    
    const updatedScene = { 
      ...scene, 
      description: compiledDescription || scene.description,
      _rev: (exists?._rev || 0) + 1 
    };
    
    const newScenes = exists 
      ? project.scenes.map(s => s.id === scene.id ? updatedScene : s) 
      : [...project.scenes, updatedScene];
    
    project.scenes = newScenes.sort((a, b) => 
      (parseFloat(a.chapter) || 0) - (parseFloat(b.chapter) || 0)
    );
  });
}

export function generateSceneBlocks(id, blocks) {
  updateState((project) => {
    const scene = project.scenes.find(s => String(s.id) === String(id));
    if (scene) {
      scene.narrative = blocks;
      scene.description = compileScene(scene);
      scene._rev = (scene._rev || 0) + 1;
    }
  });
}

export function updateScenePhase(id, phase, text) {
  updateState((project) => {
    const scene = project.scenes.find(s => String(s.id) === String(id));
    if (scene) {
      scene.narrative = { ...(scene.narrative || {}), [phase]: text };
      scene.description = compileScene(scene);
      scene._rev = (scene._rev || 0) + 1;
    }
  });
}

export function deleteScene(id) {
  updateState((project) => {
    project.scenes = project.scenes.filter(s => s.id !== id);
  });
}

export function saveBeat(beat) {
  updateState((project) => {
    const exists = project.beats.find(b => b.id === beat.id);
    if (exists) {
      project.beats = project.beats.map(b => b.id === beat.id ? { ...b, ...beat } : b);
    } else {
      project.beats.push(beat);
    }
    
    // Enforce ordering by percentage (numeric pct value)
    project.beats.sort((a, b) => {
      const aPct = parseInt(a.pct) || 0;
      const bPct = parseInt(b.pct) || 0;
      return aPct - bPct;
    });
  });
}

export function updateBeat(id, patch) {
  updateState((project) => {
    const beat = project.beats.find(b => b.id === id);
    if (beat) {
      Object.assign(beat, patch);
      // Re-sort in case percentage changed
      project.beats.sort((a, b) => (parseInt(a.pct) || 0) - (parseInt(b.pct) || 0));
    }
  });
}

export function deleteBeat(id) {
  updateState((project) => {
    project.beats = project.beats.filter(b => b.id !== id);
  });
}

function sanitizeCore(patch) {
  return {
    ...patch,
    wordCountTarget: patch.wordCountTarget !== undefined ? (Number(patch.wordCountTarget) || 0) : undefined,
    wordCountCurrent: patch.wordCountCurrent !== undefined ? (Number(patch.wordCountCurrent) || 0) : undefined,
    title: patch.title !== undefined ? (patch.title || "").trim() : undefined,
  };
}

export function updateCore(patch) {
  updateState((project) => {
    project.core = {
      ...project.core,
      ...sanitizeCore(patch)
    };
  });
}

export function addRule(rule) {
  updateState((project) => {
    const newRule = rule || { 
      id: Date.now(), 
      rule: "", 
      cost: "", 
      limit: "", 
      consequence: "", 
      category: "physics" 
    };
    project.rules.push(newRule);
  });
}

export function updateRule(id, patch) {
  updateState((project) => {
    const rule = project.rules.find(r => r.id === id);
    if (rule) Object.assign(rule, patch);
  });
}

export function deleteRule(id) {
  updateState((project) => {
    project.rules = project.rules.filter(r => r.id !== id);
  });
}
