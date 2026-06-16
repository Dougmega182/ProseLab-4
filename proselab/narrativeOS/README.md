# NarrativeOS - Quantum Shadows

NarrativeOS is an advanced Python CLI kernel for **Multi-Novel Continuity Analysis**, **Prose Causality Research**, and **Elite Prose Generation**.

It is designed to separate the **Creative Engine** from the **Novel Instance**, providing a project-agnostic platform for identifying the "gears" of great writing.

## Core Architecture: The 3-Node Loop

NarrativeOS has moved away from multi-agent consensus and is now grounded in a minimal, adversarial architecture:

1.  **Generator (Singular)**: Produces high-stakes prose drafts using the best available model (Claude Opus via T2_premium).
2.  **Grounded Critic (Adversarial)**: Analyzes technical mechanisms (not just "feel") and must cite elite human anchors to validate its critique.
3.  **Corpus Oracle (Ground Truth)**: A curated database of elite prose (Wolfe, Le Guin, Butler, Delany, Bester) used for forced comparison.

## Key Research Modules

### 1. The Causality Suite (MAT/MRT/MIT)
- **MAT (Attribution)**: Proves a mechanism's power by removing it and measuring score degradation against a neutral edit.
- **MRT (Restoration)**: Verifies understanding by proving that score recovers when the mechanism is restored.
- **MIT (Interaction)**: Maps the 2x2 dependency matrix of prose architecture to identify synergistic mechanisms.

### 2. The Mutation Archive
A structured repository for "Dangerous Brilliance"—prose that fails standard compliance but contains genuinely novel construction. These "interesting failures" are preserved for long-term signal analysis.

### 3. The Dangerous Genius Ledger
A ledger of high-risk variants rejected by humans but identified by the machine as potentially ahead of taste. It tracks the delta between "Expressed Taste" and "Hidden Value."

## Getting Started

### 1. Ingest a New Novel
Bootstrap a new project directory instantly:
```bash
python -m narrative_os ingest <NovelName> <ManuscriptPath>
```

### 2. Run an Elite Tournament
Generate multiple variants and run a blind, grounded selection:
```bash
python -m narrative_os --project-root novels/MyBook generate-scene "Scene outline" --tournament 3
```

### 3. Adversarial Calibration
Stress-test the judge's ability to distinguish between elite precision and "fake greatness" traps:
```bash
python -m narrative_os calibrate
```

### 4. Human-in-the-Loop Validation
Export blind comparison tasks for real human ranking:
```bash
python -m narrative_os export-validation prose_a.txt prose_b.txt --outline "Scene intent"
```

## Status
- **Technical Capability**: 100% Operational.
- **Causality Proven**: Yes (via O->M1/M2/M3->R loop).
- **Aesthetic Monoculture Broken**: Yes (via Multi-Axis Corpus).
- **Selection Pressure Active**: Yes (via Tournament selection).

---
*NarrativeOS is not a novel factory. It is a selection engine for greatness anchored in elite literary truth.*
