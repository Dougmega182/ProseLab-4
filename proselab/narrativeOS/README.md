# NarrativeOS - Quantum Shadows

NarrativeOS is the Python CLI track for Quantum Shadows continuity,
contract/canon validation, and controlled prose generation.

It is not the React/Vite ProseLab app. During the current scope lock, active
work stays inside:

```text
E:\Ai\ProseLabV2\proselab\narrativeOS\
```

## Current Role

NarrativeOS now does more than chapter extraction. The active system supports:

- structured canon storage
- manuscript/chapter parsing
- LLM-assisted canon extraction
- deterministic conflict detection
- Section 22 prose contract generation from `decisions.md`
- contract linting
- canon reconciliation audits
- contract/canon bridge checks
- beat-level prose generation with contract preflight
- scene-scale generation fixtures and diagnostics

The current manuscript source for new fixture/smoke-test work is:

```text
E:\Ai\ProseLabV2\DRAFTS\Quantum Shadows - EXTENDED DRAFTv1.md
```

## Completed / Current Phase

See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for detailed completed and
outstanding work.

Current status:

- Phase 7 complete: Section 22 contract parser, schema, linter, generator
  wiring.
- Phase 8 complete: canon audit commands and clean canon snapshot baseline.
- Phase 9 complete: contract/canon bridge with canonical mapping file.
- Phase 10 in progress: scene-scale generation, using the Solis apartment scene
  as the strict fixture.

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

## Important Files

```text
src/narrative_os/
  cli.py                    CLI entry point
  contracts.py              Section 22 contract models
  decisions_parser.py       decisions.md -> book contract parser
  contract_lint.py          deterministic contract lint interface
  contract_canon_bridge.py  Section 22 <-> canon preflight
  canon_audit.py            Phase 8 audit/snapshot commands
  prose_generator.py        beat-level generation
  scene_generator.py        scene-scale generation
  prose_lint.py             mechanical prose lint

data/
  canon_store.json
  canon.phase8_clean.json
  contracts/
    book1_contract.json
    s22_canon_mapping.json
    banned_items_list.md
  prose_test/
    ch9.5_brief.md
    ch9.5_scene_plan.json
    ch9.5_generated_draft.md
```

The `ch9.5_*` filenames are legacy fixture names. They now represent the Solis
apartment scene fixture, not a canonical fractional chapter.

## Common Commands

Run tests:

```bash
python -m pytest tests -v
```

Build the Book 1 contract from decisions:

```bash
python -m narrative_os build-contract --decisions decisions.md --mapping data/contracts/s22_canon_mapping.json --out data/contracts/book1_contract.json
```

Check the contract/canon bridge:

```bash
python -m narrative_os check-contract-canon --contract data/contracts/book1_contract.json --mapping data/contracts/s22_canon_mapping.json
```

Run Phase 8 audits:

```bash
python -m narrative_os audit-fake-pass-ids
python -m narrative_os audit-contamination --entity Hayden
python -m narrative_os audit-contamination --entity Kain
```

Generate from a scene plan:

```bash
python -m narrative_os generate-scene-plan data/prose_test/ch9.5_scene_plan.json --contract data/contracts/book1_contract.json --out data/prose_test/ch9.5_generated_draft.md
```

## Banned Items Policy

`data/contracts/banned_items_list.md` is currently a reference file.

Planned Phase 10 split:

- deterministic hard lint for exact banned vocabulary, explicit S22 terminology
  bans, biological-proof lines, impossible deductions, and direct A&S decoding
- semantic critic rubric for judgement-based issues such as awkward similes,
  anaphora-chain overuse, colon-fragment stacking, rule-of-three excess, pacing
  stalls, and clinical observation that becomes final explanation

## Non-Negotiables

- Generator cannot self-approve.
- Retry loops must terminate.
- Provider/config failures must be distinguishable from quality rejection.
- No direct LLM endpoint calls outside the provider/router layer.
- No graph-shaped narrative state model.
- No React work while the NarrativeOS scope lock is active.
- Legacy fractional chapter labels in active canon/seed data must be audited
  before manuscript-ready generation.
