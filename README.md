# ProseLab 4

ProseLab 4 is a local-first AI writing workstation focused on constrained prose generation, critique, manuscript structure, and narrative intelligence.

This repository is no longer just a single-pass rewrite prototype. The current app includes:
- critique-driven create mode
- project/chapter/scene document management
- manuscript import into IndexedDB
- preproduction planning surfaces
- lore extraction, graphing, and consistency tooling

## Current State

Implemented:
- analysis and delta stages
- generate/refine pipeline
- critique verdicts with retry/orchestration
- preproduction workspace
- project/chapter/scene sidebar
- manuscript import and export
- IndexedDB persistence with legacy migration
- lore graph, timeline, and consistency checks
- in-app local reset/maintenance action
- project naming/history cues in the sidebar for imported manuscripts

Still outstanding:
- broader shell polish and copy cleanup
- stronger regression testing
- clearer final positioning of Gemini/challenger behavior in the main pipeline
- further decomposition of `src/App.jsx`

## App Location

The active app is:
- `proselab/`

Primary entry points:
- `proselab/src/App.jsx`
- `proselab/src/hooks/useDocumentManager.js`
- `proselab/src/services/importOrchestrator.js`
- `proselab/src/engine/pipeline.js`

## Running Locally

### Recommended launcher

On this workspace, the usual launcher is:
- `E:\Ai\ProseLabV2\ProseLab-4.bat`

That starts the Vite app in `proselab/` and opens the local dev URL.

### Manual run

```bash
cd proselab
npm install
npm run dev
```

### Production build

```bash
cd proselab
npm run build
```

## Environment

The active Vite env file is:
- `proselab/.env`

Current runtime expects keys such as:
- `VITE_OPENAI_KEY`
- `VITE_GEMINI_KEY`
- `VITE_OLLAMA_MODEL`

Do not rely on the repository root `.env` for the React app.

## Main Product Surfaces

### 1. Preproduction

Includes:
- Core lock
- Voice profile
- World rules
- Character dossiers
- Beat map
- Scene inventory
- Preflight brief
- Pipeline settings

Recent state:
- imported manuscript data now populates these surfaces
- dossiers/world/beats layout was refreshed for better readability
- imported dossiers, rules, beats, inventory, and preflight now surface review flags and provenance cues for manuscript evaluation

### 2. Create / Editorial Modes

Modes in the main UI:
- `CREATE`
- `ANALYSE`
- `ENGINEER`
- `MARKET`
- `VERDICT`

Important behavior:
- `CREATE` is scene-intent gated
- `ENGINEER` remains intentionally locked until analysis has run and the text changes
- `VERDICT` remains intentionally locked until prerequisite editorial stages are available

### 3. Manuscript Workflow

Current capability:
- import manuscript files
- choose manuscript project name during import
- split into chapters/scenes
- populate sidebar structure
- show project recency and structure context in the sidebar
- derive and save dossiers, world rules, beats, and scene inventory
- show a trust/review result screen after import so extracted sections can be triaged immediately
- export compiled manuscript
- delete imported manuscript projects
- reset local manuscript/cache state without opening DevTools

### 4. Lore Intelligence

Current capability:
- extract entities and relationships
- visualize graph links
- inspect timeline events
- run consistency checks
- export lore data

Recent state:
- Lore now exposes review-oriented confidence and issue summaries so contradictions, duplicates, and weak entities are easier to audit after import

## Manuscript Evaluation Workflow

Best current evaluation path:
- `WORLD` and `DOSSIERS` to validate extracted constraints and cast logic
- `BEATS` to verify structural inference
- `INVENTORY` and `PREFLIGHT` to audit scene readiness and underspecified scenes
- `LORE > ISSUES` and `LORE > TIMELINE` to review contradictions, duplicates, low-confidence entities, and event coherence

## Persistence Model

Current storage is mixed by purpose, but the live authority is now explicit:

- IndexedDB is the canonical runtime store for projects and manuscript structure
- file import/export is the explicit file boundary
- localStorage is support storage, not the source of truth

Details:

- IndexedDB:
  - projects
  - chapters
  - scenes
  - manuscript structure and imported planning data

- localStorage:
  - some cache entries
  - token/cost logs
  - certain diagnostic and legacy data
  - some editor/runtime support state

This means local resets for debugging must often clear both IndexedDB and selected localStorage keys.
The app now exposes a first-class reset action for that maintenance path.

## Known Gaps

- Some visible strings still contain mojibake / broken encoding.
- `App.jsx` is still carrying too much orchestration and UI state.
- The broader shell still needs UI consistency work outside the refreshed import/preproduction surfaces.
- Challenger/Gemini behavior needs one clearer documented truth path.
- Automated test coverage is still behind the app's current complexity.

## Documentation Map

- [AGENTS.md](E:\Ai\ProseLabV2\AGENTS.md): current agent/runtime architecture
- [PLAN.md](E:\Ai\ProseLabV2\PLAN.md): implementation status and phased next work
- [ROADMAP.md](E:\Ai\ProseLabV2\ROADMAP.md): strategic view of completed vs outstanding product work
