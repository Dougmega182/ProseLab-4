import { callCritic } from "./proselab/src/engine/critic.js";
import fs from "node:fs";

function readEnvFile(filePath) {
  const vars = {};
  if (!fs.existsSync(filePath)) return vars;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    vars[key] = value;
  }
  return vars;
}

const env = {
  ...readEnvFile("e:/Ai/ProseLabV2/proselab/.env"),
  ...process.env,
};
const openai = env.VITE_OPENAI_KEY || env.OPENAI_KEY;

const texts = [
  { name: "Set 1 - Neutral", text: "The old bookstore sat on a quiet corner, its windows dusty and filled with faded book covers. A customer entered, browsing the shelves lined with novels and histories while the shopkeeper sorted papers behind the counter. The air smelled of paper and time. Outside, a delivery truck rumbled past, briefly breaking the afternoon calm." },
  { name: "Set 1 - High-Craft", text: "Tucked into the city's forgotten crease, the bookstore breathed neglect—windows veiled in dust that softened the spines of books long unclaimed. A lone wanderer crossed the threshold, fingers trailing spines like memories half-recalled, each volume whispering of worlds abandoned. The shopkeeper moved in amber light, riffling pages that carried the musk of aged ink and vanished summers. Beyond the glass, a truck growled its passage, a mechanical heartbeat against the hush of perpetual twilight." },
  { name: "Set 1 - Functional", text: "Entering the bookstore provided a pause from the street noise, allowing the customer time to scan titles and decide on purchases. The shopkeeper handled routine tasks at the counter, preparing for the next sale. This quiet interlude bridged the bustle outside with the focused activity of selection inside, readying both for the transaction ahead." },
  { name: "Set 1 - Experimental", text: "bookstore [corners / folds / hides] — dust on windows (softens edges). customer steps in → shelves → fingers on spines [yellowed / cracked / waiting]. air: paper + time. shopkeeper [sorts / shuffles / exists] behind counter. truck outside — rumble — interrupts? (or just passes). everything settles. again." },
  { name: "Set 2 - Neutral", text: "She started her day with coffee, grinding beans and filling the machine as sunlight filtered through the kitchen window. Steam rose from the mug as she added milk and sat at the table, scrolling through her phone. The routine felt steady and familiar. Birds chirped outside, marking the beginning of another ordinary morning." },
  { name: "Set 2 - High-Craft", text: "Dawn's first tendrils pierced the kitchen blinds, gilding the grinder's whir as beans surrendered their dark secrets to steel teeth. Water hissed into communion with grounds, birthing steam that curled like incense from the brimming mug—milk swirled in, a creamy galaxy yielding to gravity's pull. She settled at the scarred oak table, phone aglow in her palm, while beyond the pane, birds etched their urgent hymns into the awakening air, consecrating the quiet sacrament of morning." },
  { name: "Set 2 - Functional", text: "Grinding beans and brewing coffee established the daily routine, transitioning from sleep to wakefulness. Adding milk and sitting down created a moment for review of notifications before the day's tasks. This sequence prepared her mentally and physically, aligning personal habits with the external rhythm of the starting day." },
  { name: "Set 2 - Experimental", text: "coffee → grind [beans crack / release / awaken] → machine fills (hiss. steam). mug: milk spirals in — watch it turn. table. phone scrolls [news? ads? nothing?]. birds [chirp / insist / begin]. morning assembles itself. (steady. always.)" },
  { name: "Set 3 - Neutral", text: "He sat on the park bench, watching joggers pass and children play on the grass nearby. Leaves rustled in the breeze, and a vendor pushed a cart selling ice cream down the path. The afternoon felt relaxed. Distant traffic hummed faintly from the streets beyond the trees." },
  { name: "Set 3 - High-Craft", text: "Perched on weathered slats that cradled a thousand silences, he observed the park's pulse: joggers slicing air with determined strides, children erupting in chaotic joy across emerald swards. Leaves conversed in the wind's subtle tongue, a verdant murmur, while the ice cream vendor's cart creaked forward like a nomadic storyteller. Afternoon unfurled in languid warmth, traffic's drone a muffled counterpoint from the world's encircling clamor." },
  { name: "Set 3 - Functional", text: "The bench offered a vantage for observing park activities, from exercise to play, providing a natural rest stop. The vendor's approach introduced a potential interaction or refreshment option. This setup allowed time to absorb the scene before deciding on the next movement through the park or back to the street." },
  { name: "Set 3 - Experimental", text: "bench holds him — joggers [pass / blur / breathe heavy] → kids [laugh / chase / scatter] on grass. leaves rustle (breeze fingers them). cart wheels → vendor [ice cream / cold / choice?]. afternoon stretches. traffic? [far. hums. ignores]. park breathes. waits." }
];

async function main() {
  const results = [];
  for (const t of texts) {
    const result = await callCritic({ text: t.text, keys: { openai } });
    results.push({
      name: t.name,
      verdict: result.verdict,
      overall: result.score.overall,
      failures: result.failures.map(f => f.type).join(", ") || "None",
      intent_verdict: result.intent_verdict
    });
    console.log(`Evaluated: ${t.name.padEnd(25)} | Verdict: ${result.verdict.padEnd(7)} | Score: ${result.score.overall} | Failures: ${result.failures.map(f => f.type).join(", ")}`);
  }
}

main().catch(console.error);
