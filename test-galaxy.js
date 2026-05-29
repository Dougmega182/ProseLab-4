import fs from 'fs';
import path from 'path';

// Read .env keys manually
const envPath = 'E:/Ai/ProseLabV2/proselab/.env';
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    env[key] = val;
  }
});

const galaxyKey = env.VITE_GALAXY_AI_API_KEY;
const workflowId = env.VITE_GALAXY_WORKFLOW_ID;
const nodeId = env.VITE_GALAXY_NODE_ID;

console.log('Keys loaded:', { galaxyKey: galaxyKey ? 'present' : 'missing', workflowId, nodeId });

async function runTest(valuesPayload) {
  const start = Date.now();
  console.log(`\n--- Starting Run with payload:`, JSON.stringify(valuesPayload));
  
  const startRes = await fetch("https://api.galaxy.ai/api/v1/runs", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${galaxyKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      workflowId,
      values: {
        [nodeId]: valuesPayload
      }
    })
  });

  if (!startRes.ok) {
    console.error('Start failed:', startRes.status, await startRes.text());
    return;
  }

  const startData = await startRes.json();
  const runId = startData.runId;
  console.log(`Run started: ${runId}`);

  // Poll for completion
  let completed = false;
  let attempts = 0;
  while (!completed && attempts < 20) {
    await new Promise(r => setTimeout(r, 2000));
    attempts++;
    
    const pollRes = await fetch(`https://api.galaxy.ai/api/v1/runs/${runId}?inDetails=true`, {
      headers: {
        "Authorization": `Bearer ${galaxyKey}`
      }
    });
    
    if (!pollRes.ok) {
      console.error('Poll failed:', pollRes.status);
      break;
    }
    
    const pollData = await pollRes.json();
    console.log(`[Poll ${attempts}] Status: ${pollData.status}`);
    
    if (pollData.status === 'COMPLETED') {
      completed = true;
      console.log('Run COMPLETED!');
      console.log('NodeRuns Output Details:');
      pollData.nodeRuns.forEach(nr => {
        console.log(`- Node ${nr.nodeId} (${nr.nodeType}) status: ${nr.status}`);
        if (nr.output) {
          console.log(`  Output:`, JSON.stringify(nr.output).slice(0, 300));
        }
      });
      break;
    }
    
    if (pollData.status === 'FAILED' || pollData.status === 'CANCELED') {
      console.error('Run failed/canceled:', pollData.error);
      break;
    }
  }
}

async function main() {
  // Test 1: Legacy / simple text_field
  await runTest({ text_field: "Say hello!" });
  
  // Test 2: Specific custom field ID
  await runTest({ field_1777881409473_ahtf02kjj: "Say hello!" });
}

main().catch(console.error);
