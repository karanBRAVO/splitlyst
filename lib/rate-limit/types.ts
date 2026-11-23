export interface RateLimitResult {
  ok: boolean;
  retryAfterSec: number;
}

/** A place to keep rate-limit counters. Implementations: memory, Redis, and a fallback wrapper. */
export interface RateLimitStore {
  /** Count one hit for `key` and report whether it is within `limit` hits per `windowMs`. */
  hit(key: string, limit: number, windowMs: number, now: number): Promise<RateLimitResult>;
  /** Is `key` at its limit? Does not count a hit. */
  status(key: string, limit: number, windowMs: number, now: number): Promise<RateLimitResult>;
  /** Count one hit for `key` without checking the limit. */
  record(key: string, windowMs: number, now: number): Promise<void>;
  /** Forget the hits for `key`. */
  clear(key: string): Promise<void>;
}
