# SOURCEOFTRUTH.md

## Purpose

This document is the canonical baseline for ProseLab 4 moving forward.

It consolidates product intent, architecture reality, current phase, and backlog priorities.

If any other planning document conflicts with this file, this file wins.

## Product definition

ProseLab 4 is a local-first AI editorial workstation for fiction.

Primary objective:
- enforce narrative intent, causality, and voice quality through bounded critique and rewrite loops

Core premise:
- AI outputs can be fluent and structurally coherent but still lack human urgency, emotional specificity, and singular voice
- the system must push AI toward constrained, scene-grounded, emotionally earned prose
- AI supports the author; it does not replace authorial intent

## Success criteria

- Generic first-pass prose is rejected consistently
- Critique returns specific rewrite directives that cause visible structural change
- Draft -> critique -> rewrite -> critique loops run reliably with bounded retries
- Provider/config failures are clearly separated from quality rejection
- Workflow remains maintainable by one developer
- Reload/hydration preserves project state reliably

## Non-goals

- Mobile apps
- Multi-user collaboration, auth, cloud sync
- Broad enterprise workflow features outside story quality and manuscript workflows
- Unbounded autonomous background orchestration

## Runtime baseline

Active app: `proselab/` (React 19 + Vite 8)

Primary files:
- `proselab/src/App.jsx`
- `proselab/src/hooks/useDocumentManager.js`
- `proselab/src/services/db.js`
- `proselab/src/services/importOrchestrator.js`
- `proselab/src/services/orchestration/createOrchestrator.js` (Modular Creation Orchestrator)
- `proselab/src/services/orchestration/editorialOrchestrator.js` (Modular Editorial Orchestrator)
- `proselab/src/services/orchestration/rewriteOrchestrator.js` (Modular Rewrite Orchestrator)
- `proselab/src/services/llm/router.js` (Centralized Capability Provider & Router)
- `proselab/src/engine/promptBudget.js` (Strict prompt word budget compression)
- `proselab/src/engine/outputValidator.js` (Hybrid narrative output verification compiler)
- `proselab/src/engine/pipeline.js`

## Implemented capabilities

### Engine and orchestration
- analysis and delta flow
- critique verdicting (`APPROVE` / `REWRITE`)
- bounded retry/orchestration
- scene-intent gating before create execution with strict length/placeholder/duplication rules
- expansion insertion engine with polling-compatible continuation and overlap dedup
- Opus automatic insertion boundary inference from scene paragraph map during generation (with optional manual refresh action)
- boundary-safe JSON parsing in validation/critique/extraction stages to tolerate trailing model text
- **Centralized LLM Router** (centralizes capability mapping, fallback policies, and standardizes local Ollama calls on explicit IPv4 `127.0.0.1`)
- **Prompt Budgeting Control** (Voice profile limit: 120 words, Scene context: 80 words, Rewrite directives: 100 words, Repair instructions: 60 words; automatically merges, deduplicates, and compresses directives using `budget.js`)
- **Output Verification Engine (Narrative Compiler)** (Deterministic delta checks capping similarity to 5%-85%, banned abstract emotional labels block, and optional evaluative LLM checks on Goal Achievement, Conflict Acknowledgment, and Irreversible Change)
- **Decoupled Orchestration Layer** (Standalone, contract-compliant orchestrators for create, rewrite, and editorial runs completely decoupled from React UI rendering)
- **Centralized Orchestration Runner (`orchestrationRunner.js`)** (Standardized exponential backoff, tracing, state tracking, and retry-loop contract enforcement across all orchestrators)
- **Word Budgeting Isolation** (Strict word limits with separate `rewrite` and `repair` parameters, line-by-line array truncation, and automatic prompt pollution prevention)
- **Native JSON Structured Outputs** (OpenAI `response_format` strict JSON validation integrated directly with Zod schema verification in the validation layer)
- **Strict tsc Type Safety** (Whole-engine static type checks passing cleanly via standard compilation)

### Document system
- project -> chapter -> scene model
- manuscript tree/sidebar navigation
- project selection and deletion
- manuscript export
- local reset/maintenance action
- IndexedDB persistence with legacy migration support
- expansion draft runs saved to `Editorial Drafts` with checkpoint metadata
- draft scenes and draft folders are directly deletable from the sidebar drafts tree
- expansion panel controls use responsive wrapping layout to prevent overflow in write view

### Manuscript import and planning extraction
- import wizard and named project creation
- chapter/scene dissection from manuscript
- extraction into core metadata, dossiers, world rules, beats, scene inventory
- import result triage (trustworthy vs review-needed sections)
- normalization/repair paths for malformed records

### Preproduction and lore
- preproduction surfaces: core lock, voice, world rules, dossiers, beats, inventory, preflight, pipeline settings
- voice profile stability score (0-100) calibrator and visual badge indicator rendering
- lore extraction, relationships, timeline, consistency tracking, query/export surfaces
- review cues for low-confidence entities, contradictions, timeline pressure

## Non-negotiable rules

- Generator cannot self-approve
- Retry loops must terminate
- Quality rejection vs provider/config failure must be distinguishable
- Documentation must reflect runtime reality, not target fiction
- No fake auth/login UX without real auth

## Active avoidances (Banned anti-patterns)

- **Narrative State Graphs (REJECTED):** Do not propose, design, or implement graph-shaped state trackers (e.g., spatial state models, causal graphs, spatial causality trackers, emotional drift trackers, narrative ontologies). The canonical data model must remain a flat JSON store tracking structured canon entries.
- **Bypassing the LLM Abstraction Layer:** Never write direct `fetch` network calls to LLM endpoints (e.g., OpenAI/Gemini/Ollama) inside validation or business logic layers. All model interactions must route exclusively through the centralized provider router (`llm.js`).
- **Cargo-Cult JSON String Parsing:** Do not implement manual string-stripping regex or custom-written AST parsers to isolate JSON. When strict structured JSON output is required, use OpenAI's native Structured Outputs (`response_format: { type: "json_schema", ... strict: true }`) combined with direct Zod schema mapping.
- **Prompt Pollution & Instruction Stacking:** Never stack errors, violations, or challenger fatal flaws inside a growing accumulator prompt parameter over multiple retries. Isolated directives must be refreshed per pass using bounded parameters (`rewrite` vs. `repair`) and strict budgeting rules.

## Current phase

### Phase 6: architecture and reliability (COMPLETED)

Goals:
- lower change risk
- make boundaries clear
- increase regression safety

Completed work:
1. extracted orchestration and prompt-compiling/state logic from `App.jsx` into standalone modules
2. introduced centralized capability-gated provider router with resilient loopback handling
3. added prompt budgeting and narrative compiler output validation engines
4. standardized local connections to IPv4 `127.0.0.1:11434` across the stack, eliminating all `localhost` ambiguous hostname errors
5. added comprehensive unit tests for pre-inference gates in `regression.test.mjs`
6. cleanly wired the newly isolated orchestrators (`createOrchestrator`, `editorialOrchestrator`, `rewriteOrchestrator`) into `App.jsx` UI buttons, eliminating final UI-layer orchestrator coupling.
7. **Unified Orchestration Runner (`orchestrationRunner.js`):** Centralized retry/exponential backoff, telemetry tracing, state management, and similarity preservation controls.
8. **Decoupled dynamic word budgeting:** Upgraded `promptBudget.js` to support line-boundary array truncation, cleanly separating original instructions (`rewrite` budget) from automated error corrections (`repair` budget), completely eliminating prompt pollution over multiple retry passes.
9. **Native structured JSON verification:** Replaced brittle regex-based JSON extraction in `outputValidator.js` with structured Zod schema parsing enforced natively at the LLM provider API level via `response_format`.
10. **Strict static type safety:** Integrated strict TypeScript checking (`tsc`) via a custom `jsconfig.json` configuration, achieving 100% compiler verification.

Remaining work:
1. Polish preproduction/sidebar UX and remove any remaining UI-copy mojibake characters.

## Next phase

### Phase 7: Narrative State Graph and Continuity Tracking

Goals:
- track physical causality and entity continuity over long spans

Target work:
1. track character emotional drift metrics
2. map spatial locations and character/prop movements dynamically
3. verify chronological beat sequencing
4. automate local model fallbacks under resource pressure

## Challenger / Gemini runtime truth

Current behavior:
- In `CREATE`, if Critic verdict is `APPROVE` and `VITE_GEMINI_KEY` is present, Gemini challenger runs as a hard gate.
- A challenger `VETO` downgrades final verdict to `REWRITE`.
- If key is absent, challenger stage is skipped.

## Backlog priorities

### Now
- implement automatic self-corrective retry loops inside `createOrchestrator` and `rewriteOrchestrator` using the narrative compiler and challenger validations
- replace remaining mojibake in visible UI copy
- keep operator docs aligned with actual runtime

### Reliability
- explicit handling for failed OpenAI/Ollama responses in editorial modes
- prevent empty/malformed responses from being treated as successful cached states
- tests for lock logic, config gating, targeted rewrite availability, and run-blocking when config is incomplete
- regression coverage for expansion continuation dedup and checkpoint logging

### Architecture
- migrate LLM client adapters to a clean `src/services/providers/` directory with standardized driver interfaces

## Editorial quality direction

The system should favor constraint-driven generation over broad prompts.

Quality heuristics to enforce:
- physical specificity over abstraction
- concrete emotional evidence over declared feelings
- scene-level causality visibility
- voice variation without generic smoothing
- rejection of prose that is clean but narratively unnecessary

## Tech baseline

- Runtime: JavaScript ES modules, browser-first local runtime
- Frontend: React 19 + Vite 8
- Styling: Custom Vanilla CSS design tokens (custom badges, stability pills)
- Persistence: IndexedDB as canonical live store
- Scripts/tests: Node-based scripts and regression checks

## Canonicality and maintenance

This file replaces fragmented planning truth across:
- `ROADMAP.md`
- `project_brief.md`
- `PLAN.md`
- `IMPLEMENTATION_PLAN_PHASE_4.md`
- `backlog.md`
- `wants_improvements.md`

When priorities, architecture truth, or phase state changes, update this file first.
