import { callOpenAI } from "../services/llm.js";
import { EVENT_SCHEMA_PROMPT, EVENT_CATEGORIES, EVENT_SUBTYPES } from "./eventSchema.js";
import { buildDocumentStructure, resolveAnchor } from "./documentStructure.js";
import { CAPABILITIES, enrichEventCapabilities as baseEnrich } from "./capabilities.js";

/**
 * Event Normalizer 5.0 (Two-Stage)
 * Stage 1: Loose Discovery (Facts)
 * Stage 2: Structured Normalization (Events)
 */

function robustParseJSON(text) {
  if (!text) return null;
  let jsonText = text.trim();
  
  // Handle Markdown
  if (jsonText.includes("```")) {
      const match = jsonText.match(/```(?:json)?([\s\S]*?)```/);
      if (match) jsonText = match[1].trim();
  }
  
  // Find first { or [
  const firstBrace = jsonText.indexOf("{");
  const firstBracket = jsonText.indexOf("[");
  let start = -1;
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) start = firstBrace;
  else if (firstBracket !== -1) start = firstBracket;
  
  if (start === -1) return null;
  
  // Find last } or ]
  const lastBrace = jsonText.lastIndexOf("}");
  const lastBracket = jsonText.lastIndexOf("]");
  let end = -1;
  if (lastBrace !== -1 && (lastBracket === -1 || lastBrace > lastBracket)) end = lastBrace;
  else if (lastBracket !== -1) end = lastBracket;
  
  if (end === -1) return null;
  
  try {
    return JSON.parse(jsonText.substring(start, end + 1));
  } catch (e) {
    return null;
  }
}

async function discoverNarrativeFacts(text, key) {
  const prompt = `LIST all significant facts, actions, speech, and reveals in this text.
Use simple, one-sentence facts. Do NOT use a schema yet.

PROSE:
---
${text}
---

Return ONLY a JSON array of strings: ["Fact 1", "Fact 2", ...]`;

  const response = await callOpenAI(key, prompt, { model: "gpt-4o-mini" });
  if (!response?.ok) return [];
  const facts = robustParseJSON(response.content) || [];
  return facts;
}

async function normalizeFactsToEvents(facts, text, key) {
  if (!facts || !Array.isArray(facts) || facts.length === 0) return [];

  const prompt = `Convert these RAW FACTS into structured NARRATIVE EVENTS.
  
${EVENT_SCHEMA_PROMPT}

IMPORTANT:
1. REVEAL PRIORITY: If a fact involves sharing info (secret, code, address), categorize as REVEAL.
2. NARRATIVE OBSTACLES: If the text implies mistrust, hesitation, fear, doubt, or a physical barrier, you MUST extract an event with capability BLOCKS_TRANSFER or WITHHOLDS_CONTENT.
3. REACTION AS RECEIPT: Map nods, smiles, or pales to GESTURE_ACK or EMOTIONAL_DISPLAY (PERCEIVES_CONTENT).
4. CONSISTENT NAMES: Use specific names for actors.

RAW FACTS:
${facts.map((f, i) => `${i+1}. ${f}`).join("\n")}

TEXT FOR CONTEXT:
${text}

Return ONLY a JSON array of events matching the schema.`;

  const response = await callOpenAI(key, prompt, { model: "gpt-4o" });
  if (!response?.ok) return [];
  const data = robustParseJSON(response.content);
  const events = Array.isArray(data) ? data : (data?.events || []);
  
  // Assign a high default confidence for structured normalization
  return events.map(e => ({ ...e, confidence: 0.9 }));
}

const PRONOUN_MAP = {
  "he": "M", "him": "M", "his": "M",
  "she": "F", "her": "F", "hers": "F",
  "it": "N", "that": "N", "this": "N",
  "they": "P", "them": "P", "their": "P"
};

function guessGender(name) {
  if (!name) return "U";
  const n = name.toLowerCase();
  if (["miller", "vance", "man", "boy", "guy"].includes(n)) return "M";
  if (["sarah", "woman", "girl", "lady"].includes(n)) return "F";
  if (["address", "location", "coordinates", "drive", "key", "pad", "note", "paper", "rain", "ink", "smudge"].includes(n)) return "N";
  return "U"; 
}

const NARRATOR_ALIASES = new Set(["i", "me", "my", "myself", "narrator", "protagonist", "source_character"]);

function isNarrator(text) {
    if (!text) return false;
    return NARRATOR_ALIASES.has(text.toLowerCase().trim());
}

function resolveEntitiesWithAmbiguity(events) {
  const sorted = [...events].sort((a, b) => (a.trigger?.start || 0) - (b.trigger?.start || 0));
  
  for (let i = 0; i < sorted.length; i++) {
    const ev = sorted[i];
    if (!ev.roles) continue;
    
    for (const roleKey of ["source", "target"]) {
      const role = ev.roles[roleKey];
      if (role && role.head) {
        let head = role.head;
        role.resolved_entity = head; 
        role.ambiguity_penalty = 0;
        
        if (isNarrator(head)) {
            role.resolved_entity = "NARRATOR_ENTITY";
            continue;
        }

        const pGender = PRONOUN_MAP[head.toLowerCase()];
        if (pGender && pGender !== "N") {
          const candidates = [];
          for (let j = i - 1; j >= 0; j--) {
            const prevEv = sorted[j];
            for (const prevRoleKey of ["source", "target"]) {
              const prevRole = prevEv.roles?.[prevRoleKey];
              if (prevRole && prevRole.resolved_entity && !PRONOUN_MAP[prevRole.resolved_entity.toLowerCase()]) {
                const candidateEntity = prevRole.resolved_entity;
                const cGender = guessGender(candidateEntity);
                if (cGender === pGender || cGender === "U" || cGender === "P") {
                    if (!candidates.includes(candidateEntity)) candidates.push(candidateEntity);
                }
              }
            }
            if (candidates.length > 0) break;
          }

          if (candidates.length === 1) {
            role.resolved_entity = candidates[0];
          } else if (candidates.length > 1) {
            role.ambiguity_penalty = 0.2; 
            role.resolved_entity = null;
          } else {
            role.ambiguity_penalty = 0.3; 
          }
        }
      }
    }
  }
  return sorted;
}

function groundEvent(ev, text, doc) {
  if (!ev.anchor_hint) return null;
  
  // resolveAnchor handles trigger search internally.
  const grounded = resolveAnchor(doc, ev.anchor_hint, ev.trigger_text, {
    source: ev.roles?.source?.head,
    target: ev.roles?.target?.head,
    instrument: ev.roles?.instrument?.head,
    content: ev.roles?.content?.head
  });

  // If resolveAnchor failed to find the sentence, drop it.
  if (!grounded) return null;

  return {
    ...ev,
    trigger: grounded.trigger,
    roles: {
      ...ev.roles,
      source: ev.roles?.source ? { ...ev.roles.source, span: grounded.arguments.source?.span } : null,
      target: ev.roles?.target ? { ...ev.roles.target, span: grounded.arguments.target?.span } : null,
      instrument: ev.roles?.instrument ? { ...ev.roles.instrument, span: grounded.arguments.instrument?.span } : null,
      content: ev.roles?.content ? { ...ev.roles.content, span: grounded.arguments.content?.span } : null
    }
  };
}

function enrichDeliverySemantics(event) {
  const enriched = baseEnrich(event);
  const roles = event.roles || {};

  // FORCE REVEAL CATEGORY IF CONTENT IS PRESENT
  if (roles.content && roles.content.value && enriched.category !== EVENT_CATEGORIES.REVEAL) {
      enriched.category = EVENT_CATEGORIES.REVEAL;
  }

  if (enriched.category === EVENT_CATEGORIES.REVEAL || enriched.capabilities.includes(CAPABILITIES.EMITS_CONTENT)) {
    const hasTarget = roles.target && roles.target.head && roles.target.head !== "N/A" && roles.target.head !== "";
    const text = (event.anchor_hint || "").toLowerCase();
    const caps = new Set(enriched.capabilities);
    
    if (hasTarget) caps.add(CAPABILITIES.DELIVERS_TO_TARGET);
    else if (text.includes("muttered") || text.includes("whispered") || text.includes("internal")) caps.add(CAPABILITIES.PRIVATE_EMISSION);
    else caps.add(CAPABILITIES.BROADCAST_VISIBLE);
    
    enriched.capabilities = Array.from(caps);
  }
  return enriched;
}

function normalizeAndFilterEvents(rawEvents, text, doc) {
    const filtered = [];
    const seen = new Set();
    for (const raw of rawEvents) {
        if (!raw.trigger_text || !raw.anchor_hint || !raw.category) continue;
        const grounded = groundEvent(raw, text, doc);
        if (!grounded) continue;
        const key = `${grounded.category}_${grounded.trigger.start}_${grounded.trigger.end}`;
        if (seen.has(key)) continue;
        seen.add(key);
        filtered.push(grounded);
    }
    return filtered;
}

export async function extractEvents(text, keys) {
  if (!keys?.openai) throw new Error("Missing API key");

  const doc = buildDocumentStructure(text);
  
  // STAGE 1: Discovery
  const facts = await discoverNarrativeFacts(text, keys.openai);
  
  // STAGE 2: Normalization
  const rawEvents = await normalizeFactsToEvents(facts, text, keys.openai);

  if (rawEvents.length === 0) return { events: [], metrics: { final: 0, facts_found: facts.length }, logs: [] };

  const validEvents = normalizeAndFilterEvents(rawEvents, text, doc);
  const resolved = resolveEntitiesWithAmbiguity(validEvents);

  const clusters = [];
  const processedIdentities = new Set();

  for (const ev of resolved) {
    const identity = `${ev.category}_${ev.trigger?.start || 0}`;
    if (processedIdentities.has(identity)) continue;

    const variants = resolved.filter(v => `${v.category}_${v.trigger?.start || 0}` === identity);
    const avgExtractionConfidence = variants.reduce((sum, v) => sum + (v.confidence || 0.8), 0) / variants.length;
    
    let ensembleConfidence = avgExtractionConfidence;
    if (ev.roles?.source?.ambiguity_penalty) ensembleConfidence *= (1.0 - ev.roles.source.ambiguity_penalty);
    if (ev.roles?.target?.ambiguity_penalty) ensembleConfidence *= (1.0 - ev.roles.target.ambiguity_penalty);

    clusters.push({
      ...variants[0],
      confidence: Math.max(0.1, ensembleConfidence),
      ensemble_size: variants.length
    });
    processedIdentities.add(identity);
  }

  return {
    events: clusters.map((ev, i) => enrichDeliverySemantics({ ...ev, id: `E${i + 1}` })),
    metrics: {
      raw: rawEvents.length,
      valid: validEvents.length,
      final: clusters.length,
      facts_found: facts.length
    },
    logs: []
  };
}
