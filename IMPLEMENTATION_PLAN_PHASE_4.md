# Phase 4 Implementation Plan: Scene Validation & Advanced Orchestration

## Overview
This plan focuses on transitioning ProseLab from a "high-quality rewriter" to a "story-aware editorial workstation." The core objective is ensuring that the generated prose is not just "good writing" but "correct storytelling" based on the project's defined Story Core.

---

## Sprint 4: Semantic Alignment & Constraint Enforcement

### Goal:
Ensure the engine enforces project-specific logic (Lore, Causality, Voice) with the same rigor it enforces general prose quality.

### Engineering Steps:
1.  **Semantic Validator Agent**:
    -   Implement `src/engine/validator.js`.
    -   Create a specialized prompt that compares generated prose against scene metadata (`causality`, `output`, `stakes`).
    -   Wire the Validator into the `runPipeline` loop after the Critic pass.
2.  **World Rule Injection**:
    -   Update `runAgent.js` to inject the project's `rules` array into the Critic's context.
    -   Define a new `FAILURE_TYPE: RULE_VIOLATION` to trigger specific rewrite directives when world logic is broken.
3.  **Voice Profile Calibration**:
    -   Implement a scoring pass that measures prose against the `voice` profile (Sentence Length, Fragment Density, Metaphor Frequency).
    -   Surface these as "Voice Alignment" scores in the UI.

### Definition of Done:
- The engine rejects prose that contradicts the scene's `causality`.
- World rules are explicitly cited in rejection reasons.
- Voice alignment scores are visible in the Output tab.

---

## Sprint 5: Architectural Hardening (The Monolith Strike)

### Goal:
Finalize the extraction of engine logic from the UI layer to improve maintainability and testability.

### Engineering Steps:
1.  **Orchestrator Extraction**:
    -   Create `src/engine/orchestrator.js`.
    -   Extract the complex `runCreateMode` logic from `App.jsx`.
    -   Expose a single `run(sceneId, mode)` entry point for the UI.
2.  **Unified State Persistence**:
    -   Migrate `shadowActions` and `compositionMetrics` from `appStore.js` (volatile/localStorage) to `db.js` (IndexedDB).
    -   Ensure that pending agent proposals are preserved across sessions and associated with specific projects.
3.  **Error Telemetry & Diagnostics**:
    -   Implement a global `TelemetryService` to track pipeline latency, provider failure rates, and "Alignment Drift" (how often the validator rejects prose).

### Definition of Done:
- `App.jsx` is reduced to < 400 lines (primarily UI composition).
- Pending AI proposals survive a hard browser refresh.
- Pipeline errors are surfaced with actionable diagnostic data.

---

## Sprint 6: Lore-Prose Feedback Loop

### Goal:
Enable the system to "learn" from the prose it generates, updating the world model automatically.

### Engineering Steps:
1.  **Post-Approval Lore Extraction**:
    -   Implement an `onApproval` hook in the orchestrator.
    -   Trigger the `LoreAgent` to scan approved prose for new entities or relationship updates.
    -   Propose these updates as "Lore Sync" shadow actions in the Preproduction kit.
2.  **Entity Linking in Editor**:
    -   Implement basic hover-states or highlighting in the `ProseEditor` for recognized lore entities (Characters, Locations).

### Definition of Done:
- Approving a scene automatically updates mention counts and relationship strengths in the Lore Graph.
- The system detects when new prose contradicts previously established lore.

---

## Success Criteria (Phase 4)
- **Constraint Fidelity**: 90%+ alignment between scene metadata and final approved prose.
- **Architectural Integrity**: Zero LLM orchestration logic remaining in React components.
- **Operational Resilience**: Complete recovery of pipeline state after session interruption.
