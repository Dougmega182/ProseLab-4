# ProseLab Implementation Plan

## Purpose
This plan translates the current product intent in [AGENTS.md](/E:/Ai/ProseLabV2/AGENTS.md), [README.md](/E:/Ai/ProseLabV2/README.md), and [ROADMAP.md](/E:/Ai/ProseLabV2/ROADMAP.md) into an execution sequence for the current codebase.

It reflects two realities:
- The target product is a quality-enforcing AI writing engine.
- The current implementation is still a prototype centered on `proselab/src/App.jsx`.

## Product Thesis
ProseLab should not behave like a passive text editor or a one-shot generator.

The product goal is:
- analyze prose
- generate constrained rewrites
- reject weak output
- loop until approved or retry budget is exhausted

The highest-priority capability is the Critic Agent. Without rejection, the system cannot enforce quality.

## Current State

### What exists
- Local-first React/Vite app in `proselab`
- Preproduction workspace
- `CREATE`, `ANALYSE`, `ENGINEER`, `MARKET`, `VERDICT` modes
- Analysis metrics
- Delta generation
- Ollama + OpenAI rewrite path
- Local caching and token/cost tracking
- Basic provider/config diagnostics

### What is incomplete or mismatched
- README/agent docs still describe Gemini as an active final stage, but the current `runPipeline` stops after OpenAI refinement.
- There is no Critic Agent or approval/rejection loop.
- `App.jsx` currently carries orchestration, state, provider logic, prompts, and UI in one file.
- Root documentation has some duplicate and outdated content.
- Text contains mojibake in several UI strings.

## Delivery Strategy
Work in thin vertical slices. Each slice must leave the app in a runnable state and tighten the path toward quality enforcement.

Priority order:
1. Stabilize documented reality
2. Complete the core engine
3. Improve operational reliability
4. Expand workflow only after quality enforcement exists

## Agile Lifecycle

### 1. Discover
Objective:
Confirm product rules and remove contradictions between docs and runtime.

Activities:
- Audit current prompts, mode behavior, and pipeline stages
- Identify all places where UI copy disagrees with code
- Confirm which providers are truly required per mode
- Define acceptance criteria for Critic behavior

Outputs:
- Updated docs
- Clean backlog
- Explicit scope for the next sprint

### 2. Design
Objective:
Define the smallest architecture that supports a Critic loop without a rewrite of the entire app.

Activities:
- Separate engine phases conceptually:
  - analysis
  - delta
  - generation
  - critique
  - retry/orchestration
- Define Critic response contract
- Define retry budget and failure states
- Define UI states for rejected output and approved output

Outputs:
- Critic interface
- Loop-control rules
- UI state map

### 3. Build
Objective:
Implement one production-useful slice at a time.

Activities:
- Extract logic from `App.jsx` where necessary
- Add Critic call and retry loop
- Add rejection visibility in the UI
- Add tests around gating and loop behavior

Outputs:
- Running feature increment
- Updated docs
- Verified behavior

### 4. Validate
Objective:
Prove the engine is actually enforcing quality rather than generating more text.

Activities:
- Manual evaluation on known weak samples
- Verify retry termination
- Verify caching does not preserve bad states incorrectly
- Verify users can understand why a passage was rejected

Outputs:
- Pass/fail notes
- defects for next sprint

### 5. Harden
Objective:
Reduce operational ambiguity and tech debt introduced during iteration.

Activities:
- Clean copy and encoding issues
- Improve provider diagnostics
- Reduce single-file complexity
- Align docs to actual runtime

Outputs:
- More maintainable code
- fewer user-facing dead ends

## Sprint Plan

### Sprint 0: Baseline Alignment
Goal:
Make docs and UI reflect the real system before adding major behavior.

Engineering steps:
1. Clean root docs so they distinguish target architecture from current implementation.
2. Replace misleading Gemini pipeline copy or restore Gemini if that is the intended direction.
3. Fix mojibake in user-visible strings.
4. Update `proselab/README.md` from Vite boilerplate to real setup and mode documentation.
5. Add a short architecture section describing actual dependencies and local env requirements.

Definition of done:
- No user-facing login/auth expectation
- No false claim about active pipeline stages
- Setup path is documented and coherent

### Sprint 1: Critic Agent
Goal:
Introduce a hard quality gate.

Engineering steps:
1. Create a Critic prompt/contract that returns:
   - scores
   - failure modes
   - verdict: `APPROVE` or `REWRITE`
   - concise rewrite directive
2. Implement `callCritic(...)` in a dedicated engine/helper module or local extraction target.
3. Feed generated output into Critic after OpenAI refinement.
4. Store Critic results in UI state.
5. Render Critic feedback clearly in the Output view.

Definition of done:
- Generated text is explicitly judged
- Rejection reasons are visible
- Approval and rejection states are distinct

### Sprint 2: Retry Loop / Orchestrator Completion
Goal:
Make rejection operational.

Engineering steps:
1. Implement retry loop control with max 2-3 attempts.
2. On rejection, merge Critic rewrite directive back into the next generation prompt.
3. Show attempt number, stage, and final disposition in the UI.
4. Prevent infinite loops and duplicated retries from cached bad states.
5. Record final pipeline trace for inspection.

Definition of done:
- `CREATE` can reject and retry automatically
- Loop always terminates
- Final output is either approved or clearly marked as failed

### Sprint 3: Reliability and Diagnostics
Goal:
Reduce ambiguous failures.

Engineering steps:
1. Add actual Ollama reachability diagnostics instead of checking only model text.
2. Handle provider failures with user-readable messages by mode and stage.
3. Ensure empty provider responses are not treated as successful outputs.
4. Review cache keys to avoid unsafe reuse across materially different prompts.
5. Add smoke checks for env and pipeline prerequisites.

Definition of done:
- Users can distinguish config issues, provider failures, and quality rejections
- Provider state is visible before execution

### Sprint 4: Refactor for Maintainability
Goal:
Reduce `App.jsx` as a risk concentration point.

Engineering steps:
1. Extract provider calls into a small service module.
2. Extract mode metadata, prompts, and lock rules into dedicated modules.
3. Extract pipeline/orchestration logic from UI render code.
4. Keep state transitions explicit and testable.
5. Preserve behavior during refactor with lightweight regression checks.

Definition of done:
- `App.jsx` is primarily composition/UI
- core engine behavior is easier to test and evolve

### Sprint 5: Workflow Expansion
Goal:
Only after the engine enforces quality, make the tool more usable for real writing sessions.

Engineering steps:
1. Introduce project/chapter/scene structure.
2. Replace single textarea with document-aware editing.
3. Move persistence beyond localStorage when justified.
4. Keep scope narrow; avoid building a general worldbuilding suite.

Definition of done:
- The workflow supports longer writing sessions without diluting the engine focus

## Engineering Standards

### Architecture rules
- Generator cannot self-approve.
- Critic output must be structured and machine-usable.
- Retry loops must have hard bounds.
- Provider diagnostics must be explicit in the UI.
- Documentation must distinguish current behavior from target behavior.

### Code rules
- Prefer extracting logic from `App.jsx` before adding more orchestration complexity there.
- Keep prompt contracts stable and versioned by code location.
- Avoid hidden state transitions.
- Treat cached inference as part of engine correctness, not only performance.

### Testing rules
- Add tests for:
  - mode lock logic
  - config gating
  - critic verdict parsing
  - retry termination
  - rejection-to-rewrite flow

## Immediate Engineering Tasks
These are the next concrete tasks implied by the current docs and code:

1. Reconcile docs so the target architecture and current implementation are clearly separated.
2. Decide whether Gemini is active or not, then align code and copy.
3. Implement Critic Agent contract.
4. Implement bounded retry orchestration.
5. Surface Critic decisions in the UI.
6. Add basic tests around gating and loop control.
7. Refactor `App.jsx` once the Critic slice is working.

## Risks
- Building workflow features before the Critic loop will dilute the product thesis.
- Keeping orchestration in one large component will slow every future change.
- Cached bad outputs may create false confidence if the cache policy is too permissive.
- Documentation drift will keep reintroducing false assumptions such as login or active Gemini usage.

## Success Criteria
The plan succeeds when:
- ProseLab can reject weak output automatically
- retry behavior is bounded and understandable
- users can tell the difference between:
  - configuration failure
  - provider/runtime failure
  - quality rejection
- docs match real behavior
- the codebase is ready for document workflow expansion without collapsing back into a monolith
