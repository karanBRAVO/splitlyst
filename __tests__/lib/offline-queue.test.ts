/** @jest-environment jsdom */
import { enqueueExpense, flushQueue, queuedCount } from '@/lib/offline-queue';

const res = (status: number) => ({ ok: status < 400, status }) as Response;

describe('offline queue', () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(globalThis, 'crypto', {
      value: { randomUUID: () => Math.random().toString(36).slice(2) },
      configurable: true,
    });
  });
  afterEach(() => jest.restoreAllMocks());

  it('queues, then sends in order when online', async () => {
    enqueueExpense({ description: 'a' });
    enqueueExpense({ description: 'b' });
    expect(queuedCount()).toBe(2);
    const bodies: string[] = [];
    global.fetch = jest.fn(async (_u, init) => {
      bodies.push(JSON.parse((init as RequestInit).body as string).description);
      return res(201);
    }) as typeof fetch;
    expect(await flushQueue()).toEqual({ sent: 2, dropped: 0, remaining: 0 });
    expect(bodies).toEqual(['a', 'b']);
  });

  it('keeps items on network errors and 5xx', async () => {
    enqueueExpense({ description: 'a' });
    global.fetch = jest.fn().mockRejectedValue(new TypeError('offline')) as typeof fetch;
    expect((await flushQueue()).remaining).toBe(1);
    global.fetch = jest.fn().mockResolvedValue(res(503)) as typeof fetch;
    expect((await flushQueue()).remaining).toBe(1);
  });

  it('drops items rejected with 4xx', async () => {
    enqueueExpense({ description: 'bad' });
    global.fetch = jest.fn().mockResolvedValue(res(400)) as typeof fetch;
    expect(await flushQueue()).toEqual({ sent: 0, dropped: 1, remaining: 0 });
  });
});

describe('offline queue concurrency', () => {
  it('never sends an item twice when flushed concurrently', async () => {
    window.localStorage.clear();
    Object.defineProperty(globalThis, 'crypto', {
      value: { randomUUID: () => Math.random().toString(36).slice(2) },
      configurable: true,
    });
    enqueueExpense({ description: 'once' });
    const fetchMock = jest.fn(async () => {
      await new Promise((r) => setTimeout(r, 20));
      return { ok: true, status: 201 } as Response;
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const [a, b] = await Promise.all([flushQueue(), flushQueue()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
  });
});
