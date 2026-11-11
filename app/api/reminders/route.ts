import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { notify } from '@/lib/notify';
import { rateLimit } from '@/lib/rate-limit';
import { escapeHtml, sendEmail } from '@/lib/email';

const schema = z.object({ userId: z.string() });

// Nudge a friend / group-mate to settle up (in-app notification + email if configured).
export async function POST(req: NextRequest) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'userId required' }, { status: 400 });
  const { userId } = parsed.data;

  if (userId === session.user.id) {
    return NextResponse.json({ error: 'You cannot remind yourself' }, { status: 400 });
  }

  const [friendship, sharedGroup] = await Promise.all([
    prisma.friendship.findFirst({
      where: {
        status: 'accepted',
        OR: [
          { userAId: session.user.id, userBId: userId },
          { userAId: userId, userBId: session.user.id },
        ],
      },
    }),
    prisma.groupMember.findFirst({
      where: {
        userId,
        group: { members: { some: { userId: session.user.id } } },
      },
    }),
  ]);
  if (!friendship && !sharedGroup) {
    return NextResponse.json({ error: 'You are not connected with this user' }, { status: 403 });
  }

  // One reminder per person per hour
  const limited = rateLimit(`remind:${session.user.id}:${userId}`, 1, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: 'You already sent a reminder recently. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } },
    );
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  await notify({
    userId,
    type: 'payment_reminder',
    title: 'Settle-up reminder',
    message: `${session.user.name} sent you a reminder to settle up`,
    data: { fromUserId: session.user.id },
  });

  const emailed = await sendEmail({
    to: target.email,
    subject: `${session.user.name} sent you a settle-up reminder`,
    text: `Hi ${target.name},\n\n${session.user.name} reminded you to settle up on Splitlyst.\n\n${process.env.NEXTAUTH_URL ?? ''}/dashboard`,
    html: `<p>Hi ${escapeHtml(target.name)},</p><p>${escapeHtml(session.user.name ?? 'A friend')} reminded you to settle up on Splitlyst.</p><p><a href="${process.env.NEXTAUTH_URL ?? ''}/dashboard">Open Splitlyst</a></p>`,
  });

  return NextResponse.json({ success: true, emailed });
}
