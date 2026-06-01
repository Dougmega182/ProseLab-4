# NarrativeOS Roadmap

This roadmap reflects the current Python CLI track for NarrativeOS. It uses
the actual Quantum Shadows chapter sequence and keeps fractional chapter labels
out of planning language.

## Canonical Chapter Map

- Prologue
- Chapter 1: Black Pearl Bar
- Chapter 2: The Mountain
- Chapter 3: Threshold
- Chapter 4: Hayden Before the Fracture
- Chapter 5: Alfred Hospital
- Chapter 6: The Manifest
- Chapter 7: The Apartment
- Chapter 8: The Vector
- Chapter 9: The Mirror Hunt
- Chapter 10: Reyes
- Chapter 11: Bell Discovers the Lie
- Chapter 12: The Tuesday Contact
- Chapter 13: Dead Man's Switch
- Chapter 14: The Mirror Hunt: Securing the Map
- Chapter 15: The Apartment
- Chapter 16: The Breach
- Chapter 17: The Instrument's Consent
- Chapter 18: Hayden's Transit
- Chapter 19: The Descent
- Chapter 20: The Infiltration
- Chapter 21: The Window
- Chapter 22: The Fixed Point
- Epilogue: The Waking World

## Current Status

Phase 7, Phase 8, and Phase 9 are now implemented at the CLI/package level.
Phase 10 is in progress: the scene-scale generator exists, and the Solis
apartment scene is being used as the first strict scene fixture.

The current manuscript source for fixture and smoke-test work is:

```text
E:\Ai\ProseLabV2\DRAFTS\Quantum Shadows - EXTENDED DRAFTv1.md
```

## Phase 7 - Prose Generation Stub

Status: complete.

Completed:

- `contracts.py` defines the contract schema and duplicate-rule validation.
- `decisions_parser.py` parses Section 22 from `decisions.md`.
- `build-contract` writes `data/contracts/book1_contract.json`.
- `contract_lint.py` returns structured findings with `guard_id`, `severity`,
  `span`, and `rationale`.
- `prose_generator.py` loads contracts, renders Section 22 into prompts, and
  retries with bounded repair feedback.

Outstanding:

- Decide whether the generated `book1_contract.json` should be committed as
  canonical generated data or regenerated in CI from `decisions.md`.
- Lock exact clean/corrupted manuscript fixtures for long-term Section 22 tests.
- Keep Gemini-backed contract lint behind the provider abstraction when it is
  added; no direct LLM endpoint calls in business logic.

## Phase 8 - Canon Reconciliation

Status: complete.

Completed:

- `canon_audit.py` provides package commands for fake pass-id checks,
  contamination checks, and canon snapshots.
- Hayden/Kain contamination checks are available through the CLI.
- `data/canon.phase8_clean.json` is the frozen generator baseline.
- Bell discovery remains keyed to the real `bell.discovery` canon id.

Outstanding:

- Re-run audits after any future canon mutation before generating prose.
- Treat the Phase 8 snapshot as the baseline until a deliberate replacement is
  created.

## Phase 9 - Contract/Canon Bridge

Status: complete.

Completed:

- `contract_canon_bridge.py` checks Section 22 rules against canon support.
- `data/contracts/s22_canon_mapping.json` is the canonical bridge file between
  human-readable decisions and actual canon ids.
- Supersession-chain resolution is implemented.
- `check-contract-canon` exposes the bridge preflight through the CLI.
- Generation refuses to proceed when blocking contract/canon findings exist.

Outstanding:

- Add more contradiction fixtures as new Section 22 guards are discovered.
- Keep negative guard ids in the `s22.guard.no_*` style.

## Phase 10 - Scene-Scale Generation

Status: in progress.

Completed:

- `scene_generator.py` introduces scene plans, beats, diagnostics, and draft
  assembly.
- `generate-scene-plan` runs scene-plan generation from a JSON fixture.
- The Solis apartment fixture includes:
  - off-book Kain entry
  - early insertion trial records
  - Subject 7 reveal pressure
  - A&S mug signal without explicit deduction
  - per-beat word budgets
  - plot-motion constraints
  - forbidden-term diagnostics
- The latest editorial assessment has been converted into stricter fixture
  constraints: no impossible tactile deductions, no omniscient certainty, no
  stalled living-room analysis, and no filter-word crutching.

Outstanding:

- Run a fresh live smoke after the latest beat-budget parser and fixture
  constraints.
- Wire `data/contracts/banned_items_list.md` into executable lint only after
  deciding which items are hard failures versus editorial warnings.
  - Hard deterministic lint: exact banned vocabulary, explicit S22 terminology
    bans, biological-proof lines, impossible deductions, and direct A&S
    decoding.
  - Semantic critic rubric: awkward similes, anaphora-chain overuse,
    colon-fragment stacking, rule-of-three excess, pacing stalls, and clinical
    observation that turns into final explanation.
- Add better scene stitching checks so later beats cannot be dropped when an
  earlier beat overruns.
- Add voice consistency checks against approved manuscript samples.

Exit criterion:

- The Solis apartment scene reads as a coherent scene, obeys Section 22, matches
  canon, respects beat budgets, and survives manual editorial review without a
  structural rewrite.

## Phase 11 - Human Feedback Loop

Status: outstanding.

Goal:

- Turn author markup into structured regeneration input.

Planned work:

- `markup_parser.py`
- `FeedbackNote`
- `FeedbackRoute`
- amendment audit log at `data/contracts/amendments.log.jsonl`
- targeted regeneration from marked spans without rerolling the whole scene

Exit criterion:

- A marked-up scene can trigger a bounded rewrite that keeps approved material
  and fixes only the cited issue.

## Phase 12 - Open Author Action Items

Status: outstanding.

Goal:

- Use the generator on real manuscript work after the Solis apartment fixture
  proves the scene-scale pipeline.

Candidate work should be selected from the canonical chapter map above. Current
high-value targets:

- Chapter 13: Dead Man's Switch rebuild work
- Chapter 18: Hayden's Transit
- Fade escalation passes in the existing numbered chapters where Fade appears
- Aspect interlude development, anchored to Section 23

Exit criterion:

- Real manuscript scenes survive the contract/canon/voice loop faster than
  longhand-only drafting.

## Phase 13 - Book 2 Spine Activation

Status: outstanding.

Goal:

- Populate Book 2 spine entries and create a Book 2 surface contract without
  changing the generator code.

Outstanding:

- Fill Book 2 Section 23 entries.
- Create a Book 2 Section 22 contract.
- Reconcile Book 1 canon forward after Book 1 reveals resolve.

## Phase 14 - Trilogy Convergence Layer

Status: outstanding.

Goal:

- Lock the Aspect meta-question and add cross-book continuity linting once Book
  2 has survived real prose generation.

Outstanding:

- Book 3 spine entries.
- Book 3 surface contract.
- Cross-book foreclosure checks.

## Phase 15 - Template Reuse

Status: outstanding.

Goal:

- Prove NarrativeOS can boot a second novel project without Quantum
  Shadows-specific code copy-paste.

Outstanding:

- Project config isolation.
- Project-agnostic contract parsing.
- Reusable CLI workflow for a second manuscript.

## Cross-Cutting Outstanding Work

- Cost telemetry for live LLM runs.
- Cache TTL audit.
- Better long-scene test coverage.
- Clear policy for generated data versus build artifacts.
- Audit legacy fractional chapter labels in active canon/seed data and migrate
  them to the canonical chapter map before manuscript-ready generation.
- Continued documentation updates whenever implementation status changes.

## Deliberately Out of Scope

- React/Vite app work for this Python CLI track.
- Narrative state graphs or graph-shaped causality models.
- Direct network calls to LLM endpoints outside the provider/router layer.
- Inference caching as a substitute for contract/canon correctness.
