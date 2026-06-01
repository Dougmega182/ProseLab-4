# Narrative OS — Quantum Shadows

A chapter-by-chapter continuity analysis system for the novel *Quantum Shadows*. Maintains a structured canon store, retrieves a focused context slice per chapter, runs an LLM extraction pass, detects continuity conflicts, and produces author-readable reports.

This is not a "prompt system." It's a narrative database with write operations and conflict enforcement.

---

## The big picture

```
                    ┌─────────────────────┐
                    │   CANON STORE       │  44 ground-truthed entries
                    │   (canon_store.json)│  world / character / plot / craft
                    └─────────┬───────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
       ┌─────────────┐                ┌──────────────┐
       │  RETRIEVAL  │                │   FULL MS    │  cached prefix
       │ (selective) │                │ (provider    │  ~106k tokens
       │  ~1.5k tok  │                │  caching)    │
       └──────┬──────┘                └──────┬───────┘
              │                              │
              └──────────────┬───────────────┘
                             ▼
                    ┌──────────────────┐
                    │  EXTRACTOR (LLM) │  Opus 4.7 via Galaxy proxy
                    │  → StateDelta    │
                    └────────┬─────────┘
                             ▼
                    ┌──────────────────┐
                    │  CONFLICT DETECT │  tier-aware, deterministic
                    │  → Report        │
                    └────────┬─────────┘
                             ▼
                ┌────────────┴────────────┐
                ▼                         ▼
       ┌─────────────┐           ┌──────────────────┐
       │ AUTO-MERGE  │           │  PENDING REVIEW  │
       │ (clean)     │           │  pending/*.md    │
       └─────────────┘           └──────────────────┘
```

Two cache layers protect costs:

- **L1 — Local response cache.** Disk-backed SQLite + JSON blobs. Cache key is a content hash of `manuscript + canon_slice + chapter + prompt_version`. Any change to any input → automatic cache miss. Re-runs with identical inputs are free.
- **L2 — Provider prompt cache.** Anthropic's `cache_control` markers on the manuscript prefix. 90% discount on cached reads. Manuscript is written once per session, read on every chapter.

Combined cost projection for the full QS backfill (20 chapters, with caching): **~$8.67** for the first pass, **$0** for re-runs.

---

## Quickstart

```bash
# 1. Install dependencies
pip install pydantic anthropic pytest

# 2. Set the API key for the Galaxy proxy
export GALAXY_API_KEY="..."
# Default base URL: https://api.galaxy.ai/anthropic
# Override with GALAXY_BASE_URL if your proxy uses a different endpoint.

# 3. Seed the canon store (refuses to overwrite by default)
python -m narrative_os.seeds.qs_seed --force

# 4. Analyse one chapter (smoke test)
python -m narrative_os analyze manuscripts/quantum_shadows.md PROLOGUE

# 5. Backfill the whole novel
python -m narrative_os analyze-all manuscripts/quantum_shadows.md

# 6. Check pending reviews
python -m narrative_os pending

# 7. Inspect the canon
python -m narrative_os stats
```

---

## CLI reference

| Command | Purpose |
|---|---|
| `analyze <ms> <chapter>` | Run one chapter end-to-end |
| `analyze-all <ms>` | Run every chapter in order |
| `stats` | Show canon store counts |
| `pending` | List pending conflict reports |
| `clear-cache` | Drop the local LLM response cache (forces fresh API calls on next run) |

Common flags:
- `--store <path>` — override canon store location
- `--pass-id <tag>` — tag this run (default: UTC timestamp)
- `--skip <ch> [<ch>...]` — skip chapters in `analyze-all`
- `--continue-on-error` — don't stop on extractor failures

---

## What gets stored

Every `CanonEntry` is one atomic fact with full provenance:

```json
{
  "id": "world.bleed",
  "namespace": "world",
  "entity": null,
  "value": "The Bleed is the activation event of the PQ genotype...",
  "confidence": "hard_canon",
  "source_chapter": 0,
  "extracted_at_pass": "seed",
  "created_at": "2026-05-24T07:28:52Z",
  "superseded_by": null
}
```

- **Confidence tiers** drive conflict severity:
  - `hard_canon` — world rules / unambiguous baselines (changes trigger HIGH conflict, block merge)
  - `event` — specific occurrences (changes trigger MEDIUM, flag for review)
  - `inferred` — interpretive readings (changes trigger LOW, auto-retcon)
- **Supersession is explicit**: nothing is ever deleted. `superseded_by` points to the replacing entry.
- **IDs are dotted lowercase**: `entity_or_topic.slug` — human-readable, git-diffable, stable.
- **Open loops** use `OPEN:` prefix in `plot` namespace; resolved loops get a `RESOLVED:` marker and are superseded.

---

## Pending review workflow

When a chapter analysis produces HIGH conflicts, the pipeline writes:

- `pending/ch<N>__<pass_id>.md` — human-readable conflict report with provenance
- `pending/ch<N>__<pass_id>.delta.json` — machine-readable delta for retry

The author reads the markdown, decides per conflict:
1. **Revise the chapter** to match canon → edit manuscript, re-run
2. **Supersede the canon** (canon was wrong) → use `store.supersede()` directly, then re-run
3. **Accept the retcon** for LOW conflicts → already automatic on clean merges

Re-runs with the same `pass_id` are idempotent no-ops. Use a new `pass_id` to force a fresh extraction (or `clear-cache` for a fully cold start).

---

## Project layout

```
narrative_os/
├── schemas.py             Pydantic models: CanonEntry, StateDelta, Conflict
├── store.py               JSON-backed canon store with atomic writes
├── manuscript.py          Markdown chapter parser + content hashing
├── retriever.py           Deterministic context-slice retrieval
├── conflicts.py           Tier-aware conflict detection + markdown renderer
├── extractor.py           LLM extraction with cached manuscript prefix
├── pipeline.py            analyze_chapter() orchestrator + merge mechanics
├── cli.py                 CLI entry point
├── __main__.py            python -m narrative_os entry
├── prompts/
│   └── extract_delta.txt  Versioned extractor prompt (v1.0)
├── seeds/
│   └── qs_seed.py         44 seed entries grounded in the manuscript
├── llm/
│   ├── tiers.py           Role → tier → provider:model mapping
│   ├── router.py          L1 cache → provider orchestration
│   ├── cache/local.py     SQLite-indexed disk cache with TTL + LRU
│   └── providers/         Anthropic (real) + OpenAI/Gemini (stubs)
├── manuscripts/
│   └── quantum_shadows.md The novel
├── tests/                 168 tests
├── README.md              this file
└── decisions.md           architectural decisions log
```

---

## Tests

```bash
pip install pytest
python -m pytest narrative_os/tests/ -v
```

168 tests. Real LLM is never called in tests — extractor and provider are mocked.

---

## Known limitations (v1)

- **Cross-ID semantic contradictions** are NOT detected. The extractor prompt instructs the model to reuse existing IDs when updating, so cross-ID drift should be rare. v2 may add LLM-assisted semantic compare.
- **Pronoun resolution** is not performed by retrieval. If a chapter only refers to a character via pronouns ("he"), retrieval may miss the entity. Add aliases to the store as you discover them.
- **No user-feedback / annotation loop** yet. The pipeline produces conflict reports; the author reads them. Phase 7+ may add a structured annotation cycle.
- **Provider implementations** — only Anthropic (Opus 4.7 via Galaxy proxy) is fully implemented. OpenAI and Gemini providers are stubs that raise `NotImplementedError`.

---

## Cost transparency

Per the May 2026 Anthropic pricing for Opus 4.7 via prompt caching (rates approximate — verify on vendor pricing pages before locking):

| Operation | Cost |
|---|---|
| First chapter (cold cache; writes 108k manuscript tokens) | ~$2.21 |
| Subsequent chapters within cache TTL | ~$0.34 each |
| **Full 20-chapter backfill (one pass)** | **~$8.67** |
| Local cache hit on re-run | $0 |
| Backfilling after a manuscript edit | full cost — content hash changed |
| Backfilling after a canon-store-only change | full cost on affected chapters |

The cache TTL on Anthropic is 5 minutes default / 1 hour paid. For batched backfills, run chapters back-to-back; for overnight runs, use the 1-hour extended cache.
