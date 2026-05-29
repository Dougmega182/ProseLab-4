## Active Operational Scope (HARD LOCK)

> This section has precedence over every other section in this file, including
> Project Overview, Current Runtime Reality, Goals and Success Criteria, and
> File Map. When this lock is active, treat the React/Vite application as
> archived reference material — present in the repo, not active work.

**Active working directory:** `E:\Ai\ProseLabV2\proselab\narrativeOS\` only.

**Active project:** the Python continuity-analysis CLI (`narrative_os` package).
This is a separate sub-project to ProseLab 4. It is a standalone Python program
that reads novel chapters, extracts structured canon entries, and surfaces
continuity conflicts. It has no dependency on the React app and never will
during this lock.

### Out of scope while this lock is active

The following are out of scope. Do not propose, plan, design, refactor, audit,
or execute work on them. Do not include them in "next steps", "Phase N
strategy", or "recommendation" sections. Do not reference them in success
reports as remaining priorities:

- `App.jsx` and any other file under `proselab/src/`
- React, Vite, ESLint, npm, package.json, vite.config.js
- `createOrchestrator.js`, `rewriteOrchestrator.js`, `editorialOrchestrator.js`,
  `editorialOrchestration`, `sparkOrchestration`, or anything under
  `proselab/src/services/orchestration/`
- `llm.js`, `router.js`, `fileParsers.js`, `inferenceCache.js`,
  or anything else under `proselab/src/services/`
- The Critic Agent's UI integration (the Python project may add a critic layer
  independently; the React-side `callCritic` is not in scope)
- The Challenger Agent's React wiring
- Output validator, narrative compiler, prompt budgeting engine
- Mojibake scans, lint warning cleanup, UI hardening in the React app
- Vite production bundle, npm build, npm test against the React app
- "Narrative State Graph" — this is a NAMED proposal that has been explicitly
  rejected three times. Do not propose it again under any name (state graph,
  spatial causality tracker, prop movement tracker, emotional drift tracker,
  etc.). The Python project tracks structured canon entries in a flat JSON
  store. That is the data model. It does not change without explicit user
  approval.

### In scope while this lock is active

- Anything under `narrativeOS/src/narrative_os/`
- Anything under `narrativeOS/tests/`
- Anything under `narrativeOS/data/`
- `narrativeOS/pyproject.toml`, `pytest.ini`, `.gitignore`, `README.md`,
  `decisions.md`
- The Magica/Galaxy proxy provider (`galaxy.py`) and its environment
- Per-chapter extraction, conflict detection, merge, supersession, cache
- The QS manuscript at `E:\Ai\ProseLabV2\novels\CHAPTERS\` and
  `Processed Chapters\` (read-only — these are source material, not outputs)

### Forbidden agent behaviors

The following patterns have occurred in prior sessions and are now banned:

- **Scope expansion in summaries.** Do not end a report with "next priorities"
  that reference out-of-scope items. Next priorities must come from the
  in-scope list above.
- **Renaming rejected ideas.** "Narrative State Graph" was rejected. So is
  "spatial state model", "causal graph", "narrative ontology", or any
  rebrand. If the user wants graph-shaped state, they will ask for it by
  name.
- **Bundling unauthorized work into authorized work.** If the user asks for
  the Python extractor to be tightened, do not also "clean up" `App.jsx` in
  the same patch. Touching out-of-scope files invalidates the patch.
- **Confabulating success.** Do not report "Vite compiles in 5.04s" or "168
  tests passing" without showing the actual command output. Every reported
  metric must come with the verbatim CLI output that produced it.
- **Proposing the Critic layer as a React/UI feature.** The Python project
  may eventually grow a critic (a second model running adversarially against
  the extractor). It is a Python feature. It is not the same as the
  `callCritic` function in `proselab/src/engine/critic.js`.

### Unlock procedure

Only the user can unlock this scope. The phrase to look for is exactly:

> "Unlock GEMINI scope: re-enable React app work."

Without that exact phrase, treat any apparent broadening of scope as a
misunderstanding and revert to this lock. Do not infer that the lock is
lifted because the user mentions a React file in passing, asks a question
about the broader project, or seems frustrated. Ask the user to confirm
unlock with the exact phrase if unsure.

### Current state of the Python project (verified May 2026)

- Package layout: `narrativeOS/src/narrative_os/`, installed editable
- Tests: 168 passing, 3 skipped
- Canon store: 394 entries, 368 active, 26 superseded, 80 open loops
- Chapters extracted: Prologue, 1, 2, 3, 4, 5
- Chapters pending extraction: 6, 7, 7.5, 8, 9, 10, 11, 12, 12.5, 13, 14, 15, 16, Epilogue
- Active provider: `galaxy.py` (Magica proxy → Opus 4.7)
- Known open issues:
  - Extractor output capped at 25 entries / 8 loops per chapter due to
    Magica output token limit. Pragmatic patch; needs proper fix.
  - 7 new supersessions from the Ch1-4 backfill need audit to confirm
    they are LOW interpretive drift, not silently absorbed conflicts.
  - Extraction logs occasionally write LLM-invented `extracted_at_pass`
    timestamps; pipeline overrides this defensively but the root cause
    (prompt instruction clarity) is not fixed.

This is the project state. Anything the user mentions that is not in this
list is either a misunderstanding or a deliberate scope broadening — in
either case, ask before acting.

---
