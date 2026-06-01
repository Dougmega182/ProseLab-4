# AGENTS.md

Tool roster, routing rules, and current operating status for the active
NarrativeOS Python project.

## Active Scope

Active working directory:

```text
E:\Ai\ProseLabV2\proselab\narrativeOS\
```

Active project:

- Python CLI package: `src/narrative_os/`
- Tests: `tests/`
- Data/contracts/canon: `data/`
- Durable docs: `README.md`, `ROADMAP.md`, `IMPLEMENTATION_PLAN.md`,
  `decisions.md`, `GEMINI.md`, `AGENTS.md`

Out of scope unless Dale explicitly unlocks it:

- React/Vite app work under `E:\Ai\ProseLabV2\proselab\src\`
- UI orchestrator wiring
- npm/Vite/ESLint build work
- graph-shaped narrative state systems

## Tool Stack Overview

| Tool | Model | Role | Strengths |
|------|-------|------|-----------|
| Gemini Flash 3 | Gemini 3 Flash | Fast thinker | Low-cost drafts, simple transforms, option generation |
| Gemini Pro 3 | Gemini 3 Pro | Auditor | Large-context review, cross-file consistency, whole-document audits |
| Galaxy AI | Claude Opus 4.6/4.7 | Executor | Precision edits, docs, prose-sensitive output, architecture tradeoffs |
| ABACUS.ai CLI | N/A | Orchestrator | Loads governance/memory/agent rules and manages session state |

## Routing Rules

Use Executor for:

- documentation
- prose-facing output
- targeted code changes
- architecture decisions
- contract/canon bridge changes
- anything voice-sensitive

Use Auditor for:

- whole-repo or whole-manuscript audits
- cross-file consistency checks
- large canon reviews
- chapter-label migration audits

Use Flash for:

- low-stakes first drafts
- quick transforms
- brainstormed options that will be reviewed before use

Default to Executor when unclear.

## Current NarrativeOS Status

Last updated: 2026-06-02.

Completed:

- Phase 7: Section 22 contract schema, parser, generated contract, contract
  lint interface, prose-generator contract enforcement.
- Phase 8: canon audit commands and clean snapshot baseline.
- Phase 9: contract/canon bridge, canonical mapping file, supersession-chain
  resolution, generation preflight blocking.

In progress:

- Phase 10: scene-scale generation using the Solis apartment scene fixture.

Outstanding:

- Fresh live smoke run after strict beat-budget fixture updates.
- Hybrid banned-items integration:
  - deterministic lint for exact hard bans
  - semantic critic rubric for judgement-based prose failures
- Legacy fractional chapter-label audit in active canon/seed data.
- Phase 11 markup parser and amendment audit log.

## Canonical Chapter Map

There are no canonical Chapter 7.5, Chapter 12.5, or Chapter 12.75 entries.

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

## Non-Negotiable Rules

- Generator cannot self-approve.
- Retry loops must terminate.
- Provider/config failures must be distinguishable from quality rejection.
- Docs must describe current runtime honestly.
- No fake login/auth UX.
- No direct LLM endpoint calls outside the provider/router layer.
- No graph-shaped narrative state model.
- No React work while the NarrativeOS scope lock is active.

## Handoff Protocol

When passing context between agents, write a compact handoff entry to durable
project docs or memory before the receiving agent starts.

Format:

```markdown
### [HANDOFF] task-name | date: YYYY-MM-DD | from: AGENT -> to: AGENT
**Status:** what is done
**Pending:** what is not done
**Open decisions:** unresolved calls
**Files touched:** paths that changed
```
