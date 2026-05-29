# AGENTS.md
# Tool Roster & Routing Rules
# Author: Dale Ryan | Last updated: see git log

***

## TOOL STACK OVERVIEW

| Tool | Model | Role | Strengths |
|------|-------|------|-----------|
| **Gemini Flash 3** | Gemini 3 Flash | Fast thinker | Speed, low cost, good enough for low-stakes work |
| **Gemini Pro 3** | Gemini 3 Pro | Auditor | 1M+ token context, whole-repo reads, pattern detection |
| **Galaxy AI** | Claude Opus 4.6 | Executor | Precision, reasoning, voice-sensitive output |
| **ABACUS.ai CLI** | — | Orchestrator | Loads GOVERNANCE/MEMORY/AGENTS, routes tasks, manages state |

***

## AGENT DEFINITIONS

***

### AGENT: FLASH
**Tool:** Gemini Flash 3
**Role:** Fast thinker
**Cost:** Low — use freely for low-stakes work

**Assign when:**
- Quick factual lookups
- First-pass drafts that will be reviewed anyway
- Brainstorming / option generation
- Anything where a wrong answer is cheap to fix
- Formatting, restructuring, data transformation tasks
- Generating options for a decision (not making the decision)

**Do not assign when:**
- Output goes to a human without review
- The task requires multi-step reasoning
- Accuracy is load-bearing (architecture decisions, financial data, legal/regulatory refs)
- Anything voice-sensitive

**Handoff to Executor (Opus 4.6):** When the draft needs to be finalised, polished, or is going to a human.
**Handoff to Auditor (Pro 3):** When the task has grown beyond ~10 files or needs cross-file analysis.

***

### AGENT: AUDITOR
**Tool:** Gemini Pro 3
**Role:** Large-context analysis
**Cost:** Medium-high — use when you genuinely need the full context window

**Assign when:**
- Auditing an entire codebase for patterns, bugs, or consistency
- Processing large documents (PDFs, exports, long logs)
- Cross-file dependency mapping
- Checking consistency across the whole project (naming, structure, regulatory refs)
- Anything where you need to hold the entire repo or document set in context at once

**Do not assign when:**
- It's a targeted edit to a specific file — that's overkill
- Output is going to a human and voice/tone matters
- You need fast, interactive back-and-forth

**After an audit session:** Write a cache entry to MEMORY.md for whatever large context was processed. The next session should not re-read the same material.

**Handoff to Executor:** Audit findings are in — now need targeted fixes or documented output.
**Handoff to Flash:** Audit findings just need quick reformatting or simple transforms.

***

### AGENT: EXECUTOR
**Tool:** Galaxy AI (Claude Opus 4.6)
**Role:** Precision execution and all human-readable output
**Cost:** High — route here when quality matters

**Assign when:**
- Writing anything a human reads: docs, READMEs, comments, reports, cover letters, commit messages
- Targeted code changes where accuracy and context-awareness are load-bearing
- Architecture decisions requiring reasoned trade-off analysis
- Integrating outputs from Flash/Auditor into a coherent deliverable
- Any task where voice, tone, and precision matter

**Do not assign when:**
- You just need a quick low-stakes answer (use Flash)
- You need to process 30+ files simultaneously (use Auditor)

**Voice rule:** All output from this agent must follow the voice spec in GOVERNANCE.md §4. No exceptions.

***

### AGENT: ABACUS CLI
**Tool:** ABACUS.ai CLI
**Role:** Session orchestrator — not a reasoning agent

**Responsibilities:**
- Load GOVERNANCE.md, MEMORY.md, AGENTS.md at session start
- Route tasks to the right agent based on AGENTS.md rules
- Write cache entries and session logs to MEMORY.md at session close
- Surface open decisions and escalation points to Dale

**Does not:**
- Make architecture decisions
- Write prose
- Override routing rules from GOVERNANCE.md

***

## ROUTING DECISION TREE

```
New task arrives
│
├─ Does the output go to a human? (docs, prose, voice-sensitive)
│   └─ YES → EXECUTOR (Opus 4.6)
│
├─ Does it span the entire repo or require full-context analysis?
│   └─ YES → AUDITOR (Pro 3)
│
├─ Is it low-stakes, a quick lookup, or a first-pass draft?
│   └─ YES → FLASH (Flash 3)
│
├─ Is it a targeted code edit with business logic context?
│   └─ YES → EXECUTOR (Opus 4.6)
│
└─ Unclear? Default to EXECUTOR. Escalate to Auditor if context explodes.
```

***

## PROJECT-SPECIFIC ROUTING

### PMO Academy (Node.js/Express)
| Task | Agent | Notes |
|------|-------|-------|
| Module content writing | Executor | Voice-critical |
| Crisis scenario writing | Executor | Voice-critical |
| OpenAI API integration | Executor | Precision required |
| Full module consistency audit | Auditor | 8 modules, cross-check refs |
| Quick option generation | Flash | Brainstorming only |

### WARP Trading Bot (multi-model pipeline)
| Task | Agent | Notes |
|------|-------|-------|
| Architecture decisions | Executor | Reasoning required |
| Cross-layer data flow audit | Auditor | Full pipeline view needed |
| Quick data transforms | Flash | Low stakes |
| Documentation | Executor | Voice-critical |

### Quantum Shadows — Novel
| Task | Agent | Notes |
|------|-------|-------|
| Chapter drafting | Executor | Voice-critical |
| Continuity/timeline audit | Auditor | Full manuscript context |
| Plot option generation | Flash | First-pass brainstorm only |
| Editorial pass | Executor | AI-tell detection, precision |
| Character/antagonist work | Executor | Reasoning + voice |

### Music Production (Google Flow / Lyria 3 Pro)
| Task | Agent | Notes |
|------|-------|-------|
| Sound Box / Lyrics Box / Ask Producer | Executor | Voice and precision |
| Reference track analysis | Flash | Quick analysis is fine |
| Prompt structural review | Executor | Final output quality |

### Construction Business SOPs
| Task | Agent | Notes |
|------|-------|-------|
| SOP content writing | Executor | Voice-critical, regulatory accuracy |
| Cross-SOP consistency audit | Auditor | 19 SOPs, 3 tiers |
| Quick regulatory lookups | Flash | Verify with Executor before use |

### Homes Victoria Application
| Task | Agent | Notes |
|------|-------|-------|
| Interview prep / mock Q&A | Executor | Voice-critical |
| Cover letter / CV edits | Executor | Voice-critical |
| Research synthesis | Flash → Executor | Flash drafts, Executor finalises |

***

## HANDOFF PROTOCOL

When passing context between agents, write to MEMORY.md first. The receiving agent needs a cache entry, not a re-read.

Format:
```
### [HANDOFF] task-name | date: YYYY-MM-DD | from: AGENT → to: AGENT
**Status:** what's done
**Pending:** what's not done
**Open decisions:** unresolved calls
**Files touched:** paths that changed
```

*Add new project configs under "Project-Specific Routing" as projects are onboarded. Role, agent, one-line note — keep it lean.*

# ProseLab 4 - Agent Architecture Status

## Purpose

This file describes the current agent/runtime reality of ProseLab 4 and separates it from the longer-term target architecture.

The codebase is no longer just a single-pass prototype. It now includes:
- a bounded generate/critique loop
- a project/chapter/scene document model
- manuscript import into IndexedDB
- preproduction enrichment for characters, world rules, beats, and scene inventory
- a lore/consistency subsystem

## Current Runtime Baseline

The active app is the Vite project in `proselab/`.

Primary files:
- `proselab/src/App.jsx`
- `proselab/src/hooks/useDocumentManager.js`
- `proselab/src/services/db.js`
- `proselab/src/services/importOrchestrator.js`
- `proselab/src/services/createModeOrchestrator.js`
- `proselab/src/engine/pipeline.js`

The launcher used locally is:
- `E:\Ai\ProseLabV2\ProseLab-4.bat`

## Agent Status

### 1. Generator Agent
Status: implemented

Role:
- produce draft prose from scene intent, context, and voice constraints

Current implementation:
- Ollama generation path
- OpenAI refinement path

Notes:
- generation is no longer the only gate; it feeds critique/orchestration

### 2. Analyst Agent
Status: implemented

Role:
- inspect prose quality and derive craft metrics

Current functions:
- rhythm analysis
- specificity / concreteness style signals
- scene-level and editorial diagnostics

Outputs:
- structured analysis used by downstream rewrite stages

### 3. Delta Agent
Status: implemented

Role:
- turn analysis into rewrite instructions

Current behavior:
- derives constrained rewrite direction before generation/refinement

### 4. Critic Agent
Status: implemented

Role:
- reject weak output and return machine-usable feedback

Current behavior:
- returns `APPROVE` or `REWRITE`
- surfaces score/failures in UI
- feeds retry logic
- participates in create-mode orchestration and shadow/action workflows

Relevant code:
- `proselab/src/engine/critic.js`
- `proselab/src/agents/criticAgent.js`
- `proselab/src/engine/autoApplyGate.js`

### 5. Challenger / Adjudication Layer
Status: implemented

Role:
- adversarial verification of approvals

Current reality:
- Gemini 1.5 Pro is fully integrated into the creation orchestration layer (`createOrchestrator.js`) as a live adversarial challenger.
- Runs dynamically on all `APPROVE` verdicts if `VITE_GEMINI_KEY` is provided.
- An adversarial challenger `VETO` automatically downgrades the final verdict to `REWRITE`, appending detailed diagnostic flaw details to the run telemetry.
- Decoupled from hard execution gates to ensure consistent survival pass telemetry when keys are absent.

### 6. Orchestrator
Status: fully refactored, decoupled, and transactionally resilient

Role:
- control the bounded generate -> critique -> retry flow

Current behavior:
- Fully extracted from UI layers into contract-compliant orchestration modules under `src/services/orchestration/` (`createOrchestrator.js`, `editorialOrchestrator.js`, `rewriteOrchestrator.js`).
- Runs on top of a centralized `runWithRetry` transaction runner (`orchestrationRunner.js`) enforcing standardized multi-pass retries and exponential backoff policies.
- Blocks `CREATE` if scene intent is incomplete by running deterministic validation.
- Enforces strict prompt word budgeting control dynamically on all inputs, cleanly isolating the `rewrite` budget (user directives) from the `repair` budget (active validator/challenger feedback) to prevent prompt pollution over iterations.
- Standardizes all returns to a strict execution contract (`success`, `output`, `diagnostics`, `warnings`, `metrics`).
- Runs native structured JSON verification (`outputValidator.js`) leveraging OpenAI `response_format` strict schemas and Zod schema mapping.
- Automatically handles adversarial Gemini Challenger `VETO` verdicts by auto-downgrading them and feeding collected fatal flaws as precise repair directives.

Relevant code:
- `proselab/src/services/orchestration/orchestrationRunner.js`
- `proselab/src/services/orchestration/createOrchestrator.js`
- `proselab/src/services/orchestration/rewriteOrchestrator.js`
- `proselab/src/engine/promptBudget.js`
- `proselab/src/engine/outputValidator.js`

## Current Product Surfaces

### Preproduction Workspace
Status: implemented

Includes:
- Core lock
- Voice profile
- World rules
- Character dossiers
- Beat map
- Scene inventory
- Preflight brief
- Pipeline settings

Recent state:
- Voice profile page includes advanced calibration metrics, rendering a computed `stabilityScore` (0-100) and visual pill/badge tags for lexical habits and punctuation patterns.
- Evaluation cues now exist across dossiers, world rules, beats, inventory, and preflight.

### Document System
Status: implemented

Includes:
- projects
- chapters
- scenes
- scene selection
- manuscript sidebar tree
- project naming/history cues for distinguishing repeated imports
- project deletion
- manuscript export

Persistence:
- IndexedDB-backed
- legacy localStorage migration still exists for older data
- filesystem-native persistence is not the live authority for the current runtime; file import/export is the explicit boundary

Maintenance:
- a first-class in-app local reset action now clears IndexedDB plus selected local support storage for debugging/recovery

### Manuscript Import
Status: implemented, recently stabilized

Current behavior:
- imports manuscript files into a named project
- creates chapters/scenes
- derives and saves:
  - characters
  - world rules
  - beats
  - scene inventory / continuity metadata
- refreshes project state after import
- shows a post-import result screen that separates:
  - trustworthy extracted sections
  - sections needing editorial review
- exposes debug objects in browser console for diagnostics

### Lore / Consistency
Status: implemented with follow-up work still available

Includes:
- lore extraction
- relationship graph
- timeline view
- consistency issue tracking
- export/clear/query surfaces

Recent state:
- Lore now acts as a manuscript review surface, not just a data browser:
  - low-confidence and unverified entity cues
  - issue severity summaries
  - timeline review counts

## Non-Negotiable Rules

- Generator cannot self-approve.
- Retry loops must terminate.
- Provider/config failures must be distinguishable from quality rejection.
- Docs must describe current runtime honestly, not just the target vision.
- No fake login/auth UX should be introduced without real auth.

## Active Avoidances (Banned Anti-patterns)

- **Narrative State Graphs (REJECTED):** Do not propose, design, or implement graph-shaped state trackers (e.g., spatial state models, causal graphs, spatial causality trackers, emotional drift trackers, narrative ontologies). The canonical data model must remain a flat JSON store tracking structured canon entries.
- **Bypassing the LLM Abstraction Layer:** Never write direct `fetch` network calls to LLM endpoints (e.g., OpenAI/Gemini/Ollama) inside validation or business logic layers. All model interactions must route exclusively through the centralized provider router (`llm.js`).
- **Cargo-Cult JSON String Parsing:** Do not implement manual string-stripping regex or custom-written AST parsers to isolate JSON. When strict structured JSON output is required, use OpenAI's native Structured Outputs (`response_format: { type: "json_schema", ... strict: true }`) combined with direct Zod schema mapping.
- **Prompt Pollution & Instruction Stacking:** Never stack errors, violations, or challenger fatal flaws inside a growing accumulator prompt parameter over multiple retries. Isolated directives must be refreshed per pass using bounded parameters (`rewrite` vs. `repair`) and strict budgeting rules.

## Known Gaps

- Some UI copy still contains minor mojibake / encoding damage.
- The broader shell has layout inconsistency outside the refreshed import/preproduction surfaces.
- The main `App.jsx` still carries React rendering and legacy action hooks that need wiring to the new orchestrators.
- Tests for long-running multi-pass expansion cycles need more extensive coverage.

## Near-Term Priorities

1. Wire the decoupled orchestrators cleanly into the React UI actions in `App.jsx`.
2. Add automated repair loops inside the orchestrators based on the narrative compiler's validation feedback.
3. Fix remaining UI copy mojibake.
4. Continue improving preproduction and sidebar UX coherence.
