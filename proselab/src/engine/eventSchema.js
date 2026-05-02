/**
 * EVENT ONTOLOGY
 * Controlled vocabulary for atomic events to prevent semantic drift.
 */

export const EVENT_CATEGORIES = {
  ACTION: "ACTION",           // Physical movement or manipulation
  REVEAL: "REVEAL",           // Information transfer or discovery
  STATE_CHANGE: "STATE_CHANGE" // Emotional or environmental shift
};

export const EVENT_SUBTYPES = {
  DIALOGUE_EXPLICIT: "DIALOGUE_EXPLICIT",
  DIALOGUE_IMPLICIT: "DIALOGUE_IMPLICIT",
  REVEAL_EXPLICIT: "REVEAL_EXPLICIT",
  REVEAL_IMPLICIT: "REVEAL_IMPLICIT",
  DOCUMENT_READ: "DOCUMENT_READ",
  SENSORY_OBSERVATION: "SENSORY_OBSERVATION",
  OBJECT_MANIPULATION: "OBJECT_MANIPULATION",
  PHYSICAL_MOVEMENT: "PHYSICAL_MOVEMENT",
  THRESHOLD_CROSS: "THRESHOLD_CROSS",
  VIOLENCE_EXECUTION: "VIOLENCE_EXECUTION",
  MECHANISM_TRIGGER: "MECHANISM_TRIGGER",
  GESTURE_ACK: "GESTURE_ACK",
  EMOTIONAL_DISPLAY: "EMOTIONAL_DISPLAY",
  VISUAL_DESCRIPTOR: "VISUAL_DESCRIPTOR",
  SECRET_REVEAL: "SECRET_REVEAL"
};

export const EVENT_SCHEMA_PROMPT = `
EXTRACT narrative events (actions, speech, reveals).

SCHEMA:
- category: [ACTION, REVEAL, STATE_CHANGE]
- subtype: [${Object.values(EVENT_SUBTYPES).join(", ")}]
- anchor_hint: A unique phrase from the sentence.
- trigger_text: The verb or key info.
- roles: (ALL OPTIONAL)
    - source: { head: "Who did it" }
    - target: { head: "Who it was for" }
    - content: { 
        type: [ADDRESS, CODE, NAME, SECRET, OBJECT_DESC],
        value: "The actual info",
        head: "The text used"
      }

RECALL RULES:
1. PREFER NON-EMPTY: If anything happens, extract it. If unsure, output your best guess.
2. REACTION AS RECEIPT: If a character nods, smiles, pales, or widening eyes after info is shared, use subtype GESTURE_ACK or EMOTIONAL_DISPLAY.
3. LOOSE ROLES: If you can't find a target, leave it out. If source is "I", use "I".
4. DESCRIPTIVE TRIGGERS: Triggers can be phrases (e.g., "passed the note").
5. SEMANTIC REVEALS: If info (like a code) appears, extract a REVEAL even if the verb is weak.
6. NO STRUCTURAL PURISM: Focus on the facts of the story, not linguistic perfection.
`;
