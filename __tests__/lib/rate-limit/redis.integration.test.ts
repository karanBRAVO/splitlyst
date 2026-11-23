// Runs against a real Redis, to prove the Lua script and the commands behave as the fake assumes.
// Skipped unless REDIS_TEST_URL is set:
//
//   redis-server --port 6390 --save '' &          # or: docker run --rm -p 6390:6379 redis:7
//   REDIS_TEST_URL=redis://localhost:6390 npx jest __tests__/lib/rate-limit/redis.integration
//
// Use a throwaway Redis: the test writes keys prefixed "splitlyst:rl:it:".
import Redis from 'ioredis';
import {
  closeRateLimitStore,
  rateLimit,
  rateLimitClear,
  rateLimitRecord,
  rateLimitStatus,
  verifyRateLimitStore,
} from '@/lib/rate-limit';
import { RedisStore } from '@/lib/rate-limit/redis-store';

const url = process.env.REDIS_TEST_URL;
const suite = url ? describe : describe.skip;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const unique = () => `it:${Date.now()}:${Math.random().toString(36).slice(2)}`;

suite('RedisStore against a real Redis', () => {
  let client: Redis;
  let store: RedisStore;

  beforeAll(() => {
    client = new Redis(url!);
    store = new RedisStore(client);
  });
  afterAll(async () => {
    await client.quit();
  });

  it('allows up to the limit, blocks the next hit and says when to retry', async () => {
    const key = unique();
    for (let i = 0; i < 3; i++) expect((await store.hit(key, 3, 10_000)).ok).toBe(true);
    const blocked = await store.hit(key, 3, 10_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThanOrEqual(9);
    expect(blocked.retryAfterSec).toBeLessThanOrEqual(10);
  });

  it('puts an expiry on every counter, so keys never pile up', async () => {
    const key = unique();
    await store.hit(key, 3, 5000);
    const ttl = await client.pttl(`splitlyst:rl:${key}`);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(5000);
  });

  it('lets the caller through again after the window', async () => {
    const key = unique();
    await store.hit(key, 1, 700);
    expect((await store.hit(key, 1, 700)).ok).toBe(false);
    await sleep(800);
    expect((await store.hit(key, 1, 700)).ok).toBe(true);
  });

  it('does not extend the window on later hits', async () => {
    const key = unique();
    await store.hit(key, 5, 1000);
    await sleep(600);
    await store.hit(key, 5, 1000);
    const ttl = await client.pttl(`splitlyst:rl:${key}`);
    expect(ttl).toBeLessThanOrEqual(420);
  });

  it('repairs a counter that somehow has no expiry', async () => {
    const key = unique();
    await client.set(`splitlyst:rl:${key}`, '4'); // no TTL, as if a crash had interrupted a write
    await store.hit(key, 100, 5000);
    expect(await client.pttl(`splitlyst:rl:${key}`)).toBeGreaterThan(0);
  });

  it('counts exactly under concurrency (no lost or extra hits)', async () => {
    const key = unique();
    const results = await Promise.all(Array.from({ length: 60 }, () => store.hit(key, 20, 10_000)));
    expect(results.filter((r) => r.ok)).toHaveLength(20);
    expect(results.filter((r) => !r.ok)).toHaveLength(40);
  });

  it('shares the counter between separate connections, like separate server instances', async () => {
    const key = unique();
    const other = new Redis(url!);
    try {
      const second = new RedisStore(other);
      await store.hit(key, 2, 10_000);
      await second.hit(key, 2, 10_000);
      expect((await store.hit(key, 2, 10_000)).ok).toBe(false);
      expect((await second.hit(key, 2, 10_000)).ok).toBe(false);
    } finally {
      await other.quit();
    }
  });

  it('status never counts, record counts, clear resets', async () => {
    const key = unique();
    for (let i = 0; i < 5; i++) expect((await store.status(key, 2, 10_000)).ok).toBe(true);
    await store.record(key, 10_000);
    expect((await store.status(key, 2, 10_000)).ok).toBe(true);
    await store.record(key, 10_000);
    const blocked = await store.status(key, 2, 10_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThanOrEqual(9);
    await store.clear(key);
    expect((await store.status(key, 2, 10_000)).ok).toBe(true);
  });

  it('verify passes against a healthy Redis', async () => {
    await expect(store.verify()).resolves.toBeUndefined();
  });

  it('rejects, instead of hanging, when nothing is listening', async () => {
    const dead = new Redis('redis://127.0.0.1:1', {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    dead.on('error', () => {});
    await expect(new RedisStore(dead).hit(unique(), 1, 1000)).rejects.toThrow();
    dead.disconnect();
  });
});

suite('rate limiter through the public API with a real Redis', () => {
  const previous = process.env.REDIS_URL;
  beforeAll(() => {
    process.env.REDIS_URL = url;
  });
  afterAll(() => {
    closeRateLimitStore();
    if (previous === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = previous;
  });

  it('limits, tracks failures and verifies the store', async () => {
    const key = unique();
    expect((await rateLimit(key, 1, 10_000)).ok).toBe(true);
    expect((await rateLimit(key, 1, 10_000)).ok).toBe(false);

    const failures = unique();
    await rateLimitRecord(failures, 10_000);
    await rateLimitRecord(failures, 10_000);
    expect((await rateLimitStatus(failures, 2, 10_000)).ok).toBe(false);
    await rateLimitClear(failures);
    expect((await rateLimitStatus(failures, 2, 10_000)).ok).toBe(true);

    expect(await verifyRateLimitStore()).toMatchObject({ backend: 'redis', ok: true });
  });
});
