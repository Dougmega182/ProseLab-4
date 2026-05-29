import fs from 'fs';
import path from 'path';

// Read .env keys manually
const envPath = 'E:/Ai/ProseLabV2/proselab/.env';
let envContent = '';
try {
  envContent = fs.readFileSync(envPath, 'utf8');
} catch (e) {
  console.error(`Error reading .env at ${envPath}:`, e.message);
  process.exit(1);
}

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

// Get custom workflow/node parameters or fallback to default for minimal test
const args = process.argv.slice(2);
const customWorkflowId = args[0] || env.VITE_GALAXY_WORKFLOW_ID;
const customNodeId = args[1] || env.VITE_GALAXY_NODE_ID;
const customPrompt = args[2] || 'Rewrite this sentence:\n"The corridor was dark."';

if (!galaxyKey) {
  console.error("FATAL: VITE_GALAXY_AI_API_KEY not found in proselab/.env.");
  process.exit(1);
}

console.log('========================================================');
console.log(' GALAXY MINIMAL 3-NODE ISOLATED TESTER');
console.log('========================================================');
console.log('Parameters:');
console.log(`- Workflow ID: ${customWorkflowId}`);
console.log(`- Input Node ID: ${customNodeId}`);
console.log(`- Prompt: "${customPrompt.replace(/\n/g, ' ')}"`);
console.log('========================================================\n');

async function runMinimalTest() {
  const start = Date.now();
  console.log(`[1/3] Starting Galaxy workflow run...`);

  const payload = {
    workflowId: customWorkflowId,
    values: {
      [customNodeId]: {
        text_field: customPrompt
      }
    }
  };

  const startRes = await fetch("https://api.galaxy.ai/api/v1/runs", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${galaxyKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!startRes.ok) {
    console.error('❌ Run creation failed:', startRes.status, await startRes.text());
    return;
  }

  const startData = await startRes.json();
  const runId = startData.runId;
  console.log(`✅ Run created successfully: ${runId}`);

  const serialized = JSON.stringify(payload);
  console.log("[METRICS]", {
    workflowId: customWorkflowId,
    nodeId: customNodeId,
    runId,
    promptLength: customPrompt.length,
    payloadBytes: Buffer.byteLength(serialized, "utf8"),
    startedAt: new Date().toISOString()
  });
  console.log(`\n[2/3] Polling Galaxy execution graph...`);

  let completed = false;
  let attempts = 0;
  const maxAttempts = 60; // Up to 2 minutes polling

  while (!completed && attempts < maxAttempts) {
    await new Promise(r => setTimeout(r, 2000));
    attempts++;

    const pollRes = await fetch(`https://api.galaxy.ai/api/v1/runs/${runId}?inDetails=true`, {
      headers: {
        "Authorization": `Bearer ${galaxyKey}`
      }
    });

    if (!pollRes.ok) {
      console.error(`❌ Poll attempt ${attempts} failed:`, pollRes.status);
      continue;
    }

    const pollData = await pollRes.json();
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    
    // Aggregate node run statuses
    const nodeRuns = pollData.nodeRuns || [];
    const nodeStatuses = nodeRuns.map(nr => {
      return `${nr.nodeId || nr.nodeType || 'unknown'}(${nr.status || 'QUEUED'})`;
    }).join(', ');

    console.log(`[Poll ${attempts} | ${elapsed}s] Status: [${pollData.status}] | Nodes: [${nodeStatuses}]`);

    if (pollData.status === 'COMPLETED') {
      completed = true;
      console.log('\n========================================================');
      console.log('🎉 SUCCESS: Galaxy workflow finished run successfully!');
      console.log('========================================================');
      console.log('Final Node outputs:');
      nodeRuns.forEach(nr => {
        console.log(`\nNode: ${nr.nodeId} (${nr.nodeType})`);
        console.log(`Status: ${nr.status}`);
        if (nr.output) {
          console.log(`Output payload:`, JSON.stringify(nr.output, null, 2));
        }
      });
      break;
    }

    if (pollData.status === 'FAILED' || pollData.status === 'CANCELED') {
      console.error(`\n❌ FAILED: Run ended in terminal state: [${pollData.status}]`);
      console.error('Error message:', pollData.error || 'No error details provided.');
      break;
    }
  }

  if (!completed && attempts >= maxAttempts) {
    console.error('\n❌ TIMEOUT: The Galaxy workflow has stalled upstream or exceeded maximum test polling limit (120s).');
  }
}

runMinimalTest().catch(console.error);
