# ProseLab 4

ProseLab 4 is a local-first AI editorial workstation for fiction.

It is built to enforce story intent, not just produce fluent prose.

If there is any conflict between older planning files, use `SOURCEOFTRUTH.md`.

## What it does

- Runs a bounded generate -> critique -> rewrite loop with automated retry/repair policies
- Implements strict prompt budgeting (Voice: 120 words, Scene: 80 words, Rewrite: 100 words, Repair: 60 words) to prevent token drift
- Employs a hybrid narrative output validator (Goal, Conflict, Change, Stakes, Reveal, Causality) acting as a narrative compiler
- Uses project/chapter/scene structure instead of a single draft box
- Centralizes all model mapping, capability gating, and retries in a unified Provider Router
- Standardizes all local connection resolving to explicit IPv4 `127.0.0.1`, completely eliminating loopback failures
- Imports manuscripts and extracts planning assets
- Provides preproduction surfaces (voice stability calibration, world rules, dossiers, beats, inventory)
- Tracks lore consistency (entities, relationships, timeline, contradictions)

## Product stance

- AI is an assistant, not the final author
- Generic prose should be rejected
- Emotional specificity, voice, and narrative logic are first-class constraints

## Active avoidances (Banned anti-patterns)

- **Narrative State Graphs (REJECTED):** Do not propose, design, or implement graph-shaped state trackers (e.g., spatial state models, causal graphs, spatial causality trackers, emotional drift trackers, narrative ontologies). The canonical data model must remain a flat JSON store tracking structured canon entries.
- **Bypassing the LLM Abstraction Layer:** Never write direct `fetch` network calls to LLM endpoints (e.g., OpenAI/Gemini/Ollama) inside validation or business logic layers. All model interactions must route exclusively through the centralized provider router (`llm.js`).
- **Cargo-Cult JSON String Parsing:** Do not implement manual string-stripping regex or custom-written AST parsers to isolate JSON. When strict structured JSON output is required, use OpenAI's native Structured Outputs (`response_format: { type: "json_schema", ... strict: true }`) combined with direct Zod schema mapping.
- **Prompt Pollution & Instruction Stacking:** Never stack errors, violations, or challenger fatal flaws inside a growing accumulator prompt parameter over multiple retries. Isolated directives must be refreshed per pass using bounded parameters (`rewrite` vs. `repair`) and strict budgeting rules.

## Current status

- Active phase: Phase 6 (Architecture and reliability / UX hardening) — **100% COMPLETED**
- Core engine, document model, import pipeline, lore subsystem, centralized provider router, decoupled isolation prompt budgeting, native structured output validator, and robust multi-pass retry/repair loops running transactionally on a central `orchestrationRunner` are fully implemented, integrated, and pass strict TypeScript compilation (`tsc`) cleanly with zero errors.
- IndexedDB is the canonical live persistence layer.

## Workspace structure

- `proselab/` — active Vite app runtime
- `proselab/src/services/orchestration/` — modular, contract-compliant orchestrators
- `proselab/src/services/llm/` — centralized provider capability routing
- `proselab/src/engine/` — prompt budgeting and output verification compiler engines
- `SOURCEOFTRUTH.md` — canonical product and engineering baseline

## Local run

```bash
npm --prefix proselab install
npm --prefix proselab run dev
```

## Build and test

```bash
# Verify Rolldown bundle compilation
npm --prefix proselab run build

# Run pre-inference and lock-state regression tests
npm --prefix proselab run test

# Run targeted pre-inference intent regression checks
npm --prefix proselab run test:regression

# Run single end-to-end rewrite & critique loop
npm --prefix proselab run critic:cycle

# Run 16-sample Critic challenge suite
npm --prefix proselab run critic:challenge
```

## Expansion Draft Insertion (Galaxy AI polling)

The Write tab now includes an **Expansion Draft Insertion** panel.

- Paste expansion instructions into **Expansion Brief**
- Generate draft insertion with fully automatic Opus boundary inference from chapter + expansion brief
- Optional **Refresh Auto Placement** re-runs placement reasoning preview before generation
- Generate into **Editorial Drafts** (non-destructive)
- Manage drafts in the sidebar **DRAFTS** section, including deleting draft scenes/folders directly
- Output is checkpointed and autosaved each pass
- Continuation is automatic when output truncates
- Repetition between continuation passes is deduplicated
- Final draft labels include chapter + insertion start/end paragraph and line references
- JSON stage parsing is boundary-safe, so trailing model text no longer blocks pipeline stages
- Expansion panel layout is responsive and wraps controls to avoid horizontal overflow

Optional lint run (repo currently has known lint debt):

```bash
npm --prefix proselab run lint
```

## Environment

Create `proselab/.env` with required provider keys for your configured runtime.

## Superseded docs

The following are now consolidated into `SOURCEOFTRUTH.md`:

- `ROADMAP.md`
- `project_brief.md`
- `PLAN.md`
- `IMPLEMENTATION_PLAN_PHASE_4.md`
- `backlog.md`
- `wants_improvements.md`
