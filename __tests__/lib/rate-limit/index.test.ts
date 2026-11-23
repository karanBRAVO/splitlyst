jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.requireActual('./fake-redis').FakeRedis,
}));

import {
  closeRateLimitStore,
  rateLimit,
  rateLimitBackend,
  rateLimitClear,
  rateLimitRecord,
  rateLimitStatus,
  resetRateLimits,
  verifyRateLimitStore,
} from '@/lib/rate-limit';
import { FakeRedis } from './fake-redis';

const ENV = { ...process.env };
const setEnv = (name: string, value: string | undefined) =>
  Reflect.set(process.env, name, value as string);
let errors: string[];
let warnings: string[];

beforeEach(() => {
  jest.useFakeTimers();
  process.env = { ...ENV };
  delete process.env.REDIS_URL;
  FakeRedis.reset();
  closeRateLimitStore();
  resetRateLimits();
  errors = [];
  warnings = [];
  jest.spyOn(console, 'error').mockImplementation((...a) => void errors.push(a.join(' ')));
  jest.spyOn(console, 'warn').mockImplementation((...a) => void warnings.push(a.join(' ')));
});
afterEach(() => {
  process.env = { ...ENV };
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('without REDIS_URL', () => {
  it('keeps limits in memory and never touches Redis', async () => {
    expect(rateLimitBackend()).toBe('memory');
    expect((await rateLimit('k', 2, 60_000)).ok).toBe(true);
    expect((await rateLimit('k', 2, 60_000)).ok).toBe(true);
    expect((await rateLimit('k', 2, 60_000)).ok).toBe(false);
    expect(FakeRedis.instances).toHaveLength(0);
  });

  it('treats a blank REDIS_URL as not set', async () => {
    setEnv('REDIS_URL', '   ');
    expect(rateLimitBackend()).toBe('memory');
    await rateLimit('k', 1, 1000);
    expect(FakeRedis.instances).toHaveLength(0);
  });

  it('warns once in production that limits are per instance', async () => {
    setEnv('NODE_ENV', 'production');
    await rateLimit('a', 1, 1000);
    await rateLimit('b', 1, 1000);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('REDIS_URL is not set');
  });

  it('does not warn in development or tests', async () => {
    await rateLimit('a', 1, 1000);
    expect(warnings).toEqual([]);
  });

  it('supports status, record and clear', async () => {
    await rateLimitRecord('k', 60_000);
    await rateLimitRecord('k', 60_000);
    expect((await rateLimitStatus('k', 2, 60_000)).ok).toBe(false);
    await rateLimitClear('k');
    expect((await rateLimitStatus('k', 2, 60_000)).ok).toBe(true);
  });

  it('resetRateLimits clears the counters', async () => {
    await rateLimit('k', 1, 60_000);
    resetRateLimits();
    expect((await rateLimit('k', 1, 60_000)).ok).toBe(true);
  });
});

describe('with REDIS_URL', () => {
  beforeEach(() => setEnv('REDIS_URL', 'redis://localhost:6379'));

  it('counts in Redis, not in memory', async () => {
    expect(rateLimitBackend()).toBe('redis');
    expect((await rateLimit('k', 2, 60_000)).ok).toBe(true);
    expect(FakeRedis.data.get('splitlyst:rl:k')?.value).toBe(1);
    await rateLimit('k', 2, 60_000);
    expect((await rateLimit('k', 2, 60_000)).ok).toBe(false);
  });

  it('connects lazily with the configured URL and reuses one client', async () => {
    expect(FakeRedis.instances).toHaveLength(0); // nothing connects until a limit is checked
    await rateLimit('a', 5, 1000);
    await rateLimit('b', 5, 1000);
    await rateLimitStatus('c', 5, 1000);
    expect(FakeRedis.instances).toHaveLength(1);
    expect(FakeRedis.instances[0].url).toBe('redis://localhost:6379');
    expect(FakeRedis.instances[0].options).toMatchObject({ lazyConnect: true });
  });

  it('switches to a new client when REDIS_URL changes and closes the old one', async () => {
    await rateLimit('k', 5, 1000);
    setEnv('REDIS_URL', 'redis://other-host:6379');
    await rateLimit('k', 5, 1000);
    expect(FakeRedis.instances.map((i) => i.url)).toEqual([
      'redis://localhost:6379',
      'redis://other-host:6379',
    ]);
    expect(FakeRedis.instances[0].disconnected).toBe(true);
  });

  it('supports status, record and clear', async () => {
    await rateLimitRecord('k', 60_000);
    await rateLimitRecord('k', 60_000);
    expect((await rateLimitStatus('k', 2, 60_000)).ok).toBe(false);
    await rateLimitClear('k');
    expect((await rateLimitStatus('k', 2, 60_000)).ok).toBe(true);
  });

  it('does not warn about a missing Redis in production', async () => {
    setEnv('NODE_ENV', 'production');
    await rateLimit('k', 1, 1000);
    expect(warnings).toEqual([]);
  });

  it('closeRateLimitStore disconnects, and a later call reconnects', async () => {
    await rateLimit('k', 5, 1000);
    closeRateLimitStore();
    expect(FakeRedis.instances[0].disconnected).toBe(true);
    await rateLimit('k', 5, 1000);
    expect(FakeRedis.instances).toHaveLength(2);
  });
});

describe('when Redis is down', () => {
  beforeEach(() => setEnv('REDIS_URL', 'redis://localhost:6379'));

  it('keeps enforcing the limit in memory instead of failing or letting everything through', async () => {
    FakeRedis.outage = 'error';
    expect((await rateLimit('k', 2, 60_000)).ok).toBe(true);
    expect((await rateLimit('k', 2, 60_000)).ok).toBe(true);
    expect((await rateLimit('k', 2, 60_000)).ok).toBe(false);
  });

  it('logs the outage once, not on every request', async () => {
    FakeRedis.outage = 'error';
    for (let i = 0; i < 5; i++) await rateLimit('k', 10, 1000);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Redis unavailable');
    expect(errors[0]).toContain('ECONNREFUSED');
  });

  it('does not wait for a Redis that never answers, and skips it afterwards', async () => {
    FakeRedis.outage = 'hang';
    const first = rateLimit('k', 5, 1000);
    await jest.advanceTimersByTimeAsync(2000); // the 2 s timeout
    expect((await first).ok).toBe(true);
    // while backing off, calls answer immediately without advancing any timers
    expect((await rateLimit('k', 5, 1000)).ok).toBe(true);
    expect(errors).toHaveLength(1);
  });

  it('returns to Redis once it is back', async () => {
    FakeRedis.outage = 'error';
    await rateLimit('k', 5, 60_000);
    FakeRedis.outage = false;
    await jest.advanceTimersByTimeAsync(10_001);
    await rateLimit('k', 5, 60_000);
    expect(FakeRedis.data.get('splitlyst:rl:k')?.value).toBe(1);
  });

  it('login-style helpers fail open too', async () => {
    FakeRedis.outage = 'error';
    await expect(rateLimitRecord('k', 1000)).resolves.toBeUndefined();
    await expect(rateLimitStatus('k', 5, 1000)).resolves.toMatchObject({ ok: true });
    await expect(rateLimitClear('k')).resolves.toBeUndefined();
  });
});

describe('verifyRateLimitStore', () => {
  it('reports the in-memory store as fine without checking anything', async () => {
    expect(await verifyRateLimitStore()).toEqual({ backend: 'memory', ok: true });
  });

  it('passes when Redis is reachable and writable', async () => {
    setEnv('REDIS_URL', 'redis://localhost:6379');
    const result = await verifyRateLimitStore();
    expect(result).toMatchObject({ backend: 'redis', ok: true });
    expect(typeof result.ms).toBe('number');
  });

  it('fails for a read-only user', async () => {
    setEnv('REDIS_URL', 'redis://localhost:6379');
    FakeRedis.readOnly = true;
    const result = await verifyRateLimitStore();
    expect(result.ok).toBe(false);
    expect(result.error).toContain('NOPERM');
  });

  it('fails when Redis is unreachable, and does not fall back to memory', async () => {
    setEnv('REDIS_URL', 'redis://localhost:6379');
    FakeRedis.outage = 'error';
    const result = await verifyRateLimitStore();
    expect(result).toMatchObject({ backend: 'redis', ok: false });
    expect(result.error).toContain('ECONNREFUSED');
  });

  it('never includes the password from the URL in its result', async () => {
    setEnv('REDIS_URL', 'rediss://default:s3cr3t-pass@redis.example.com:6379');
    FakeRedis.outage = 'error';
    expect(JSON.stringify(await verifyRateLimitStore())).not.toContain('s3cr3t-pass');
  });
});
