// Shared helpers for the connection checks (`npm run test:connections`).
import { readFileSync } from 'node:fs';

export type Status = 'ok' | 'fail' | 'skipped';

export interface CheckResult {
  name: string;
  status: Status;
  /** Short explanation shown in the summary (e.g. why it was skipped) */
  note?: string;
}

export const TARGETS = ['database', 'exchange-rate', 'email'] as const;
export type Target = (typeof TARGETS)[number];

export interface ParsedArgs {
  help: boolean;
  unknown: string[];
}

/** The script takes no arguments except `--help`; anything else is reported as unknown. */
export function parseArgs(argv: string[]): ParsedArgs {
  const unknown: string[] = [];
  let help = false;
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') help = true;
    else unknown.push(arg);
  }
  return { help, unknown };
}

export const HELP = `Usage: npm run test:connections

Runs every check, in order:
  database        PostgreSQL via Prisma
  exchange-rate   exchangerate-api.com
  email           Gmail/SMTP or Resend. Verifies the login without sending anything,
                  then asks whether you want a real test email (type an address, or Enter to skip).`;

/** Loose check that a typed string looks like an email address. */
export function isEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Load .env without a dotenv dependency; variables already in the environment win. */
export function loadEnv(file = '.env'): void {
  let raw: string;
  try {
    raw = readFileSync(file, 'utf-8');
  } catch {
    return; // no .env — rely on the environment
  }
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

/** Show enough of a secret to recognise it, never all of it. */
export function maskKey(key: string): string {
  return key.length > 10
    ? `${key.slice(0, 4)}${'*'.repeat(key.length - 4)}`
    : '*'.repeat(key.length);
}

/** 0 when nothing failed (skipped checks are fine), 1 otherwise. */
export function exitCodeFor(results: CheckResult[]): 0 | 1 {
  return results.some((r) => r.status === 'fail') ? 1 : 0;
}

// ---- terminal output ----
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

export const out = {
  ok: (msg: string) => console.log(`  ${GREEN}✓${RESET}  ${msg}`),
  fail: (msg: string) => console.log(`  ${RED}✗${RESET}  ${msg}`),
  warn: (msg: string) => console.log(`  ${YELLOW}⚠${RESET}  ${msg}`),
  info: (msg: string) => console.log(`  ${DIM}·${RESET}  ${msg}`),
  header: (msg: string) => console.log(`\n${BOLD}${msg}${RESET}`),
  title: (msg: string) => console.log(`${BOLD}${msg}${RESET}`),
};

/** Error text safe to print (no stack traces). */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
