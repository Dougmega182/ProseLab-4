# All-in-One Banned Items List (Prose Filter)

This list merges hard bans for the worst AI-tell offenders and soft caps for patterns that can be used deliberately in moderation. It prioritizes the clinical, proprioceptive voice of the narrative over generic, melodramatic, or AI-default constructions.

## Hard-Banned Constructions & Patterns
- The specific [noun] of [situation] (e.g., "the specific type of smell that only a dog could sense")
- `not X, but Y` contrasts (including "It wasn't X. It was Y.", "It's not just X, it's Y.", "No X. Just Y.", "A is not about X, it's about Y.")
- Em-dashes for dramatic pauses or emphasis (parenthetical interruptions OK)
- "In that moment" / "It was in this moment"
- Awkward or forced comparative prose/similes/metaphors (e.g., "his arm bent at a 90-degree angle, the way a pipe bends when you apply heat to it" — mechanical, non-grounded, or nonsensical analogies)
- Excessive "like" similes (e.g., "She laughed like [random unrelated thing]")
- "The kind of / the sort of / the type of" qualifiers
- "But here's the truth..." / "Here's what nobody's saying..." (ta-da phrases)
- Rhetorical question + immediate answer
- Colon-into-fragment lists (e.g., "He was the perfect spy: quiet, unassuming, deadly.")
- Overly polished or therapist-like dialogue
- Characters "tracing lazy circles" with fingers, forehead touches, etc.

## Hard-Banned Filter Words & Verbs
- saw, heard, felt, noticed, watched, observed, realized, knew, thought
- remarked, observed, noted, commented, expressed, declared, mused

## Hard-Banned Vocabulary & Phrases
- vibrant, tapestry, delve, navigate (non-literal), resonate (non-literal), rich, intricate, ethereal, dappled, filtered
- furthermore, moreover, additionally, indeed, crucially, it is worth noting, absolutely, certainly (as filler emphasis)
- ozone (unless literal electrical/quantum), hum (as atmospheric background)
- thick with [X], heavy with [X], pregnant with [X]
- labyrinthine, cacophony, shards (metaphorical), symphony (of anything non-musical), fractured/fractals (metaphorical)
- etched, palpable, tangible, testament, kaleidoscope, myriad, plethora, profound, nuanced (overused)
- unlock, unleash, elevate, embark, transformative, revolutionary, cutting-edge, paradigm shift
- Whispering forests/trees, ethereal glow

## Hard-Banned Emotional & Physical Crutches
- heart swelled / pounded / hammered
- breath hitched / caught
- eyes flashed / blazed / shone / darkened / widened
- a chill ran through [him/her]
- warmth spread / bloomed / flooded
- [he/she] felt [emotion] (direct telling)
- furrowed brow, jaw clenched/tightened, single tear, butterflies in stomach, heart skipped a beat

## Soft Caps (Per Scene)
- **Anaphora chains:** max 2
- **"Kind of / Sort of":** max 3
- **Pulse/heartbeat metaphors:** max 1 (unless plot-critical)
- **Underwriting-by-absence:** max 1 ("he did not feel...", "it wasn't that he...")
- **Rule of three lists:** max 2 (soft, deliberate use only, like sodium lights)
- **Overuse of "as if" similes/comparisons:** max 2–3 per scene

## Implementation Notes
- **Two-pass system:** Hard bans first (flag + suggest replacements), then soft cap counters per scene.
- **Simile rules:** Flag anything that feels mechanical, overly technical, or disconnected from lived sensory/emotional experience. Human similes are usually grounded, messy, or idiosyncratic.
- **Exceptions:** Allow rare deliberate breaks with a manual override flag (e.g., `#ALLOW_RULE_OF_THREE`).
