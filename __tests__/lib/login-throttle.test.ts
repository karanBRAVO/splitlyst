const mockFindUnique = jest.fn();
const mockUpdate = jest.fn();
jest.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: (a: unknown) => mockFindUnique(a), update: mockUpdate } },
}));
const mockVerifyTotp = jest.fn();
jest.mock('@/lib/totp', () => ({
  verifyTotp: (...a: unknown[]) => mockVerifyTotp(...a),
  hashRecoveryCode: (c: string) => `hashed:${c}`,
}));

import { hash } from 'bcryptjs';
import {
  LOGIN_MAX_FAILURES_PER_EMAIL,
  LOGIN_MAX_FAILURES_PER_IP,
  TOTP_INVALID,
  TOTP_REQUIRED,
  authOptions,
  tooManyAttemptsMessage,
} from '@/lib/auth';
import { resetRateLimits } from '@/lib/rate-limit';

type Authorize = (
  credentials: Record<string, string | undefined>,
  req: unknown,
) => Promise<unknown>;
const authorize = (authOptions.providers[0] as unknown as { options: { authorize: Authorize } })
  .options.authorize;

const PASSWORD = 'correct-horse';
const LOCKED = /^Too many failed sign-in attempts\. Try again in \d+ minutes?\.$/;
let passwordHash: string;
let users: Record<string, Record<string, unknown>>;

const attempt = (
  email: string,
  password: string,
  ip: string | null = '203.0.113.1',
  totp?: string,
) => authorize({ email, password, totp }, { headers: ip ? { 'x-forwarded-for': ip } : {} });

const failTimes = async (n: number, email = 'a@example.com', ip: string | null = '203.0.113.1') => {
  for (let i = 0; i < n; i++) {
    await expect(attempt(email, 'wrong', ip)).rejects.toThrow('Incorrect password');
  }
};

beforeAll(async () => {
  passwordHash = await hash(PASSWORD, 4);
});
beforeEach(() => {
  delete process.env.REDIS_URL;
  resetRateLimits();
  const base = {
    id: 'u1',
    name: 'A',
    avatar: null,
    currency: 'USD',
    locale: 'en',
    password: passwordHash,
    totpEnabled: false,
    totpSecret: null,
    recoveryCodes: null,
  };
  users = {
    'a@example.com': { ...base, email: 'a@example.com' },
    'b@example.com': { ...base, id: 'u2', email: 'b@example.com' },
    'twofa@example.com': {
      ...base,
      id: 'u3',
      email: 'twofa@example.com',
      totpEnabled: true,
      totpSecret: 'SECRET',
    },
  };
  mockFindUnique.mockReset().mockImplementation(async ({ where }) => users[where.email] ?? null);
  mockUpdate.mockReset().mockResolvedValue({});
  mockVerifyTotp.mockReset().mockReturnValue(false);
});

describe('sign-in throttling', () => {
  it('still signs in normally', async () => {
    await expect(attempt('a@example.com', PASSWORD)).resolves.toMatchObject({ id: 'u1' });
  });

  it('locks an account after too many wrong passwords, even for the right password', async () => {
    await failTimes(LOGIN_MAX_FAILURES_PER_EMAIL);
    await expect(attempt('a@example.com', 'wrong')).rejects.toThrow(LOCKED);
    await expect(attempt('a@example.com', PASSWORD)).rejects.toThrow(LOCKED);
  });

  it('allows one fewer failure than the limit', async () => {
    await failTimes(LOGIN_MAX_FAILURES_PER_EMAIL - 1);
    await expect(attempt('a@example.com', PASSWORD)).resolves.toMatchObject({ id: 'u1' });
  });

  it('refuses a locked account before looking it up or hashing anything', async () => {
    await failTimes(LOGIN_MAX_FAILURES_PER_EMAIL);
    mockFindUnique.mockClear();
    await expect(attempt('a@example.com', PASSWORD)).rejects.toThrow(LOCKED);
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('counts unknown emails too, so account names cannot be probed without limit', async () => {
    for (let i = 0; i < LOGIN_MAX_FAILURES_PER_EMAIL; i++) {
      await expect(attempt('nobody@example.com', 'x')).rejects.toThrow('No account found');
    }
    await expect(attempt('nobody@example.com', 'x')).rejects.toThrow(LOCKED);
  });

  it('treats the email case-insensitively', async () => {
    for (let i = 0; i < LOGIN_MAX_FAILURES_PER_EMAIL; i++) {
      await expect(attempt(i % 2 ? 'A@Example.com' : 'a@example.com', 'wrong')).rejects.toThrow(
        'Incorrect password',
      );
    }
    await expect(attempt('A@EXAMPLE.COM', PASSWORD)).rejects.toThrow(LOCKED);
  });

  it('resets the account counter after a successful sign-in', async () => {
    await failTimes(LOGIN_MAX_FAILURES_PER_EMAIL - 1);
    await expect(attempt('a@example.com', PASSWORD)).resolves.toBeTruthy();
    await failTimes(LOGIN_MAX_FAILURES_PER_EMAIL - 1);
    await expect(attempt('a@example.com', PASSWORD)).resolves.toBeTruthy();
  });

  it('does not let one locked account block other accounts', async () => {
    await failTimes(LOGIN_MAX_FAILURES_PER_EMAIL, 'a@example.com', '198.51.100.1');
    await expect(attempt('b@example.com', PASSWORD, '198.51.100.2')).resolves.toMatchObject({
      id: 'u2',
    });
  });

  it('blocks an IP after too many failures across different accounts', async () => {
    for (let i = 0; i < LOGIN_MAX_FAILURES_PER_IP; i++) {
      await expect(attempt(`ghost${i}@example.com`, 'x', '198.51.100.9')).rejects.toThrow(
        'No account found',
      );
    }
    await expect(attempt('b@example.com', PASSWORD, '198.51.100.9')).rejects.toThrow(LOCKED);
    // a different IP is unaffected
    await expect(attempt('b@example.com', PASSWORD, '198.51.100.10')).resolves.toBeTruthy();
  });

  it('uses the first address in x-forwarded-for', async () => {
    for (let i = 0; i < LOGIN_MAX_FAILURES_PER_IP; i++) {
      await expect(
        attempt(`ghost${i}@example.com`, 'x', '198.51.100.20, 10.0.0.1'),
      ).rejects.toThrow('No account found');
    }
    await expect(attempt('b@example.com', PASSWORD, '198.51.100.20, 10.9.9.9')).rejects.toThrow(
      LOCKED,
    );
  });

  it('does not create one shared bucket when the IP is unknown', async () => {
    for (let i = 0; i < LOGIN_MAX_FAILURES_PER_IP + 5; i++) {
      await expect(attempt(`ghost${i}@example.com`, 'x', null)).rejects.toThrow('No account found');
    }
    await expect(attempt('b@example.com', PASSWORD, null)).resolves.toBeTruthy();
  });

  it('does not count a missing two-factor code as a failed attempt', async () => {
    for (let i = 0; i < LOGIN_MAX_FAILURES_PER_EMAIL + 5; i++) {
      await expect(attempt('twofa@example.com', PASSWORD)).rejects.toThrow(TOTP_REQUIRED);
    }
  });

  it('counts wrong two-factor codes, then locks', async () => {
    for (let i = 0; i < LOGIN_MAX_FAILURES_PER_EMAIL; i++) {
      await expect(attempt('twofa@example.com', PASSWORD, '203.0.113.5', '000000')).rejects.toThrow(
        TOTP_INVALID,
      );
    }
    mockVerifyTotp.mockReturnValue(true);
    await expect(attempt('twofa@example.com', PASSWORD, '203.0.113.5', '123456')).rejects.toThrow(
      LOCKED,
    );
  });

  it('completes a two-factor sign-in with a valid code and clears the counter', async () => {
    mockVerifyTotp.mockReturnValue(true);
    await expect(
      attempt('twofa@example.com', PASSWORD, '203.0.113.6', '123456'),
    ).resolves.toMatchObject({ id: 'u3' });
  });

  it('never writes the email address into the rate-limit store', async () => {
    const spy = jest.spyOn(Map.prototype, 'set');
    await expect(attempt('a@example.com', 'wrong')).rejects.toThrow('Incorrect password');
    const keys = spy.mock.calls.map(([key]) => String(key));
    spy.mockRestore();
    expect(keys.filter((k) => k.startsWith('login:email:'))).toHaveLength(1);
    expect(keys.join('\n')).not.toContain('a@example.com');
  });

  it('does not throttle a request that is missing its credentials', async () => {
    await expect(authorize({ email: '', password: '' }, { headers: {} })).rejects.toThrow(
      'Email and password are required',
    );
  });
});

describe('tooManyAttemptsMessage', () => {
  it('rounds the wait up to whole minutes', () => {
    expect(tooManyAttemptsMessage({ ok: false, retryAfterSec: 1 })).toContain('1 minute.');
    expect(tooManyAttemptsMessage({ ok: false, retryAfterSec: 60 })).toContain('1 minute.');
    expect(tooManyAttemptsMessage({ ok: false, retryAfterSec: 61 })).toContain('2 minutes.');
    expect(tooManyAttemptsMessage({ ok: false, retryAfterSec: 900 })).toContain('15 minutes.');
  });
});
