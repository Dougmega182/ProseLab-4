# Change Log - 2026-06-13 (Phase 16)

## Summary
Transitioned NarrativeOS from technical causal evaluation to **Artistic Discrimination**. Implemented tests to distinguish between technical 'surface' accuracy and genuine artistic necessity.

## Technical Changes

### 1. Mechanism Impostor Test
- **`impostor_bench.json`**: Created a benchmark pitting Elite Originals vs. Synthetic Impostors (mechanism-perfect but hollow) vs. Ugly Genius (technically rough but emotionally true).
- **`impostor_test.py`**: Implementation of the triple-comparison runner to identify if the judge is fooled by style-fraud or blind to irreducible truth.

### 2. Choice Attribution
- **`tournament.py`**: Updated `VariantEvaluation` to include `choice_attribution`.
- **System Prompt**: Refactored the judge to articulate the *authorial intent* behind specific implementations (e.g., "Why use passive voice here specifically?").

### 3. Judge Disagreement Harvesting
- **`panel_judge.py`**: Refactored to a specialized role-based dialectic:
    - **Detector**: Identifies mechanisms.
    - **Skeptic**: Attacks causal claims.
    - **Auditor**: Detects 'Fake Greatness'.
    - **Editor**: Synthesizes and resolves conflict.
- **Disagreement Delta**: Now calculates a numeric delta (0-10) based on role-conflict.

### 4. Infrastructure & Robustness
- **JSON Parsing**: Enhanced robust parsing to handle chatty LLM outputs and varying nesting patterns.
- **Rate Limit Resilience**: Added cooldown logic and detailed error separation (API vs. Literary).

## Files Created
- `src/narrative_os/impostor_test.py`
- `novels/QuantumShadows/data/impostor_bench.json`

## Files Modified
- `src/narrative_os/tournament.py` (Choice Attribution schema)
- `src/narrative_os/panel_judge.py` (Specialized roles)
- `src/narrative_os/cli.py` (Impostor test command)
- `ROADMAP.md` (Updated to Phase 16)
- `README.md` (Updated architecture)
