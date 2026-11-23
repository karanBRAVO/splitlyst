// A small in-memory stand-in for the parts of ioredis the rate limiter uses. It follows Redis semantics
// (counters, millisecond TTLs, key expiry) and can simulate an outage or a read-only user.
// Real Redis behaviour is covered by redis.integration.test.ts.

interface Item {
  value: number;
  expiresAt: number | null;
}

export class FakeRedis {
  static data = new Map<string, Item>();
  static instances: FakeRedis[] = [];
  /** 'error' rejects every command, 'hang' never answers, 'unreachable' fails like ioredis does when it cannot connect. */
  static outage: false | 'error' | 'hang' | 'unreachable' = false;
  static readOnly = false;
  static pongReply = 'PONG';

  static reset() {
    FakeRedis.data.clear();
    FakeRedis.instances = [];
    FakeRedis.outage = false;
    FakeRedis.readOnly = false;
    FakeRedis.pongReply = 'PONG';
  }

  disconnected = false;
  constructor(
    public url?: string,
    public options?: Record<string, unknown>,
  ) {
    FakeRedis.instances.push(this);
  }

  listeners: Record<string, ((err: Error) => void)[]> = {};
  on(event: string, listener: (err: Error) => void) {
    (this.listeners[event] ??= []).push(listener);
    return this;
  }
  emit(event: string, err: Error) {
    for (const listener of this.listeners[event] ?? []) listener(err);
  }
  disconnect() {
    this.disconnected = true;
  }

  private async gate() {
    if (FakeRedis.outage === 'error') throw new Error('connect ECONNREFUSED 127.0.0.1:6379');
    if (FakeRedis.outage === 'hang') await new Promise(() => {});
    if (FakeRedis.outage === 'unreachable') {
      const err = new Error('Reached the max retries per request limit (which is 1).');
      err.name = 'MaxRetriesPerRequestError';
      throw err;
    }
  }

  private live(key: string): Item | undefined {
    const item = FakeRedis.data.get(key);
    if (item && item.expiresAt !== null && item.expiresAt <= Date.now()) {
      FakeRedis.data.delete(key);
      return undefined;
    }
    return item;
  }

  private ttl(key: string): number {
    const item = this.live(key);
    if (!item) return -2;
    return item.expiresAt === null ? -1 : item.expiresAt - Date.now();
  }

  /** Mirrors the Lua counter in redis-store.ts: INCR, start the window on the first hit. */
  async eval(_script: string, _numKeys: number, key: string, windowMs: number) {
    await this.gate();
    const item = this.live(key) ?? { value: 0, expiresAt: null };
    item.value += 1;
    if (item.expiresAt === null) item.expiresAt = Date.now() + Number(windowMs);
    FakeRedis.data.set(key, item);
    return [item.value, item.expiresAt - Date.now()];
  }

  pipeline() {
    const ops: ['get' | 'pttl', string][] = [];
    const chain = {
      get: (key: string) => (ops.push(['get', key]), chain),
      pttl: (key: string) => (ops.push(['pttl', key]), chain),
      exec: async () => {
        await this.gate();
        return ops.map(([op, key]) => [
          null,
          op === 'get' ? (this.live(key) ? String(this.live(key)!.value) : null) : this.ttl(key),
        ]);
      },
    };
    return chain;
  }

  async del(key: string) {
    await this.gate();
    return FakeRedis.data.delete(key) ? 1 : 0;
  }

  async ping() {
    await this.gate();
    return FakeRedis.pongReply;
  }

  async set(key: string, value: string, mode?: string, seconds?: number) {
    await this.gate();
    if (FakeRedis.readOnly) {
      throw new Error("NOPERM this user has no permissions to run the 'set' command");
    }
    const expiresAt = mode === 'EX' && seconds ? Date.now() + seconds * 1000 : null;
    FakeRedis.data.set(key, { value: Number(value), expiresAt });
    return 'OK';
  }
}
