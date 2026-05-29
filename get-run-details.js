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
const runId = "ca8bcda9-96a8-4596-b68d-0c1bbff5a9d0";

async function main() {
  console.log(`Fetching details for run: ${runId}`);
  const res = await fetch(`http://localhost:5173/api/galaxy/runs/${runId}?inDetails=true`, {
    headers: {
      "Authorization": `Bearer ${galaxyKey}`,
      "Content-Type": "application/json"
    }
  });
  console.log('GET status:', res.status);
  const data = await res.json();
  fs.writeFileSync('E:/Ai/ProseLabV2/run_details.json', JSON.stringify(data, null, 2));
  console.log('Saved details to E:/Ai/ProseLabV2/run_details.json');
}

main().catch(console.error);
