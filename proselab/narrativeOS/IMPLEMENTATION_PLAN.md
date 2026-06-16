# NarrativeOS Implementation Plan

This plan turns `ROADMAP.md` into executable work for the multi-novel kernel and prose causality platform.

## 1. Technical Mechanism Analysis (Completed)
- **Constraint**: No vague adjectives (evocative, vivid, etc.) in judge output.
- **Requirement**: All critiques must articulate the *technical operation* of the sentence.
- **Verification**: `calibrate` command with M3 style-preserving hostile edits.

## 2. 2x2 Dependency Matrix (Completed)
- **Goal**: Isolate Synergy vs Dependency in prose architecture.
- **Implementation**: PIT loop for A1B1, A0B1, A1B0, A0B0.
- **Logic**: If `Loss(A+B) > Loss(A) + Loss(B)`, flag Synergy.

## 3. False Causality Trap Detection (Completed)
- **Goal**: Prove judge isn't just pattern-matching surface tokens.
- **Implementation**: Seeded v3 traps with correlated-but-non-causal features.
- **Verification**: `hostile-bench` results where judge must reject the trap.

## 4. The 100-item 'Horsemen' Run (Current)
- **Task**: Run high-volume blind tournaments across 10 distinct failure categories (Fake Greatness, Ugly Genius, etc.).
- **Infrastructure**: Use the **Panel Judge** (Gemini + Ollama/Qwen) to harvest disagreement.
- **Output**: Populate the **Disagreement Ledger** with technical deltas.

## 5. Mechanism Interaction Mapping (Current)
- **Task**: Identify which mechanisms in the *Quantum Shadows* corpus have the highest dependency on placement vs. phrasing.
- **Analysis**: Cross-reference MIT results from the 100-item run.

## 6. Temporal Decay Implementation (Next)
- **Task**: Implement T+24h simulated judge.
- **Requirement**: Memory-constrained second pass (no original text allowed in context during T+24h evaluation).

## 7. Mechanism Adversary Agent (Next)
- **Task**: Build the 'Devil's Advocate' critic.
- **Constraint**: Adversary is rewarded for successfully disproving a judge's causal claim.

---
*Status: Architecture verified. Transitioning to mass-calibration and adversarial stress-testing.*
