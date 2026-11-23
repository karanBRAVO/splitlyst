import type Redis from 'ioredis';
import { RedisStore } from '@/lib/rate-limit/redis-store';
import { FakeRedis } from './fake-redis';

const asRedis = (fake: FakeRedis) => fake as unknown as Redis;
let store: RedisStore;

beforeEach(() => {
  jest.useFakeTimers();
  FakeRedis.reset();
  store = new RedisStore(asRedis(new FakeRedis()));
});
afterEach(() => jest.useRealTimers());

describe('RedisStore.hit', () => {
  it('allows up to the limit, then blocks', async () => {
    expect((await store.hit('k', 3, 60_000)).ok).toBe(true);
    expect((await store.hit('k', 3, 60_000)).ok).toBe(true);
    expect((await store.hit('k', 3, 60_000)).ok).toBe(true);
    expect((await store.hit('k', 3, 60_000)).ok).toBe(false);
  });

  it('tells the caller how long to wait, from the key TTL', async () => {
    await store.hit('k', 1, 60_000);
    jest.advanceTimersByTime(20_000);
    expect(await store.hit('k', 1, 60_000)).toEqual({ ok: false, retryAfterSec: 40 });
  });

  it('starts the window at the first hit and does not extend it on later hits', async () => {
    await store.hit('k', 2, 60_000);
    jest.advanceTimersByTime(30_000);
    await store.hit('k', 2, 60_000);
    jest.advanceTimersByTime(30_001); // the first hit is now 60s old
    expect((await store.hit('k', 2, 60_000)).ok).toBe(true);
  });

  it('lets the caller through again once the window has passed', async () => {
    await store.hit('k', 1, 1000);
    expect((await store.hit('k', 1, 1000)).ok).toBe(false);
    jest.advanceTimersByTime(1001);
    expect((await store.hit('k', 1, 1000)).ok).toBe(true);
  });

  it('keeps keys independent and prefixes them', async () => {
    await store.hit('a', 1, 1000);
    expect((await store.hit('b', 1, 1000)).ok).toBe(true);
    expect([...FakeRedis.data.keys()].sort()).toEqual(['splitlyst:rl:a', 'splitlyst:rl:b']);
  });

  it('never reports a retry time below one second', async () => {
    await store.hit('k', 1, 1000);
    jest.advanceTimersByTime(999);
    expect((await store.hit('k', 1, 1000)).retryAfterSec).toBe(1);
  });
});

describe('RedisStore.status / record / clear', () => {
  it('status does not count a hit', async () => {
    for (let i = 0; i < 10; i++) expect((await store.status('k', 1, 1000)).ok).toBe(true);
    expect(FakeRedis.data.size).toBe(0);
  });

  it('record counts a hit that status then sees', async () => {
    await store.record('k', 60_000);
    expect((await store.status('k', 2, 60_000)).ok).toBe(true);
    await store.record('k', 60_000);
    expect(await store.status('k', 2, 60_000)).toEqual({ ok: false, retryAfterSec: 60 });
  });

  it('record does not itself block', async () => {
    for (let i = 0; i < 5; i++) await expect(store.record('k', 1000)).resolves.toBeUndefined();
    expect((await store.status('k', 3, 1000)).ok).toBe(false);
  });

  it('clear forgets the key', async () => {
    await store.record('k', 60_000);
    await store.clear('k');
    expect((await store.status('k', 1, 60_000)).ok).toBe(true);
  });

  it('counts expire with the window', async () => {
    await store.record('k', 1000);
    expect((await store.status('k', 1, 1000)).ok).toBe(false);
    jest.advanceTimersByTime(1001);
    expect((await store.status('k', 1, 1000)).ok).toBe(true);
  });
});

describe('RedisStore.verify', () => {
  it('passes when Redis answers and accepts a write', async () => {
    await expect(store.verify()).resolves.toBeUndefined();
    expect(FakeRedis.data.has('splitlyst:rl:healthcheck')).toBe(true);
  });

  it('fails for a read-only user, with the reason', async () => {
    FakeRedis.readOnly = true;
    await expect(store.verify()).rejects.toThrow('NOPERM');
  });

  it('fails on an unexpected PING reply', async () => {
    FakeRedis.pongReply = 'LOADING';
    await expect(store.verify()).rejects.toThrow('Unexpected reply to PING');
  });
});

describe('RedisStore failures', () => {
  it('rejects when Redis refuses the connection (so a FallbackStore can take over)', async () => {
    FakeRedis.outage = 'error';
    await expect(store.hit('k', 1, 1000)).rejects.toThrow('ECONNREFUSED');
    await expect(store.status('k', 1, 1000)).rejects.toThrow('ECONNREFUSED');
    await expect(store.clear('k')).rejects.toThrow('ECONNREFUSED');
  });

  it('explains an unreachable Redis with the underlying connection error', async () => {
    const fake = new FakeRedis();
    const unreachable = new RedisStore(asRedis(fake));
    fake.emit('error', new Error('connect ECONNREFUSED 127.0.0.1:6379'));
    FakeRedis.outage = 'unreachable';
    await expect(unreachable.hit('k', 1, 1000)).rejects.toThrow(
      'Cannot reach Redis: connect ECONNREFUSED 127.0.0.1:6379',
    );
    await expect(unreachable.verify()).rejects.toThrow('Cannot reach Redis');
  });

  it('still says "Cannot reach Redis" when no connection error was reported', async () => {
    FakeRedis.outage = 'unreachable';
    await expect(store.hit('k', 1, 1000)).rejects.toThrow(/^Cannot reach Redis$/);
  });

  it('gives up on a Redis that never answers instead of hanging the request', async () => {
    FakeRedis.outage = 'hang';
    const pending = store.hit('k', 1, 1000);
    const assertion = expect(pending).rejects.toThrow('did not answer within 2000 ms');
    await jest.advanceTimersByTimeAsync(2000);
    await assertion;
  });
});
