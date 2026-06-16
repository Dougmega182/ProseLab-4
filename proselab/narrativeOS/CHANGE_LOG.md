# Change Log - 2026-06-13

## Summary
Refactored NarrativeOS into a project-agnostic multi-novel kernel and implemented an advanced prose causality research platform (MAT/MRT/MIT).

## Technical Changes

### 1. Project Layer & Multi-Novel Support
- **`project.py`**: Introduced `ProjectPaths` and active project management.
- **`dna.py`**: Implemented `NovelDNA` schema for novel-specific voice, tone, and authorial constraints.
- **`constitution.py`**: Added `CriticConstitution` to define novel-specific editorial standards and hard failures.
- **`state.py`**: Added `NarrativeState` for persistent character and world state tracking.
- **CLI Updates**: Added `--project-root` flag and `ingest` command to bootstrap new novels.

### 2. Grounded 3-Node Architecture
- **`prose_generator.py`**: Collapsed multi-model chain into a 3-node loop: Generator -> Grounded Critic -> Tournament.
- **`corpus.py`**: Implemented `CorpusOracle` for forced comparison against elite human anchors (Wolfe, Le Guin, Butler, Delany, Bester).
- **`tournament.py`**: Refactored judge into an **Adversarial Critic** that must cite corpus anchors and analyze technical mechanisms without adjectives.

### 3. Prose Causality & Validation
- **`mechanism_causality.py`**: Implemented the **O -> M1/M2/M3 -> R** causality loop.
  - **MAT**: Mechanism Attribution Test (Removal).
  - **MRT**: Mechanism Restoration Test (Recovery).
  - **M3**: Style-preserving hostile edits for true causal attribution.
  - **2x2 Matrix**: Dependency vs. Synergy detection.
- **`repair_gate.py`**: Added the "Anti-Bullshit Gate" (Counterfactual Repair) to validate genius anomalies.
- **`locked_schema.py`**: Defined a permanent evaluation schema including **Memorability**, **Meaningful Residue**, and **Temporal Impact**.
- **`human_loop.py`**: Refactored human handoff to capture granular feedback and technical rationales.

### 4. Calibration & Benchmarking
- **`calibration.py`**: Added `calibrate` command to stress-test the judge against known categories.
- **`reality_check.py`**: Added `reality-check` and `hostile-test` for blind pairwise preference ranking.
- **Adversarial Traps**: Seeded `fake_greatness_traps.json` and `adversarial_v3_traps.json` (False Causality, Invisible Load-Bearing Walls).

### 5. Infrastructure
- **Providers**: Implemented full support for **Ollama** and **OpenAI**.
- **`panel_judge.py`**: Added framework for multi-model panel disagreement harvesting.

## Files Created
- `src/narrative_os/project.py`
- `src/narrative_os/dna.py`
- `src/narrative_os/constitution.py`
- `src/narrative_os/state.py`
- `src/narrative_os/corpus.py`
- `src/narrative_os/tournament.py` (Major refactor)
- `src/narrative_os/mechanism_causality.py`
- `src/narrative_os/repair_gate.py`
- `src/narrative_os/locked_schema.py`
- `src/narrative_os/human_loop.py`
- `src/narrative_os/calibration.py`
- `src/narrative_os/reality_check.py`
- `src/narrative_os/panel_judge.py`
- `src/narrative_os/llm/providers/ollama.py`
- `novels/QuantumShadows/...` (Initial migration)
- `novels/TestFantasy/...` (Hostile genre test)

## Files Modified
- `src/narrative_os/cli.py` (Massive expansion)
- `src/narrative_os/store.py` (Project-awareness)
- `src/narrative_os/pipeline.py` (Project-awareness)
- `src/narrative_os/retriever.py` (Project-awareness)
- `src/narrative_os/voice_linter.py` (Project-awareness)
- `src/narrative_os/llm/router.py` (Ollama support)
- `src/narrative_os/llm/tiers.py` (New testing tiers)
- `src/narrative_os/llm/providers/openai.py` (Stub implementation)
- `src/narrative_os/llm/providers/gemini.py` (Robust JSON parsing)
