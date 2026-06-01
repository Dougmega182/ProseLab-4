## 20. The Canon Reconciliation Cycle (Pass A & B)

During Phase 7 (May 2026), after full backfill of all 16 chapters + Prologue + Epilogue (~950+ entries), it became clear that the LLM extractor preferred creating new entries rather than superseding existing ones. Seed entries (especially character identities) survived untouched while duplicate or richer entries were created. We ran a full reconciliation cycle to unify the canon.

### 20.1 Methodology: Pass A, Pass B, and Followup
The reconciliation was structured hierarchically:
- **Pass A (Namespace cleanup):** Handled the 16 active seed entries in the plot namespace via 9 mutations (4 SUPERSEDE → existing, 5 SUPERSEDE → NEW) plus 7 deliberate KEEPs, executed through one batched pre-flight-validated script (commit `53456d0`).
- **Pass B (Entity-by-entity):** Targeted the `character` namespace. We dumped active entries per entity (`entity_dump.py` and later `entity_dump_focused.py`), reviewed the arc, and wrote tailored supersession scripts for each of the 8 entities: Varn, Chen, Aspect, Solis, Reyes, Bell, Emily, Hayden, and Kain (commits `7c377d7` through `993dea8`).
- **Chain Repair & Audit:** An early discovery of fractured supersession chains (due to the audit trail loss incident) required a structural integrity fix (`a2e4c7d`), redirecting 53 entries to 21 active roots. Between entity passes, we performed sweeping audits (e.g., `audit_seed_entries.py`) to verify zero unintended active seed entries remained.

### 20.2 The Seed-Quality Lesson (Rule for Book 2)
The most expensive mistake of the cycle was writing initial seed entries from grep fragments rather than full manuscript reading. This created systemic underestimates (like Kain's three thin seed entries vs. 239 extracted entries) or factual errors (Bell discovering Kain's ICS instead of Hayden's — caught early via the wider Bell audit before Pass B formally began — and Aspect's misattributed Ch 6 first-appearance, caught during Pass B Aspect). We spent significant compute and time correcting seeds that should have been more conservative initially.

**Rule for Book 2:** If you cannot quote a specific manuscript passage that establishes a fact, it does not go into the seed as `hard_canon`. At most, it should be marked `inferred`. A thin, accurate seed is far better than a confident, incorrect seed.

### 20.3 Verification Rituals
Drift was prevented through strict, non-negotiable rituals:
- **Pre-flight Validation:** Every batched supersession script checked for the existence of all target IDs and collisions before mutating the JSON store.
- **Grep Verification:** Manual grep checks against the actual manuscript.
- **Atomic Commits:** Each logical operation (Pass B per entity, chain repair) was isolated in its own commit.
- **Strict Scope Locks:** Enforcing the `AGENT.md` and `GEMINI.md` scope locks prevented agent scope-creep into unapproved React/UI work during critical Python continuity work.
- **Five-Artifact Reporting:** Status reporting consistently included the summary, command output, verification output, test results, and git status.

### 20.4 Cross-ID Continuity Loops (The Load-Bearing Artifact)
The reconciliation work surfaced massive value that simple conflict-detection could not. By reviewing entities holistically, we planted critical, cross-ID open loops:
- The Varn timeline discrepancy.
- The laughing-woman cross-carrier identity (B-734 residue vs Hayden's subject memory).
- Chen's dead-man's-switch fate.
- Solis's B-734 reality status.
- Kain's two-jumps-left prognosis vs. his Epilogue survival state.

Several pre-existing seed loops were also resolved during the cycle (e.g., `plot.loop_solis_retirement` resolved into Ch 14's `sequestration_reason`). The reconciliation work both surfaced new questions and closed old ones — the canon is now structurally healthier on both axes.

These loops require human/system reconciliation to surface. This curated canon is the true artifact produced by the system, serving as the substrate for everything that follows.

### 20.5 The Prose Generator Proof Point
To validate the reconciled canon, we built a thin wrapper (`prose_generator.py`) to pull a canon slice, extract voice rules, and prompt the LLM (Opus 4.7 via Galaxy) to generate a Black Pearl scene. The prompt mandated a `<thinking>` critique block before generating `<prose_output>`. The generator successfully rejected commercial-fiction clichés by explicitly referencing canon IDs (e.g., Kain's tremor, the dead lighter, the denervated hand). The output scored 10/10 on the predefined rubric, providing the first concrete evidence that a clean canon substrate produces canon-grounded prose. A 4-scene test suite (POV switches, multi-character, post-Epilogue invention, action sequence) is the appropriate next test.

### 20.6 Known Limitations
- **Cross-ID semantic contradictions:** The system still relies heavily on identical entity IDs. Semantic drift (saying the same thing with different IDs) isn't auto-detected.
- **Generator testing:** The prose generator has only been tested on a Kain reading-pass scene. It needs the 4-scene test suite to expose prompt fragility.
- **Multi-novel scoping:** The flat store is currently constrained to Book 1.
- **Technical debt:** Section 17's mid-flight schema-tolerance patches (e.g., flattening `resolved_loops` dicts) remain in `extractor.py` and need a proper refactor in any future pass.

### 20.7 The Naming-Deferral Decision (Section 21 Placeholder)
The current Python project name (`narrativeOS`) will eventually transition to Continuum (proposed). The associated React drafting app (`ProseLab 4`) is proposed to rename to Forge. Both renames are deferred until the multi-novel refactor. The rationale is to maintain operational velocity on the Book 1 baseline without paying the cognitive and file-system cost of a rename mid-cycle.

### 20.8 Milestone tag
Repository tagged `qs-canon-complete-v1` at commit `993dea8` (Pass B Kain).
This tag represents the canonical "Book 1 reconciliation complete" baseline.
Any future Book 2 work or multi-novel refactor branches from this point.
