import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// --- mocks: the database client and nodemailer, so no real connection is made ---
const mockQueryRaw = jest.fn();
const mockCount = jest.fn();
const mockDisconnect = jest.fn();
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    $queryRaw: mockQueryRaw,
    $disconnect: mockDisconnect,
    user: { count: mockCount },
    group: { count: mockCount },
    expense: { count: mockCount },
  })),
}));
jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }));

const mockSendMail = jest.fn();
const mockVerify = jest.fn();
jest.mock('nodemailer', () => ({
  createTransport: () => ({ sendMail: mockSendMail, verify: mockVerify }),
}));

import { checkDatabase, maskUrl } from '../../scripts/connections/database';
import { checkEmail } from '../../scripts/connections/email';
import { checkExchangeRate } from '../../scripts/connections/exchange-rate';
import {
  exitCodeFor,
  isEmailAddress,
  loadEnv,
  maskKey,
  parseArgs,
  type CheckResult,
} from '../../scripts/connections/shared';
import { resetEmailTransport } from '../../lib/email';

const ENV = { ...process.env };
let logged: string[];
beforeEach(() => {
  logged = [];
  jest.spyOn(console, 'log').mockImplementation((...a) => void logged.push(a.join(' ')));
  jest.spyOn(console, 'error').mockImplementation(() => {});
  for (const k of [
    'DATABASE_URL',
    'EXCHANGE_RATE_API_KEY',
    'RESEND_API_KEY',
    'EMAIL_FROM',
    'EMAIL_PROVIDER',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASS',
  ])
    delete process.env[k];
  mockQueryRaw.mockReset().mockResolvedValue([{ ping: 1 }]);
  mockCount.mockReset().mockResolvedValue(3);
  mockDisconnect.mockReset();
  mockSendMail.mockReset().mockResolvedValue({});
  mockVerify.mockReset().mockResolvedValue(true);
  resetEmailTransport();
});
afterEach(() => {
  process.env = { ...ENV };
  jest.restoreAllMocks();
});
const output = () => logged.join('\n');

describe('parseArgs', () => {
  it('takes no arguments: a plain run is not help and has nothing unknown', () => {
    expect(parseArgs([])).toEqual({ help: false, unknown: [] });
  });

  it('recognises --help / -h', () => {
    expect(parseArgs(['--help']).help).toBe(true);
    expect(parseArgs(['-h']).help).toBe(true);
  });

  it('reports anything else as unknown (no check selection, no address argument)', () => {
    expect(parseArgs(['db', '--to', 'a@b.c']).unknown).toEqual(['db', '--to', 'a@b.c']);
    expect(parseArgs(['email']).unknown).toEqual(['email']);
  });
});

describe('masking', () => {
  it('hides a database password, including one that contains "@"', () => {
    expect(maskUrl('postgresql://user:secret@host:5432/db')).toBe(
      'postgresql://user:****@host:5432/db',
    );
    const tricky = maskUrl(
      'postgresql://postgres.abc:p@ss@W@aws.pooler.example.com:6543/postgres?pgbouncer=true',
    );
    expect(tricky).toBe(
      'postgresql://postgres.abc:****@aws.pooler.example.com:6543/postgres?pgbouncer=true',
    );
    expect(tricky).not.toMatch(/p@ss|W@/);
  });
  it('leaves a URL without a password alone', () => {
    expect(maskUrl('postgresql://host/db')).toBe('postgresql://host/db');
  });
  it('never shows all of a key', () => {
    expect(maskKey('abcdefghijklmnopqrstuvwx')).toBe('abcd' + '*'.repeat(20));
    expect(maskKey('short')).toBe('*****');
    expect(maskKey('')).toBe('');
  });
});

describe('exitCodeFor', () => {
  const r = (status: CheckResult['status']): CheckResult => ({ name: 'x', status });
  it('fails only when a check failed (skipped is fine)', () => {
    expect(exitCodeFor([r('ok'), r('skipped')])).toBe(0);
    expect(exitCodeFor([r('ok'), r('fail')])).toBe(1);
    expect(exitCodeFor([])).toBe(0);
  });
});

describe('loadEnv', () => {
  it('reads values, strips quotes, skips comments, and never overrides what is already set', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'env-')), '.env');
    writeFileSync(
      file,
      '# comment\nLOADENV_A="quoted"\nLOADENV_B=\'single\'\nLOADENV_C=plain\nLOADENV_KEEP=from-file\n\nnot a pair\n',
    );
    process.env.LOADENV_KEEP = 'from-shell';
    loadEnv(file);
    expect(process.env.LOADENV_A).toBe('quoted');
    expect(process.env.LOADENV_B).toBe('single');
    expect(process.env.LOADENV_C).toBe('plain');
    expect(process.env.LOADENV_KEEP).toBe('from-shell');
    for (const k of ['LOADENV_A', 'LOADENV_B', 'LOADENV_C', 'LOADENV_KEEP']) delete process.env[k];
  });
  it('quietly does nothing when the file is missing', () => {
    expect(() => loadEnv('/nonexistent/.env')).not.toThrow();
  });
});

describe('checkDatabase', () => {
  it('fails clearly when DATABASE_URL is missing', async () => {
    expect(await checkDatabase()).toMatchObject({
      name: 'Database',
      status: 'fail',
      note: 'DATABASE_URL is not set',
    });
  });

  it('passes when it can ping and count the core tables, and always disconnects', async () => {
    process.env.DATABASE_URL = 'postgresql://user:hunter2@host:5432/db';
    expect(await checkDatabase()).toEqual({ name: 'Database', status: 'ok' });
    expect(mockQueryRaw).toHaveBeenCalled();
    expect(mockCount).toHaveBeenCalledTimes(3);
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
    expect(output()).toContain('users: 3, groups: 3, expenses: 3');
  });

  it('reports a failed connection with the reason, never prints the password, and still disconnects', async () => {
    process.env.DATABASE_URL = 'postgresql://user:hunter2@host:5432/db';
    mockQueryRaw.mockRejectedValue(new Error('connect ECONNREFUSED'));
    expect(await checkDatabase()).toMatchObject({ status: 'fail', note: 'connect ECONNREFUSED' });
    expect(output()).not.toContain('hunter2');
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it('fails when the schema is missing (tables unreachable)', async () => {
    process.env.DATABASE_URL = 'postgresql://user:pw@host/db';
    mockCount.mockRejectedValue(new Error('relation "users" does not exist'));
    expect(await checkDatabase()).toMatchObject({ status: 'fail' });
  });
});

describe('checkExchangeRate', () => {
  const apiResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status });
  const good = {
    result: 'success',
    base_code: 'USD',
    time_last_update_utc: 'Fri, 13 Nov 2026 00:00:01 +0000',
    conversion_rates: { EUR: 0.9, GBP: 0.75, JPY: 159.8, INR: 94.1, CAD: 1.43 },
  };

  it('is skipped (not failed) without a key, because the app has fallback rates', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    expect(await checkExchangeRate()).toMatchObject({ status: 'skipped' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('passes on a successful response, prints sample rates, and masks the key', async () => {
    process.env.EXCHANGE_RATE_API_KEY = 'abcdefghijklmnopqrstuvwx';
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(apiResponse(good));
    expect(await checkExchangeRate()).toEqual({ name: 'Exchange Rate API', status: 'ok' });
    expect(output()).toContain('EUR=0.9');
    expect(output()).toContain('INR=94.1');
    expect(output()).not.toContain('abcdefghijklmnopqrstuvwx');
    // never hangs: a timeout signal is always passed
    expect((fetchSpy.mock.calls[0][1] as RequestInit).signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    ['an HTTP error', () => apiResponse({}, 500), /HTTP 500/],
    ['an API-level error', () => apiResponse({ result: 'error' }), /result="error"/],
    ['a non-JSON body', () => new Response('<html>nope</html>', { status: 200 }), /Invalid JSON/],
  ])('fails on %s', async (_label, respond, note) => {
    process.env.EXCHANGE_RATE_API_KEY = 'abcdefghijklmnopqrstuvwx';
    jest.spyOn(global, 'fetch').mockResolvedValue(respond());
    const result = await checkExchangeRate();
    expect(result.status).toBe('fail');
    expect(result.note).toMatch(note);
  });

  it('fails when the request itself fails or times out', async () => {
    process.env.EXCHANGE_RATE_API_KEY = 'abcdefghijklmnopqrstuvwx';
    jest
      .spyOn(global, 'fetch')
      .mockRejectedValue(new Error('The operation was aborted due to timeout'));
    expect(await checkExchangeRate()).toMatchObject({
      status: 'fail',
      note: expect.stringMatching(/timeout/),
    });
  });
});

describe('isEmailAddress', () => {
  it('accepts normal addresses and rejects obvious typos', () => {
    expect(isEmailAddress('me@example.com')).toBe(true);
    expect(isEmailAddress('first.last+tag@sub.example.co.uk')).toBe(true);
    for (const bad of ['', 'nope', 'a@b', '@b.c', 'a b@c.d', 'a@@b.c'])
      expect(isEmailAddress(bad)).toBe(false);
  });
});

describe('checkEmail', () => {
  const smtp = () => {
    process.env.SMTP_USER = 'app@gmail.com';
    process.env.SMTP_PASS = 'abcd efgh ijkl mnop';
  };
  const answering = (answer: string | undefined) => jest.fn().mockResolvedValue(answer);

  it('is skipped when nothing is configured, and never prompts', async () => {
    const prompt = answering('me@example.com');
    expect(await checkEmail({ prompt })).toMatchObject({
      status: 'skipped',
      note: 'not configured',
    });
    expect(prompt).not.toHaveBeenCalled();
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('verifies an SMTP login without sending, then asks where to send a test', async () => {
    smtp();
    const prompt = answering('');
    expect(await checkEmail({ prompt })).toEqual({ name: 'Email', status: 'ok' });
    expect(mockVerify).toHaveBeenCalledTimes(1);
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(prompt.mock.calls[0][0]).toMatch(/press Enter to skip/i);
    expect(mockSendMail).not.toHaveBeenCalled(); // Enter = skip
    expect(output()).toContain('nothing was sent');
    expect(output()).not.toMatch(/abcd efgh|abcdefgh/); // credentials never printed
  });

  it('sends one real message to the address typed at the prompt', async () => {
    smtp();
    expect(await checkEmail({ prompt: answering('  me@example.com  ') })).toEqual({
      name: 'Email',
      status: 'ok',
    });
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    expect(mockSendMail.mock.calls[0][0]).toMatchObject({
      to: 'me@example.com',
      subject: 'Splitlyst test email',
    });
    expect(output()).toContain('Sent to me@example.com');
  });

  it('does not send to something that is not an email address', async () => {
    smtp();
    expect(await checkEmail({ prompt: answering('not-an-email') })).toEqual({
      name: 'Email',
      status: 'ok',
    });
    expect(mockSendMail).not.toHaveBeenCalled();
    expect(output()).toContain("doesn't look like an email address");
  });

  it('skips the send quietly when there is no terminal to ask on (CI)', async () => {
    smtp();
    expect(await checkEmail({ prompt: answering(undefined) })).toEqual({
      name: 'Email',
      status: 'ok',
    });
    expect(await checkEmail()).toEqual({ name: 'Email', status: 'ok' }); // no prompt function at all
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('fails with the reason when the SMTP login is rejected, and does not ask for a recipient', async () => {
    smtp();
    mockVerify.mockRejectedValue(
      Object.assign(new Error('Invalid login'), { code: 'EAUTH', responseCode: 535 }),
    );
    const prompt = answering('me@example.com');
    const result = await checkEmail({ prompt });
    expect(result.status).toBe('fail');
    expect(result.note).toMatch(/EAUTH.*535/);
    expect(prompt).not.toHaveBeenCalled();
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('reports a failed send as a failure', async () => {
    smtp();
    mockSendMail.mockRejectedValue(new Error('550 mailbox unavailable'));
    expect(await checkEmail({ prompt: answering('me@example.com') })).toMatchObject({
      status: 'fail',
      note: 'send failed',
    });
  });

  it('for Resend there is no free login check: it says so and asks for an address to prove it', async () => {
    process.env.RESEND_API_KEY = 're_x';
    process.env.EMAIL_FROM = 'Splitlyst <noreply@example.com>';
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }));

    const skipped = answering('');
    expect(await checkEmail({ prompt: skipped })).toEqual({ name: 'Email', status: 'ok' });
    expect(skipped.mock.calls[0][0]).toMatch(/Enter an address to send a test email/);
    expect(fetchSpy).not.toHaveBeenCalled();

    await checkEmail({ prompt: answering('me@example.com') });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
