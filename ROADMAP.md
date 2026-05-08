# ProseLab 4 - Roadmap

## Reality Check

ProseLab is already beyond the "single textarea + rewrite button" stage.

Implemented now:
- critique-based create pipeline
- bounded orchestration / retries
- project/chapter/scene document model
- IndexedDB-backed manuscript persistence
- manuscript import with structural and planning extraction
- preproduction workspace
- lore graph, timeline, and consistency tooling

The roadmap now needs to focus on hardening, coherence, and architectural cleanup rather than pretending those systems do not exist.

## Completed Phases

### Phase 1 - Core Quality Gate
Status: done

Delivered:
- analysis and delta flow
- critique verdicting
- approval vs rewrite handling
- bounded retry/orchestration

### Phase 2 - Writing Workflow Foundation
Status: done

Delivered:
- document tree
- project/chapter/scene workflow
- manuscript export
- sidebar navigation
- clearer project naming/history cues in the sidebar
- IndexedDB persistence replacing the old single-storage assumption

### Phase 3 - Lore Intelligence
Status: done

Delivered:
- lore extraction
- relationship graph
- timeline view
- consistency checking
- lore querying/export support
- review-focused lore triage for low-confidence entities, contradictions, duplicates, and timeline pressure

### Phase 4 - Manuscript Ingest and Planning Surface
Status: done, with polish still ongoing

Delivered:
- import wizard
- named manuscript project creation
- chapter/scene creation from manuscript
- imported population of:
  - title/core data
  - character dossiers
  - world rules
  - beats
  - scene inventory
- project deletion
- first-class local reset/maintenance path for recovery and debugging
- import debugging and repair paths
- review-oriented preproduction and scene-audit surfaces for evaluating imported manuscripts
- an import result screen that immediately triages trustworthy extracted sections vs sections needing review

## Current Active Phase

### Phase 5 - UX Coherence and Hardening
Status: in progress

Goal:
- make the implemented system feel reliable and readable for real use

Work remaining:
1. clean remaining mojibake and stale UI copy
2. continue polishing preproduction and sidebar UX
3. strengthen post-import and post-reload confidence with tests
4. reduce single-file complexity in `App.jsx`
5. clarify runtime truth for Gemini/challenger behavior
6. continue reducing inline styling and duplicated presentation code

## Next Major Phase

### Phase 6 - Architecture and Reliability
Goal:
- make the codebase safer to evolve

Target work:
1. refactor orchestration/state logic out of `App.jsx`
2. add regression coverage for:
   - import persistence
   - hydration after reload
   - delete cascade behavior
   - critique/retry flow
   - mode gating
3. centralize provider diagnostics and runtime status messaging

Outcome:
- lower change risk
- fewer regressions
- easier future feature work

## Strategic Options Still Open

### Challenger / Gemini
Decision pending:
- make Gemini/adjudication a clearly enforced stage in the main pipeline
- or treat it as optional infrastructure and document it honestly

### File-System-Level Persistence
Decision:
- IndexedDB remains the canonical live persistence layer for the current product

Why:
- the app is local-first and browser-hosted
- current risk has been hydration and schema correctness, not lack of file access
- import/export already provides the file boundary the product actually uses today

Revisit only if:
- versioned project bundles become a requirement
- automatic backup/snapshotting is added
- cross-machine sync or collaboration becomes real scope

## Explicitly Outstanding

- UI copy/encoding cleanup
- stronger tests
- more maintainable architecture boundaries
- deeper provider diagnostics
- clearer advanced pipeline documentation
- continued shell/presentation cleanup outside the refreshed manuscript surfaces

## Explicitly No Longer Outstanding

These older roadmap items are already completed and should not be treated as future work:
- Critic Agent
- retry loop/orchestrator basics
- document tree
- IndexedDB-backed structured persistence
- lore graph/timeline
- manuscript import workflow
- imported population of dossiers/world/beats/inventory

## Success Criteria

The next stage succeeds when:
- manuscript import feels dependable end-to-end
- reloads preserve and hydrate project state correctly
- preproduction surfaces are readable and useful without extra decoding by the user
- critique/orchestration behavior is clear in both UI and docs
- the codebase is easier to change without breaking persistence or workflow state
