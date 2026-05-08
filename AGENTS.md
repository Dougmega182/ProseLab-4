# AGENTS.md

# ProseLab 4 - Agent Architecture Status

## Purpose

This file describes the current agent/runtime reality of ProseLab 4 and separates it from the longer-term target architecture.

The codebase is no longer just a single-pass prototype. It now includes:
- a bounded generate/critique loop
- a project/chapter/scene document model
- manuscript import into IndexedDB
- preproduction enrichment for characters, world rules, beats, and scene inventory
- a lore/consistency subsystem

## Current Runtime Baseline

The active app is the Vite project in `proselab/`.

Primary files:
- `proselab/src/App.jsx`
- `proselab/src/hooks/useDocumentManager.js`
- `proselab/src/services/db.js`
- `proselab/src/services/importOrchestrator.js`
- `proselab/src/services/createModeOrchestrator.js`
- `proselab/src/engine/pipeline.js`

The launcher used locally is:
- `E:\Ai\ProseLabV2\ProseLab-4.bat`

## Agent Status

### 1. Generator Agent
Status: implemented

Role:
- produce draft prose from scene intent, context, and voice constraints

Current implementation:
- Ollama generation path
- OpenAI refinement path

Notes:
- generation is no longer the only gate; it feeds critique/orchestration

### 2. Analyst Agent
Status: implemented

Role:
- inspect prose quality and derive craft metrics

Current functions:
- rhythm analysis
- specificity / concreteness style signals
- scene-level and editorial diagnostics

Outputs:
- structured analysis used by downstream rewrite stages

### 3. Delta Agent
Status: implemented

Role:
- turn analysis into rewrite instructions

Current behavior:
- derives constrained rewrite direction before generation/refinement

### 4. Critic Agent
Status: implemented

Role:
- reject weak output and return machine-usable feedback

Current behavior:
- returns `APPROVE` or `REWRITE`
- surfaces score/failures in UI
- feeds retry logic
- participates in create-mode orchestration and shadow/action workflows

Relevant code:
- `proselab/src/engine/critic.js`
- `proselab/src/agents/criticAgent.js`
- `proselab/src/engine/autoApplyGate.js`

### 5. Challenger / Adjudication Layer
Status: partial

Role:
- adversarial verification of approvals

Current reality:
- Gemini support exists in the provider layer
- critique guardrails and truth/adjudication scaffolding exist
- documentation previously overstated Gemini as an always-active final stage

What is still missing:
- one explicit, always-on challenger pass in the main create pipeline with clear UI visibility

### 6. Orchestrator
Status: implemented, still evolving

Role:
- control the bounded generate -> critique -> retry flow

Current behavior:
- blocks `CREATE` if scene intent is incomplete
- runs analysis, delta, generation, validation, critique
- records attempts and final disposition
- enforces bounded retry behavior

Relevant code:
- `proselab/src/services/createModeOrchestrator.js`
- `proselab/src/engine/pipeline.js`
- `proselab/src/engine/orchestrator.js`

## Current Product Surfaces

### Preproduction Workspace
Status: implemented

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
- imported manuscript metadata now lands in these surfaces
- GUI was refreshed to make dossiers/world/beats more readable
- evaluation cues now exist across dossiers, world rules, beats, inventory, and preflight:
  - provenance labels
  - review flags
  - scene readiness scoring

### Document System
Status: implemented

Includes:
- projects
- chapters
- scenes
- scene selection
- manuscript sidebar tree
- project naming/history cues for distinguishing repeated imports
- project deletion
- manuscript export

Persistence:
- IndexedDB-backed
- legacy localStorage migration still exists for older data
- filesystem-native persistence is not the live authority for the current runtime; file import/export is the explicit boundary

Maintenance:
- a first-class in-app local reset action now clears IndexedDB plus selected local support storage for debugging/recovery

### Manuscript Import
Status: implemented, recently stabilized

Current behavior:
- imports manuscript files into a named project
- creates chapters/scenes
- derives and saves:
  - characters
  - world rules
  - beats
  - scene inventory / continuity metadata
- refreshes project state after import
- shows a post-import result screen that separates:
  - trustworthy extracted sections
  - sections needing editorial review
- exposes debug objects in browser console for diagnostics

### Lore / Consistency
Status: implemented with follow-up work still available

Includes:
- lore extraction
- relationship graph
- timeline view
- consistency issue tracking
- export/clear/query surfaces

Recent state:
- Lore now acts as a manuscript review surface, not just a data browser:
  - low-confidence and unverified entity cues
  - issue severity summaries
  - timeline review counts

## Non-Negotiable Rules

- Generator cannot self-approve.
- Retry loops must terminate.
- Provider/config failures must be distinguishable from quality rejection.
- Docs must describe current runtime honestly, not just the target vision.
- No fake login/auth UX should be introduced without real auth.

## Known Gaps

- Some UI copy and icons still contain mojibake / encoding damage.
- The broader shell still has layout inconsistency outside the refreshed import/preproduction surfaces.
- The main `App.jsx` remains too large and still carries too much orchestration/state/UI coupling.
- Gemini/challenger behavior still needs one clean, documented truth path in the main runtime.
- Tests are still lighter than they should be for orchestration, imports, and mode gating.

## Near-Term Priorities

1. Finish aligning UI copy and provider messaging with the real pipeline.
2. Continue breaking orchestration/state concerns out of `App.jsx`.
3. Add regression coverage for:
   - import persistence
   - project/chapter/scene hydration
   - create-mode gating
   - critic/retry behavior
4. Continue improving preproduction and sidebar UX coherence.
5. Decide whether challenger/Gemini becomes a first-class enforced stage or remains optional infrastructure.
