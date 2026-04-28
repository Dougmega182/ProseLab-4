import { saveProject, loadProject, getTokenLog, saveTokenLog } from "../services/storage.js";

let state = {
  project: loadProject() || {
    core: { title: "", genre: "", constraint: "", theme: "", falseBelief: "", midpoint: "" },
    voice: { length: "Medium", fragments: "Occasional", metaphor: "Moderate", dialogue: "Direct" },
    settings: { ollamaModel: "llama3" },
    chars: [],
    scenes: [],
    rules: [],
    beats: [],
  },
};

export function getState() {
  return state;
}

export function updateProject(patch) {
  state.project = { ...state.project, ...patch };
  saveProject(state.project);
  return state.project;
}

export function updateProjectDeep(section, patch) {
  state.project[section] = { ...state.project[section], ...patch };
  saveProject(state.project);
  return state.project;
}

export function logTokenUsage(provider, inputTokens, outputTokens) {
  const log = getTokenLog();
  log.push({ provider, inputTokens, outputTokens, timestamp: Date.now() });
  saveTokenLog(log);
}
