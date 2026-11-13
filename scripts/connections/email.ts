import { emailProvider, sendEmail, smtpFrom, verifyEmailProvider } from '../../lib/email';
import { type CheckResult, isEmailAddress, out } from './shared';

/** Asks one question and returns the typed answer; undefined when it can't ask (no terminal). */
export type Prompt = (question: string) => Promise<string | undefined>;

/**
 * Verifies the configured email provider. For SMTP this connects and logs in without sending anything.
 * It then offers to send one real test message: the recipient is typed at a prompt (Enter skips).
 * Credentials are never printed.
 */
export async function checkEmail(opts: { prompt?: Prompt } = {}): Promise<CheckResult> {
  const name = 'Email';
  const provider = emailProvider();

  if (!provider) {
    out.warn(
      'Email not configured — links are only shown in local development ' +
        '(set SMTP_USER + SMTP_PASS (Gmail app password) or RESEND_API_KEY + EMAIL_FROM)',
    );
    return { name, status: 'skipped', note: 'not configured' };
  }

  out.info(
    provider === 'smtp'
      ? `Provider: SMTP (${process.env.SMTP_HOST || 'smtp.gmail.com'}:${process.env.SMTP_PORT || 465}, from ${smtpFrom()})`
      : `Provider: Resend (from ${process.env.EMAIL_FROM})`,
  );

  const check = await verifyEmailProvider();
  if (!check.ok) {
    out.fail(`Could not log in: ${check.error}`);
    return { name, status: 'fail', note: check.error };
  }
  if (check.verified) out.ok('Connected and logged in (nothing was sent)');
  else out.info('Resend has no free login check — it can only be proven by sending a message');

  const question = check.verified
    ? 'Send a real test email too? Enter an address (or press Enter to skip):'
    : 'Enter an address to send a test email (or press Enter to skip):';
  const answer = (await opts.prompt?.(question))?.trim();

  if (!answer) {
    out.info('Not sending a test email');
    return { name, status: 'ok' };
  }
  if (!isEmailAddress(answer)) {
    out.warn(`"${answer}" doesn't look like an email address — not sending`);
    return { name, status: 'ok' };
  }

  const sent = await sendEmail({
    to: answer,
    subject: 'Splitlyst test email',
    text: 'If you can read this, Splitlyst can send email. 🎉',
    html: '<p>If you can read this, <strong>Splitlyst</strong> can send email. 🎉</p>',
  });
  if (!sent) {
    out.fail('Sending failed — see the [email] line above for the reason');
    return { name, status: 'fail', note: 'send failed' };
  }
  out.ok(`Sent to ${answer} — check the inbox (and spam)`);
  return { name, status: 'ok' };
}
