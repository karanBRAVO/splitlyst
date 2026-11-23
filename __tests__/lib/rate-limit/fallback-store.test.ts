import { FallbackStore } from '@/lib/rate-limit/fallback-store';
import type { RateLimitResult, RateLimitStore } from '@/lib/rate-limit/types';

const OK: RateLimitResult = { ok: true, retryAfterSec: 0 };

function fakeStore(tag: string) {
  const calls: string[] = [];
  const store: RateLimitStore & { fail: boolean; calls: string[] } = {
    fail: false,
    calls,
    async hit() {
      calls.push('hit');
      if (store.fail) throw new Error('boom');
      return { ok: true, retryAfterSec: tag === 'primary' ? 1 : 2 };
    },
    async status() {
      calls.push('status');
      if (store.fail) throw new Error('boom');
      return OK;
    },
    async record() {
      calls.push('record');
      if (store.fail) throw new Error('boom');
    },
    async clear() {
      calls.push('clear');
      if (store.fail) throw new Error('boom');
    },
  };
  return store;
}

let errors: string[];
beforeEach(() => {
  jest.useFakeTimers();
  errors = [];
  jest.spyOn(console, 'error').mockImplementation((...a) => void errors.push(a.join(' ')));
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('FallbackStore', () => {
  it('uses the primary store while it works', async () => {
    const primary = fakeStore('primary');
    const fallback = fakeStore('fallback');
    const store = new FallbackStore(primary, fallback);
    expect((await store.hit('k', 1, 1000, 0)).retryAfterSec).toBe(1);
    expect(fallback.calls).toEqual([]);
    expect(errors).toEqual([]);
  });

  it.each(['hit', 'status', 'record', 'clear'] as const)(
    'falls back for %s when the primary throws, without throwing itself',
    async (method) => {
      const primary = fakeStore('primary');
      const fallback = fakeStore('fallback');
      primary.fail = true;
      const store = new FallbackStore(primary, fallback);
      const call =
        method === 'hit'
          ? store.hit('k', 1, 1000, 0)
          : method === 'status'
            ? store.status('k', 1, 1000, 0)
            : method === 'record'
              ? store.record('k', 1000, 0)
              : store.clear('k');
      await expect(call).resolves.not.toThrow();
      expect(fallback.calls).toEqual([method]);
    },
  );

  it('returns the fallback result when the primary fails', async () => {
    const primary = fakeStore('primary');
    primary.fail = true;
    const store = new FallbackStore(primary, fakeStore('fallback'));
    expect((await store.hit('k', 1, 1000, 0)).retryAfterSec).toBe(2);
  });

  it('logs the failure', async () => {
    const primary = fakeStore('primary');
    primary.fail = true;
    await new FallbackStore(primary, fakeStore('fallback')).hit('k', 1, 1000, 0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('[rate-limit] Redis unavailable');
    expect(errors[0]).toContain('boom');
  });

  it('skips the primary while backing off, so requests are not slowed down or logged repeatedly', async () => {
    const primary = fakeStore('primary');
    primary.fail = true;
    const store = new FallbackStore(primary, fakeStore('fallback'), 10_000);
    await store.hit('k', 1, 1000, 0);
    await store.hit('k', 1, 1000, 0);
    await store.status('k', 1, 1000, 0);
    expect(primary.calls).toEqual(['hit']);
    expect(errors).toHaveLength(1);
  });

  it('tries the primary again after the back-off and recovers', async () => {
    const primary = fakeStore('primary');
    primary.fail = true;
    const store = new FallbackStore(primary, fakeStore('fallback'), 10_000);
    await store.hit('k', 1, 1000, 0);
    primary.fail = false;
    jest.advanceTimersByTime(10_001);
    expect((await store.hit('k', 1, 1000, 0)).retryAfterSec).toBe(1);
    expect(primary.calls).toEqual(['hit', 'hit']);
  });

  it('backs off again if the primary is still down after the back-off', async () => {
    const primary = fakeStore('primary');
    primary.fail = true;
    const store = new FallbackStore(primary, fakeStore('fallback'), 10_000);
    await store.hit('k', 1, 1000, 0);
    jest.advanceTimersByTime(10_001);
    await store.hit('k', 1, 1000, 0);
    await store.hit('k', 1, 1000, 0);
    expect(primary.calls).toEqual(['hit', 'hit']);
  });

  it('reset() makes it try the primary immediately', async () => {
    const primary = fakeStore('primary');
    primary.fail = true;
    const store = new FallbackStore(primary, fakeStore('fallback'));
    await store.hit('k', 1, 1000, 0);
    primary.fail = false;
    store.reset();
    expect((await store.hit('k', 1, 1000, 0)).retryAfterSec).toBe(1);
  });
});
