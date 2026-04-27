# ProseLab 4 — AI Writing Engine

## What This Is

ProseLab 4 is NOT a writing app.

It is an **AI-augmented writing engine** that improves prose quality in real-time using a structured pipeline:

WRITE → ANALYZE → CRITIQUE → REWRITE → APPROVE

The goal is simple:
Produce writing that is sharper, more specific, and structurally stronger than the original input — consistently.

---

## Core Concept

LLMs fail at prose because they:
- Default to average
- Lack revision instinct
- Overuse abstract language
- Miss rhythm

ProseLab solves this by forcing:
- Structural analysis
- Constraint-driven rewriting
- Multi-model refinement
- (Next) Critic enforcement loop

---

## Current Features (v4)

- Analytical engine:
  - Rhythm analysis
  - Emotional concreteness scoring
  - Specificity scoring

- Delta engine:
  - Converts analysis into rewrite instructions

- Multi-model pipeline:
  - Ollama (generation)
  - OpenAI (refinement)
  - Gemini (final polish)

- Content-addressed caching
- Token + cost tracking
- Local-first (browser storage)

---

## Core Pipeline
Input Text
↓
Analysis (metrics)
↓
Delta (instructions)
↓
Ollama Rewrite
↓
OpenAI Refine
↓
Gemini Final


---

## What’s Missing (Critical)

- Critic loop (approval / rejection system)
- Structured document system (binder)
- Entity linking (lore system)
- Persistent storage beyond localStorage

---

## Tech Stack

Frontend:
- React (Vite)
- LocalStorage (temporary persistence)

AI:
- Ollama (local models)
- OpenAI API
- Gemini API

---

## Philosophy

- Output quality > feature count
- Constraint > creativity
- Iteration > generation
- Local-first > cloud dependency

---

## Run

```bash
npm install
npm run dev