# MEMORY.md
# Claude Code — Persistent State, Cache & Decisions
# Author: Dale Ryan | Last updated: 2026-05-15

---

## HOW TO USE THIS FILE

- **Read:** Every session starts here. Full read, no skipping.
- **Write:** After any session that produced significant new context, add cache entries before closing.
- **Purge:** Mark stale entries `[STALE]` — don't delete, they're useful history. Explicit `[PURGE]` to actually remove.
- **Format:** Follow the templates exactly. This file is machine-read as well as human-read.

Cache entries go in `§ INFERENCE CACHE`. Decisions go in `§ DECISIONS LOG`. Project state goes in `§ ACTIVE PROJECTS`.

---

## § PROFILE

**Name:** Dale Ryan
**Location:** Eltham North, Victoria, Australia
**Background:** Victorian Registered Builder, 20 years experience. Founded and ran Ryandale Building Group ~15 years. Currently Project Coordinator (portfolio management) + runs 11-person residential construction company.

**Career target:** Transition from construction business ownership into client-side project management / PMO consulting. Targeting healthcare and government infrastructure in Melbourne. Current live application: Director, Portfolio Management Office — Homes Victoria (DFFH).

**Credentials:** Advanced Diploma Construction + Advanced Diploma IT, RMIT.

**AI tool stack:**
- ABACUS.ai → scaffolding, shell ops
- Gemini Flash 3 → fast/low-stakes thinking
- Gemini Pro 3 → large-context audits
- Galaxy AI (Opus 4.6) → execution, precision, all prose output
- ABACUS.ai CLI → session orchestrator, loads context files
- GPT (various) → WARP trading bot stack, creative tasks

**Writing voice (mandatory for all prose output):**
- Direct, terse, no corporate language
- Short sentences, active voice
- No hedging, no flattery, no padding
- Dry humour acceptable, forced positivity not
- Technical precision over accessibility — he'll ask if simpler is needed
- See GOVERNANCE.md §3 for full spec

---

## § ACTIVE PROJECTS

*Update status, current task, and next action every session. One entry per project.*

---

### PROJECT: PMO Academy
**Status:** Active
**Stack:** Node.js / Express / localhost / OpenAI API
**Location:** [add local path]
**Description:** Localhost learning platform with 8 modules for PMO knowledge and live crisis scenarios. Built specifically to support Homes Victoria application prep.
**Current task:** [update each session]
**Next action:** [update each session]
**Last touched:** [date]
**Cache entries:** [list any cache block IDs for this project]

---

### PROJECT: WARP Trading Bot
**Status:** Active
**Stack:** Python, GPT-4.5 Mini/Pro, Gemini 2.5 Flash/Pro (no Anthropic models)
**Architecture:** 5-layer pipeline
**Location:** [add local path]
**Description:** Multi-model AI trading research bot. WARP multi-agent system.
**Current task:** [update each session]
**Next action:** [update each session]
**Last touched:** [date]
**Cache entries:** [list any cache block IDs for this project]

---

### PROJECT: Quantum Shadows — Book 1: Entangled
**Status:** Active
**Stack:** 4-agent AI writing system (Architect, Analyst, Writer, Editor)
**Genre:** Sci-fi
**Setting:** 2618 CE Melbourne. Protagonist: Detective Nolan Kain, Quantum Security Agency (QSA).
**Known issues (from last editorial pass):**
- Name/year contradictions
- Chapter 6 voice drop
- Character Bell underdeveloped
- Antagonist motivation shallow
**Current task:** Stabilize ProseLab rewrite behavior so full editorial rewrite returns rewritten scene prose only.
**Next action:** Run another end-to-end rewrite pass in UI and verify no prompt/feedback leakage in output.
**Last touched:** 2026-05-15
**Cache entries:** proselab-rewrite-flow-apply-full-editorial, governance-memory-agents-baseline

---

### PROJECT: Music Production — Google Flow / Lyria 3 Pro
**Status:** Active
**Engine:** Lyria 3 Pro
**Deliverable format:** Sound Box + Lyrics Box + Ask Producer per track
**Active tracks:**
1. Complacency/self-improvement — anthemic pop-punk architecture
2. Absurdist mundane — emotional emptiness, mundane specificity
**Reference:** Blink-182 *Neighbourhoods* — BPM ranges, guitar delay motifs, polyrhythmic drums, DeLonge vs Hoppus vocal registers
**Current task:** [update each session]
**Next action:** [update each session]
**Last touched:** [date]

---

### PROJECT: Construction Business SOPs
**Status:** Complete (19 SOPs across 3 tiers)
**Stack:** Victorian regulatory refs, Buildertrend/BuildPass integration
**Location:** [add local path]
**Notes:** Complete unless regulatory changes require updates.
**Last touched:** [date]

---

### PROJECT: Homes Victoria Application — Director PMO
**Status:** Submitted / In progress
**Target role:** Director, Portfolio Management Office — Homes Victoria (DFFH)
**Capital portfolio context:** Big Housing Build, Ground Lease Model, High-rise Redevelopment
**Materials produced:** CV (modernised, PMO/govt targeting), cover letter (includes HIA/ABS research — 98.6% of Victorian construction businesses are small), mock interview prep
**Current task:** [update each session — interview prep, follow-up, etc.]
**Last touched:** [date]

---

## § INFERENCE CACHE

*Entries added here when large context has been processed. Use these instead of re-reading source material.*
*Format: [CACHE] id | cached: date | status: FRESH|STALE*

---

<!-- CACHE ENTRIES GO HERE -->
<!-- Copy this template when adding a new entry:

### [CACHE] descriptive-id | cached: YYYY-MM-DD | status: FRESH
**Source:** path/to/file or URL
**Summary:**
- fact 1
- fact 2
- fact 3
**Key identifiers:** function names, class names, schema fields, config keys
**Used in:** project name(s)
**Stale if:** what change would invalidate this
**Handed off from:** agent (if applicable)

-->

### [CACHE] proselab-rewrite-flow-apply-full-editorial | cached: 2026-05-15 | status: FRESH
**Source:** proselab/src/App.jsx, proselab/src/engine/rewrite.js, proselab/src/engine/guards.js, output.md
**Summary:**
- "Apply Full Editorial Rewrite" routes through runTargetedRewrite and generateRewrite with mode="intent-repair".
- Root cause of leakage: intent-repair prompt lacked strict "output only rewritten scene text" contract; model could echo original scene and feedback/instructions.
- Fix applied: tightened intent-repair prompt output rules and added prompt-leakage detection in validateOutputContract.
**Key identifiers:** runTargetedRewrite, buildRewritePrompt, generateRewrite, validateOutputContract, mode: "intent-repair"
**Used in:** Quantum Shadows — Book 1: Entangled
**Stale if:** rewrite pipeline files change (App.jsx rewrite action, rewrite.js prompt construction, guards.js contract checks).
**Handed off from:** ABACUS.ai CLI Executor

### [CACHE] governance-memory-agents-baseline | cached: 2026-05-15 | status: FRESH
**Source:** GOVERNANCE.md, MEMORY.md, AGENTS.md
**Summary:**
- Session load order is fixed: GOVERNANCE → MEMORY → AGENTS, with cache-first behavior mandatory.
- Token policy requires reuse of cache entries, batching related work, and mandatory cache writes after significant context processing.
- Routing policy: low-stakes quick work to Flash behavior, full-context audits to Pro behavior, precision edits and human-facing output to Opus executor behavior.
**Key identifiers:** cache-first, TOKEN BUDGET RULES, INFERENCE CACHE POLICY, ROUTING DECISION TREE, HANDOFF PROTOCOL
**Used in:** all active projects
**Stale if:** governance/routing/cache policies are revised in source files.
**Handed off from:** ABACUS.ai CLI Orchestrator

### [CACHE] proselab-expansion-insertion-flow | cached: 2026-05-15 | status: FRESH
**Source:** proselab/src/engine/expansionWriter.js, proselab/src/App.jsx, README.md, SOURCEOFTRUTH.md, proselab/README.md, proselab/INSTRUCTIONS.md
**Summary:**
- Expansion generation is polling-compatible and non-streaming, with automatic continuation passes until end marker.
- Continuation de-dup is handled with overlap merge to reduce repeated output between passes.
- Expansion output is written into Editorial Drafts with chapter + insertion boundary labels (paragraph and line references), with checkpoint autosave and log records.
- Expansion panel now supports Opus-assisted insertion placement suggestion and responsive control wrapping to prevent overflow.
**Key identifiers:** generateExpansionInsertionDraft, describeInsertionAnchors, recommendExpansionInsertion, runExpansionInsertionDraft, expansion_log, Editorial Drafts
**Used in:** Quantum Shadows — Book 1: Entangled
**Stale if:** expansion runtime flow, placement recommendation behavior, or insertion labeling/layout behavior changes in App.jsx or expansionWriter.js.
**Handed off from:** ABACUS.ai CLI Executor

---

## § DECISIONS LOG

*Architectural, technical, or strategic decisions made during sessions. Never delete — stale decisions are useful context for why things are the way they are.*

---

<!-- DECISION ENTRIES GO HERE -->
<!-- Copy this template:

### [DECISION] decision-id | date: YYYY-MM-DD | project: project-name
**Decision:** What was decided
**Options considered:** What else was on the table (brief)
**Rationale:** Why this option won
**Trade-offs accepted:** What we're living with
**Revisit if:** What circumstances would make us reconsider

-->

### [DECISION] proselab-rewrite-output-contract-hardening | date: 2026-05-15 | project: Quantum Shadows — Book 1: Entangled
**Decision:** Enforce strict output-only prose contract for intent-repair rewrites and reject prompt/instruction leakage.
**Options considered:** (1) Prompt-only fix, (2) parser/extractor post-processing, (3) prompt + validator hardening.
**Rationale:** Prompt-only is fragile under model drift. Prompt + validator gives defense-in-depth while staying minimal and local to rewrite path.
**Trade-offs accepted:** Slightly stricter validation may trigger retry more often on borderline outputs.
**Revisit if:** leakage still appears in production outputs; then add deterministic extraction fallback.

### [DECISION] proselab-expansion-runtime-polling-continuation | date: 2026-05-15 | project: Quantum Shadows — Book 1: Entangled
**Decision:** Implement expansion insertion generation as polling multi-pass continuation with overlap de-dup, checkpoint autosave, and draft-only writes.
**Options considered:** (1) single-pass generation, (2) manual continuation prompts, (3) multi-pass automatic continuation with completion marker.
**Rationale:** Polling API plus output limits require deterministic continuation. Automatic multi-pass behavior reduces operator friction and protects flow quality.
**Trade-offs accepted:** Added orchestration complexity and longer run times for long insertions.
**Revisit if:** provider offers reliable streaming completion semantics and deterministic anti-repeat continuation primitives.


---

## § HANDOFF LOG

*Records of context handoffs between agents. Populated automatically during inter-agent handoffs per AGENTS.md protocol.*

---

<!-- HANDOFF ENTRIES GO HERE -->
<!-- Copy this template:

### [HANDOFF] task-name | date: YYYY-MM-DD | from: AGENT → to: AGENT
**Status:** what's complete
**Pending:** what's not done
**Open decisions:** unresolved calls
**Files touched:** paths

-->

### [HANDOFF] repo-push-and-expansion | date: 2026-05-15 | from: FLASH → to: DALE
**Status:** Major expansion committed and pushed. Docker-based architecture (Ingestion, Python, Nginx) integrated. `galaxy-vscode` extension added. `MEMORY.md`, `GOVERNANCE.md`, and `AGENTS.md` updated and synced.
**Pending:** Validation of Docker containers in production environment. Testing of `galaxy-vscode` extension in a clean VS Code instance.
**Open decisions:** None.
**Files touched:** .gitignore, AGENTS.md, README.md, proselab/src/App.jsx, proselab/src/index.css, proselab/src/services/llm.js, ingestion-server/env.example, etc. (103 files total).

---

## § SESSION LOG

*One-line entry per session. What was done, what changed, what was cached.*

---

| Date | Project | Work done | Cache entries added | Decisions made |
|------|---------|-----------|--------------------:|----------------|
| 2026-05-15 | Quantum Shadows — Book 1: Entangled | Diagnosed and fixed Apply Full Editorial Rewrite prompt leakage; aligned runtime context from governance docs | proselab-rewrite-flow-apply-full-editorial, governance-memory-agents-baseline | proselab-rewrite-output-contract-hardening |
| 2026-05-15 | Quantum Shadows — Book 1: Entangled | Implemented and wired expansion insertion workflow with polling continuation, overlap dedup, draft checkpoint autosave/logging, and updated runtime docs | proselab-expansion-insertion-flow | proselab-expansion-runtime-polling-continuation |
| 2026-05-15 | Quantum Shadows — Book 1: Entangled | Added Opus-guided insertion placement recommendation and fixed expansion panel overflow with responsive layout; updated docs to match runtime | proselab-expansion-insertion-flow | proselab-expansion-runtime-polling-continuation |
| 2026-05-15 | Project Expansion | Staged, committed, and pushed 103 files including Docker architecture, Ingestion/Python services, and `galaxy-vscode` extension. Sanitized API keys. | none | none |

---

## § VOICE REFERENCE — QUICK CARD

*Paste this into any session prompt when generating human-readable output.*

```
VOICE RULES — Dale
- Short sentences. Active voice. No passive unless it's genuinely clearer.
- No: leverage, utilise, synergy, ensure alignment, robust, seamless, cutting-edge
- No hedging: not "may potentially", not "it could be worth considering"
- No flattery openers. Just answer.
- State opinions as opinions. Defend them if challenged.
- Technical accuracy > accessible simplification
- Cut 30% of words from every sentence before outputting
- Dry humour is fine. Forced positivity is not.
- Write like someone who's been building things for 20 years and has no time for waffle.
```

---

*This file is the source of truth for session state. If something isn't here, it didn't happen.*
*Every session that changes something should update this file before closing.*