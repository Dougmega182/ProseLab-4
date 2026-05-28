# ProseLab V4 — User Guide

ProseLab V4 is a local-first editorial workstation for fiction.

It is built for intent-locked drafting, critique, and revision.

## Quick workflow

### 1) Import or create a manuscript project

- Use **Import** in the sidebar for `.md`, `.txt`, `.json`, `.docx`, or `.rtf`.
- ProseLab maps content to **Project → Chapter → Scene**.
- You can also create chapters/scenes manually and paste text directly in the editor.

### 2) Set scene intent before running modes

In the **Write** tab, open metadata for the selected scene and fill:

- causality
- location
- time
- required output
- stakes

Intent metadata improves critique quality and run gating.

### 3) Draft in the Write tab

- Edit the active scene in the prose editor.
- Auto-save persists to IndexedDB.
- Focus Mode is available from the header.

### 4) Run editorial modes

- **CREATE**: generation/refinement with critic quality gate
- **ANALYSE**: voice/rhythm and editorial diagnostics
- **ENGINEER**: structural and world-shape feedback
- **MARKET**: market-facing evaluation
- **VERDICT**: synthesis/final editorial judgment

## Expansion draft insertions (Galaxy AI polling)

Use this when you want expansion prose inserted between existing paragraphs without changing the source scene directly.

Steps:

1. Select the source scene.
2. In **Write**, open **Expansion Draft Insertion**.
3. Paste the expansion brief/instructions.
4. Click **Generate Expansion Draft**. Opus first infers insertion boundaries automatically from chapter + brief.
5. Optional: click **Refresh Auto Placement** to preview or re-run inferred boundaries before generation.

Runtime behavior:

- Uses Galaxy AI polling path (non-streaming).
- Automatically continues when output truncates.
- De-duplicates overlapping continuation output.
- Saves to **Editorial Drafts** as draft scenes (non-destructive).
- Delete draft scenes (× on each draft row) or draft folders (- on each draft folder header) in the **DRAFTS** sidebar section.
- Labels output with chapter and insertion boundaries (paragraph and line references).
- Validation/critique/lore extraction use boundary-safe JSON parsing so trailing model text does not block the pipeline.
- Expansion panel uses responsive layout so controls wrap instead of overflowing.
- Autosaves each pass and logs start/checkpoint/complete/error records.

## Logs and diagnostics

- Use the **Logs** tab to inspect traces and run behavior.
- Checkpoint and completion records for expansion runs are stored via document logs.

## Environment keys

Configure `proselab/.env`:

- `VITE_OPENAI_KEY` (Galaxy AI proxy key in this runtime)
- `VITE_GEMINI_KEY` (optional challenger infrastructure)
- `VITE_OLLAMA_MODEL`

## Notes on runtime truth

- Galaxy/Opus is used through the OpenAI-keyed provider path in this app.
- In `CREATE`, Gemini challenger is enforced on `APPROVE` verdicts when `VITE_GEMINI_KEY` is configured.
