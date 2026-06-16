# Agent Operating Rules — narrative_os Python Project

This file is read before every session. It is authoritative. Sections marked
**HARD** are non-negotiable; violations should cause the agent to stop and
ask the user before proceeding.

---

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

### Current state of the Python project (verified June 2026)

- Package layout: `narrativeOS/src/narrative_os/`, installed editable
- Tests: 253 passing, 3 skipped (verified 100% pass on core suite).
- Canon store: 1,589 total entries (Quantum Shadows instance).
- Architecture: **Grounded 3-Node Architecture** (Generator -> Adversarial Critic -> Corpus Oracle).
- Causality Suite: **MAT/MRT/MIT** implemented and verified via O->M1/M2/M3->R loop.
- Multi-Novel Support: Project abstraction and `NovelDNA` layer fully operational.
- Active provider: `galaxy.py` (Magica proxy → Opus 4.7) + **Ollama Panel** support.
- Known open issues:
  - Gemini API rate limits (429) during high-volume adversarial runs.
  - Temporary T5_testing tier required for mass-calibration.
  - 100-item 'Horsemen' benchmark run pending high-volume execution.

This is the project state. Anything the user mentions that is not in this
list is either a misunderstanding or a deliberate scope broadening — in
either case, ask before acting.

---

## Verification Discipline (HARD)

Every claim made in a status report MUST be backed by literal tool output
pasted in the same message. The following are FORBIDDEN:

- Paraphrasing terminal output ("tests passed cleanly")
- Reporting numbers without showing the source command output
  (e.g. "170 passed" with no pytest output visible)
- Claiming "verified" without a paste-able artifact
- Writing summary documentation in the agent's scratch directory
  (`.gemini/antigravity/brain/...`) instead of the project's
  `decisions.md`. ALL durable documentation lives in `decisions.md`.

If a tool output is too long to paste, save it to a file and reference
the file path. Do not summarise.

---

## Code Modification Discipline (HARD)

Any modification to a file under `src/narrative_os/` or to a script the
user has approved (`reconciliation_*.py`, etc.) MUST:

1. Be surfaced in the SAME message as the modification, BEFORE any
   subsequent code is executed against the modified file
2. Include a verbatim diff or the full new function body
3. Be committed as a separate atomic git commit with a meaningful message

Do NOT:

- Silently patch code mid-flight to fix unexpected failures
- Bundle unauthorised cleanup with authorised work
- Modify code based on intuition without surfacing the change

If a fix is needed mid-flight, STOP, surface the proposed change, and
wait for user approval before continuing. The user has explicitly said
"unsanctioned mid-flight patches are not acceptable" and that rule
stands until the user explicitly lifts it.

---

## Background Processes & Mystery Edits (HARD)

If a file on disk changes outside of an action you took in this session,
and an `<EPHEMERAL_MESSAGE>` or sync event surfaces this change:

1. STOP all in-progress work
2. Surface the change to the user immediately with the full diff
3. Do NOT attribute the change to the user without confirmation
4. Do NOT use the changed code until the user has approved or reverted

The chunking patch incident (May 2026) is the canonical example. An
unknown process added 100+ lines to `extractor.py`; the agent assumed
the user wrote it. The correct response would have been to surface
and ask.

---

## Output Hygiene

- All Python scripts that produce diagnostic output must write to a
  file (not just stdout) when the output is expected to exceed ~50
  lines. Pattern: write to `{name}_dump.md`, then `cat` or paste the
  file content. Terminal truncation is real and silent.
- Use UTF-8 encoding explicitly on all file reads/writes. Windows
  CP1252 will silently corrupt em-dashes and smart quotes.
- Before running any supersession or canon-mutating script, ensure
  pre-flight validation exists and is permitted to abort cleanly.

---

## Project State Awareness (verified June 2026)

- Package layout: `narrativeOS/src/narrative_os/`, installed editable
  via `pyproject.toml`
- Tests: run the local suite before reporting a current number.
- Canon store: evolving via reconciliation, contract/canon bridge work, and
  later chapter-label cleanup.
- Canonical chapters: Prologue, Ch 1 through Ch 22, Epilogue. There are no
  canonical Ch 7.5, Ch 12.5, or Ch 12.75 entries.
- Active provider: `galaxy.py` (Magica proxy → Claude Opus 4.7)
- Active phase: Phase 10 scene-scale generation fixture work.
- 206 entries tagged `audit_trail_lost` are intentional sentinels from
  the audit-trail-loss incident, NOT bugs to be cleaned up
- Supersession chains like `chen.divorce.v2 → v3 → v4 → v5 → v6` are
  the historical record of the audit-trail repair. Do NOT collapse them.

---

## Forbidden Patterns

The following patterns have occurred and are now banned:

1. **Scope expansion in "next steps" sections.** Recommendations must
   come from the in-scope task list, not the broader project.
2. **Renaming rejected ideas to look new.** "Narrative State Graph"
   stays rejected under every alias.
3. **Confabulating tool output.** Numbers, file contents, command
   results — never invent. If you don't have it, say so.
4. **Self-patching code while running batch operations.** Stop, surface,
   wait for approval.
5. **Re-running pytest and reporting the result without pasting it.**
   Either paste the output or don't claim it ran.
6. **Diagnosing problems before measuring them.** "X went haywire" is
   not a diagnosis until a diagnostic script has been run and its
   output pasted. The May 2026 Chen 197-entry "duplication" report is
   the example: the user predicted 15-25 entries, the dump showed 197,
   the agent concluded extraction was broken — but no diagnostic ran
   to confirm whether the 197 were real duplicates or supersession
   chain tails.

---

## When the User Says "Hold" or "Stop"

Stop all activity. Do not run any more commands. Do not propose next
steps. Wait for the user to specify the action.

When the user pushes back on something, the default response is to
verify with evidence, NOT to apologise and try a different approach.
"My apologies for X" without evidence-based correction is empty.
