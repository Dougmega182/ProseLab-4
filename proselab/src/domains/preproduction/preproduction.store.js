export const initialPreproduction = {
  core: { 
    title: "", 
    genre: "", 
    constraint: "", 
    theme: "", 
    falseBelief: "", 
    midpoint: "" 
  },
  voice: { 
    length: "Medium", 
    fragments: "Occasional", 
    metaphor: "Moderate", 
    dialogue: "Direct",
    banned: []
  },
  settings: { 
    ollamaModel: "qwen3:8b" 
  },
  chars: [],
  scenes: [], // Each scene will have _rev: 1 and a 'narrative' object upon creation
  rules: [],
  beats: [],
};
