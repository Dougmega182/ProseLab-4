# NarrativeOS Roadmap

A staged plan from where you are now (operational Phase 6 canon + §22/§23 contract sealed) to a working trilogy-scale prose generation system. Phases are sequenced by dependency, not calendar — each gates the next.

---

## Phase 7 — Prose Generation Stub (current)

**Goal:** Prove §22 is enforceable, not just architecturally elegant.

- `decisions_parser.py` — markdown §22 → `book1_contract.json` (single source of truth, parsed every run)
- `prose_generator.py` (~80 lines) — load contract → build prompt → Opus 4.7 generates → Gemini 2.5 Pro lints → triage hard/soft/pass
- Two-beat smoke test: known-clean Ch 3 paragraph (must PASS), deliberately-corrupted variant (must trip the §22.4 guard)
- Lint report format locked: per-finding `{guard_id, severity, span, rationale}`

**Exit criterion:** clean beat passes, corrupted beat trips the right guard with the right span cited. Architecture proven.

---

## Phase 8 — Canon Reconciliation (deferred from Phase 6)

**Goal:** Clean the canonical store now that the generator has proven the §22 layer is the load-bearing one.

- Close out the four fake-pass-ID contamination patterns (ch0_2025-07-09, ch0_2025-01-27, ch0_2025-07-08, ch5_2025) — most already swept by `verify-fix-001`, finish the tail
- Re-run Hayden/Kain contamination audit against the cleaned store; confirm bell.discovery (Ch 8, pass=seed) survives untouched
- Reconcile superseded entries — decide per-fact whether the supersession was correct or the earlier extraction was right
- Snapshot a clean canon as `canon.phase8_clean.json` — this becomes the baseline the generator reads from

**Exit criterion:** zero fake-pass entries, audit scripts return clean, snapshot frozen.

---

## Phase 9 — Contract ↔ Canon Bridge

**Goal:** §22 and the canonical store stop being separate worlds.

- `canon_to_contract_check.py` — for every §22 entry with a `→ §23.X` ref, verify the canonical store contains a supporting fact (or flag the gap)
- `contract_to_canon_check.py` — reverse direction; flag canonical facts that contradict §22 (these are bugs in canon, not in §22)
- Wire both checks into the prose generator's pre-flight: stub refuses to run if contract and canon disagree on a beat's relevant facts
- Extend the linter to consult canon for facts (`Kain's authorisation = ICS 41`) alongside §22 for surface rules

**Exit criterion:** generator can produce a scene that obeys §22 *and* matches the canon's hard numbers, with the bridge catching disagreements before they hit prose.

---

## Phase 10 — Scene-Scale Generation

**Goal:** Move from beat to scene. This is the first phase where the system produces something a human reader would call "prose."

- Beat-chain assembly — generator takes a scene outline (3–8 beats), generates each beat with §22 context, stitches with continuity prompts
- Voice consistency check — separate lint pass against established voice samples (Opus reads Ch 3, asks "does this sound like the same narrator?")
- Per-character POV discipline — §22 entries gain a `pov_constraints` field (what Bell can know vs. what Hayden can know vs. what the narrator can know)
- Test against a real Ch 9.5 (Solis's apartment, A&S mug payoff) draft — your existing open author action item becomes the first real-stakes test

**Exit criterion:** a generated scene reads cleanly, obeys §22, matches canon, and survives your editorial markup without a structural rewrite.

---

## Phase 11 — Human-in-the-Loop Feedback (the deferred phase)

**Goal:** The iterative draft → markup → re-run loop becomes a first-class system feature, not a manual habit.

- `markup_parser.py` — reads your annotated drafts (margin notes, strikethroughs, replacement spans), emits structured feedback
- Feedback routes to three destinations: (a) §22 amendments if the note reveals a missing guard, (b) canon corrections if the note reveals a fact error, (c) prompt tuning if the note reveals a generator habit
- Diff-aware regeneration — generator can take "rewrite this paragraph keeping X, changing Y" without re-rolling the whole scene
- Markup → §22 amendment audit log so you can see which guards were learned from which feedback rounds

**Exit criterion:** a markup round genuinely improves the next generation without you having to manually translate notes into prompt changes.

---

## Phase 12 — Open Author Action Items (Batch 3)

**Goal:** Use the system to do the work it was built for.

- Ch 9.5 (Solis's apartment, A&S mug payoff) — full draft
- Ch 12.75 (Hayden's Transit) — full draft
- Ch 10 Dead Man's Switch full rebuild — priority per project memory
- Fade escalation passes — Ch 7.5, Ch 9 (tram), Ch 12 (Alfred Crescent), Ch 12.75
- Aspect interlude creative development — using §23.1 + §23.9 as the structural anchor

**Exit criterion:** Book 1 manuscript open items closed, with generated drafts surviving your markup at a rate that proves the system is faster than longhand.

---

## Phase 13 — Book 2 Spine Activation

**Goal:** §23's Book 2 entries graduate from placeholder shape to populated entries.

- Fill the five-part structure for each Book 2 spine entry (Bell-as-investigator, Hayden's return, Kain hunts Hayden, Emily realises pawn status, Limitless-mechanism, hand restoration)
- Create §22-Book-2 (a *new* prose-generation contract for Book 2 surface) — this is the moment §23's template-reuse argument either pays off or doesn't
- Foreclosure guards in §22-Book-2 protect Book 3 reveals; the N.K. lighter (§23.9) gets its surface rules
- Reconcile Book 1 canon forward — what does the canonical store look like after Book 1's reveals are resolved?

**Exit criterion:** Book 2 has the same architectural rigour Book 1 has now, and the prose generator can be pointed at either book without code changes.

---

## Phase 14 — Trilogy Convergence Layer

**Goal:** The three-candidate Aspect-meta-question (what Aspect serves) gets resolved in §23, and Book 3's spine populates.

- Lock the Aspect resolution — this is the single highest-leverage decision in the whole project, and deferring it past Phase 13 is correct because Book 2 prose has to be writable under all three candidates
- Book 3 §23 entries fill in
- §22-Book-3 contract
- Cross-book continuity linter — checks Book 1 prose for foreclosures against finalised Book 3 reveals (catches anything Book 1 prose hinted toward that Book 3 now contradicts)

**Exit criterion:** trilogy spine fully locked, contracts for all three books exist, generator is book-agnostic.

---

## Phase 15 — "Interview with the Devil" Template Reuse

**Goal:** Prove the architecture generalises.

- Spin up a second project using the §22/§23 split as the template
- Generalise `decisions_parser.py` to be project-agnostic
- Generator + linter + canon become a reusable NarrativeOS toolkit, not a Quantum-Shadows-specific stack

**Exit criterion:** a second novel project boots from template in under an hour, with no Quantum-Shadows code copy-paste.

---

## Cross-cutting tracks (run alongside, not gated)

- **Cost telemetry** — log Opus/Gemini token spend per beat, surface monthly; the cost-efficiency principle in project memory needs measurement to enforce
- **Cache TTL audit** — the local cache auto-invalidation rule (TTL + freshness + storage limits) needs a scheduled audit script regardless of phase
- **React UI** — remains out of scope per the scope lock, but Phase 11's markup parser is the natural seam where a UI would eventually attach; don't design around its absence in a way that forecloses it

---

## What's deliberately not on this roadmap

- **Inference caching** — rejected per project memory; doesn't solve the missing-global-context problem
- **React UI build** — scope-locked out of the current Python CLI track
- **Narrative State Graph** — explicitly out of scope per project memory
- **Automated extraction of new chapters** — the manual extraction discipline is working; don't automate it until Phase 10 proves the generator side first

---

## The honest sequencing call

Phase 7 → 8 → 9 is the critical path. Everything after Phase 10 depends on the generator working at scene scale, and everything after Phase 11 depends on the feedback loop closing cleanly. If Phase 10 reveals the generator can't hold scene-scale coherence, Phases 13–15 are premature and you'll want to revisit the §22 structure — not as failure but as the architecture telling you something.

The single biggest risk is treating §22 as done after Phase 7. §22 will need amendments through Phases 10 and 11 — that's not drift, that's the contract learning from contact with real prose. Build the amendment audit log early (Phase 7 or 8) so you can see §22 evolving rather than discovering six months in that it quietly grew without anyone tracking why.
