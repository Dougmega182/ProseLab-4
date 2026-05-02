import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cacheDir = path.resolve(__dirname, "../../.cache");

if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

function hashStr(str) {
  return crypto.createHash("sha256").update(str).digest("hex");
}

export async function diskCachedInference({ name, input, context = {}, fn }) {
  const keyPayload = { name, input, context };
  const hash = hashStr(JSON.stringify(keyPayload));
  const cachePath = path.join(cacheDir, `${name}_${hash}.json`);

  if (fs.existsSync(cachePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(cachePath, "utf8"));
      // console.log(`CACHE HIT [Disk]: ${name}`);
      return data;
    } catch (e) {
      console.warn(`Failed to read cache for ${name}`, e);
    }
  }

  const output = await fn();

  if (output !== undefined && output !== null) {
    try {
      fs.writeFileSync(cachePath, JSON.stringify(output, null, 2));
    } catch (e) {
      console.warn(`Failed to write cache for ${name}`, e);
    }
  }

  return output;
}
