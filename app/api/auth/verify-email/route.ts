import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { sendVerificationEmail } from '@/lib/verification';

// Click-through from the emailed link.
export async function GET(req: NextRequest) {
  const base = process.env.NEXTAUTH_URL || req.nextUrl.origin;
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.redirect(`${base}/login?verified=invalid`);

  const record = await prisma.emailVerificationToken.findUnique({ where: { token } });
  if (!record || record.expiresAt < new Date()) {
    return NextResponse.redirect(`${base}/login?verified=invalid`);
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { emailVerified: new Date() } }),
    prisma.emailVerificationToken.deleteMany({ where: { userId: record.userId } }),
  ]);
  return NextResponse.redirect(`${base}/dashboard?verified=1`);
}

// (Re)send the verification email for the signed-in user.
export async function POST(req: NextRequest) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limited = rateLimit(`verify:${session.user.id}:${clientIp(req)}`, 3, 15 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } },
    );
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (user.emailVerified) return NextResponse.json({ alreadyVerified: true });

  const result = await sendVerificationEmail(user);
  // This is the signed-in user's own address, so (unlike password reset) it's safe to report failure.
  if (!result.sent && !result.devUrl) {
    return NextResponse.json(
      { error: "We couldn't send the email right now. Please try again later." },
      { status: 502 },
    );
  }
  return NextResponse.json({ success: true, ...(result.devUrl ? { devUrl: result.devUrl } : {}) });
}
