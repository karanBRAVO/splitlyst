import { escapeHtml, isEmailConfigured, sendEmail } from '@/lib/email';

const ORIGINAL_ENV = { ...process.env };
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
