// Minimal transactional email sender using the Resend REST API (no extra dependency).
// Configure RESEND_API_KEY and EMAIL_FROM. Without them, email is disabled (isEmailConfigured() === false).

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

type EmailInput = { to: string | string[]; subject: string; text: string; html?: string };

/** Never throws: returns false (and logs) on failure so callers' main flow isn't broken. */
export async function sendEmail({ to, subject, text, html }: EmailInput): Promise<boolean> {
  if (!isEmailConfigured()) return false;
  try {
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
  } catch (err) {
    console.error('[email] send error', err);
    return false;
  }
}
