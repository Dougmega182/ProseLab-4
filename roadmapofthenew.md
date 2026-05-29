# ProseLab 4 — Roadmap & Current Implementation Status

## The Goal

Not:
> “AI writing assistant.”

The actual goal:
> “A narrative intelligence system that critiques, stabilizes, and elevates long-form fiction.”

That means:
* Prose diagnostics
* Narrative structure intelligence
* Voice preservation
* Critic-agent orchestration
* Revision systems
* Manuscript memory

You are building:
* Part IDE
* Part literary critic
* Part narrative operating system

This is a real product direction.

---

## Current Architecture & Implementation Status (May 2026)

ProseLab 4 has successfully evolved from a prototype into a robust, multi-agent narrative architecture. Below is the updated roadmap showing what has been built, what is partially complete, and what remains in the backlog.

---

# PHASE 0 — STOP THE CHAOS (1 week)
**Status: [x] 100% COMPLETED**

## Objective
Stabilize core architecture and establish strict boundaries before adding complex features.

## Deliverables

### 0.1 Establish Core Architecture — [x] COMPLETED
* **Implementation:** Clean separation of concerns. Core engine logic is isolated in `/src/engine/` (pipeline, critic, validator, auto-apply gates). Orchestration contracts are decoupled from React components and housed inside `/src/services/orchestration/`.
* **Layout:**
  * `src/engine/` — Pipeline execution, critic logic, output validation.
  * `src/services/` — Persistence, import pipelines, and external API gateways.
  * `src/services/orchestration/` — Decoupled creation, editorial, and rewrite orchestrators.
  * `src/hooks/` — React UI state bindings.

### 0.2 Convert Everything To Plugin Pattern — [x] COMPLETED
* **Implementation:** The critics, validators, and analyzers conform to strict, contract-compliant module designs. Critics evaluate prose and return a standardized verdict (`APPROVE` or `REWRITE`) alongside typed failure modes and scores, which feed downstream repair engines without hardcoding logic.

### 0.3 Define Canonical Data Structures — [x] COMPLETED
* **Implementation:** Created strong, reliable schemas backed by IndexedDB and managed via **Dexie.js**. 
* **Core Stores:**
  * `projects` — Metadata, naming context, active timeline.
  * `chapters` — Structural positioning and ordering index.
  * `scenes` — Persists the 6 core narrative compiler beats (`goal`, `conflict`, `change`, `reveal`, `stakes`, `causality`) along with scene metadata (`chars`, `objects`, `location`, `time`, `output`).
  * `preproduction` — Stores characters dossiers, world rules, beat maps, and scene inventories.

---

# PHASE 1 — BUILD THE CORE ENGINE (2–3 weeks)
**Status: [x] 100% COMPLETED**

## Objective
Create the “critic swarm” foundation and a robust, bounded rewrite execution loop.

## Deliverables

### 1.1 Create Orchestrator — [x] COMPLETED
* **Implementation:** Built decoupled, contract-compliant orchestration modules (`createOrchestrator.js`, `rewriteOrchestrator.js`, `editorialOrchestrator.js`).
* **Flow:** Controls a bounded `generate -> critique -> retry` loop. If a critic rejects the prose, the orchestrator compiles specific structural and stylistic failures into a delta instruction set, triggering a targeted repair pass. Handles both database-persisted scenes and stateless bridge execution seamlessly.

### 1.2 Build First 3 Critics — [x] COMPLETED
* **Critic 1 — Rhythm Critic:** Analyzes sentence length uniformity, cadence collapse, fragment misuse, and clause monotony. Surfaces variance metrics.
* **Critic 2 — Emotional Authenticity Critic:** Detects abstract emotional labels ("unease", "sadness") and melodrama, enforcing body reactions and physical grounding.
* **Critic 3 — Specificity Critic:** Identifies vague terms, placeholder verbs, low sensory density, and abstract imagery.

### 1.3 Build Unified Score Engine — [x] COMPLETED
* **Implementation:** Aggregates multi-dimensional prose quality scores (Rhythm, Dialogue, Specificity, Pacing, Sensory) into a single, weighted quality metrics object. The voice calibration engine also calculates a `stabilityScore` (0-100) indicating lexical and structural consistency.

### 1.4 Build Diff Viewer — [x] COMPLETED
* **Implementation:** Standardized side-by-side layout in the Main Editor that renders the original prose vs. rewritten versions, highlighting exactly what was changed and displaying the diagnostic critic failures that triggered the change.

---

# PHASE 2 — PROSE INTELLIGENCE (3–5 weeks)
**Status: [x] 90% COMPLETED**

## Objective
Operationalize stylistic, structural, and continuity intelligence across the manuscript.

## Deliverables

### 2.1 Voice Fingerprinting — [x] COMPLETED
* **Implementation:** The Voice Profile module allows authors to run advanced voice calibration. Evaluates prose and extracts cadences, metaphors, fragments, and dialogue styles, compiling them into a set of `compressedDirectives`. These directives are dynamically injected into the prompt budgeting builder during execution.

### 2.2 Consistency Engine — [x] COMPLETED
* **Implementation:** Implemented the Lore & Consistency subsystem. Ingests manuscripts, extracts entities/characters, and builds a comprehensive relationship graph. Surfaces unverified or low-confidence entities, logs timeline reviews, and tracks severity summaries for continuity conflicts.

### 2.3 Narrative Momentum Engine — [/] PARTIALLY COMPLETED
* **Implementation:** Computes cadence, pacing, and tension curves scene-by-scene. The database tracks scene objectives and stake resolutions. Fully automated narrative pacing and momentum graph rendering is currently in progress.

### 2.4 Scene Intelligence — [x] COMPLETED
* **Implementation:** Embedded the **Narrative Compiler** direct validation gate. Creation and rewrite passes are strictly verified against the scene's 6 core beats. If the output validator detects that a beat (e.g., the sibling reveal or a causality step) was omitted, it blocks approval and feeds specific violations back into the repair loop.

---

# PHASE 3 — CORPUS & RAG SYSTEM (2–4 weeks)
**Status: [/] 50% PARTIALLY COMPLETED**

## Objective
Augment the criticism and writing engine with deep corpus retrieval and stylistic memory.

## Deliverables

### 3.1 Build Corpus Pipeline — [/] PARTIALLY COMPLETED
* **Implementation:** Built the **Manuscript Import Orchestrator**. Ingests `.docx` or `.txt` manuscripts, splits them into chapters/scenes, parses scene inventory, and populates the IndexedDB database. RAG-based vector chunk indexing (Chroma/LanceDB) is in the backlog.

### 3.2 Add Metadata Tagging — [x] COMPLETED
* **Implementation:** The import pipeline automatically tags and extracts metadata tags including character appearances, rules of the world, narrative beats, and scene-level summaries on initial ingestion.

### 3.3 Retrieval-Augmented Criticism — [ ] BACKLOG
* **Goal:** Connect vector-based retrieval to search the author's previous chapters or historical reference manuscripts (e.g., Wolfian or dark noir styles) to retrieve matching "good" and "bad" structural patterns for live comparison.

---

# PHASE 4 — AGENTIC WRITING SYSTEM (4–6 weeks)
**Status: [x] 95% COMPLETED**

## Objective
Operationalize the Generator-Critic-Challenger loops under actual network and validation loads.

## Deliverables

### 4.1 Generator ↔ Critic Loop — [x] COMPLETED
* **Implementation:** Implemented in `src/engine/pipeline.js`. Separates drafting (Ollama `qwen3:8b`) from premium refinement (Galaxy AI `claude-opus-4-6`). Delta instructions guide the rewriter precisely without allowing the critic to edit prose directly, maintaining strong model alignment.

### 4.2 Multi-Pass Revision — [x] COMPLETED
* **Implementation:** The Editorial and Rewrite Orchestrators segment revisions into discrete, structured passes (pacing, rhythm, style, voice guidelines) rather than attempting to solve all prose issues simultaneously.

### 4.3 Adversarial Challenger Layer — [x] COMPLETED
* **Implementation:** Fully integrated **Gemini 1.5 Pro** as a live, adversarial Challenger agent. Runs automatically on all `APPROVE` verdicts if a Gemini key is present. If the challenger detects a logical loophole or soft character drift, it triggers a `VETO`, auto-downgrades the verdict to `REWRITE`, and appends diagnostic flaw telemetry to force another retry loop.

---

# PHASE 5 — UI & PRODUCTIZATION (ongoing)
**Status: [/] 80% COMPLETED**

## Objective
Provide an elegant, modern, dark-noir interface displaying live telemetry and interactive editing.

## Deliverables

### 5.1 Left Sidebar — [x] COMPLETED
* **Implementation:** Renders a tree of chapters and scenes, tracks creation/rewrite completion statuses, and shows project naming/history cues for imported manuscripts.

### 5.2 Main Editor — [x] COMPLETED
* **Implementation:** Enriches drafting with inline critic suggestions, side-by-side diff viewers, and instant generation/editorial triggers.

### 5.3 Right Sidebar (Preproduction Workspace) — [x] COMPLETED
* **Implementation:** Houses the Voice Profile calibration tabs, World Rules compiler, Character Dossiers, Beat Maps, and the Preflight Brief. Surfaces pacing, rhythm stability, and consistency indicators.

---

# PHASE 6 — ENTERPRISE-GRADE REFACTOR & TYPE SAFETY (COMPLETED)
**Status: [x] 100% COMPLETED**

## Objective
Elevate validation structures, isolate retry buffers, and enforce static compilation correctness.

## Deliverables

### 6.1 Decoupled Word Budgeting Isolation — [x] COMPLETED
* **Implementation:** Upgraded `promptBudget.js` to support line-boundary array truncation. Isolated original user rewrite directives into the `rewrite` budget and active validation/challenger repair cues into the `repair` budget, eliminating prompt pollution.

### 6.2 Automated Multi-Pass Repair Loops — [x] COMPLETED
* **Implementation:** Rewrote both `createOrchestrator.js` and `rewriteOrchestrator.js` to run on top of a central `runWithRetry` engine.

### 6.3 Unified Orchestration Runner — [x] COMPLETED
* **Implementation:** Created `orchestrationRunner.js` to manage exponential backoffs, execution logging, telemetry capture, and diagnostic traces.

### 6.4 Native Structured Outputs — [x] COMPLETED
* **Implementation:** Replaced brittle regex parsers in `outputValidator.js` with structured Zod schemas, enforcing JSON schemas natively at the model level via `response_format`.

### 6.5 Strict `tsc` Compilation — [x] COMPLETED
* **Implementation:** Enforced strict static type-checking across targeted orchestrators and engine files, ensuring clean compilation with zero warnings.

---

## VERIFIED CURRENT TECHNOLOGY STACK

```txt
┌────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (UI)                             │
│       React 19 + Vite (Fast HMR) | Vanilla HSL CSS (Modern Noir)       │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          ORCHESTRATION LAYER                           │
│  Decoupled Orchestrators (Create, Rewrite, Editorial) | dexie (IndexedDB)│
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                            EXECUTION ENGINES                           │
│  Pipeline Runner | Prompt Word Budgeting Builder | Output Validator    │
└──────────────┬───────────────────┬───────────────────┬─────────────────┘
               │                   │                   │
               ▼                   ▼                   ▼
      ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
      │   LOCAL DRAFT   │ │ PREMIUM REWRITE │ │ ADVERSARIAL VETO│
      │  Ollama tags    │ │   Galaxy AI     │ │   Gemini Pro    │
      │  (qwen3:8b)     │ │ (claude-opus-4-6│ │  (gemini-1.5)   │
      └─────────────────┘ └─────────────────┘ └─────────────────┘
```

* **Core Framework:** React, Vite.
* **Styling:** Modern dark noir, glassmorphism, responsive CSS variables.
* **Storage & State:** **Dexie.js** wrapping IndexedDB for seamless offline-first document, character, lore, and timeline persistence.
* **Model Routing:**
  * **Drafting:** Local Ollama (`qwen3:8b`).
  * **Style Refinement & Criticism:** Premium Galaxy AI workflow (`claude-opus-4-6` via `https://api.galaxy.ai`).
  * **Adversarial Challenger:** Google Generative Language API (`gemini-1.5-pro`).

---

## ACTIVE BACKLOG & NEXT STEPS (Near-Term Priorities)

1. **Copy & Mojibake Polish:** Perform a sweep of minor encoding anomalies (mojibake) in legacy UI views.
2. **Phase 7 Narrative State Graph:** Awaiting explicit instruction or unlocking from user.
