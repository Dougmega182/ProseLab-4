# Deterministic Hard-Banned Prose Rules

This document defines the strict, regex-enforceable hard bans for the prose generator. Any occurrence of these patterns or words triggers an immediate lint failure and a rewrite cycle.

## Hard-Banned Constructions & Patterns

- **The specific [noun] of [situation]:** Permanent ban of the `the specific \w+ of` structure (e.g., "the specific scent of").
- **Contrastive "Not X, but Y" structures:** Permanent ban of contrastive pairings, including:
  - `not X, but Y`
  - `It wasn't X. It was Y.` / `It was not X. It was Y.`
  - `It's not just X, it's Y.` / `It is not just X, it is Y.`
  - `No X. Just Y.`
  - `X is not about Y, it's about Z.`
- **"In that moment" / "It was in this moment":** Banned temporal markers.
- **"But here's the truth..." / "Here's what nobody's saying...":** (Ta-da phrases).
- **Em-dashes for dramatic pauses:** Single em-dashes (`—` or `--`) acting as dramatic pauses within a sentence are banned (parenthetical pair interruptions are permitted).
- **Rhetorical question + immediate answer:** A question followed immediately by a declarative sentence.

## Section 22 Names & Forbidden Attributions

- **Alain Aspect:** Never name `Alain Aspect` in Book 1 (use placeholders or indirect subtext only).
- **N.K.:** Banned designation in Book 1.
- **Alain and Solis:** No direct decoding of the two figures.

## Explicit/Illegal Deductions

- **Lubricant viscosity:** Direct scientific measurement calculations or impossible tactile deductions.
- **Direct A&S decoding:** Explicit connections of the A&S mug to its historical designer.

## Banned Vocabulary & Filler Words

- **AI-default terms:** `vibrant`, `tapestry`, `delve`, `delving`, `ethereal`, `dappled`, `filtered` (for light), `labyrinthine`, `cacophony`, `shards` (metaphorical), `symphony` (metaphorical), `fractured` (metaphorical), `fractals` (metaphorical).
- **Overused prose terms:** `etched`, `palpable`, `tangible`, `testament`, `kaleidoscope`, `myriad`, `plethora`, `profound`, `nuanced`.
- **Hype/activation verbs:** `unlock`, `unleash`, `elevate`, `embark`, `transformative`, `revolutionary`, `cutting-edge`, `paradigm shift`.
- **Banned dialogue tags:** `remarked`, `observed`, `noted`, `commented`, `expressed`, `declared`, `mused` (default to "said" or omit).
- **Filler transitional words:** `furthermore`, `moreover`, `additionally`, `indeed`, `crucially`, `it is worth noting`, `absolutely`, `certainly`.
- **Prepositional atmospheric phrases:** `thick with [X]`, `heavy with [X]`, `pregnant with [X]`.
- **AI-style atmospheric cliches:** `whispering forests`, `whispering trees`, `ethereal glow`, `smile played across [his/her] lips`, `worn smooth`, `cognitive architecture`.

## Banned Filter Words (Perceptual Interposition)

Banned when used in perceptual forms indicating what characters saw, heard, or felt instead of showing the sensory reality:
- `saw`, `heard`, `felt`, `noticed`, `watched`, `observed`, `realized`, `knew`, `thought`.

## Emotional & Physical Crutches

- **Cardiac tells:** `heart swelled`, `heart pounded`, `heart hammered`, `heart raced`, `heart skipped`, `heart skipped a beat`.
- **Respiratory tells:** `breath hitched`, `breath caught`, `breath stopped`, `breath stuck`.
- **Ocular tells:** `eyes flashed`, `eyes blazed`, `eyes shone`, `eyes darkened`, `eyes narrowed`, `eyes widened`.
- **Vascular/Somatic tells:**
  - `chill ran through`
  - `warmth spread`, `warmth bloomed`, `warmth flooded`
  - `felt [emotion]` (direct telling)
  - `furrowed brow`, `jaw clenched`, `jaw tightened`
  - `single tear`
  - `butterflies in stomach`
