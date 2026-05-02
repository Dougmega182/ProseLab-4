# 📄 AGENTS.md

# ProseLab 4 — Agent Architecture

## Overview

ProseLab is transitioning into a **multi-agent writing system**.

Not all agents exist yet. This defines the target system.

---

## Core Agents

### 1. Generator Agent (EXISTS)

**Role:**
Produce improved prose from constraints.

**Current Implementation:**
- Ollama (primary rewrite)
- OpenAI (refinement)

---

### 2. Analyst Agent (EXISTS)

**Role:**
Measure writing quality.

**Functions:**
- Rhythm analysis
- Emotional concreteness
- Specificity scoring

**Output:**
Structured metrics

---

### 3. Delta Agent (EXISTS)

**Role:**
Convert analysis into actionable rewrite instructions.

---

### 4. Critic Agent (EXISTS)

**Role:**
Reject bad writing.

**Responsibilities:**
- Evaluate generated text against rhythm, specificity, and grounding.
- Detect failure modes (averaging, over-explanation, weak metaphors).
- Score narrative intent alignment.
- Return: APPROVE or REWRITE (with feedback).

---

### 5. Challenger Agent (EXISTS)

**Role:**
Adversarial verification.

**Current Implementation:**
- Gemini 1.5 Pro.

**Function:**
Challenges `APPROVE` verdicts from the primary Critic to detect "deceptively clean" but empty prose.

---

### 6. Orchestrator (EXISTS)

**Role:**
Control the pipeline loop.

**Behavior:**
Generate → Critique → Challenger → (Pass?)
YES → Accept
NO → Rewrite → Retry (max 3)

---

## Target Loop

User Input
↓
Analysis
↓
Delta
↓
Generate
↓
Critic (Primary)
↓
[REWRITE] → Loop
[APPROVE] → Challenger
            ↓
            [REWRITE] → Loop
            [APPROVE] → Final Output


---

## Design Rules

- Generator cannot self-approve
- Critic must be stricter than generator
- Loop must terminate (max retries)
- Feedback must be specific, not generic

---

## Future Agents (Later)

- Lore Agent (entity extraction + linking)
- Consistency Agent (timeline / character validation)
- Style Agent (voice enforcement)

---

## Non-Negotiable Principle

> If the system cannot reject bad output, it will produce average output.

The Critic Agent is mandatory.

# ProseLab V2 Agent Guide

The app is a local-first prose workstation with:
- A preproduction workspace for story core, voice, rules, characters, beats, scenes, and preflight briefs.
- A `CREATE` mode that currently runs `analysis -> delta -> Ollama draft -> OpenAI refinement`.
- Editorial modes: `ANALYSE`, `ENGINEER`, `MARKET`, and `VERDICT`.
- LocalStorage persistence for text, preproduction state, cache entries, and token/cost stats.

## Current Runtime Reality
- There is no user account system, no session management, and no login flow.
- API access is driven by local Vite env vars in `proselab/.env`.
- The app reads:
  - `VITE_OPENAI_KEY`
  - `VITE_GEMINI_KEY`
  - `VITE_OLLAMA_MODEL`
- `CREATE` currently depends on Ollama plus OpenAI.
- Editorial modes currently depend on OpenAI.
- Gemini is surfaced in settings/status, but the current `runPipeline` implementation does not call `callGemini`.

## Important Product Behavior
- `ENGINEER` is intentionally locked until `ANALYSE` has run and the editor text has changed afterward.
- `VERDICT` is intentionally locked until both `ANALYSE` and `ENGINEER` have feedback.
- `ANALYSE` is diagnosis-only by prompt design.
- The app has inference caching keyed by normalized prompt content.

## Main Files
- `proselab/src/App.jsx`: primary application logic and UI.
- `proselab/src/index.css`: design system and layout styles.
- `proselab/preproduction-kit.html`: likely source/reference material for the preproduction surface.
- `archieve/`: historical versions and craft notes. Treat as reference, not active app code.

## Constraints For Future Changes
- Preserve the current mode progression unless the user explicitly asks to relax it.
- Do not introduce fake auth/UI copy suggesting users should sign in unless a real auth flow is added.
- Keep provider diagnostics explicit. Missing config should be visible before mode execution.
- Treat `proselab/.env` as sensitive local configuration and never print secret values back to the user.

## Known Mismatches
- UI copy still implies a Gemini final stage in places, but the active pipeline stops after OpenAI refinement.
- The root workspace `.env` is not the Vite env file used by the React app; `proselab/.env` is the active file.
- The repository root is not a Git repo in the current workspace context.

## Recommended Next Engineering Priorities
- Make provider diagnostics deeper by probing Ollama availability instead of only checking model text.
- Either wire Gemini back into `runPipeline` or remove Gemini from the advertised active pipeline.
- Replace mojibake characters in UI strings with clean ASCII/UTF-8 text.
- Add basic tests around mode gating and provider requirements.
