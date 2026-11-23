import Redis from 'ioredis';
import type { RateLimitResult, RateLimitStore } from './types';

const PREFIX = 'splitlyst:rl:';
const TIMEOUT_MS = 2000;

// Count one hit and return [count, ms until the window ends]. The window starts at the first hit.
// Plain Lua rather than `PEXPIRE ... NX`, so it also works on Redis older than 7.0.
const COUNT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return {count, ttl}
`;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Redis did not answer within ${TIMEOUT_MS} ms`)),
      TIMEOUT_MS,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Pipeline results are [error, value] pairs; throw the first error. */
function unwrap(results: [Error | null, unknown][] | null): unknown[] {
  if (!results) throw new Error('Redis returned no result');
  return results.map(([err, value]) => {
    if (err) throw err;
    return value;
  });
}

function retryAfter(ttlMs: number, windowMs: number): number {
  return Math.max(1, Math.ceil((ttlMs > 0 ? ttlMs : windowMs) / 1000));
}

/**
 * Counters in Redis, shared by every server instance. Works with any Redis (local, Docker, AWS
 * ElastiCache, Upstash, Redis Cloud, ...). Every call is bounded by a timeout and throws on failure,
 * so wrap it in a FallbackStore to keep users unblocked when Redis is down.
 */
export class RedisStore implements RateLimitStore {
  private lastConnectionError: Error | null = null;

  constructor(private readonly client: Redis) {
    // Also stops ioredis from throwing on connection errors nobody listens to.
    client.on('error', (err: Error) => {
      this.lastConnectionError = err;
    });
  }

  /** Run a command with a timeout, and explain "could not connect" in plain terms. */
  private call<T>(command: Promise<T>): Promise<T> {
    return withTimeout(command).catch((err: unknown) => {
      if (err instanceof Error && err.name === 'MaxRetriesPerRequestError') {
        const reason = this.lastConnectionError?.message;
        throw new Error(`Cannot reach Redis${reason ? `: ${reason}` : ''}`);
      }
      throw err;
    });
  }

  private async count(key: string, windowMs: number) {
    const [count, ttl] = (await this.call(
      this.client.eval(COUNT_SCRIPT, 1, PREFIX + key, windowMs),
    )) as [number, number];
    return { count: Number(count), ttl: Number(ttl) };
  }

  async hit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const { count, ttl } = await this.count(key, windowMs);
    return count > limit
      ? { ok: false, retryAfterSec: retryAfter(ttl, windowMs) }
      : { ok: true, retryAfterSec: 0 };
  }

  async status(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const k = PREFIX + key;
    const [count, ttl] = unwrap(await this.call(this.client.pipeline().get(k).pttl(k).exec()));
    return Number(count ?? 0) >= limit
      ? { ok: false, retryAfterSec: retryAfter(Number(ttl), windowMs) }
      : { ok: true, retryAfterSec: 0 };
  }

  async record(key: string, windowMs: number): Promise<void> {
    await this.count(key, windowMs);
  }

  async clear(key: string): Promise<void> {
    await this.call(this.client.del(PREFIX + key));
  }

  /** Reachable and writable? (A read-only user fails the write.) Throws with the reason if not. */
  async verify(): Promise<void> {
    const pong = await this.call(this.client.ping());
    if (pong !== 'PONG') throw new Error(`Unexpected reply to PING: ${String(pong)}`);
    const set = await this.call(this.client.set(`${PREFIX}healthcheck`, '1', 'EX', 10));
    if (set !== 'OK') throw new Error(`Write was not accepted: ${String(set)}`);
  }
}

// One client (and store) per process, kept across hot reloads. Created lazily: importing this file never connects.
const shared = globalThis as unknown as {
  __splitlystRedis?: { url: string; client: Redis; store: RedisStore };
};

export function getRedisStore(url: string): RedisStore {
  if (shared.__splitlystRedis?.url !== url) {
    shared.__splitlystRedis?.client.disconnect();
    const client = new Redis(url, {
      lazyConnect: true,
      connectTimeout: TIMEOUT_MS,
      maxRetriesPerRequest: 1,
      retryStrategy: (attempt) => Math.min(attempt * 200, 5000),
    });
    shared.__splitlystRedis = { url, client, store: new RedisStore(client) };
  }
  return shared.__splitlystRedis.store;
}

/** Close the connection (scripts call this so the process can exit). */
export function closeRedisStore() {
  shared.__splitlystRedis?.client.disconnect();
  shared.__splitlystRedis = undefined;
}
