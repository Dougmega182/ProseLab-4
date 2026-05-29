import fs from 'fs';

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

async function main() {
  console.log('\n--- Testing GET request to http://localhost:5173/api/galaxy/runs ---');
  try {
    const getRes = await fetch("http://localhost:5173/api/galaxy/runs", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${galaxyKey}`,
        "Content-Type": "application/json"
      }
    });
    console.log('GET status:', getRes.status);
    const getText = await getRes.text();
    console.log('GET response (first 200 chars):', getText.slice(0, 200));
  } catch (err) {
    console.error('GET error:', err);
  }

  console.log('\n--- Testing POST request to http://localhost:5173/api/galaxy/runs ---');
  try {
    const postRes = await fetch("http://localhost:5173/api/galaxy/runs", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${galaxyKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        workflowId,
        values: {
          [nodeId]: {
            text_field: "This is a proxy verification test."
          }
        }
      })
    });
    console.log('POST status:', postRes.status);
    const postText = await postRes.text();
    console.log('POST response (first 500 chars):', postText.slice(0, 500));
  } catch (err) {
    console.error('POST error:', err);
  }
}

main().catch(console.error);
