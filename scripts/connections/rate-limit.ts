import { closeRateLimitStore, verifyRateLimitStore } from '../../lib/rate-limit';
import { type CheckResult, maskUrl, out } from './shared';

/**
 * REDIS_URL is optional: without it the limits are kept in each server's memory, which is fine for
 * development, so that is a skip rather than a failure. With it set, prove the server answers and
 * accepts writes. The password is never printed.
 */
export async function checkRateLimit(): Promise<CheckResult> {
  const name = 'Rate limiting';
  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    out.warn(
      'REDIS_URL not set — limits are kept in memory, per server instance ' +
        '(set it in production so all instances share the counters)',
    );
    return { name, status: 'skipped', note: 'no Redis — per-instance limits' };
  }

  out.info(`URL: ${maskUrl(url)}`);
  try {
    const check = await verifyRateLimitStore();
    if (!check.ok) {
      out.fail(`Redis check failed: ${check.error}`);
      return { name, status: 'fail', note: check.error };
    }
    out.ok(`Connected and writable  (${check.ms} ms)`);
    return { name, status: 'ok' };
  } finally {
    closeRateLimitStore(); // otherwise the open connection keeps the script from exiting
  }
}
