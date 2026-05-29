import fs from 'fs';

// Read .env keys manually to configure process.env
const envPath = 'E:/Ai/ProseLabV2/proselab/.env';
const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    process.env[key] = val;
  }
});

console.log('Environment variables pre-loaded.');

// Mock/stub browser fetch globally since we are running in Node
const originalFetch = global.fetch;
global.fetch = async (url, options) => {
  // Map local proxy calls to the direct Galaxy API
  const directUrl = url.startsWith('/') 
    ? `https://api.galaxy.ai/api/v1${url.replace(/^\/api\/galaxy/, '')}`
    : url.replace(/^\/api\/galaxy/, 'https://api.galaxy.ai/api/v1');
  
  console.log(`[Mock Fetch] ${url} -> ${directUrl}`);
  return originalFetch(directUrl, options);
};

async function main() {
  // Dynamically import to ensure process.env is set before top-level module code runs
  const { generateRewrite } = await import('./proselab/src/engine/rewrite.js');
  const { callOpenAI } = await import('./proselab/src/services/llm.js');

  const originalText = "He blinked rapidly, the dark walls of the narrow corridor closing in on him like a giant stone fist.";
  const instructions = ["[Readability]: Replace abstract sensory descriptors with concrete direct actions."];
  const sceneIntent = {
    objective: "Character navigates narrow corridor safely.",
    success_state: "Corridor is traversed.",
    failure_state: "Failed to traverse.",
    irreversible_change: "Moves deeper into the dungeon.",
    story_delta: "Increased danger."
  };

  console.log('Starting generateRewrite call...');
  const res = await generateRewrite({
    original: originalText,
    instructions,
    sceneIntent,
    mode: "intent-repair",
    llmCaller: callOpenAI,
    key: process.env.VITE_OPENAI_KEY,
    debug: true
  });

  console.log('\nResult returned by generateRewrite:');
  console.log(JSON.stringify(res, null, 2));

  if (res.ok && res.text) {
    console.log('\n[PASS] generateRewrite succeeded!');
  } else {
    console.log('\n[FAIL] generateRewrite failed!');
    const errorDetail = res.response?.error || res.error || "Rewrite failed to produce content.";
    console.log('Extracted error detail:', errorDetail);
  }
}

main().catch(console.error);
