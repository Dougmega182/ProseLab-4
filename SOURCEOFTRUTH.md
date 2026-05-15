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
- `proselab/src/services/createModeOrchestrator.js`
- `proselab/src/engine/pipeline.js`

## Implemented capabilities

### Engine and orchestration
- analysis and delta flow
- critique verdicting (`APPROVE` / `REWRITE`)
- bounded retry/orchestration
- scene-intent gating before create execution
- expansion insertion engine with polling-compatible continuation and overlap dedup
- Opus-assisted insertion boundary recommendation from scene paragraph map (`Suggest Insertion Placement`)

### Document system
- project -> chapter -> scene model
- manuscript tree/sidebar navigation
- project selection and deletion
- manuscript export
- local reset/maintenance action
- IndexedDB persistence with legacy migration support
- expansion draft runs saved to `Editorial Drafts` with checkpoint metadata
- expansion panel controls use responsive wrapping layout to prevent overflow in write view

### Manuscript import and planning extraction
- import wizard and named project creation
- chapter/scene dissection from manuscript
- extraction into core metadata, dossiers, world rules, beats, scene inventory
- import result triage (trustworthy vs review-needed sections)
- normalization/repair paths for malformed records

### Preproduction and lore
- preproduction surfaces: core lock, voice, world rules, dossiers, beats, inventory, preflight, pipeline settings
- lore extraction, relationships, timeline, consistency tracking, query/export surfaces
- review cues for low-confidence entities, contradictions, timeline pressure

## Non-negotiable rules

- Generator cannot self-approve
- Retry loops must terminate
- Quality rejection vs provider/config failure must be distinguishable
- Documentation must reflect runtime reality, not target fiction
- No fake auth/login UX without real auth

## Current phase

### Phase 5: UX coherence and hardening (in progress)

Goals:
- make implemented workflows reliable and readable end-to-end

Priority work:
1. remove mojibake and stale/misleading copy
2. continue preproduction/sidebar UX polish
3. increase import/reload confidence with stronger tests
4. reduce coupling and size concentration in `App.jsx`
5. keep Gemini challenger messaging explicit: enforced on APPROVE in CREATE when key is configured
6. reduce inline styling and presentation duplication

## Next phase

### Phase 6: architecture and reliability

Goals:
- lower change risk
- make boundaries clear
- increase regression safety

Target work:
1. refactor orchestration/state logic out of `App.jsx`
2. add regression coverage for import persistence, hydration, delete cascades, critique/retry flow, mode gating
3. centralize provider diagnostics and runtime status messaging

## Challenger / Gemini runtime truth

Current behavior:
- In `CREATE`, if Critic verdict is `APPROVE` and `VITE_GEMINI_KEY` is present, Gemini challenger runs as a hard gate.
- A challenger `VETO` downgrades final verdict to `REWRITE`.
- If key is absent, challenger stage is skipped.

## Backlog priorities

### Now
- align remaining create-mode copy to conditional runtime truth (Gemini hard gate when key is configured)
- add real Ollama reachability checks
- replace mojibake in visible UI copy
- keep operator docs aligned with actual runtime

### Reliability
- explicit handling for failed OpenAI/Ollama responses in editorial modes
- prevent empty/malformed responses from being treated as successful cached states
- tests for lock logic, config gating, targeted rewrite availability, and run-blocking when config is incomplete
- regression coverage for expansion continuation dedup and checkpoint logging

### Architecture
- split provider logic from UI state concentration in `App.jsx`
- extract mode definitions, lock rules, and persona metadata into dedicated modules
- formalize diagnostics panel model instead of ad hoc render checks

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
