import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define standard CP1252 / UTF-8 crossover mojibake patterns and their corrections
const MOJIBAKE_PATTERNS = [
  { raw: "â€™", correct: "’", desc: "Right single quote / Smart apostrophe" },
  { raw: "â€”", correct: "—", desc: "Em dash" },
  { raw: "â€“", correct: "–", desc: "En dash" },
  { raw: "â€œ", correct: "“", desc: "Left double quote" },
  { raw: "â€", correct: "”", desc: "Right double quote" },
  { raw: "â€¦", correct: "…", desc: "Ellipsis" },
  { raw: "Ã©", correct: "é", desc: "Lowercase e with acute accent" },
  { raw: "Ã¡", correct: "á", desc: "Lowercase a with acute accent" },
  { raw: "Ã³", correct: "ó", desc: "Lowercase o with acute accent" },
  { raw: "Ãº", correct: "ú", desc: "Lowercase u with acute accent" },
  { raw: "Ã±", correct: "ñ", desc: "Lowercase n with tilde" },
  { raw: "Ã­", correct: "í", desc: "Lowercase i with acute accent" },
  { raw: "Ã§", correct: "ç", desc: "Lowercase c with cedilla" },
  { raw: "Ã ", correct: "à", desc: "Lowercase a with grave accent" },
  { raw: "Ã¨", correct: "è", desc: "Lowercase e with grave accent" },
  { raw: "Ã¹", correct: "ù", desc: "Lowercase u with grave accent" },
  { raw: "Ã‰", correct: "É", desc: "Uppercase E with acute accent" },
  { raw: "Ã€", correct: "À", desc: "Uppercase A with grave accent" },
  { raw: "Ã—", correct: "×", desc: "Multiplication sign" },
  { raw: "ï¿½", correct: "", desc: "Replacement character" },
  { raw: "Â ", correct: " ", desc: "Double-encoded space (often non-breaking)" },
  // Standalone Â symbols prefixing common characters
  { raw: "Â°", correct: "°", desc: "Degree symbol prefix" },
  { raw: "Â£", correct: "£", desc: "Pound symbol prefix" },
  { raw: "Â©", correct: "©", desc: "Copyright symbol prefix" },
  { raw: "Â®", correct: "®", desc: "Registered trademark prefix" },
];

// Helper to scan a directory recursively
function getFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== "node_modules" && file !== "dist" && file !== "build" && file !== ".git") {
        getFiles(filePath, fileList);
      }
    } else {
      const ext = path.extname(file);
      if ([".js", ".jsx", ".css", ".html"].includes(ext)) {
        fileList.push(filePath);
      }
    }
  }
  return fileList;
}

// Perform scan
function scan() {
  const isRepair = process.argv.includes("--repair");
  const targetDir = path.resolve(__dirname, "../src");
  console.log(`\n🔍 STARTING MOJIBAKE SCAN IN: ${targetDir}`);
  console.log(`Mode: ${isRepair ? "🛠️  REPAIR & SAVE" : "📋 DRY-RUN ONLY"}\n`);

  const files = getFiles(targetDir);
  let totalMatches = 0;
  let filesWithMatches = 0;

  for (const filePath of files) {
    const relativePath = path.relative(path.resolve(__dirname, ".."), filePath);
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split(/\r?\n/);
    let fileHasMatch = false;
    let fileMatchesCount = 0;
    let modifiedContent = content;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const pattern of MOJIBAKE_PATTERNS) {
        if (line.includes(pattern.raw)) {
          fileHasMatch = true;
          totalMatches++;
          fileMatchesCount++;
          
          const col = line.indexOf(pattern.raw) + 1;
          const snippetStart = Math.max(0, col - 20);
          const snippetEnd = Math.min(line.length, col + pattern.raw.length + 20);
          const snippet = line.substring(snippetStart, snippetEnd).trim();
          
          console.log(`[MATCH] ${relativePath}:${i + 1}:${col}`);
          console.log(`  Pattern: "${pattern.raw}" -> correction: "${pattern.correct}" (${pattern.desc})`);
          console.log(`  Context: "... ${snippet} ..."`);
          console.log();
        }
      }
    }

    if (fileHasMatch) {
      filesWithMatches++;
      if (isRepair) {
        // Apply replacements sequentially, sorting by raw length descending to avoid prefix collision
        const sortedPatterns = [...MOJIBAKE_PATTERNS].sort((a, b) => b.raw.length - a.raw.length);
        for (const pattern of sortedPatterns) {
          // Replace all occurrences
          const escapedPattern = pattern.raw.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
          const regex = new RegExp(escapedPattern, "g");
          modifiedContent = modifiedContent.replace(regex, pattern.correct);
        }
        
        fs.writeFileSync(filePath, modifiedContent, "utf-8");
        console.log(`✅ REPAIRED: ${relativePath} (${fileMatchesCount} corrections applied)\n`);
      }
    }
  }

  console.log("--------------------------------------------------");
  console.log(`📊 SCAN SUMMARY:`);
  console.log(`- Files Scanned: ${files.length}`);
  console.log(`- Files Containing Mojibake: ${filesWithMatches}`);
  console.log(`- Total Mojibake Instances Found: ${totalMatches}`);
  console.log();
  if (totalMatches > 0 && !isRepair) {
    console.log(`👉 Run "node scripts/scan-mojibake.mjs --repair" to automatically repair these files.`);
  } else if (totalMatches > 0 && isRepair) {
    console.log(`🎉 All ${totalMatches} instances have been automatically repaired and saved!`);
  } else {
    console.log(`✨ Excellent! No mojibake issues found in the scanned files.`);
  }
  console.log("--------------------------------------------------\n");
}

scan();
