import fs from 'fs';

const runDetails = JSON.parse(fs.readFileSync('E:/Ai/ProseLabV2/run_details.json', 'utf8'));

console.log('NodeRuns Summary:');
runDetails.nodeRuns.forEach((node, idx) => {
  console.log(`\nNode #${idx + 1}:`);
  console.log(`  nodeId: ${node.nodeId}`);
  console.log(`  nodeType: ${node.nodeType}`);
  console.log(`  status: ${node.status}`);
  console.log(`  completedAt: ${node.completedAt}`);
  console.log(`  output type: ${typeof node.output}`);
  if (node.output) {
    if (typeof node.output === 'object') {
      console.log(`  output keys:`, Object.keys(node.output));
      for (const k of Object.keys(node.output)) {
        const val = node.output[k];
        const valStr = typeof val === 'object' ? JSON.stringify(val) : String(val);
        console.log(`    ${k}: ${valStr.slice(0, 150)}...`);
      }
    } else {
      console.log(`  output value:`, String(node.output).slice(0, 150));
    }
  }
});
