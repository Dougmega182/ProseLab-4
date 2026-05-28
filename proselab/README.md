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

`CREATE` mode executes a rigorous pipeline governed by isolated code boundaries:
- **Pre-Inference Scene Validation**: Strictly verifies structural integrity (ensuring all 6 beats: goal, conflict, change, stakes, reveal, causality are present, satisfy minimum character lengths, contain no placeholders, and contain no duplicate text).
- **Centralized Provider Routing**: Model capability matching and execution policies are managed by the unified LLM Router (`src/services/llm/router.js`). All local model requests bypass host configuration ambiguities by using strict IPv4 `127.0.0.1` addressing.
- **Prompt Budgeting Control**: Before prompts are constructed, `src/engine/promptBudget.js` enforces non-negotiable word caps (Voice directives: 120 words, Scene context: 80 words, Rewrite directives: 100 words, Repair instructions: 60 words). Instructions are consolidated and deduplicated using semantic heuristic merging rules (`src/engine/budget.js`).
- **Narrative Compiler (Output Verification)**: Prose outputs are audited via hybrid validation (`src/engine/outputValidator.js`):
  - *Deterministic Delta Indexing*: Rejects outputs too similar to the original text (similarity > 85%) or completely disconnected (similarity < 5%).
  - *Tone/Style Censorship*: Identifies and blocks abstract emotional keywords (e.g., "unease", "dread") to force concrete sensory tells.
  - *Semantic Gating*: Leverages lightweight evaluative calls to confirm protagonist goal achievement, conflict acknowledgment, and irreversible change.
- **Challenger Gate**: Enforces a live Gemini Pro adversarial critique on all `APPROVE` verdicts if `VITE_GEMINI_KEY` is provided, automatically downgrading vetoed drafts to `REWRITE`.

### 3. Editorial Modes

- `ANALYSE`: Rhythms, prose density, and craft-level diagnostic mapping.
- `ENGINEER`: Conflict, stakes, and narrative structure checks.
- `MARKET`: Readership calibration and commercial positioning.
- `VERDICT`: Deep high-level critique and synthesis.

## Draft Expansion Insertions (Galaxy AI)

The Write tab includes an **Expansion Draft Insertion** panel for chapter expansion passes.

Workflow:
1. Select the source scene in the manuscript tree.
2. Paste the expansion plan/brief.
3. Click **Generate Expansion Draft** (Opus automatically infers insertion boundaries first).
4. Optionally click **Refresh Auto Placement** if you want to preview/update boundary reasoning before generation.

Runtime behavior:
- Uses Galaxy AI polling path (non-streaming).
- Automatically continues on output truncation until completion marker.
- Deduplicates overlap across continuation passes.
- Writes output into `Editorial Drafts` as draft scenes.
- Draft scenes and draft folders can be deleted directly from the sidebar **DRAFTS** section.
- Labels output with chapter and insertion boundaries (paragraph + line references).
- Boundary-safe JSON parsing is used for validation/critique/lore extraction so trailing model text does not block pipeline execution.
- Expansion panel layout is responsive to prevent controls running off-page.
- Autosaves each pass and logs start/checkpoint/complete/error records via document logs.

## Verification & Validation Commands

ProseLab features automated script suites to verify changes and test model quality metrics:

```bash
# Run end-to-end single rewrite cycle (requires VITE_OPENAI_KEY in proselab/.env)
npm run critic:cycle

# Run full Critic challenge set (16 samples, reports pass/fail by bucket)
npm run critic:challenge

# Run pre-inference regression tests
npm run test:regression

# Verify production bundle compilation
npm run build
```

## Tech Stack

- **Frontend**: React 19 + Vite 8
- **Styling**: Harmony-curated Vanilla CSS tokens (badge arrays, computed voice stability pills)
- **Persistence**: IndexedDB (Canonical Store) and legacy migration hooks
- **Routing & Execution**: Centralized LLM Router (`src/services/llm/router.js`) and isolated orchestrator services
- **Editing**: CodeMirror 6 and project-aware manuscript state

## Principles

If the system cannot reject weak output, it will drift toward generic prose.

Governance belongs in code. Generation belongs in the model.

The Critic and Output Validator are not optional. They are the deterministic compilers that protect narrative integrity.
