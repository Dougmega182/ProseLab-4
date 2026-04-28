# ProseLab V4

ProseLab is a local-first, AI-assisted prose workstation. It uses a multi-agent pipeline to generate, critique, and rewrite prose with a focus on physical grounding and stylistic constraints.

## Features

- **Multi-Pass Critic Loop**: A dedicated Critic agent evaluates prose against specific failure modes (e.g., generic language, abstract emotions) and issues type-constrained directives.
- **Similarity Gating**: If a rewrite is too structurally similar to the original, the engine triggers a high-temperature rejection pass to force total replacement.
- **Preproduction Inventory**: Generation is grounded in a locked preproduction brief (location, objects, character functions) to prevent the AI from inventing clichéd stock imagery.
- **Editorial Personas**: Review your prose through the lens of specialized editors (Prose, Character, Structure, World, Market).

## Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment**:
   Create a `.env` file in the root directory or the `proselab` directory with your OpenAI key:
   ```env
   VITE_OPENAI_KEY=your_key_here
   ```

3. **Configure Ollama**:
   Ensure you have [Ollama](https://ollama.ai/) installed and running locally with your desired model (e.g., `llama3`). Ensure cross-origin requests are permitted if running on a different port.

4. **Run the Development Server**:
   ```bash
   npm run dev
   ```

## Architecture

- **Generator**: Runs via local Ollama models.
- **Rewrite/Refinement**: Runs via OpenAI (`gpt-4o-mini` or `gpt-4o`).
- **Critic**: Runs via OpenAI to ensure consistent JSON formatting and strict adherence to negative constraints.

The engine uses a split-constraint regime, ensuring the Generator respects scene context while the Critic aggressively flags abstract "tails" and literalized clichés.