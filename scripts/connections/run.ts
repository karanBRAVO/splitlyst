import { checkDatabase } from './database';
import { type Prompt, checkEmail } from './email';
import { checkExchangeRate } from './exchange-rate';
import { type CheckResult, type Target, out } from './shared';

const LABELS: Record<Target, string> = {
  database: 'Database (PostgreSQL via Prisma)',
  'exchange-rate': 'Exchange Rate API (exchangerate-api.com)',
  email: 'Email (Gmail/SMTP or Resend)',
};

/**
 * Run the selected checks one after another (sequentially, so their output isn't interleaved).
 * A check that throws unexpectedly is reported as a failure instead of aborting the others.
 */
export async function runChecks(
  targets: Target[],
  opts: { prompt?: Prompt } = {},
): Promise<CheckResult[]> {
  const runners: Record<Target, () => Promise<CheckResult>> = {
    database: checkDatabase,
    'exchange-rate': checkExchangeRate,
    email: () => checkEmail({ prompt: opts.prompt }),
  };

  const results: CheckResult[] = [];
  for (const [i, target] of targets.entries()) {
    out.header(`${i + 1} · ${LABELS[target]}`);
    try {
      results.push(await runners[target]());
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      out.fail(`Unexpected error: ${message}`);
      results.push({ name: LABELS[target].split(' (')[0], status: 'fail', note: message });
    }
  }
  return results;
}

export function printSummary(results: CheckResult[]): void {
  out.header('Summary');
  for (const r of results) {
    if (r.status === 'ok') out.ok(r.name);
    else if (r.status === 'skipped') out.warn(`${r.name}  (${r.note ?? 'skipped'})`);
    else out.fail(r.note ? `${r.name}  (${r.note})` : r.name);
  }
  console.log();
}
