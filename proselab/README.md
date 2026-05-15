# ProseLab V4 - Pro-Grade Editorial Workstation

ProseLab is a local-first, quality-enforcing AI writing engine. It shifts the workflow from one-shot drafting toward intent-locked scene development, critique, and revision.

## Quick Start

1. Configure `proselab/.env` with:
   - `VITE_OPENAI_KEY`
   - `VITE_GEMINI_KEY`
   - `VITE_OLLAMA_MODEL`
2. Run `npm run dev`
3. Open `http://localhost:5173`

## Importing Your Manuscript

1. Click `Import` in the sidebar.
2. Add `.md`, `.txt`, `.json`, `.docx`, or `.rtf` files.
3. Review file classification.
4. Name the manuscript project before final import.
5. Let ProseLab split the manuscript into chapters and scenes.
6. Review imported:
   - dossiers
   - world rules
   - beats
   - scene inventory

## Getting Your Manuscript Critiqued

Once the manuscript is imported, work scene-by-scene.

### 1. Preproduction

Lock the scene brief first:
- causality
- location
- story time
- required output
- stakes

### 2. Create Loop

`CREATE` currently runs:
- Ollama generation
- OpenAI refinement
- Critic evaluation

Important:
- the Critic can reject and force rewrite passes
- Gemini challenger gate is enforced on `APPROVE` in `CREATE` when `VITE_GEMINI_KEY` is configured

### 3. Editorial Modes

- `ANALYSE`: diagnosis
- `ENGINEER`: structure and world-shape review
- `MARKET`: market-facing evaluation
- `VERDICT`: higher-level editorial synthesis

## Draft Expansion Insertions (Galaxy AI)

The Write tab includes an **Expansion Draft Insertion** panel for chapter expansion passes.

Workflow:
1. Select the source scene in the manuscript tree.
2. Paste the expansion plan/brief.
3. Click **Suggest Insertion Placement** to let Opus recommend start/end paragraph boundaries.
4. Adjust boundaries if needed.
5. Click **Generate Expansion Draft**.

Runtime behavior:
- Uses Galaxy AI polling path (non-streaming).
- Automatically continues on output truncation until completion marker.
- Deduplicates overlap across continuation passes.
- Writes output into `Editorial Drafts` as draft scenes.
- Labels output with chapter and insertion boundaries (paragraph + line references).
- Expansion panel layout is responsive to prevent controls running off-page.
- Autosaves each pass and logs start/checkpoint/complete/error records via document logs.

## Tech Stack

- Frontend: React 19, Vite 8
- Persistence: IndexedDB plus selected localStorage support data
- LLMs: Ollama, OpenAI, optional Gemini infrastructure
- Editing: CodeMirror 6 and project-aware manuscript state

## Principles

If the system cannot reject weak output, it will drift toward generic prose.

The Critic is not optional. It is the quality gate that keeps the engine useful.
