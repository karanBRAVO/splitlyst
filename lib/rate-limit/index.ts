// Rate limiting.
//
// With REDIS_URL set, counters live in Redis so every server instance shares them. Any Redis that speaks
// the normal protocol works: a local install, Docker, AWS ElastiCache, Upstash, Redis Cloud, and so on.
// Use a rediss:// URL for TLS. Without REDIS_URL the counters live in this process's memory, which is fine
// for local development but not for several serverless instances (each keeps its own count).
//
// If Redis fails (timeout, outage, bad credentials) the limiter falls back to memory and logs it, so
// users are never blocked by an infrastructure problem.
import { FallbackStore } from './fallback-store';
import { MemoryStore } from './memory-store';
import { closeRedisStore, getRedisStore } from './redis-store';
import type { RateLimitResult, RateLimitStore } from './types';

export { clientIp } from './client-ip';
export type { RateLimitResult, RateLimitStore } from './types';

const memoryStore = new MemoryStore();
let redisBacked: { url: string; store: FallbackStore } | null = null;
let warnedNoRedis = false;

function redisUrl(): string | null {
  return process.env.REDIS_URL?.trim() || null;
}

function currentStore(): RateLimitStore {
  const url = redisUrl();
  if (!url) {
    if (process.env.NODE_ENV === 'production' && !warnedNoRedis) {
      warnedNoRedis = true;
      console.warn(
        '[rate-limit] REDIS_URL is not set: limits are kept per server instance. ' +
          'Set it in production so all instances share the counters.',
      );
    }
    return memoryStore;
  }
  if (redisBacked?.url !== url) {
    redisBacked = { url, store: new FallbackStore(getRedisStore(url), memoryStore) };
  }
  return redisBacked.store;
}

/** Which store is in use. */
export function rateLimitBackend(): 'redis' | 'memory' {
  return redisUrl() ? 'redis' : 'memory';
}

/**
 * Count one hit for `key` and say whether it is within `limit` hits per `windowMs`.
 * Redis uses a fixed window that starts at the first hit; memory uses a sliding window.
 * `now` only matters for the in-memory store (tests pass it).
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): Promise<RateLimitResult> {
  return currentStore().hit(key, limit, windowMs, now);
}

/** Is `key` at its limit? Does not count a hit. Pair with rateLimitRecord to count failures only. */
export function rateLimitStatus(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): Promise<RateLimitResult> {
  return currentStore().status(key, limit, windowMs, now);
}

/** Count one hit for `key` without checking the limit. */
export function rateLimitRecord(key: string, windowMs: number, now = Date.now()): Promise<void> {
  return currentStore().record(key, windowMs, now);
}

/** Forget the hits for `key`, for example after a successful sign-in. */
export function rateLimitClear(key: string): Promise<void> {
  return currentStore().clear(key);
}

export interface StoreCheck {
  backend: 'redis' | 'memory';
  ok: boolean;
  ms?: number;
  error?: string;
}

/** Prove the configured store is reachable and writable. Used by `npm run test:connections`. */
export async function verifyRateLimitStore(): Promise<StoreCheck> {
  const url = redisUrl();
  if (!url) return { backend: 'memory', ok: true };
  const start = Date.now();
  try {
    await getRedisStore(url).verify();
    return { backend: 'redis', ok: true, ms: Date.now() - start };
  } catch (err) {
    const error = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return { backend: 'redis', ok: false, error };
  }
}

/** Close the Redis connection so a script can exit. */
export function closeRateLimitStore() {
  closeRedisStore();
  redisBacked = null;
}

/** Test helper: clear the in-memory counters, the Redis back-off and the log throttle. */
export function resetRateLimits() {
  memoryStore.reset();
  redisBacked?.store.reset();
  warnedNoRedis = false;
}
