const KEY = "proselab_v4";
const COST_KEY = "plab_costs_v1";

// Project Persistence
export function saveProject(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function loadProject() {
  try {
    const data = localStorage.getItem(KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error("Failed to load project", e);
    return null;
  }
}

// Cost Tracking I/O
export function getTokenLog() {
  try {
    return JSON.parse(localStorage.getItem(COST_KEY) || "[]");
  } catch (e) {
    return [];
  }
}

export function saveTokenLog(log) {
  localStorage.setItem(COST_KEY, JSON.stringify(log));
}

export function clearTokenLog() {
  localStorage.removeItem(COST_KEY);
}

// Stats Calculation (Pure logic, moved from App.jsx)
export function getCostStats(COST_RATES) {
  const log = getTokenLog();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const today = log.filter((e) => e.timestamp >= todayStart.getTime());
  
  const totals = { calls: today.length, inputTokens: 0, outputTokens: 0, cost: 0 };
  today.forEach((e) => {
    totals.inputTokens += e.inputTokens || 0;
    totals.outputTokens += e.outputTokens || 0;
    const rate = COST_RATES[e.provider] || { input: 0, output: 0 };
    totals.cost += (e.inputTokens / 1000) * rate.input + (e.outputTokens / 1000) * rate.output;
  });

  const allTime = { calls: log.length, cost: 0 };
  log.forEach((e) => {
    const rate = COST_RATES[e.provider] || { input: 0, output: 0 };
    allTime.cost += (e.inputTokens / 1000) * rate.input + (e.outputTokens / 1000) * rate.output;
  });

  return { today: totals, allTime };
}
