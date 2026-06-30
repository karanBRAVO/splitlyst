import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { get as httpsGetRaw } from 'node:https';

// Load .env manually (no dotenv dependency needed — tsx supports it via --env-file,
// but we also handle it inline for plain `tsx scripts/test-connections.ts`)
function loadEnv() {
  try {
    const raw = require('fs').readFileSync('.env', 'utf-8') as string;
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // .env not found — rely on environment variables already set
  }
}

loadEnv();

const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

function ok(msg: string) {
  console.log(`  ${GREEN}✓${RESET}  ${msg}`);
}
function fail(msg: string) {
  console.log(`  ${RED}✗${RESET}  ${msg}`);
}
function info(msg: string) {
  console.log(`  ${DIM}·${RESET}  ${msg}`);
}
function header(msg: string) {
  console.log(`\n${BOLD}${msg}${RESET}`);
}

function httpsGet<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    httpsGetRaw(url, (res) => {
      let body = '';
      res.on('data', (chunk: Buffer) => {
        body += chunk.toString();
      });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}`));
        } else {
          try {
            resolve(JSON.parse(body));
          } catch {
            reject(new Error('Invalid JSON response'));
          }
        }
      });
    }).on('error', reject);
  });
}

async function testDatabase() {
  header('1 · Database (PostgreSQL via Prisma)');

  const url = process.env.DATABASE_URL;
  if (!url) {
    fail('DATABASE_URL is not set');
    return false;
  }

  // Mask password for display
  const masked = url.replace(/:([^:@]+)@/, ':****@');
  info(`URL: ${masked}`);

  const adapter = new PrismaPg({ connectionString: url });
  const prisma = new PrismaClient({ adapter, log: [] });

  try {
    // Basic connectivity
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1 AS ping`;
    const latency = Date.now() - start;
    ok(`Connected  (${latency} ms)`);

    // Check that core tables exist by counting rows
    const [users, groups, expenses] = await Promise.all([
      prisma.user.count(),
      prisma.group.count(),
      prisma.expense.count(),
    ]);
    ok(`Tables reachable — users: ${users}, groups: ${groups}, expenses: ${expenses}`);

    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    fail(`Connection failed: ${message}`);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

async function testExchangeRateApi() {
  header('2 · Exchange Rate API (exchangerate-api.com)');

  const apiKey = process.env.EXCHANGE_RATE_API_KEY;
  if (!apiKey) {
    console.log(
      `  ${YELLOW}⚠${RESET}  EXCHANGE_RATE_API_KEY not set — app will use hardcoded fallback rates`,
    );
    return null;
  }

  info(`Key: ${apiKey.slice(0, 6)}${'*'.repeat(apiKey.length - 6)}`);

  const url = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`;

  try {
    const start = Date.now();
    const data = await httpsGet<{
      result: string;
      time_last_update_utc: string;
      base_code: string;
      conversion_rates: Record<string, number>;
    }>(url);
    const latency = Date.now() - start;

    if (data.result !== 'success') {
      fail(`API returned result="${data.result}"`);
      return false;
    }

    ok(`Connected  (${latency} ms)`);
    ok(`Base currency: ${data.base_code}`);
    ok(`Last updated: ${data.time_last_update_utc}`);

    const spot = ['EUR', 'GBP', 'JPY', 'INR', 'CAD'];
    const rates = spot.map((c) => `${c}=${data.conversion_rates[c] ?? 'N/A'}`).join('  ');
    ok(`Sample rates: ${rates}`);

    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    fail(`Request failed: ${message}`);
    return false;
  }
}

async function main() {
  console.log(`${BOLD}Splitlyst — connection tests${RESET}`);

  const [dbOk, apiOk] = await Promise.all([testDatabase(), testExchangeRateApi()]);

  header('Summary');
  if (dbOk) {
    ok('Database');
  } else {
    fail('Database');
  }
  if (apiOk === true) {
    ok('Exchange Rate API');
  } else if (apiOk === null) {
    console.log(`  ${YELLOW}⚠${RESET}  Exchange Rate API  (no key — using fallback rates)`);
  } else {
    fail('Exchange Rate API');
  }

  console.log();
  process.exit(dbOk && apiOk !== false ? 0 : 1);
}

main();
