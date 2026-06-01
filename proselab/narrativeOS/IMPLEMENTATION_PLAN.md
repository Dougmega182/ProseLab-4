# NarrativeOS Implementation Plan

This plan turns `ROADMAP.md` into executable work. It keeps the roadmap's
sequence, but makes the next engineering moves concrete: what to build, where
it belongs, what tests prove it, and what blocks the next phase.

Current baseline, verified from the repo:

- Active package: `src/narrative_os/`
- CLI entry: `python -m narrative_os`
- Existing generation path: `prose_generator.py` builds canon-aware prompts and
  repairs against `prose_lint.py`
- Current manuscript source for new fixture/smoke-test work:
  `E:\Ai\ProseLabV2\DRAFTS\Quantum Shadows - EXTENDED DRAFTv1.md`
- Existing continuity path: manuscript parsing, deterministic retrieval, LLM
  extraction, conflict detection, merge/pending review, inevitability critic
- Existing gap for Phase 7: no `decisions_parser.py`; Section 22 is not parsed
  into a contract file; Gemini provider is still a stub; prose lint is local
  regex/cap based, not the roadmap's Gemini contract-lint pass
- Scope lock: Python CLI only. React/Vite work stays out of scope.

## Status Snapshot

Last updated: 2026-06-02.

### Completed

- Phase 7 core is implemented:
  - contract schema and duplicate-id validation
  - Section 22 parser from `decisions.md`
  - generated `data/contracts/book1_contract.json`
  - deterministic contract lint result shape
  - contract rendering and retry-aware lint feedback in `prose_generator.py`
  - `build-contract` CLI command
- Phase 8 core is implemented:
  - `canon_audit.py` package commands
  - fake pass-id audit
  - Hayden/Kain contamination audit
  - `data/canon.phase8_clean.json` snapshot baseline
- Phase 9 core is implemented:
  - contract/canon bridge
  - canonical mapping support through `data/contracts/s22_canon_mapping.json`
  - supersession-chain resolution
  - `check-contract-canon` CLI preflight
  - generation preflight blocking for high-severity bridge findings
- Phase 10 scaffold is implemented:
  - `scene_generator.py`
  - `generate-scene-plan` CLI command
  - Solis apartment scene brief and machine-readable scene plan
  - per-scene and per-beat word-budget parsing
  - required/forbidden term diagnostics
  - live smoke artifacts for editorial review

### Latest Verification

- `python -m narrative_os build-contract --decisions decisions.md --mapping data\contracts\s22_canon_mapping.json --out data\contracts\book1_contract.json`
  wrote 26 contract rules.
- `python -m narrative_os check-contract-canon --contract data\contracts\book1_contract.json --mapping data\contracts\s22_canon_mapping.json`
  reported `Contract/canon bridge: clean`.
- `python -m narrative_os audit-fake-pass-ids` found 0 fake pass entries.
- `python -m narrative_os audit-contamination --entity Hayden` found 0
  unallowed seed violations.
- `python -m narrative_os audit-contamination --entity Kain` found 0
  unallowed seed violations; `kain.investigation_method` remains the only
  allowed seed match.
- `python -m pytest tests -v` passed with 207 passed and 3 skipped.

### Outstanding

- Treat `data/contracts/banned_items_list.md` as an editorial reference until
  it is intentionally wired into `prose_lint.py` or contract lint.
- Run a fresh Solis apartment scene smoke after the latest beat budgets and
  plot-motion constraints were added.
- Audit and correct legacy fractional chapter labels in active canon/seed data
  before treating generated prose as manuscript-ready.
- Decide whether `book1_contract.json` remains committed generated data or is
  regenerated in CI from `decisions.md`.
- Lock the exact clean/corrupted Ch 3 prose fixtures for the Section 22 guard
  tests.
- Add cost telemetry and cache TTL audit scripts.
- Build Phase 11 markup parsing and amendment logging.
- Expand scene stitching and voice/semantic consistency checks once the Solis
  apartment scene survives manual editorial review.
- Split `data/contracts/banned_items_list.md` into:
  - deterministic hard-fail regex rules for exact banned vocabulary, S22 names,
    and explicit illegal deductions
  - semantic critic rubric items for constructions that need judgement, such
    as anaphora chains, awkward similes, colon-fragment stacking, and rule-of-
    three overuse

## Critical Path

The immediate path is Phase 7 -> Phase 8 -> Phase 9.

Do not start scene-scale generation until Phase 7 proves the Section 22 contract
can be enforced and Phase 9 proves contract/canon disagreement is caught before
generation.

## Phase 7 Implementation: Prose Generation Stub

Goal: prove Section 22 is enforceable as a parsed runtime contract.

### 7.1 Add contract schema

Create `src/narrative_os/contracts.py`.

Models:

- `ContractRule`
  - `guard_id`
  - `kind`: `reveal`, `permitted_signal`, `foreclosure_guard`, `surface_rule`
  - `text`
  - `section_ref`
  - `severity`: `hard`, `soft`
  - `canon_refs`: list of canon ids or empty until Phase 9
- `BookContract`
  - `project`
  - `book`
  - `source_path`
  - `source_hash`
  - `rules`
  - `created_at`

Tests:

- `tests/test_contracts.py`
- Validate round-trip JSON.
- Validate duplicate `guard_id` rejection.
- Validate hard rules can be filtered separately from soft rules.

Exit gate:

- Contract models validate independently of LLM calls.

### 7.2 Parse Section 22 from `decisions.md`

Create `src/narrative_os/decisions_parser.py`.

Behavior:

- Read `decisions.md` with UTF-8.
- Locate `## Section 22: Prose-Generation Contract (Surface)`.
- Stop before `## Section 23: Load-Bearing Architecture (Spine)`.
- Parse the three Section 22 buckets currently present:
  - reveals / facts
  - permitted reader signals
  - foreclosure guards
- Preserve Section 23 references such as `Section 23.1` as `section_ref`.
- Generate stable ids like:
  - `s22.reveal.aspect_identity`
  - `s22.signal.solis_physical_absence`
  - `s22.guard.no_aspect_wrong_attribution`
- Write `data/contracts/book1_contract.json`.

Add CLI command:

```bash
python -m narrative_os build-contract --decisions decisions.md --out data/contracts/book1_contract.json
```

Tests:

- `tests/test_decisions_parser.py`
- Fixture with a minimal Section 22/23 block.
- Assert the expected number of reveal, signal, and guard rules.
- Assert source hash changes when input changes.
- Assert parser fails clearly if Section 22 or Section 23 is missing.

Exit gate:

- Contract file is generated from `decisions.md`; no hand-maintained duplicate
  contract becomes authoritative.

### 7.3 Add contract linter interface

Create `src/narrative_os/contract_lint.py`.

Models:

- `ContractFinding`
  - `guard_id`
  - `severity`
  - `span`
  - `rationale`
- `ContractLintResult`
  - `passed`
  - `findings`

Implementation order:

1. Start with deterministic lint checks for rules that can be caught by string
   or regex.
2. Add the LLM lint adapter behind the same interface.
3. Keep Gemini-specific implementation behind `llm/router.py`; do not call
   Gemini directly from business logic.

Tests:

- `tests/test_contract_lint.py`
- Known-clean Ch 3 paragraph from
  `E:\Ai\ProseLabV2\DRAFTS\Quantum Shadows - EXTENDED DRAFTv1.md` passes.
- Deliberately corrupted paragraph trips the intended Section 22.4-style guard
  and returns `{guard_id, severity, span, rationale}`.
- Tests must use a mock provider, not a live LLM.

Exit gate:

- The lint report shape is locked before prose generation depends on it.

### 7.4 Wire contract into prose generation

Refactor `prose_generator.py` conservatively.

Keep existing canon-aware prompt and mechanical prose lint, but add:

- `contract_path` argument
- contract load before prompt assembly
- Section 22 rules rendered into prompt
- contract lint after generation
- combined pass/fail status:
  - mechanical lint hard failure
  - contract hard failure
  - soft findings surfaced but not necessarily blocking

Add CLI flags to `generate-scene`:

```bash
--contract data/contracts/book1_contract.json
--contract-only
```

Tests:

- Extend `tests/test_prose_generator.py`.
- Contract is included in prompt assembly.
- Failed contract lint triggers retry when `--retry` path is used.
- Repair prompt receives only the current findings, not an accumulating error
  stack.

Exit gate:

- Clean beat passes.
- Corrupted beat fails with the right guard id and cited span.
- No live LLM is required for tests.

## Phase 8 Implementation: Canon Reconciliation

Goal: freeze a clean generator baseline.

### 8.1 Add canon audit scripts as package commands

Current reconciliation scripts are top-level one-offs. Keep them for history,
but add stable package commands before more canon mutation.

Create `src/narrative_os/canon_audit.py`.

Commands:

```bash
python -m narrative_os audit-fake-pass-ids
python -m narrative_os audit-contamination --entity Hayden
python -m narrative_os audit-contamination --entity Kain
python -m narrative_os snapshot-canon --out data/canon.phase8_clean.json
```

Tests:

- `tests/test_canon_audit.py`
- Fake pass id detection.
- Snapshot writes exact current store payload without mutation.
- Audit commands return non-zero only for real violations.

Exit gate:

- Zero fake-pass entries.
- Hayden/Kain contamination audit clean.
- Bell discovery seed entry survives untouched.
- `data/canon.phase8_clean.json` exists and is treated as the generator
  baseline.

## Phase 9 Implementation: Contract/Canon Bridge

Goal: Section 22 and canon must agree before prose is generated.

### 9.1 Add bridge checks

Create `src/narrative_os/contract_canon_bridge.py`.

Functions:

- `canon_to_contract_check(contract, store_entries)`
- `contract_to_canon_check(contract, store_entries)`
- `preflight_contract_canon(contract_path, store_path, beat_text)`

Behavior:

- For each Section 22 rule with a Section 23 reference, verify at least one
  supporting active canon entry exists.
- Flag hard canon entries that contradict Section 22 guard text.
- Return structured findings; do not print from library functions.

Tests:

- `tests/test_contract_canon_bridge.py`
- Missing support is flagged.
- Contradicting hard canon blocks.
- Inferred canon disagreement is flagged lower than hard canon disagreement.

Exit gate:

- `generate-scene` refuses to run when the relevant contract/canon preflight
  has blocking findings.

## Phase 10 Implementation: Scene-Scale Generation

Goal: move from one beat to a coherent scene.

Create `src/narrative_os/scene_generator.py`.

Components:

- `Beat`
- `ScenePlan`
- `SceneDraft`
- beat-chain assembly
- per-beat generation through the Phase 7 generator
- stitch pass
- final contract/canon/prose lint pass

Tests:

- `tests/test_scene_generator.py`
- 3-beat mock scene preserves required facts across beats.
- Stitch pass does not delete required canon facts.
- POV constraints are included in prompt material.

Exit gate:

- The Solis apartment test scene can be generated, linted, and reviewed as a
  complete scene artifact.

## Phase 11 Implementation: Human Feedback Loop

Goal: markup becomes structured input.

Create `src/narrative_os/markup_parser.py`.

Initial supported format should be plain markdown, not a UI-specific format.

Artifacts:

- `FeedbackNote`
- `FeedbackRoute`: `contract_amendment`, `canon_correction`,
  `prompt_tuning`, `local_rewrite`
- amendment audit log in `data/contracts/amendments.log.jsonl`

Tests:

- `tests/test_markup_parser.py`
- Inline notes parse into structured feedback.
- Replacement spans are preserved.
- Feedback routes are deterministic for explicit tags.

Exit gate:

- A marked-up scene can trigger a targeted regeneration without rerolling the
  whole scene.

## Later Phases

Phase 12 should remain author-output focused. Do not build new architecture
unless the Solis apartment fixture, Chapter 13 rebuild work, Chapter 18 Hayden
Transit work, Fade escalation passes, and Aspect interlude expose a repeated
systems problem.

Phase 13 introduces Book 2 contracts. The key engineering requirement is that
`BookContract` is already book-agnostic, so adding `book2_contract.json` is data
work, not code work.

Phase 14 adds cross-book linting. Do not start until Book 2 contract shape has
survived real prose generation.

Phase 15 generalizes the toolkit. Do not remove Quantum Shadows assumptions
early; first isolate them behind project config files:

- `data/projects/quantum_shadows/project.json`
- `data/contracts/book1_contract.json`
- `data/canon.phase8_clean.json`

## Immediate Sprint Plan

1. Build `contracts.py`.
2. Build `decisions_parser.py`.
3. Add `build-contract` CLI command.
4. Generate `data/contracts/book1_contract.json`.
5. Build `contract_lint.py` with deterministic checks and mockable LLM adapter.
6. Add tests for clean/corrupted beat outcomes.
7. Wire contract loading and linting into `prose_generator.py`.
8. Run:

```bash
python -m pytest tests/test_contracts.py tests/test_decisions_parser.py tests/test_contract_lint.py tests/test_prose_generator.py -v
python -m narrative_os build-contract --decisions decisions.md --out data/contracts/book1_contract.json
python -m narrative_os generate-scene "Two-beat smoke outline here" --contract data/contracts/book1_contract.json --retry
```

## Engineering Rules

- No direct LLM endpoint calls outside `llm/router.py` and providers.
- No graph-shaped state model.
- No React work.
- No canon mutation without a preflight audit and snapshot.
- No hand-maintained duplicate Section 22 contract.
- Tests mock providers; live LLM runs are manual smoke tests only.
- Error prompts must be bounded per retry. Do not accumulate old failures into
  growing prompt stacks.

## Open Decisions

- Whether Gemini contract lint is required in Phase 7, or whether the first
  implementation can use the existing provider abstraction with a mocked
  contract critic until `GeminiProvider` is real.
- Whether `book1_contract.json` should be committed as generated data or treated
  as a build artifact regenerated from `decisions.md`.
- Exact paragraph fixtures for the clean Ch 3 beat and corrupted Section 22
  guard test.
- Whether Phase 8 reconciliation scripts should be migrated into package code
  before or after Phase 7 exit criteria are met.
