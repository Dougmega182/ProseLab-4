const CACHE_KEY = "plab_cache_v3";
const CACHE_ENABLED_KEY = "plab_cache_enabled";
const CACHE_VERSION_KEY = "plab_cache_version_override";
const CACHE_VERSION = "v3";
const DEV_TTL_MS = 60 * 60 * 1000;
const PROD_TTL_MS = 24 * 60 * 60 * 1000;

function canUseStorage() {
  return typeof localStorage !== "undefined";
}

function getCache() {
  if (!canUseStorage()) return {};
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

function getCacheTtlMs() {
  const host =
    typeof window !== "undefined" && window.location
      ? window.location.hostname
      : "";
  const isDevHost =
    host === "localhost" || host === "127.0.0.1" || host.endsWith(".local");
  return isDevHost ? DEV_TTL_MS : PROD_TTL_MS;
}

function getEffectiveCacheVersion() {
  if (!canUseStorage()) return CACHE_VERSION;
  return localStorage.getItem(CACHE_VERSION_KEY) || CACHE_VERSION;
}

function getCacheAgeMs(timestamp) {
  if (typeof timestamp !== "number") return Number.POSITIVE_INFINITY;
  return Date.now() - timestamp;
}

function buildCacheKeyPayload({ name, input, context = {} }) {
  return {
    version: getEffectiveCacheVersion(),
    name,
    input: normalizeInput(input),
    context,
  };
}

function isCacheEntryFresh(entry) {
  return Boolean(entry) && getCacheAgeMs(entry.timestamp) <= getCacheTtlMs();
}

function isCacheEnabled() {
  if (!canUseStorage()) return true;
  const explicit = localStorage.getItem(CACHE_ENABLED_KEY);
  if (explicit === "false") return false;
  if (explicit === "true") return true;
  return true;
}

function setCache(cache) {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn("Cache full, evicting...", e);
    const keys = Object.keys(cache);
    keys.slice(0, Math.ceil(keys.length * 0.25)).forEach((key) => {
      delete cache[key];
    });
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch {}
  }
}

async function hashStr(str) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(str),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeInput(str) {
  return String(str || "").trim().replace(/\s+/g, " ");
}

export function shouldCacheInference(name) {
  if (
    name.startsWith("critic::") ||
    name.startsWith("generator::") ||
    name.includes("rewrite") ||
    name.startsWith("ollama::") ||
    name.startsWith("openai::") ||
    name.startsWith("gemini::")
  ) {
    return false;
  }

  return name === "analysis" || name === "delta" || name.startsWith("persona::");
}

export async function cachedInference({
  name,
  input,
  context = {},
  fn,
  enabled = true,
}) {
  const policyAllowsCache = shouldCacheInference(name);
  const cacheAllowed = enabled && policyAllowsCache && isCacheEnabled();

  if (!cacheAllowed) {
    console.log("CACHE BYPASS:", {
      name,
      enabled,
      policyAllowsCache,
      cacheEnabled: isCacheEnabled(),
    });
    return fn();
  }

  const keyPayload = buildCacheKeyPayload({ name, input, context });
  const hash = await hashStr(JSON.stringify(keyPayload));
  const key = `${name}::${hash}`;
  const cache = getCache();
  const entry = cache[key];

  if (entry && isCacheEntryFresh(entry)) {
    console.log("CACHE HIT:", {
      name,
      key,
      ageMs: getCacheAgeMs(entry.timestamp),
    });
    return entry.value;
  }

  if (entry) {
    console.log("CACHE STALE:", {
      name,
      key,
      ageMs: getCacheAgeMs(entry.timestamp),
    });
    delete cache[key];
    setCache(cache);
  }

  console.log("CACHE MISS:", {
    name,
    key,
    ttlMs: getCacheTtlMs(),
  });
  const output = await fn();

  if (output !== undefined && output !== null && output !== "") {
    cache[key] = {
      value: output,
      timestamp: Date.now(),
      version: getEffectiveCacheVersion(),
    };
    setCache(cache);
  }

  return output;
}

export function getCacheStats() {
  const cache = getCache();
  const keys = Object.keys(cache);
  const bytes = new Blob([JSON.stringify(cache)]).size;
  return {
    entries: keys.length,
    sizeKB: (bytes / 1024).toFixed(1),
    limitKB: "~5120",
  };
}

export function clearInferenceCache() {
  if (!canUseStorage()) return;
  localStorage.removeItem(CACHE_KEY);
}

export function setCacheEnabled(enabled) {
  if (!canUseStorage()) return;
  localStorage.setItem(CACHE_ENABLED_KEY, enabled ? "true" : "false");
}

export function setCacheVersion(version) {
  if (!canUseStorage()) return;
  if (!version) {
    localStorage.removeItem(CACHE_VERSION_KEY);
    return;
  }
  localStorage.setItem(CACHE_VERSION_KEY, String(version));
}

export function getCacheDiagnostics() {
  return {
    enabled: isCacheEnabled(),
    version: getEffectiveCacheVersion(),
    ttlMs: getCacheTtlMs(),
  };
}
