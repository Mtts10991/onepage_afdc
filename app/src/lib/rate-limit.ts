/**
 * Minimal in-memory sliding-window rate limiter.
 *
 * Suitable for a single Node.js process (this app's current deployment shape).
 * If we ever scale to multiple replicas or a serverless platform, swap the
 * `Map` for Redis (`@upstash/ratelimit` or similar) — the call sites won't
 * have to change.
 *
 * Each `key` (e.g. an IP address or `${ip}:${email}`) gets its own bucket.
 * `count` resets when `resetAt` passes.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Sweep expired buckets so the Map doesn't grow forever on a long-running
 * server. Cheap because Maps iterate in insertion order — we stop at the
 * first non-expired entry isn't worth the complexity, so we sweep all.
 */
function sweep(now: number) {
  // Only sweep occasionally to keep the hot path O(1).
  if (Math.random() > 0.01) return;
  for (const [k, v] of buckets) {
    if (v.resetAt < now) buckets.delete(k);
  }
}

export interface RateLimitResult {
  /** true → request is allowed; false → blocked */
  ok: boolean;
  /** Remaining attempts in the current window */
  remaining: number;
  /** Unix-ms timestamp when the window resets */
  resetAt: number;
}

/**
 * Check + consume one token from `key`'s bucket.
 *
 * @param max         max attempts per window (default: 5)
 * @param windowMs    window length in ms (default: 15 minutes)
 */
export function rateLimit(
  key: string,
  max = 5,
  windowMs = 15 * 60_000,
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt < now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: max - 1, resetAt };
  }
  if (existing.count >= max) {
    return { ok: false, remaining: 0, resetAt: existing.resetAt };
  }
  existing.count += 1;
  return {
    ok: true,
    remaining: max - existing.count,
    resetAt: existing.resetAt,
  };
}

/** Reset a key — call after a successful login to clear the counter. */
export function clearRate(key: string) {
  buckets.delete(key);
}
