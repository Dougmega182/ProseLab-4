import codecs
text = """
## 16 — Seed identity-attribution error (May 2026)

Two seed entries (`bell.identity` and `bell.discovery`) incorrectly stated
that Bell discovers *Kain's* hidden ICS readings in Ch 8. The actual
manuscript clearly shows Bell discovers *Hayden's* ICS readings (her own
partner's). This is a content error introduced during the Phase 6.5 seed
polish, where I read manuscript grep fragments out of context.

**How it was caught:** Ch 8 backfill produced 22 entries about the Hayden
data — correct content — but did NOT supersede the two wrong seed entries.
The extractor invented new ids (`bell.pov_chapter`, `hayden.ics_full_trajectory`)
rather than reusing the existing wrong-but-collisional ids. Result:
silent parallel canon — three Ch-8-anchored Bell entries, two saying Kain,
one saying Hayden, no conflict report.

**Remediation:**
1. Manually superseded `bell.identity` -> `bell.identity.v2` and
   `bell.discovery` -> `bell.discovery.v2` with corrected attribution.
   The v2 entries are deliberately brief and point at the Ch 8 entries
   that cover the full story.
2. Updated `extract_delta.txt` (v1.1 -> v1.2) with an explicit
   "Identity attribution check" rule directing the extractor to reuse
   existing ids on identity corrections.
3. Bumped `extractor.v2` -> `extractor.v3` in `cache_key_parts` to force
   cache miss on future extractions.
4. Added regression test
   `tests/test_extractor_identity_routing.py::test_extractor_can_correct_identity_attribution`
   verifying the system accepts identity-correction entries through
   existing ids.

**Why we did not re-extract Ch 8:**
The Ch 8 content is correct and rich (22 entries, all manuscript-grounded).
Re-extracting risks losing this content for a marginal benefit. The
parallel-canon issue is resolved by retiring the wrong seed entries,
which is what the supersession accomplishes.

**Open question for the next backfill cycle:**
Are there other seed entries with similar identity errors that haven't
yet been exposed by chapter extraction? Likely candidates: the Reyes
entries (case vs M. Reyes), the Aspect entry (claims it's a designation
but with no manuscript grounding for the specifics). Watch supersession
patterns in remaining chapters for similar silent-parallel-canon shape.
"""

with codecs.open('decisions.md', 'a', 'utf-8') as f:
    f.write(text)
