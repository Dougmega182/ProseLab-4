# ProseLab Implementation Plan

## Purpose

This plan reflects the codebase as it exists now, not the earlier prototype-only assumptions.

It answers two questions:
- what is already complete
- what is still worth doing next

## Completed Foundations

### Core engine
Completed:
- analysis and delta stages
- generation/refinement pipeline
- critique verdicting with `APPROVE` / `REWRITE`
- bounded orchestration and retry handling
- scene-intent gating before `CREATE`

### Document workflow
Completed:
- project -> chapter -> scene model
- document sidebar and manuscript tree
- project selection
- project naming/history cues for repeated imports
- project deletion
- manuscript export
- IndexedDB persistence with legacy migration path
- first-class local reset/maintenance action

### Manuscript import
Completed:
- import wizard
- named manuscript project creation
- chapter/scene dissection
- post-import state refresh
- post-import trust/review summary for extracted analysis
- persistence repair/normalization for malformed records
- enrichment import into:
  - core metadata
  - dossiers
  - world rules
  - beats
  - scene inventory
- browser debug hooks for import diagnostics

### Preproduction workspace
Completed:
- core lock
- voice profile
- world rules
- dossiers
- beats
- inventory
- preflight brief
- pipeline settings

Recent improvement:
- refreshed layout for dossiers, world rules, beats, and inventory so imported data reads more coherently
- sidebar now exposes project recency and structure cues to reduce import confusion
- manuscript evaluation cues now surface directly in the UI:
  - provenance on imported planning assets
  - review flags for incomplete dossiers/rules/beats/scenes
  - scene readiness scoring and preflight audit summaries
  - import-result triage that tells the user which extracted sections look strong versus which need review

### Lore intelligence
Completed:
- extraction
- relationship graph
- timeline
- consistency checks
- export/query tooling

Recent improvement:
- Lore review now surfaces low-confidence entities, issue severity summaries, and timeline audit cues for imported manuscripts

## Still In Progress

### 1. Runtime/documentation alignment
Why it still matters:
- the app has evolved faster than the root docs
- some UI/provider copy still implies older pipeline behavior

Remaining work:
- remove remaining stale Gemini/final-stage wording where inaccurate
- continue cleaning mojibake / broken symbols
- keep root and in-app help text synchronized

### 2. Preproduction UX polish
Already improved:
- dossiers/world/beats readability

Still outstanding:
- polish edit modals
- tighten overall spacing/typography consistency across the shell
- improve top-row card coherence and metadata storytelling
- reduce inline styles and style duplication
- keep the new reset/maintenance path visible and trustworthy

### 3. App architecture cleanup
Problem:
- `App.jsx` still concentrates too much responsibility

Next slice:
- move more orchestration and adapter logic into focused hooks/services
- reduce implicit coupling between import, document state, and UI refresh
- define clearer boundaries between:
  - document state
  - pipeline state
  - lore state
  - preproduction state

### 4. Testing and reliability
Still outstanding:
- regression tests for import and hydration
- tests for create-mode gating
- tests for critique/retry termination
- tests for project/chapter/scene persistence and deletion

### 5. Challenger / Gemini truth path
Current state:
- Gemini support exists
- challenger/adjudication concepts exist
- docs historically overstated how active it is in the main path

Decision still needed:
- either promote challenger/Gemini to a clean, enforced runtime stage
- or document it strictly as optional / partial infrastructure

## Phased Next Work

### Phase A - Finish UX stabilization
Goal:
- make imported/manuscript-first workflows feel complete

Tasks:
1. clean remaining mojibake in visible UI
2. polish character/rule/beat editing flows
3. improve project naming/history cues in the sidebar
4. add a first-class reset/maintenance action for local data

Definition of done:
- no major import-to-dashboard confusion
- preproduction surfaces feel coherent for real manuscript ingestion
- maintenance/reset no longer requires DevTools

Current status:
- delivered, with broader shell polish still ongoing

### Phase B - Harden persistence and regression safety
Goal:
- stop reintroducing import/hydration bugs

Tasks:
1. add automated tests for import persistence
2. test IndexedDB repair/normalization paths
3. test delete-project cascade behavior
4. test sidebar hydration from selected project

Definition of done:
- structure and enrichment survive reloads predictably

### Phase C - Refactor runtime boundaries
Goal:
- reduce risk concentration in `App.jsx`

Tasks:
1. extract more adapters from `App.jsx`
2. centralize provider/runtime diagnostics
3. separate import orchestration from main composition logic
4. reduce duplicated shape-mapping between storage and UI

Definition of done:
- new features no longer require deep edits across one giant component

### Phase D - Clarify advanced orchestration
Goal:
- make the quality-enforcement story unambiguous

Tasks:
1. decide final challenger/Gemini role
2. document the exact active create pipeline
3. surface final approval chain more clearly in the UI

Definition of done:
- no mismatch between code, UI copy, and root docs

## Priority Backlog

1. Clean remaining mojibake and stale copy.
2. Add regression coverage for import/hydration.
3. Refactor `App.jsx` into smaller orchestration boundaries.
4. Improve edit flows for dossiers/world/beats.
5. Finalize challenger/Gemini positioning.
6. Keep shrinking inline styling and presentation duplication.

## What Is No Longer Outstanding

These items were previously listed as missing but are now implemented:
- Critic agent
- bounded retry loop
- project/chapter/scene document system
- IndexedDB persistence
- manuscript import workflow
- dossier/world/beats population from import
- lore graph/timeline/consistency surface
- first-class local reset/maintenance action
- project naming/history cues in the sidebar
- short-term persistence decision: IndexedDB remains the live store
