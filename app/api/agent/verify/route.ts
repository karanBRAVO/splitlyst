import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { chat, describeOtariError, isOtariConfigured } from '@/lib/otari';
import {
  buildVerifierMessages,
  codeWasExecuted,
  compareShares,
  expectedShares,
  parseVerifierReply,
  verifyInputSchema,
  type VerifyStatus,
} from '@/lib/ai-verify';

/**
 * Step 2 of the agent: a stronger "planner" model re-computes the split by running real Python in
 * Otari's sandbox. We compare its answer with the server's own arithmetic. This never blocks saving:
 * if the check can't run it returns `unavailable`, and the server's numbers are always the ones saved.
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

  const limited = rateLimit(`agent-verify:${session.user.id}`, 20, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: 'Slow down a little — try again in a moment.', kind: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } },
    );
  }

  const parsed = verifyInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: 'Invalid split to verify' }, { status: 400 });
  const input = parsed.data;

  const expected = expectedShares(input);

  try {
    const result = await chat({
      role: 'planner', // routing policy: Qwen3-235B, with GLM-4.7 as the automatic backup
      userId: session.user.id,
      tools: [{ type: 'otari_code_execution' }],
      temperature: 0,
      maxTokens: 1500,
      messages: buildVerifierMessages(input),
    });

    const reply = parseVerifierReply(result.content);
    const codeRan = codeWasExecuted(result.inspector.toolCalls);
    let status: VerifyStatus;
    let mismatches: ReturnType<typeof compareShares>['mismatches'] = [];

    if (!reply) {
      status = 'unverified';
    } else {
      const cmp = compareShares(expected, reply.shares);
      mismatches = cmp.mismatches;
      // A matching answer only counts as verified if Otari really ran code
      status = !cmp.ok ? 'mismatch' : codeRan ? 'verified' : 'unverified';
    }

    return NextResponse.json({
      status,
      codeRan,
      expected,
      actual: reply?.shares ?? null,
      mismatches,
      inspector: result.inspector,
    });
  } catch (err) {
    // A failed check must not look like a failed expense
    const e = describeOtariError(err);
    return NextResponse.json({
      status: 'unavailable' satisfies VerifyStatus,
      reason: e.kind,
      message: e.message,
    });
  }
}
