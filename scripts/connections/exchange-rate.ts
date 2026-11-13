import { type CheckResult, errorMessage, maskKey, out } from './shared';

interface RatesResponse {
  result: string;
  time_last_update_utc: string;
  base_code: string;
  conversion_rates: Record<string, number>;
}

const SPOT_CURRENCIES = ['EUR', 'GBP', 'JPY', 'INR', 'CAD'];

/** The key is optional: without it the app uses hardcoded fallback rates, so that is a skip, not a failure. */
export async function checkExchangeRate(): Promise<CheckResult> {
  const name = 'Exchange Rate API';
  const apiKey = process.env.EXCHANGE_RATE_API_KEY;
  if (!apiKey) {
    out.warn('EXCHANGE_RATE_API_KEY not set — app will use hardcoded fallback rates');
    return { name, status: 'skipped', note: 'no key — using fallback rates' };
  }

  out.info(`Key: ${maskKey(apiKey)}`);

  try {
    const start = Date.now();
    const res = await fetch(`https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`, {
      signal: AbortSignal.timeout(10_000), // never hang the whole run on a stuck connection
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json().catch(() => {
      throw new Error('Invalid JSON response');
    })) as RatesResponse;

    if (data.result !== 'success') {
      out.fail(`API returned result="${data.result}"`);
      return { name, status: 'fail', note: `result="${data.result}"` };
    }

    out.ok(`Connected  (${Date.now() - start} ms)`);
    out.ok(`Base currency: ${data.base_code}`);
    out.ok(`Last updated: ${data.time_last_update_utc}`);
    out.ok(
      `Sample rates: ${SPOT_CURRENCIES.map((c) => `${c}=${data.conversion_rates[c] ?? 'N/A'}`).join('  ')}`,
    );
    return { name, status: 'ok' };
  } catch (err) {
    const message = errorMessage(err);
    out.fail(`Request failed: ${message}`);
    return { name, status: 'fail', note: message };
  }
}
