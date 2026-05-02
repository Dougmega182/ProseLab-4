# ProseLab V4 — Editorial Orchestration Engine

ProseLab is a local-first, quality-enforcing AI prose workstation. Unlike generic chat interfaces, it uses a multi-agent pipeline to force output quality through structural analysis, intent-alignment, and adversarial critique.

## Core Pipeline

The system operates on a **Generate → Critique → Challenge** loop:

1.  **Analysis & Delta**: The input text is measured for rhythm, physical grounding, and specificity. These metrics are converted into a "Delta" (rewrite instructions).
2.  **Ollama Draft**: A local LLM produces the primary structural draft based on the Delta.
3.  **OpenAI Refinement**: The draft is smoothed for rhythm and tone using `gpt-4o-mini`.
4.  **Critic Gate**: The Critic agent evaluates the refined draft against narrative intent and stylistic "Absolute Bans" (e.g., no abstract emotional labels).
5.  **Adversarial Challenge**: If the Critic approves, a Challenger agent (Gemini 1.5 Pro) performs a cross-architecture verification to detect "deceptively clean" but empty prose.
6.  **Retry Loop**: On rejection, the engine re-injects specific failure directives and retries up to 3 times.

## Throughput Hardening

The engine is tuned for **Liveness and Honesty**:
- **Decoupled Confidence**: Confidence scores are telemetry signals, not hard rejection gates.
- **Survival Pass**: If narrative intent repair is exhausted, the pipeline proceeds to full critique anyway to provide honest scoring for "near-misses."
- **Softened Scoring**: The Critic permits emotional resonance provided it is anchored in physical grounding, lowering the approval barrier for contextually strong prose.

## Setup & Execution

### 1. Environment Configuration
Create `proselab/.env` (Vite-specific) with the following:
```env
VITE_OPENAI_KEY=your_openai_key
VITE_GEMINI_KEY=your_gemini_key
VITE_OLLAMA_MODEL=llama3 (or your preferred local model)
```

### 2. Run Development App
```bash
cd proselab
npm install
npm run dev
```

### 3. Engine Validation
The engine is verified via a 50-sample throughput test set:
```bash
# Run the full throughput telemetry map
cd proselab
npm run throughput
```

## Architecture Map

- `src/engine/pipeline.js`: The central orchestrator.
- `src/engine/critic.js`: The quality gate (Primary & Challenger logic).
- `src/engine/rewrite.js`: The constraint-driven generator prompts.
- `src/engine/guards.js`: System invariants and gatekeepers.
- `src/services/inferenceCache.js`: SHA-256 content-addressed caching.

## Principles

> "If the system cannot reject bad output, it will produce average output."

ProseLab defaults to rejection. If a sample is borderline, it triggers a rewrite. Quality is enforced through the adversarial friction between the Primary Critic and the Challenger.