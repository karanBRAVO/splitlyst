import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { z } from 'zod';
import crypto from 'crypto';
import { escapeHtml, isEmailConfigured, sendEmail } from '@/lib/email';

const schema = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  const limited = rateLimit(`forgot:${clientIp(req)}`, 5, 900000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } },
    );
  }
  try {
    const { email } = schema.parse(await req.json());

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    // Always return 200 to prevent email enumeration
    if (!user) return NextResponse.json({ success: true });

    // Invalidate any existing tokens for this user
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    await prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt },
    });

    const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;

    if (isEmailConfigured()) {
      const sent = await sendEmail({
        to: user.email,
        subject: 'Reset your Splitlyst password',
        text: `Hi ${user.name},\n\nUse this link to reset your password (valid for 1 hour):\n${resetUrl}\n\nIf you didn't request this, you can ignore this email.`,
        html: `<p>Hi ${escapeHtml(user.name)},</p><p><a href="${resetUrl}">Reset your password</a> (link valid for 1 hour).</p><p>If you didn't request this, you can ignore this email.</p>`,
      });
      // Dev only: if the provider rejected the send, show the link so local testing isn't blocked
      if (!sent && process.env.NODE_ENV !== 'production') {
        return NextResponse.json({ success: true, resetUrl });
      }
      return NextResponse.json({ success: true });
    }

    // No email provider configured: only expose the link outside production (local dev).
    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json({ success: true, resetUrl });
    }
    console.error('[forgot-password] EMAIL not configured; reset email was not sent');
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
