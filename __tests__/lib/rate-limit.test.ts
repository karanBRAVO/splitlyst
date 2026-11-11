import { rateLimit, resetRateLimits, clientIp } from '@/lib/rate-limit';

beforeEach(() => resetRateLimits());

describe('rateLimit', () => {
  it('allows up to the limit then blocks', () => {
    const t = 1_000_000;
    expect(rateLimit('k', 2, 1000, t).ok).toBe(true);
    expect(rateLimit('k', 2, 1000, t + 10).ok).toBe(true);
    const blocked = rateLimit('k', 2, 1000, t + 20);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThanOrEqual(1);
  });

  it('frees up once the window has passed', () => {
    const t = 5_000_000;
    rateLimit('k', 1, 1000, t);
    expect(rateLimit('k', 1, 1000, t + 500).ok).toBe(false);
    expect(rateLimit('k', 1, 1000, t + 1001).ok).toBe(true);
  });

  it('tracks keys independently', () => {
    rateLimit('a', 1, 1000, 1);
    expect(rateLimit('b', 1, 1000, 1).ok).toBe(true);
  });
});

describe('clientIp', () => {
  it('uses the first x-forwarded-for entry', () => {
    const h = new Headers({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' });
    expect(clientIp({ headers: h })).toBe('1.2.3.4');
  });
  it('falls back to unknown', () => {
    expect(clientIp({ headers: new Headers() })).toBe('unknown');
  });
});
