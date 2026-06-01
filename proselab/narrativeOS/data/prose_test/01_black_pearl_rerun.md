# Black Pearl rerun (calibration)

**Scene id:** `01_black_pearl_rerun`  
**Chapter context:** 1  
**Canon slice tokens:** ~31715  
**Attempts:** 1  
**Passed Lint:** True

## Outline

Kain returns to the Black Pearl bar three months after Ch 1. Emily is not there. He notices something specific about the space that wasn't there before. The scene runs approximately 200 words.

## Thinking

Let me work through this carefully.

**1. Three predictable clichés a hack writer would make:**

(a) **The "empty bar feels haunted" atmospheric cliché** — describing the Black Pearl as feeling "heavy with absence" or "thick with memories," using banned phrases. The voice rules ban "thick with [X]" and "heavy with [X]." The canon (world.black_pearl) establishes the Black Pearl as a specific physical space — converted shipping office, exposed brick, loading-bay ceiling, fourteen-metre bar, Gen-4 autom-unit — not an atmospheric mood piece. The prose must observe the space physically, not emotionally.

(b) **The "Kain feels Emily's absence emotionally" cliché** — writing something like "He felt her absence like a weight" or "His heart ached as he scanned the room for her." The emotional_grounding rules require emotion through observable action, count/measurement, or negative-space observation only. The emotional_crutches ban heart-related tells. Emily's absence must be shown through what Kain does or doesn't do, not through named feelings.

(c) **The "something ominous has changed" dramatic reveal** — using em-dashes for dramatic pause, writing "It wasn't the bar that had changed — it was something else" or deploying the banned "not X, but Y" contrastive structure. The forbidden_patterns ban this construction. The change Kain notices must be presented as clinical observation, consistent with craft.register_clinical — reported the way a carrier reports a body reading.

**2. Negative space:**

Emily is not there. The scene does NOT say why she isn't there. It does NOT say whether Kain expected her. It does NOT say what their relationship is now — three months after the events of Ch 1 where she briefed him on the investigation, destroyed his career years ago, and they parted in mutual leverage. The meaning lives in what Kain does NOT do: he does not ask the autom about her, he does not check his comm, he does not sit in a particular seat. The new detail he notices — something specific about the space — carries weight because of what it implies about who has or hasn't been here.

I need to think about what the "something specific" is. Given canon: the Black Pearl runs off-grid (mesh node under foundation slab), has a Gen-4 autom-unit, three sodium lights in the car park. What could be new?

Options:
- A new surveillance unit (Pelco camera) — would signal QSA presence encroaching on the off-grid space
- A physical object left behind — but this risks being too on-the-nose
- Something about the Gen-4 autom's behavior — a preference profile change
- Something about the sodium lights — one changed state

The sodium lights are established: "three sodium lights" in the car park. The Gen-4 autom has preference profiles. If the autom's passive array registers Kain and serves something different — or serves nothing — that would be a negative-space tell. Or if the autom serves his usual without the usual acknowledgment pattern.

Actually, the most interesting and canon-grounded option: the Gen-4 autom's preference profile for Kain has been reset or altered. This would imply someone with access wiped or modified the bar's systems — possibly as part of an identity scrub or QSA operation. But wait — the identity scrub happens later in the timeline (Ch 11). Three months after Ch 1 would be early in the investigation.

Let me reconsider. Something simpler and more physically grounded: one of the three sodium lights in the car park has changed. Canon says "three sodium lights" but doesn't specify their states at the Black Pearl. Actually, the "Three sodium lights. One dead, one cycling, one steady" example is given in the soft_caps section as an example of permitted environmental listing — it's not canon for the Black Pearl specifically. But it's a useful model.

Better option: a new camera. The Pelco surveillance array (world.pelco_surveillance_array) is established as QSA infrastructure. If a Pelco unit has appeared at or near the Black Pearl — which is supposed to be off-grid — that's a significant tell. It means the QSA's surveillance has reached a space that was operationally clean.

Or even better: something about the autom's behavior. The Gen-4 autom (world.gen4_autom) has a passive array and preference profiles. If the autom serves Kain's drink but the preference profile has been updated — say, it serves something slightly different, or it serves the drink Emily would have ordered alongside his — that would be a devastating negative-space detail. It would mean someone updated the profile, or the autom's passive array registered Emily's pattern from a visit Kain doesn't know about.

Actually, the most powerful version: the autom serves Kain's usual, but also sets down a second glass — Emily's preference — then clears it when no one sits. This would mean Emily has been here recently enough that the autom's profile associates Kain's arrival with Emily's. But that's too much interpretation for the autom's programming.

Let me go simpler. The Gen-4 autom has preference profiles. If the autom does NOT recognize Kain — if his profile has been cleared — that's a negative-space tell connected to the identity scrub. But the scrub hasn't happened yet at three months after Ch 1.

OK, let me think about timeline. Ch 1 is the beginning. Three months after Ch 1, Kain is deep into the investigation. The identity scrub happens in Ch 11, which is later. So at three months, Kain is still operational, still has his identity, but the investigation is underway.

What would be new at the Black Pearl three months in? Something that signals the investigation's reach, or the network's awareness of Kain.

The most grounded option: a new fixture. A camera, a sensor, a piece of hardware. Or something removed — something that was there before that isn't now.

Actually — the mesh node. Canon says the Black Pearl's "mesh node buried under the foundation slab and shielded well enough that nothing transmitted in or out without the owner's say-so." If the mesh node's shielding has been compromised — if Kain's comm device gets a signal where it shouldn't — that's a tell. The bar is no longer off-grid. Someone has breached the shielding.

This is good. It's specific, canon-grounded, and carries enormous implications without stating them. If the Black Pearl is no longer off-grid, Kain's operational clean space is compromised.

But how would Kain notice this? His comm device would register a signal. Or his tablet. A notification arriving in a space where notifications don't arrive.

Let me draft:

Kain enters the Black Pearl. The Gen-4 autom serves his usual. Emily is not there. He sits. His comm device — which has never received a signal inside the Black Pearl in four years — receives a signal. A single notification. He looks at the device. He looks at the bar surface. He does not open the notification.

That's clean. ~200 words. The negative space: he doesn't open it, he doesn't ask who compromised the shielding, he doesn't leave. The signal's presence IS the story.

Wait — but the comm device receiving a signal is a bit abstract. Let me think about whether there's something more physically observable.

Actually, let me reconsider. The scene says "He notices something specific about the space that wasn't there before." This implies a physical change to the space itself, not a signal on his device.

Physical changes to the Black Pearl space:
- A new camera (Pelco unit) mounted somewhere
- A mark on the bar surface
- A different arrangement of something
- The autom behaving differently
- A new fixture or removed fixture

The most powerful: a small, specific physical addition. A Pelco camera would be too obvious — the Black Pearl's owner wouldn't allow it. Something subtler.

What about: a new scratch or mark on the fourteen-metre bar that corresponds to a QSA marking convention? Or a blue classification tape — the kind used on Threshold internal doors (world.threshold_facility: "Internal doors marked with blue classification tape").

A strip of blue tape. On the inside of the bar's service door, or on a surface Kain can see from his seat. Blue classification tape means QSA has been here and marked the space. The Black Pearl — his off-grid sanctuary — has been classified.

That's devastating and specific. Blue tape = Threshold facility marking convention. Its presence at the Black Pearl means the QSA has formally designated this space.

Let me draft the scene:

---

The Gen-4 set his glass on the bar before he sat down. The passive array had registered him at the door — four years of Tuesday evenings encoded in the preference profile, the pour calibrated to a margin he had never needed to correct.

Emily's seat was empty. It had been empty for three months. The autom did not set a second glass.

He drank. The bourbon was correct. The ice was correct. The fourteen-metre bar stretched east under the loading-bay ceiling, exposed brick catching the downlight at the angles he had catalogued on his first visit and not recatalogued since.

The blue tape was new.

A single strip, fifteen centimetres, applied to the service door frame at handle height. The adhesive was QSA standard — the matte finish that did not reflect light, the specific width used on Threshold internal doors. Someone had classified this room.

Kain set his glass down. The Gen-4's wrist articulation cycled through its idle routine — that slight over-precision, the absence of the micro-hesitation that plagued the Gen-3s. The autom had not been told about the tape. The autom did not need to be told.

He finished the bourbon. He did not look at the tape again.

---

Let me count: approximately 195 words. Good.

Now let me review against forbidden patterns:

**Constructions:**
- "the specific [noun] of [situation]" — WAIT. I have "the specific width used on Threshold internal doors." This uses "the specific width" — is this the banned construction? The ban is "the specific [noun] of [situation]." My usage is "the specific width used on..." — it's "the specific [noun] [verb phrase]" not "the specific [noun] of [situation]." However, looking at craft.repeated_phrases, it says "'the specific quality of X' (clinical observation)" is a recurring formula. The ban in forbidden_patterns says "the specific [noun] of [situation]" is permanently banned. My construction is "the specific width used on" — no "of" — so it's technically not the banned form. But it's close enough to feel like it. Let me rewrite to be safe.

Change to: "the matte finish that did not reflect light, the width matched to Threshold internal doors."

Actually, let me reconsider. The ban is specifically "the specific [noun] of [situation]" — with "of." My phrase "the specific width used on" doesn't use "of." But the instruction says this construction "was overused in prior chapters and is now permanently banned." The spirit of the ban seems to target "the specific X of Y" pattern. Let me just avoid "the specific" entirely to be safe.

Revised: "the matte finish that did not reflect light, the width that matched Threshold internal doors."

- "not X, but Y" — checking... "not an echo" appears in canon but I don't use it. I don't see this pattern in my draft.
- "in that moment" — not present.
- Em-dash for dramatic pause — I use em-dashes only for genuine parenthetical/structural purposes. Let me check: "The passive array had registered him at the door — four years of Tuesday evenings encoded in the preference profile" — this is a parenthetical expansion, not a dramatic pause. OK. "The adhesive was QSA standard — the matte finish..." — this is appositional, clarifying. OK. "that slight over-precision, the absence of the micro-hesitation that plagued the Gen-3s" — no em-dash here. OK.
- "Furthermore" etc. — not present.

**Filter words:**
- saw, heard, felt, noticed, watched, observed, realized, knew, thought — checking... I don't see any of these used as filter words. "He did not look at the tape again" — "look" is not on the banned list; it's an action verb here, not a filter.

Wait — the outline says "He notices something specific." But in my prose I don't use "noticed" — I show the tape directly. Good.

**Dialogue tags:** No dialogue. N/A.

**Vocabulary bans:** 
- vibrant, tapestry, delve, etc. — not present.
- "hum" — not present.
- "ozone" — not present.
- "thick with," "heavy with," "pregnant with" — not present.

**Emotional crutches:**
- heart/breath/eyes clichés — not present.
- "a chill ran through" — not present.
- "he felt [emotion]" — not present.

**3. Tropes deployed:**

- **"The sanctuary compromised" trope** — the safe space is no longer safe. Grounded in: (a) world.black_pearl establishes the bar as off-grid, operationally clean; (b) world.threshold_facility establishes blue classification tape as QSA institutional marking; (c) the trope is subverted because Kain does not react with alarm or departure — he finishes his drink and does not look at the tape again. The predictable shape (character discovers sanctuary is compromised → panic/flight) is refused. Kain's non-reaction IS the reaction.

- **"The empty chair" trope** — the absent partner's seat. Grounded in: (a) emily.identity.v2 and the eleven-year professional history; (b) subverted because the prose does not dwell on the empty seat or make it symbolic — it's stated in two sentences and the scene moves on. The autom's non-action (not setting a second glass) carries the weight.

**4. Forbidden pattern review (final check):**

Re-reading my revised draft:

"The Gen-4 set his glass on the bar before he sat down. The passive array had registered him at the door — four years of Tuesday evenings encoded in the preference profile, the pour calibrated to a margin he had never needed to correct.

Emily's seat was empty. It had been empty for three months. The autom did not set a second glass.

He drank. The bourbon was correct. The ice was correct. The fourteen-metre bar stretched east under the loading-bay ceiling, exposed brick catching the downlight at the angles he had catalogued on his first visit and not recatalogued since.

The blue tape was new.

A single strip, fifteen centimetres, applied to the service door frame at handle height. The adhesive was QSA standard — the matte finish that did not reflect light, the width that matched Threshold internal doors. Someone had classified this room.

Kain set his glass down. The Gen-4's wrist articulation cycled through its idle routine — that slight over-precision, the absence of the micro-hesitation that plagued the Gen-3s. The autom had not been told about the tape. The autom did not need to be told.

He finished the bourbon. He did not look at the tape again."

Checking each sentence:
- No "the specific [noun] of [situation]" ✓
- No "not X, but Y" contrastive ✓
- No "in that moment" ✓
- Em-dashes: two uses, both parenthetical/appositional, not dramatic pause ✓
- No banned transition words ✓
- No filter words (saw, heard, felt, noticed, watched, observed, realized, knew, thought) ✓
- No banned dialogue tags (no dialogue) ✓
- No banned vocabulary ✓
- No emotional crutches ✓
- No banned phrases ✓

**5. Soft cap counts:**

- Anaphora chains: "The bourbon was correct. The ice was correct." — that's 2 (at the cap). "The autom had not been told... The autom did not need to be told." — that's 2 more. Wait, is that an anaphora chain? "The autom" repeats at the start of two consecutive sentences. That's a chain of 2. And "was correct" repeats in two consecutive clauses. That's also 2. The cap is max 2 anaphora chains per scene. I have 2 chains. At the cap. OK.

Actually wait — let me re-read the cap: "Anaphora chains: max 2." Does this mean max 2 chains, or max 2 items in a chain? I think it means max 2 chains (instances of anaphora). I have 2. At the cap but within it.

- "Kind of [X]" / "sort of [X]": 0 ✓
- Pulse-count references: 0 ✓
- Underwriting-by-absence: "He did not look at the tape again" — this is underwriting by naming what he didn't do. That's 1. Within cap of 1. ✓
- Rule of three: "The bourbon was correct. The ice was correct." — that's only two items, not three. "He drank. The bourbon was correct. The ice was correct." — three sentences but not a "A, B, and C" structure. I think this is fine. 0 rule-of-three uses. ✓
- "As if" similes: 0 ✓

All within caps. ✓

**6. Sensory grounding:**

- **Bourbon taste/temperature**: Grounded in the Gen-4 autom's preference profile (world.gen4_autom) — the pour is calibrated from four years of visits.
- **Exposed brick catching downlight**: Grounded in world.black_pearl — "exposed brick, loading-bay ceiling." The downlight is a specific fixture in the bar space. Time of day is implied (evening — "Tuesday evenings").
- **Blue tape visual**: Grounded in world.threshold_facility — "Internal doors marked with blue classification tape." The matte finish and width are specific physical properties of QSA-standard adhesive.
- **The Gen-4's wrist articulation**: Grounded in world.gen4_autom — "that slight over-precision, the absence of the micro-hesitation that plagued the Gen-3s when orders stacked."

All sensory details are specifically named, motivated by the physical environment, and tied to canon sources. ✓

One more thought: "the angles he had catalogued on his first visit and not recatalogued since" — this connects to kain.investigation_method (reading pass, treating information density of a space as valuable) and kain.proprioceptive_mapping_habit. Good.

The scene is ready. Let me also verify: "Emily's seat was empty. It had been empty for three months." — this doesn't contradict canon. Three months after Ch 1, Emily would be managing the official investigation (plot.loop_official_investigation_direction) and meeting with QSA internal liaison. Her absence from the Black Pearl is consistent with the operational separation established at the end of Ch 1.

"The autom did not set a second glass" — this implies the autom's preference profile previously associated Kain's arrival with Emily's presence (they came together often enough for the pattern to encode). Now it has adapted to her absence. This is consistent with the Gen-4's passive array and preference profile system.

"Someone had classified this room" — the implication is that the QSA has formally designated the Black Pearl as a QSA-relevant space, despite its off-grid status. This doesn't contradict canon — it extends the world logically. The blue tape is a physical marker, not an electronic intrusion, which is consistent with the bar's mesh-node shielding (the shielding blocks electronic transmission, but physical marking is unaffected).

I'm satisfied. The scene is clean.

Actually, one small revision. "Emily's seat was empty. It had been empty for three months." — I want to make sure "It had been empty for three months" doesn't read as telling. It's a factual observation — a duration count. Per craft.measurement_as_voice, counts and timestamps are load-bearing details. This is fine.

Let me also reconsider whether "Someone had classified this room" is too much telling. It's a deduction, not an emotion. Kain reads the tape and draws a conclusion. The register is clinical/investigative, consistent with his method. It's showing his analytical process through a single declarative sentence. I think it works.

Final draft is ready.

## Prose

The Gen-4 set his glass on the bar before he sat down. The passive array had registered him at the door — four years of Tuesday evenings encoded in the preference profile, the pour calibrated to a margin he had never needed to correct.

Emily's seat was empty. It had been empty for three months. The autom did not set a second glass.

He drank. The bourbon was correct. The ice was correct. The fourteen-metre bar stretched east under the loading-bay ceiling, exposed brick catching the downlight at the angles he had catalogued on his first visit and not recatalogued since.

The blue tape was new.

A single strip, fifteen centimetres, applied to the service door frame at handle height. The adhesive was QSA standard — the matte finish that did not reflect light, the width that matched Threshold internal doors. Someone had classified this room.

Kain set his glass down. The Gen-4's wrist articulation cycled through its idle routine — that slight over-precision, the absence of the micro-hesitation that plagued the Gen-3s. The autom had not been told about the tape. The autom did not need to be told.

He finished the bourbon. He did not look at the tape again.

## Lint report

```
Word count: 202

HARD VIOLATIONS: none

SOFT CAP VIOLATIONS: none

```