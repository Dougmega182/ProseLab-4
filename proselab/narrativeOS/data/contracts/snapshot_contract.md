# Snapshot System Invariants & Contract

This document defines the absolute, non-negotiable invariants of the NarrativeOS snapshot and rollback infrastructure. Before any fuzz testing or chaos engineering is attempted, the system must deterministically enforce these boundaries.

If the system violates any of these invariants, it is fundamentally untrustworthy.

---

## 1. Cryptographic Sealing Invariant
A snapshot is not a backup folder; it is a cryptographically sealed vault.

*   **Rule 1.1:** The `SnapshotManifest` (`manifest.json`) is the absolute root of trust for a snapshot.
*   **Rule 1.2:** Every file tracked by a snapshot (e.g., `canon_store.json`, `book1_contract.json`) **MUST** have its SHA-256 hash strictly map to the recorded hash in the manifest.
*   **Rule 1.3:** Any hash mismatch, missing file, or unrecognized file within a snapshot directory **MUST** trigger an immediate, hard failure (`SnapshotError`). The snapshot must be classified as `CORRUPTED`.
*   **Rule 1.4:** The manifest itself must be strictly schema-validated. Missing fields or schema downgrades (e.g., loading a `v2` manifest in a `v1` runtime) **MUST** reject the snapshot.

## 2. Lineage Continuity Invariant
Snapshots do not exist in isolation. They form a directed acyclic graph of temporal states.

*   **Rule 2.1:** Every snapshot (except the explicit genesis/baseline snapshot) **MUST** declare a `parent_snapshot_id`.
*   **Rule 2.2:** A snapshot is only valid if its parent exists and is also cryptographically valid.
*   **Rule 2.3:** An "orphaned node" (a snapshot pointing to a missing or corrupted parent) **MUST** be rejected as untrustworthy. History cannot have gaps.
*   **Rule 2.4:** Lineage must be strictly acyclic. `A -> B -> A` is a fatal system state.

## 3. Rollback Idempotence & Atomicity Invariant
Rollback is a destructive operation on active state and must be perfectly contained.

*   **Rule 3.1:** Rollback is purely functional. Executing `rollback(snapshot_X)` 10,000 times must yield the exact same bit-for-bit active state as executing it once.
*   **Rule 3.2:** Rollback **MUST NOT** mutate the target snapshot in any way. Snapshot directories are strictly read-only after their atomic creation.
*   **Rule 3.3:** Active state transitions must be atomic. A crash *during* a rollback cannot leave the system with `canon_store.json` from `Snapshot A` and `book1_contract.json` from `Snapshot B`. Rollbacks must stage files and flip pointers/renames atomically.

## 4. Normalization Equality Invariant
Semantic equality does not exist at the snapshot layer; only bitwise equality exists.

*   **Rule 4.1:** The system does not tolerate JSON whitespace differences or key ordering drift. If two active states are semantically identical, they **MUST** produce identical canonical hashes.
*   **Rule 4.2:** Rolling back to `snapshot_X`, then immediately creating `snapshot_Y` without any generative actions, **MUST** result in `snapshot_X.hash == snapshot_Y.hash`.

## 5. Tamper-Evident Forensics Invariant
The system must not silently absorb or ignore failures.

*   **Rule 5.1:** Any detection of corruption, schema mismatch, or lineage breakage during verification **MUST** be written to an append-only audit log.
*   **Rule 5.2:** Audit logs are strictly monotonic. They can only be appended to, never rewritten or rolled back.
