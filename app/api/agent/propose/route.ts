import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { chat, describeOtariError, isOtariConfigured } from '@/lib/otari';
import { buildReaderMessages, extractJson, resolveDraft, type Person } from '@/lib/ai-draft';
import { calculateEqualSplits, calculatePercentageSplits } from '@/lib/calculations';
import { roundToTwoDecimals } from '@/lib/utils';

const schema = z.object({
  text: z.string().trim().min(3).max(2000),
  groupId: z.string().optional().nullable(),
});

/** Who the agent is allowed to put on an expense: the group's members, or you + accepted friends. */
async function peopleFor(userId: string, groupId?: string | null): Promise<Person[] | null> {
  if (groupId) {
    const members = await prisma.groupMember.findMany({
      where: { groupId },
      include: { user: { select: { id: true, name: true } } },
    });
    if (!members.some((m) => m.userId === userId)) return null;
    return members.map((m) => ({ id: m.user.id, name: m.user.name }));
  }
  const [me, friendships] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } }),
    prisma.friendship.findMany({
      where: { status: 'accepted', OR: [{ userAId: userId }, { userBId: userId }] },
      include: {
        userA: { select: { id: true, name: true } },
        userB: { select: { id: true, name: true } },
      },
    }),
  ]);
  if (!me) return null;
  const others = friendships.map((f) => (f.userAId === userId ? f.userB : f.userA));
  return [me, ...others].filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i);
}

/**
 * Step 1 of the agent: read plain English and PROPOSE an expense. Nothing is saved here — the user
 * reviews the proposal and confirms it through the normal expense endpoint.
 */
export async function POST(req: NextRequest) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isOtariConfigured()) {
    return NextResponse.json(
      { error: 'AI features are not set up yet.', kind: 'not_configured' },
      { status: 503 },
    );
  }

  const limited = rateLimit(`agent:${session.user.id}`, 20, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: 'Slow down a little — try again in a moment.', kind: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } },
    );
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Describe the expense in a few words.' }, { status: 400 });
  }
  const { text, groupId } = parsed.data;

  const people = await peopleFor(session.user.id, groupId);
  if (!people) return NextResponse.json({ error: 'Group not found' }, { status: 404 });
  const me = people.find((p) => p.id === session.user.id);

  let result;
  try {
    result = await chat({
      role: 'reader',
      userId: session.user.id, // per-user budget: Otari bills this person's own daily allowance
      json: true,
      temperature: 0,
      maxTokens: 600,
      messages: buildReaderMessages({
        text,
        people,
        meName: me?.name ?? session.user.name ?? 'me',
        defaultCurrency: session.user.currency || 'USD',
      }),
    });
  } catch (err) {
    const e = describeOtariError(err);
    return NextResponse.json({ error: e.message, kind: e.kind }, { status: e.status });
  }

  let draft;
  try {
    draft = resolveDraft(extractJson(result.content), people, session.user.id);
  } catch {
    return NextResponse.json(
      {
        error: "I couldn't understand that. Try: “Dinner 60 with Bob, I paid”.",
        kind: 'unparsed',
        inspector: result.inspector,
      },
      { status: 422 },
    );
  }

  // The server — not the model — does the arithmetic that will be saved.
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? 'Unknown';
  let amounts: Array<{ userId: string; amount: number }>;
  if (draft.splitType === 'percentage') {
    amounts = calculatePercentageSplits(
      draft.amount,
      draft.splits.map((s) => ({ userId: s.userId, percentage: s.percentage ?? 0 })),
    ).map((s) => ({ userId: s.userId, amount: s.amount ?? 0 }));
  } else if (draft.splitType === 'custom') {
    amounts = draft.splits.map((s) => ({
      userId: s.userId,
      amount: roundToTwoDecimals(s.amount ?? 0),
    }));
  } else {
    amounts = calculateEqualSplits(draft.amount, draft.participantIds).map((s) => ({
      userId: s.userId,
      amount: s.amount ?? 0,
    }));
  }

  return NextResponse.json({
    draft: {
      description: draft.description,
      amount: draft.amount,
      currency: draft.currency || session.user.currency || 'USD',
      category: draft.category,
      splitType: draft.splitType,
      groupId: groupId ?? null,
      paidById: draft.paidById,
      paidByName: nameOf(draft.paidById),
      participantIds: draft.participantIds,
      splits: draft.splits,
      shares: amounts.map((a) => ({ ...a, name: nameOf(a.userId) })),
      unmatched: draft.unmatched,
    },
    inspector: result.inspector,
  });
}
