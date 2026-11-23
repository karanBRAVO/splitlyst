import type { RateLimitResult, RateLimitStore } from './types';

function describe(err: unknown): string {
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}

/**
 * Use `primary` (Redis) and, when it fails, `fallback` (memory) so a Redis outage never locks users
 * out of signing in or registering. After a failure the primary is skipped for `retryAfterMs`, so
 * requests are not slowed down by repeated timeouts, then tried again.
 */
export class FallbackStore implements RateLimitStore {
  private downUntil = 0;

  constructor(
    private readonly primary: RateLimitStore,
    private readonly fallback: RateLimitStore,
    private readonly retryAfterMs = 10_000,
  ) {}

  private async run<T>(op: (store: RateLimitStore) => Promise<T>): Promise<T> {
    if (Date.now() >= this.downUntil) {
      try {
        return await op(this.primary);
      } catch (err) {
        this.downUntil = Date.now() + this.retryAfterMs;
        console.error(`[rate-limit] Redis unavailable, using in-memory limits. ${describe(err)}`);
      }
    }
    return op(this.fallback);
  }

  hit(key: string, limit: number, windowMs: number, now: number): Promise<RateLimitResult> {
    return this.run((s) => s.hit(key, limit, windowMs, now));
  }

  status(key: string, limit: number, windowMs: number, now: number): Promise<RateLimitResult> {
    return this.run((s) => s.status(key, limit, windowMs, now));
  }

  record(key: string, windowMs: number, now: number): Promise<void> {
    return this.run((s) => s.record(key, windowMs, now));
  }

  clear(key: string): Promise<void> {
    return this.run((s) => s.clear(key));
  }

  /** Test helper: try the primary again immediately. */
  reset() {
    this.downUntil = 0;
  }
}
