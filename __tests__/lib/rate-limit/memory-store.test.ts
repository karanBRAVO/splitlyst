import { MemoryStore } from '@/lib/rate-limit/memory-store';

let store: MemoryStore;
beforeEach(() => {
  store = new MemoryStore();
});

describe('MemoryStore.hit', () => {
  it('allows up to the limit, then blocks with a retry time', async () => {
    const t = 1_000_000;
    expect((await store.hit('k', 2, 1000, t)).ok).toBe(true);
    expect((await store.hit('k', 2, 1000, t + 10)).ok).toBe(true);
    const blocked = await store.hit('k', 2, 1000, t + 20);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBe(1);
  });

  it('reports how long until the oldest hit leaves the window', async () => {
    const t = 5_000_000;
    await store.hit('k', 1, 60_000, t);
    const blocked = await store.hit('k', 1, 60_000, t + 10_000);
    expect(blocked).toEqual({ ok: false, retryAfterSec: 50 });
  });

  it('frees up once the window has passed', async () => {
    const t = 5_000_000;
    await store.hit('k', 1, 1000, t);
    expect((await store.hit('k', 1, 1000, t + 500)).ok).toBe(false);
    expect((await store.hit('k', 1, 1000, t + 1001)).ok).toBe(true);
  });

  it('does not count blocked attempts, so a blocked caller is freed on time', async () => {
    const t = 1_000;
    await store.hit('k', 1, 1000, t);
    for (let i = 1; i <= 5; i++) await store.hit('k', 1, 1000, t + i * 100);
    expect((await store.hit('k', 1, 1000, t + 1001)).ok).toBe(true);
  });

  it('tracks keys independently', async () => {
    await store.hit('a', 1, 1000, 1);
    expect((await store.hit('b', 1, 1000, 1)).ok).toBe(true);
  });
});

describe('MemoryStore.status / record / clear', () => {
  it('status reports the limit without counting a hit', async () => {
    for (let i = 0; i < 20; i++) expect((await store.status('k', 1, 1000, 1)).ok).toBe(true);
  });

  it('record counts a hit that status then sees', async () => {
    const t = 1_000;
    await store.record('k', 60_000, t);
    expect((await store.status('k', 2, 60_000, t)).ok).toBe(true);
    await store.record('k', 60_000, t + 1);
    expect(await store.status('k', 2, 60_000, t + 2)).toEqual({ ok: false, retryAfterSec: 60 });
  });

  it('record does not itself block, only status does', async () => {
    for (let i = 0; i < 5; i++) await store.record('k', 1000, i);
    expect((await store.status('k', 3, 1000, 10)).ok).toBe(false);
  });

  it('clear forgets the key', async () => {
    await store.record('k', 1000, 1);
    await store.clear('k');
    expect((await store.status('k', 1, 1000, 2)).ok).toBe(true);
  });

  it('counts fall out of the window', async () => {
    await store.record('k', 1000, 0);
    expect((await store.status('k', 1, 1000, 500)).ok).toBe(false);
    expect((await store.status('k', 1, 1000, 1001)).ok).toBe(true);
  });
});

describe('MemoryStore memory use', () => {
  it('drops expired keys instead of growing without bound', async () => {
    const hits = (store as unknown as { hits: Map<string, unknown> }).hits;
    for (let i = 0; i < 10_001; i++) await store.hit(`user:${i}`, 5, 1000, 0);
    expect(hits.size).toBeGreaterThanOrEqual(10_000);
    await store.hit('later', 5, 1000, 5000); // everything above has expired by now
    expect(hits.size).toBeLessThan(10);
  });
});
