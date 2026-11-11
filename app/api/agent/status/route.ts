import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { getEndUserUsage, isOtariConfigured } from '@/lib/otari';

/** Is the AI agent available, and how much of this user's daily allowance is left? */
export async function GET() {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isOtariConfigured()) return NextResponse.json({ enabled: false });

  const limit = Number(process.env.OTARI_DAILY_BUDGET_USD) || 0.1;
  const usage = await getEndUserUsage(session.user.id);
  const spent = usage?.spendUsd ?? 0;
  return NextResponse.json({
    enabled: true,
    allowance: {
      limitUsd: limit,
      spentUsd: spent,
      remainingUsd: Math.max(0, limit - spent),
      blocked: usage?.blocked ?? false,
      resetsAt: usage?.nextResetAt ?? null,
    },
  });
}
