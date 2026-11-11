// Minimal offline queue for new expenses: stored in localStorage and replayed when back online.

const KEY = 'splitlyst-offline-expenses';

type Queued = { id: string; payload: Record<string, unknown>; queuedAt: number };

function read(): Queued[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

function write(items: Queued[]) {
  window.localStorage.setItem(KEY, JSON.stringify(items));
}

export function enqueueExpense(payload: Record<string, unknown>): void {
  write([...read(), { id: crypto.randomUUID(), payload, queuedAt: Date.now() }]);
}

export function queuedCount(): number {
  return read().length;
}

/**
 * Replay queued expenses in order. Network/5xx errors keep the item queued (and stop, to preserve
 * order); 4xx errors drop the item since retrying can never succeed.
 */
let flushing: Promise<{ sent: number; dropped: number; remaining: number }> | null = null;

/** Concurrent callers (e.g. the `online` event + a mount-time flush) share one run, so nothing is sent twice. */
export function flushQueue(): Promise<{ sent: number; dropped: number; remaining: number }> {
  if (!flushing) flushing = runFlush().finally(() => (flushing = null));
  return flushing;
}

async function runFlush(): Promise<{ sent: number; dropped: number; remaining: number }> {
  let sent = 0;
  let dropped = 0;
  let queue = read();
  while (queue.length > 0) {
    const item = queue[0];
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.payload),
      });
      if (res.ok) sent++;
      else if (res.status >= 400 && res.status < 500 && res.status !== 401) dropped++;
      else break;
    } catch {
      break;
    }
    queue = queue.slice(1);
    write(queue);
  }
  return { sent, dropped, remaining: queue.length };
}
