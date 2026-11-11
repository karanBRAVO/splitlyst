import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { escapeHtml, isEmailConfigured, sendEmail } from '@/lib/email';

const TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Create a verification token for a user and email the link.
 * Returns the link only outside production when email isn't configured (local dev / tests).
 */
export async function sendVerificationEmail(user: {
  id: string;
  email: string;
  name: string;
}): Promise<{ sent: boolean; devUrl?: string }> {
  await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });
  const token = crypto.randomBytes(32).toString('hex');
  await prisma.emailVerificationToken.create({
    data: { userId: user.id, token, expiresAt: new Date(Date.now() + TTL_MS) },
  });

  const url = `${process.env.NEXTAUTH_URL}/api/auth/verify-email?token=${token}`;
  if (isEmailConfigured()) {
    const sent = await sendEmail({
      to: user.email,
      subject: 'Verify your Splitlyst email',
      text: `Hi ${user.name},\n\nConfirm your email address:\n${url}\n\nThis link is valid for 24 hours.`,
      html: `<p>Hi ${escapeHtml(user.name)},</p><p><a href="${url}">Confirm your email address</a> (valid for 24 hours).</p>`,
    });
    // In development, fall back to showing the link if the provider rejects the send
    // (e.g. Resend's test sender only delivers to your own address). Never in production.
    if (!sent && process.env.NODE_ENV !== 'production') return { sent: false, devUrl: url };
    return { sent };
  }
  return process.env.NODE_ENV !== 'production' ? { sent: false, devUrl: url } : { sent: false };
}
