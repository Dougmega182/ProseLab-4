# Project Brief

## Project Overview
ProseLab 4 is a local-first AI writing engine for drafting, critiquing, and rewriting prose under explicit stylistic and structural constraints. It is not a general writing app; it is a quality-enforcing prose workflow centered on analysis, harsh criticism, and bounded rewrite passes.

## Goals (Success Criteria)
- First-pass generic prose is rejected consistently, and the critic provides specific rewrite instructions that cause visible structural change in the second draft.
- A 2-pass draft -> critique -> rewrite -> critique cycle can run reliably on real paragraphs with valid live LLM responses and no cached generation or critic leakage.
- The system remains understandable and maintainable by one developer, with clear cache behavior, explicit provider diagnostics, and bounded orchestration.

## Non-Goals (Explicitly out of scope for now)
- Mobile apps.
- Multi-user collaboration, auth systems, or cloud sync.
- Full document/binder workflow beyond what is needed to validate the core engine.
- Graph visualizations, timeline tooling, maps, or broad worldbuilding features.
- Advanced autonomous agent swarms or long-running background orchestration.

## Tech Stack & Versions (update as decided)
- Language/Runtime: JavaScript (ES modules), Node.js for scripts, browser runtime for the app
- Framework: React 19 + Vite 8
- Database: None currently; localStorage only
- Key Libraries: `react`, `react-dom`
- Deployment: Local development currently; no production deployment target locked yet
- Testing: Script-based validation currently; formal test stack not committed yet

## Constraints & Hard Rules
- Must be secure by default: no secrets committed, no browser-exposed production key strategy, and explicit provider failure reporting.
- Code must be maintainable by a single developer for at least 12 months.
- No unnecessary dependencies; prefer standard library or already-committed packages.
- All new code must include basic tests, validation scripts, or a clear testing plan.
- Performance budget: interactive local editing should remain responsive; repeated editorial passes should reuse only safe cache layers, and live LLM calls should avoid unnecessary token spend.
- Generator and critic outputs must not be cached.
- Cache must include versioned context and prompt identity where applicable.
- Rewrite loops must be bounded; no infinite retries.
- The critic must default toward rejection of safe, generic, or emotionally vague prose.

## Current State (update periodically)
- Last major decision: Locked a 3-pass Critic loop with structural bans (verbatim preservation, interpretive tails, metaphors) and unified scene context grounding on 2026-04-28.
- Open blockers:
  - `App.jsx` still carries too much responsibility and remains a refactor target.
  - The Output tab is a "black box" that only shows the final result, hiding the intermediate critique/rewrite stages from the user.
- Next milestone: Refactor the `App.jsx` Output tab to surface per-attempt scores, failures, and critic instructions so the user can see the reasoning behind each rejection in the 3-pass loop.

## My Known Weaknesses (correct for these)
- Overestimate discipline / underestimate effort -> always double time estimates and question follow-through.
- Tendency to add features before stabilizing core.
- Avoidance of thorough testing and refactoring.

This file is authoritative. Reference it in every relevant response.
