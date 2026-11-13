// Transactional email with two interchangeable providers:
//
//  • SMTP (e.g. Gmail with an app password) — free, no domain needed:
//      SMTP_USER, SMTP_PASS  (+ optional SMTP_HOST=smtp.gmail.com, SMTP_PORT=465, EMAIL_FROM)
//  • Resend REST API — needs a domain you have verified in Resend:
//      RESEND_API_KEY, EMAIL_FROM
//
// Choose explicitly with EMAIL_PROVIDER=smtp|resend; otherwise SMTP is used when SMTP_USER/SMTP_PASS
// are set, else Resend. With neither configured, email is disabled (isEmailConfigured() === false).

export type EmailProvider = 'smtp' | 'resend';

function smtpConfigured(): boolean {
  return !!process.env.SMTP_USER?.trim() && !!process.env.SMTP_PASS?.trim();
}

function resendConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
}

/** Which provider will send mail, or null when email isn't configured. */
export function emailProvider(): EmailProvider | null {
  const forced = process.env.EMAIL_PROVIDER?.trim().toLowerCase();
  if (forced === 'smtp') return smtpConfigured() ? 'smtp' : null;
  if (forced === 'resend') return resendConfigured() ? 'resend' : null;
  if (smtpConfigured()) return 'smtp';
  if (resendConfigured()) return 'resend';
  return null;
}

export function isEmailConfigured(): boolean {
  return emailProvider() !== null;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

type EmailInput = { to: string | string[]; subject: string; text: string; html?: string };

/** From address for SMTP: EMAIL_FROM if given, else "Splitlyst <SMTP_USER>" (Gmail requires the account's own address). */
export function smtpFrom(): string {
  return process.env.EMAIL_FROM?.trim() || `Splitlyst <${process.env.SMTP_USER?.trim()}>`;
}

// Reused across calls so warm serverless invocations don't reconnect every time
type Transport = {
  sendMail: (message: Record<string, unknown>) => Promise<unknown>;
  verify?: () => Promise<unknown>;
};
let cached: { key: string; transport: Transport } | null = null;

async function smtpTransport(): Promise<Transport> {
  const host = process.env.SMTP_HOST?.trim() || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT) || 465;
  const user = process.env.SMTP_USER!.trim();
  // Google shows app passwords as "abcd efgh ijkl mnop"; the spaces aren't part of the password
  const pass = process.env.SMTP_PASS!.replace(/\s+/g, '');
  const key = `${host}:${port}:${user}:${pass}`;
  if (cached?.key === key) return cached.transport;

  const nodemailer = await import('nodemailer');
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465 = implicit TLS; 587 = STARTTLS
    auth: { user, pass },
    // fail fast: a hung SMTP connection must not eat the whole serverless request
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  }) as unknown as Transport;
  cached = { key, transport };
  return transport;
}

async function sendViaSmtp({ to, subject, text, html }: EmailInput): Promise<boolean> {
  const transport = await smtpTransport();
  await transport.sendMail({
    from: smtpFrom(),
    to: Array.isArray(to) ? to.join(', ') : to,
    subject,
    text,
    html,
  });
  return true;
}

async function sendViaResend({ to, subject, text, html }: EmailInput): Promise<boolean> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: Array.isArray(to) ? to : [to],
      subject,
      text,
      html,
    }),
  });
  if (!res.ok) {
    console.error('[email] send failed', res.status, await res.text());
    return false;
  }
  return true;
}

/** A short reason for a failure — code, SMTP response code and message; never credentials. */
export function describeEmailError(err: unknown): string {
  const e = err as { code?: string; responseCode?: number; message?: string };
  return [e.code, e.responseCode, e.message].filter(Boolean).join(' · ');
}

export interface EmailVerification {
  provider: EmailProvider | null;
  ok: boolean;
  /** true when the connection/login was actually proven (SMTP); Resend can only be proven by sending */
  verified: boolean;
  error?: string;
}

/**
 * Check that email is usable WITHOUT sending a message: for SMTP this connects and logs in
 * (nodemailer's verify()); for Resend there is no free check, so it only reports "configured".
 */
export async function verifyEmailProvider(): Promise<EmailVerification> {
  const provider = emailProvider();
  if (!provider) return { provider: null, ok: false, verified: false, error: 'not configured' };
  if (provider === 'resend') return { provider, ok: true, verified: false };
  try {
    const transport = await smtpTransport();
    if (!transport.verify) throw new Error('this SMTP transport cannot be verified');
    await transport.verify();
    return { provider, ok: true, verified: true };
  } catch (err) {
    return { provider, ok: false, verified: false, error: describeEmailError(err) };
  }
}

/** Never throws: returns false (and logs) on failure so callers' main flow isn't broken. */
export async function sendEmail(input: EmailInput): Promise<boolean> {
  const provider = emailProvider();
  if (!provider) return false;
  try {
    return provider === 'smtp' ? await sendViaSmtp(input) : await sendViaResend(input);
  } catch (err) {
    // log the reason, never the credentials
    console.error(`[email] ${provider} send error:`, describeEmailError(err));
    return false;
  }
}

/** Test helper: forget the cached SMTP connection. */
export function resetEmailTransport() {
  cached = null;
}
