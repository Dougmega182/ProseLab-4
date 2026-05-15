# ProseLab 4

ProseLab 4 is a local-first AI editorial workstation for fiction.

It is built to enforce story intent, not just produce fluent prose.

If there is any conflict between older planning files, use `SOURCEOFTRUTH.md`.

## What it does

- Runs a bounded generate -> critique -> rewrite cycle
- Uses project/chapter/scene structure instead of a single draft box
- Imports manuscripts and extracts planning assets
- Provides preproduction surfaces (voice, world rules, dossiers, beats, inventory)
- Tracks lore consistency (entities, relationships, timeline, contradictions)

## Product stance

- AI is an assistant, not the final author
- Generic prose should be rejected
- Emotional specificity, voice, and narrative logic are first-class constraints

## Current status

- Active phase: UX coherence and hardening
- Core engine, document model, import pipeline, and lore subsystem are implemented
- IndexedDB is the canonical live persistence layer

## Workspace structure

- `proselab/` — active Vite app runtime
- `ingestion-server/` — ingestion service assets
- `galaxy-vscode/` — extension workspace assets
- `SOURCEOFTRUTH.md` — canonical product and engineering baseline

## Local run

```bash
npm --prefix proselab install
npm --prefix proselab run dev
```

## Build and test

```bash
npm --prefix proselab run build
npm --prefix proselab run test
```

## Expansion Draft Insertion (Galaxy AI polling)

The Write tab now includes an **Expansion Draft Insertion** panel.

- Paste expansion instructions into **Expansion Brief**
- Use **Suggest Insertion Placement** to let Opus recommend start/end paragraph boundaries
- Generate into **Editorial Drafts** (non-destructive)
- Output is checkpointed and autosaved each pass
- Continuation is automatic when output truncates
- Repetition between continuation passes is deduplicated
- Final draft labels include chapter + insertion start/end paragraph and line references
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
