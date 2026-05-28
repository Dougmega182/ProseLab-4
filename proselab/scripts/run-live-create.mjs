import { runCreateOrchestration } from "../src/services/orchestration/createOrchestrator.js";
import fs from "node:fs";
import path from "node:path";

function readEnvFile(p) {
  try {
    const c = fs.readFileSync(p, "utf-8");
    return Object.fromEntries(
      c.split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"))
        .map((l) => {
          const idx = l.indexOf("=");
          if (idx === -1) return [];
          return [l.slice(0, idx).trim(), l.slice(idx + 1).replace(/^["']|["']$/g, "").trim()];
        })
        .filter(entry => entry.length === 2)
    );
  } catch {
    return {};
  }
}

async function main() {
  console.log("🚀 STARTING LIVE CREATE PIPELINE RUN VERIFICATION...");
  
  // Load environment variables
  const rootEnv = readEnvFile(path.resolve("..", ".env"));
  const appEnv = readEnvFile(path.resolve(".env"));
  
  Object.assign(process.env, rootEnv, appEnv);
  
  const openai = appEnv.VITE_OPENAI_KEY || rootEnv.OPENAI_KEY || rootEnv.VITE_OPENAI_KEY || appEnv.OPENAI_KEY;
  const gemini = appEnv.VITE_GEMINI_KEY || rootEnv.GEMINI_KEY || rootEnv.VITE_GEMINI_KEY || appEnv.GEMINI_KEY;
  
  console.log(`🔑 Credentials Found: OpenAI = ${openai ? "✅ Yes" : "❌ No"}, Gemini = ${gemini ? "✅ Yes" : "❌ No"}`);

  // Hardcode a highly structured scene passing validateSceneIntent perfectly
  const activeScene = {
    id: "scene-101",
    chapter: "4",
    title: "The Final Confrontation",
    location: "Precision Interrogation Room B",
    time: "20:00",
    goal: "Protagonist Vance extracts the hidden launch codes from the rogue commander.",
    conflict: "Rogue commander Vance plays mind games and threatens to trigger the self-destruct.",
    change: "Rogue commander Vance yields the correct encryption key under extreme pressure.",
    stakes: "If they fail to get the codes in 5 minutes, the satellite will fire on the city.",
    reveal: "The rogue commander is actually Vance's biological brother who was presumed dead.",
    causality: "Vance uses this sibling connection to break his brother's resolve.",
    chars: "Protagonist Vance, Rogue Commander Lance",
    objects: "encryption terminal, flickering light bulb, silver necklace, countdown clock",
  };

  const preproduction = {
    core: {},
    chars: [],
    rules: [],
    beats: [],
    scenes: [activeScene],
    voice: {
      length: "Medium",
      fragments: "Occasional",
      metaphor: "Moderate",
      dialogue: "Direct",
      profile: "Short, punchy sentences. High sensory descriptions. Dark noir atmosphere.",
      compressedDirectives: [
        "Short, punchy sentences.",
        "High sensory descriptions.",
        "Dark noir atmosphere."
      ]
    },
    settings: {
      ollamaModel: appEnv.VITE_OLLAMA_MODEL || "rocinante"
    }
  };

  const inputProse = "He felt very sad and everything was overwhelming as he sat at the desk and thought about how bad things had become.";

  console.log("\n📦 Pipeline Parameters initialized.");
  console.log("📝 Input Prose:", inputProse);

  console.log("\n⚡ Launching runCreateOrchestration...");
  const result = await runCreateOrchestration({
    text: inputProse,
    preproduction,
    preflightId: "scene-101",
    delta: ["Replace vague words with concrete sensory detail.", "Replace abstract emotions with physical reactions."],
    keys: { openai, gemini },
    onStage: (stage) => {
      console.log(`⏱️  [Orchestrator Stage]: ${stage}`);
    }
  });

  console.log("\n🎉 PIPELINE RUN COMPLETED!");
  console.log("==========================================");
  console.log("SUCCESS:", result.success ? "✅ YES" : "❌ NO");
  console.log("WARNINGS:", result.warnings);
  console.log("DIAGNOSTICS:", JSON.stringify(result.diagnostics, null, 2));
  console.log("METRICS:", result.metrics);
  console.log("==========================================");
  console.log("✍️  FINAL PROSE:");
  console.log(result.output);
  console.log("==========================================");
}

main().catch((err) => {
  console.error("\n💥 FATAL CRASH:", err);
  process.exit(1);
});
