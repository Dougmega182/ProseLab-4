# AGENTS.md
# Tool Roster & Routing Rules
# Author: Dale Ryan | Last updated: see git log

---

## TOOL STACK OVERVIEW

| Tool | Model | Role | Strengths |
|------|-------|------|-----------|
| **Gemini Flash 3** | Gemini 3 Flash | Fast thinker | Speed, low cost, good enough for low-stakes work |
| **Gemini Pro 3** | Gemini 3 Pro | Auditor | 1M+ token context, whole-repo reads, pattern detection |
| **Galaxy AI** | Claude Opus 4.6 | Executor | Precision, reasoning, voice-sensitive output |
| **ABACUS.ai CLI** | — | Orchestrator | Loads GOVERNANCE/MEMORY/AGENTS, routes tasks, manages state |

---

## AGENT DEFINITIONS

---

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

---

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

---

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

---

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

---

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

---

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

---

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
Status: partial

Role:
- adversarial verification of approvals

Current reality:
- Gemini support exists in the provider layer
- critique guardrails and truth/adjudication scaffolding exist
- documentation previously overstated Gemini as an always-active final stage

What is still missing:
- one explicit, always-on challenger pass in the main create pipeline with clear UI visibility

### 6. Orchestrator
Status: implemented, still evolving

Role:
- control the bounded generate -> critique -> retry flow

Current behavior:
- blocks `CREATE` if scene intent is incomplete
- runs analysis, delta, generation, validation, critique
- records attempts and final disposition
- enforces bounded retry behavior

Relevant code:
- `proselab/src/services/createModeOrchestrator.js`
- `proselab/src/engine/pipeline.js`
- `proselab/src/engine/orchestrator.js`

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
- imported manuscript metadata now lands in these surfaces
- GUI was refreshed to make dossiers/world/beats more readable
- evaluation cues now exist across dossiers, world rules, beats, inventory, and preflight:
  - provenance labels
  - review flags
  - scene readiness scoring

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

## Known Gaps

- Some UI copy and icons still contain mojibake / encoding damage.
- The broader shell still has layout inconsistency outside the refreshed import/preproduction surfaces.
- The main `App.jsx` remains too large and still carries too much orchestration/state/UI coupling.
- Gemini/challenger behavior still needs one clean, documented truth path in the main runtime.
- Tests are still lighter than they should be for orchestration, imports, and mode gating.

## Near-Term Priorities

1. Finish aligning UI copy and provider messaging with the real pipeline.
2. Continue breaking orchestration/state concerns out of `App.jsx`.
3. Add regression coverage for:
   - import persistence
   - project/chapter/scene hydration
   - create-mode gating
   - critic/retry behavior
4. Continue improving preproduction and sidebar UX coherence.
5. Decide whether challenger/Gemini becomes a first-class enforced stage or remains optional infrastructure.
