"""
Local response cache — disk-backed, SQLite-indexed, content-hash keyed.

Design:
    - Layer-1 cache that sits in front of the LLM provider.
    - SQLite holds metadata (key, paths, size, timestamps, hits).
    - Response payloads stored as JSON files in a sharded directory tree.
    - Cache key derived from input content hashes — if any input changes,
      the key changes, the old entry becomes unreachable. (Content-based
      invalidation, no manual "bust" needed.)

Invalidation triggers (matches user's spec):
    - TTL          : optional per-entry expiry timestamp
    - Mutation     : content-hash key change → automatic miss on new inputs
    - Manual       : .invalidate(key) or .clear() for event-driven cases
    - LRU eviction : enforced when total size > max_size_bytes

Not handled (out of scope for v1):
    - Network reconnection (everything is local)
    - Distributed/multi-process locking
"""

from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional


DEFAULT_CACHE_DIR = Path(__file__).parents[4] / "data" / ".cache" / "llm_responses"
DEFAULT_MAX_SIZE_BYTES = 1 * 1024 * 1024 * 1024   # 1 GiB


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class CacheEntry:
    key: str
    payload: dict
    created_at: float
    expires_at: Optional[float]
    size_bytes: int
    hits: int


@dataclass
class CacheStats:
    total_entries: int
    total_size_bytes: int
    hits: int
    misses: int
    evictions: int


# ---------------------------------------------------------------------------
# Key construction
# ---------------------------------------------------------------------------

def make_cache_key(*parts: Any) -> str:
    """
    Deterministic 32-char hex key from arbitrary parts.

    Each part is JSON-serialized with sorted keys for stability.
    Use this for ALL cache keys to keep them content-addressable.
    """
    blob = json.dumps(parts, sort_keys=True, default=str, ensure_ascii=False)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()[:32]


# ---------------------------------------------------------------------------
# Cache
# ---------------------------------------------------------------------------

class LocalCache:
    """Disk-backed LRU cache with TTL + content-hash invalidation."""

    def __init__(
        self,
        cache_dir: Path | str | None = None,
        max_size_bytes: int = DEFAULT_MAX_SIZE_BYTES,
        default_ttl_seconds: Optional[float] = None,
    ):
        self.cache_dir = Path(cache_dir) if cache_dir else DEFAULT_CACHE_DIR
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.blob_dir = self.cache_dir / "blobs"
        self.blob_dir.mkdir(exist_ok=True)
        self.db_path = self.cache_dir / "index.sqlite"
        self.max_size_bytes = max_size_bytes
        self.default_ttl_seconds = default_ttl_seconds
        self._init_db()
        # Process-local hit/miss counters
        self._hits = 0
        self._misses = 0
        self._evictions = 0

    # --- DB ----------------------------------------------------------------

    def _init_db(self) -> None:
        with self._conn() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS entries (
                    key         TEXT PRIMARY KEY,
                    blob_path   TEXT NOT NULL,
                    created_at  REAL NOT NULL,
                    accessed_at REAL NOT NULL,
                    expires_at  REAL,
                    size_bytes  INTEGER NOT NULL,
                    hits        INTEGER NOT NULL DEFAULT 0
                )
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_accessed ON entries(accessed_at)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_expires ON entries(expires_at)"
            )

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, timeout=10.0, isolation_level=None)
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")
        return conn

    # --- Blob paths --------------------------------------------------------

    def _blob_path(self, key: str) -> Path:
        # Shard by first 2 chars to avoid huge flat directories
        return self.blob_dir / key[:2] / f"{key}.json"

    # --- Public API --------------------------------------------------------

    def get(self, key: str) -> Optional[dict]:
        """Return cached payload or None on miss / expired."""
        now = time.time()
        with self._conn() as conn:
            row = conn.execute(
                "SELECT blob_path, expires_at FROM entries WHERE key = ?",
                (key,),
            ).fetchone()

            if row is None:
                self._misses += 1
                return None

            blob_path, expires_at = row
            if expires_at is not None and expires_at < now:
                # Expired — evict
                self._evict_entry(conn, key, blob_path)
                self._misses += 1
                return None

            blob = Path(blob_path)
            if not blob.exists():
                # Index/file desync — treat as miss and clean up
                conn.execute("DELETE FROM entries WHERE key = ?", (key,))
                self._misses += 1
                return None

            payload = json.loads(blob.read_text(encoding="utf-8"))
            conn.execute(
                "UPDATE entries SET accessed_at = ?, hits = hits + 1 WHERE key = ?",
                (now, key),
            )
            self._hits += 1
            return payload

    def set(
        self,
        key: str,
        payload: dict,
        ttl_seconds: Optional[float] = None,
    ) -> None:
        """Store payload. TTL overrides the cache default; None = no expiry."""
        now = time.time()
        ttl = ttl_seconds if ttl_seconds is not None else self.default_ttl_seconds
        expires_at = now + ttl if ttl else None

        blob_path = self._blob_path(key)
        blob_path.parent.mkdir(parents=True, exist_ok=True)
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        # Atomic write
        tmp = blob_path.with_suffix(".tmp")
        tmp.write_bytes(data)
        os.replace(tmp, blob_path)

        with self._conn() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO entries
                (key, blob_path, created_at, accessed_at, expires_at, size_bytes, hits)
                VALUES (?, ?, ?, ?, ?, ?, 0)
                """,
                (key, str(blob_path), now, now, expires_at, len(data)),
            )

        self._maybe_evict()

    def invalidate(self, key: str) -> bool:
        """Manual invalidation. Returns True if an entry was removed."""
        with self._conn() as conn:
            row = conn.execute(
                "SELECT blob_path FROM entries WHERE key = ?", (key,)
            ).fetchone()
            if row is None:
                return False
            self._evict_entry(conn, key, row[0])
        return True

    def clear(self) -> int:
        """Drop everything. Returns count of removed entries."""
        with self._conn() as conn:
            rows = conn.execute("SELECT blob_path FROM entries").fetchall()
            for (blob_path,) in rows:
                try:
                    Path(blob_path).unlink(missing_ok=True)
                except OSError:
                    pass
            conn.execute("DELETE FROM entries")
        return len(rows)

    def stats(self) -> CacheStats:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT COUNT(*), COALESCE(SUM(size_bytes), 0) FROM entries"
            ).fetchone()
        return CacheStats(
            total_entries=row[0],
            total_size_bytes=row[1],
            hits=self._hits,
            misses=self._misses,
            evictions=self._evictions,
        )

    def sweep_expired(self) -> int:
        """Remove all entries past their expires_at. Returns count."""
        now = time.time()
        removed = 0
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT key, blob_path FROM entries "
                "WHERE expires_at IS NOT NULL AND expires_at < ?",
                (now,),
            ).fetchall()
            for key, blob_path in rows:
                self._evict_entry(conn, key, blob_path)
                removed += 1
        return removed

    # --- Eviction ----------------------------------------------------------

    def _evict_entry(
        self,
        conn: sqlite3.Connection,
        key: str,
        blob_path: str,
    ) -> None:
        try:
            Path(blob_path).unlink(missing_ok=True)
        except OSError:
            pass
        conn.execute("DELETE FROM entries WHERE key = ?", (key,))
        self._evictions += 1

    def _maybe_evict(self) -> None:
        """LRU eviction when total size exceeds max_size_bytes."""
        with self._conn() as conn:
            total = conn.execute(
                "SELECT COALESCE(SUM(size_bytes), 0) FROM entries"
            ).fetchone()[0]
            if total <= self.max_size_bytes:
                return

            # Evict least-recently-accessed entries until under budget
            rows = conn.execute(
                "SELECT key, blob_path, size_bytes FROM entries "
                "ORDER BY accessed_at ASC"
            ).fetchall()

            for key, blob_path, size in rows:
                if total <= self.max_size_bytes:
                    break
                self._evict_entry(conn, key, blob_path)
                total -= size
