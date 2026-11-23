import type { RateLimitResult, RateLimitStore } from './types';

const MAX_KEYS = 10_000;

interface Entry {
  times: number[];
  windowMs: number;
}

/**
 * Counters kept in this process's memory (sliding window). Fine for local development and as the
 * fallback when Redis is down; with several server instances each one keeps its own count.
 */
export class MemoryStore implements RateLimitStore {
  private readonly hits = new Map<string, Entry>();

  private recent(key: string, windowMs: number, now: number): number[] {
    const entry = this.hits.get(key);
    return entry ? entry.times.filter((t) => t > now - windowMs) : [];
  }

  /** Drop expired keys so a stream of unique keys cannot grow the map without bound. */
  private sweep(now: number) {
    if (this.hits.size < MAX_KEYS) return;
    for (const [key, entry] of this.hits) {
      const last = entry.times[entry.times.length - 1] ?? 0;
      if (last + entry.windowMs <= now) this.hits.delete(key);
    }
  }

  private blocked(recent: number[], windowMs: number, now: number): RateLimitResult {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000)),
    };
  }

  async hit(key: string, limit: number, windowMs: number, now: number): Promise<RateLimitResult> {
    this.sweep(now);
    const recent = this.recent(key, windowMs, now);
    if (recent.length >= limit) {
      this.hits.set(key, { times: recent, windowMs });
      return this.blocked(recent, windowMs, now);
    }
    this.hits.set(key, { times: [...recent, now], windowMs });
    return { ok: true, retryAfterSec: 0 };
  }

  async status(
    key: string,
    limit: number,
    windowMs: number,
    now: number,
  ): Promise<RateLimitResult> {
    const recent = this.recent(key, windowMs, now);
    return recent.length >= limit
      ? this.blocked(recent, windowMs, now)
      : { ok: true, retryAfterSec: 0 };
  }

  async record(key: string, windowMs: number, now: number): Promise<void> {
    this.sweep(now);
    this.hits.set(key, { times: [...this.recent(key, windowMs, now), now], windowMs });
  }

  async clear(key: string): Promise<void> {
    this.hits.delete(key);
  }

  /** Test helper. */
  reset() {
    this.hits.clear();
  }
}
