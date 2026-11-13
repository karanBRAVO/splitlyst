const mockSendMail = jest.fn();
const mockVerify = jest.fn();
const mockCreateTransport = jest.fn(() => ({ sendMail: mockSendMail, verify: mockVerify }));
jest.mock('nodemailer', () => ({
  createTransport: (...a: unknown[]) => mockCreateTransport(...(a as [])),
}));

import {
  emailProvider,
  escapeHtml,
  isEmailConfigured,
  resetEmailTransport,
  sendEmail,
  smtpFrom,
  verifyEmailProvider,
} from '@/lib/email';

const ORIGINAL_ENV = { ...process.env };
beforeEach(() => {
  // start every test with no email configuration, whatever the developer's shell has
  for (const k of [
    'RESEND_API_KEY',
    'EMAIL_FROM',
    'EMAIL_PROVIDER',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASS',
  ])
    delete process.env[k];
  mockSendMail.mockReset().mockResolvedValue({ messageId: 'x' });
  mockCreateTransport.mockClear();
  resetEmailTransport();
});
afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  jest.restoreAllMocks();
});

describe('escapeHtml', () => {
  it('escapes markup characters', () => {
    expect(escapeHtml(`<a href="x">&</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  });
});

describe('sendEmail', () => {
  it('is disabled without configuration', async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    const fetchSpy = jest.spyOn(global, 'fetch');
    expect(isEmailConfigured()).toBe(false);
    expect(await sendEmail({ to: 'a@b.c', subject: 's', text: 't' })).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('posts to Resend when configured', async () => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.EMAIL_FROM = 'Splitlyst <no@reply.test>';
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }));
    expect(await sendEmail({ to: 'a@b.c', subject: 'Hi', text: 'Body' })).toBe(true);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toMatchObject({ to: ['a@b.c'], subject: 'Hi', from: 'Splitlyst <no@reply.test>' });
  });

  it('never throws on provider errors', async () => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.EMAIL_FROM = 'x@y.z';
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('nope', { status: 500 }));
    expect(await sendEmail({ to: 'a@b.c', subject: 's', text: 't' })).toBe(false);
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network'));
    expect(await sendEmail({ to: 'a@b.c', subject: 's', text: 't' })).toBe(false);
  });
});

describe('provider selection', () => {
  it('is null (disabled) with no configuration', () => {
    expect(emailProvider()).toBeNull();
    expect(isEmailConfigured()).toBe(false);
  });

  it('uses SMTP when a user and password are set, Resend when only its key is', () => {
    process.env.SMTP_USER = 'app@gmail.com';
    process.env.SMTP_PASS = 'secret';
    expect(emailProvider()).toBe('smtp');
    delete process.env.SMTP_USER;
    process.env.RESEND_API_KEY = 're_x';
    process.env.EMAIL_FROM = 'a@b.c';
    expect(emailProvider()).toBe('resend');
  });

  it('prefers SMTP when both are configured, unless EMAIL_PROVIDER says otherwise', () => {
    process.env.SMTP_USER = 'app@gmail.com';
    process.env.SMTP_PASS = 'secret';
    process.env.RESEND_API_KEY = 're_x';
    process.env.EMAIL_FROM = 'a@b.c';
    expect(emailProvider()).toBe('smtp');
    process.env.EMAIL_PROVIDER = 'resend';
    expect(emailProvider()).toBe('resend');
  });

  it('a forced provider that is not configured disables email instead of silently switching', () => {
    process.env.RESEND_API_KEY = 're_x';
    process.env.EMAIL_FROM = 'a@b.c';
    process.env.EMAIL_PROVIDER = 'smtp';
    expect(emailProvider()).toBeNull();
  });

  it('ignores blank values (as set by the e2e config)', () => {
    process.env.SMTP_USER = '';
    process.env.SMTP_PASS = '';
    process.env.RESEND_API_KEY = '';
    expect(isEmailConfigured()).toBe(false);
  });
});

describe('SMTP sending', () => {
  beforeEach(() => {
    process.env.SMTP_USER = 'splitlyst.app@gmail.com';
    process.env.SMTP_PASS = 'abcd efgh ijkl mnop'; // Google displays app passwords with spaces
  });

  it('connects to Gmail over implicit TLS with the password stripped of spaces', async () => {
    expect(await sendEmail({ to: 'a@b.c', subject: 'Hi', text: 'Body', html: '<p>Body</p>' })).toBe(
      true,
    );
    expect(mockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user: 'splitlyst.app@gmail.com', pass: 'abcdefghijklmnop' },
      }),
    );
  });

  it('sends from "Splitlyst <account>" by default, or EMAIL_FROM when set', async () => {
    await sendEmail({ to: 'a@b.c', subject: 'Hi', text: 'Body' });
    expect(mockSendMail.mock.calls[0][0]).toMatchObject({
      from: 'Splitlyst <splitlyst.app@gmail.com>',
      to: 'a@b.c',
      subject: 'Hi',
      text: 'Body',
    });
    expect(smtpFrom()).toBe('Splitlyst <splitlyst.app@gmail.com>');
    process.env.EMAIL_FROM = 'Splitlyst Team <splitlyst.app@gmail.com>';
    expect(smtpFrom()).toBe('Splitlyst Team <splitlyst.app@gmail.com>');
  });

  it('joins several recipients and supports STARTTLS on port 587 and another host', async () => {
    process.env.SMTP_HOST = 'smtp.example.test';
    process.env.SMTP_PORT = '587';
    await sendEmail({ to: ['a@b.c', 'd@e.f'], subject: 's', text: 't' });
    expect(mockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'smtp.example.test', port: 587, secure: false }),
    );
    expect(mockSendMail.mock.calls[0][0].to).toBe('a@b.c, d@e.f');
  });

  it('sets short timeouts so a hung connection cannot stall a serverless request', async () => {
    await sendEmail({ to: 'a@b.c', subject: 's', text: 't' });
    const cfg = (mockCreateTransport.mock.calls[0] as unknown as [Record<string, number>])[0];
    expect(cfg.connectionTimeout).toBeLessThanOrEqual(15_000);
    expect(cfg.socketTimeout).toBeLessThanOrEqual(20_000);
  });

  it('reuses the connection between sends and rebuilds it when credentials change', async () => {
    await sendEmail({ to: 'a@b.c', subject: '1', text: 't' });
    await sendEmail({ to: 'a@b.c', subject: '2', text: 't' });
    expect(mockCreateTransport).toHaveBeenCalledTimes(1);
    process.env.SMTP_PASS = 'another password here';
    await sendEmail({ to: 'a@b.c', subject: '3', text: 't' });
    expect(mockCreateTransport).toHaveBeenCalledTimes(2);
  });

  it('never throws, and never logs the password', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockSendMail.mockRejectedValue(
      Object.assign(new Error('Invalid login: 535-5.7.8 Username and Password not accepted'), {
        code: 'EAUTH',
        responseCode: 535,
      }),
    );
    expect(await sendEmail({ to: 'a@b.c', subject: 's', text: 't' })).toBe(false);
    const logged = log.mock.calls.flat().join(' ');
    expect(logged).toMatch(/EAUTH/);
    expect(logged).toMatch(/535/);
    expect(logged).not.toMatch(/abcdefghijklmnop|abcd efgh/);
  });

  it('does not use Resend or the network when SMTP is the provider', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    await sendEmail({ to: 'a@b.c', subject: 's', text: 't' });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockSendMail).toHaveBeenCalledTimes(1);
  });
});

describe('verifyEmailProvider (login check without sending)', () => {
  it('is "not configured" with no provider', async () => {
    expect(await verifyEmailProvider()).toEqual({
      provider: null,
      ok: false,
      verified: false,
      error: 'not configured',
    });
  });

  it('proves an SMTP login with verify() and sends nothing', async () => {
    process.env.SMTP_USER = 'app@gmail.com';
    process.env.SMTP_PASS = 'secret';
    mockVerify.mockResolvedValue(true);
    expect(await verifyEmailProvider()).toEqual({ provider: 'smtp', ok: true, verified: true });
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('reports why an SMTP login failed, without the password', async () => {
    process.env.SMTP_USER = 'app@gmail.com';
    process.env.SMTP_PASS = 'topsecretpw';
    mockVerify.mockRejectedValue(
      Object.assign(new Error('Invalid login'), { code: 'EAUTH', responseCode: 535 }),
    );
    const result = await verifyEmailProvider();
    expect(result).toMatchObject({ provider: 'smtp', ok: false, verified: false });
    expect(result.error).toMatch(/EAUTH.*535.*Invalid login/);
    expect(result.error).not.toContain('topsecretpw');
  });

  it('cannot prove Resend without sending, and says so (ok but not verified)', async () => {
    process.env.RESEND_API_KEY = 're_x';
    process.env.EMAIL_FROM = 'a@b.c';
    expect(await verifyEmailProvider()).toEqual({ provider: 'resend', ok: true, verified: false });
  });
});
