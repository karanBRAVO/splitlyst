import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import {
  OtariError,
  agentGuardrails,
  chat,
  describeOtariError,
  isOtariConfigured,
} from '@/lib/otari';
import {
  buildEstimate,
  buildTripMessages,
  extractSources,
  searchWasRun,
  tripInputSchema,
} from '@/lib/ai-trip';

/**
 * Trip budget planner. A researcher model searches the live web (Otari's built-in web search) for
 * typical costs at the destination. Nothing is saved: it returns an estimate with the pages it
 * actually used, and the user can then create a group for the trip.
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

  const limited = rateLimit(`agent-trip:${session.user.id}`, 5, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: 'Slow down a little — try again in a moment.', kind: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } },
    );
  }

  const parsed = tripInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Enter a destination, number of days and people.' },
      { status: 400 },
    );
  }
  const input = parsed.data;

  let result;
  try {
    result = await chat({
      role: 'researcher',
      userId: session.user.id, // each search is billed to this person's own daily allowance
      tools: [{ type: 'otari_web_search', max_uses: 2 }],
      // the destination is user-typed text: screen it like the expense text
      guardrails: agentGuardrails(),
      temperature: 0,
      maxTokens: 1500,
      messages: buildTripMessages(input),
    });
  } catch (err) {
    const e = describeOtariError(err);
    if (e.kind === 'unavailable' || e.kind === 'bad_request') {
      console.error('[agent/trip] Otari error:', err instanceof Error ? err.message : err);
    }
    return NextResponse.json(
      {
        error: e.message,
        kind: e.kind,
        inspector: err instanceof OtariError ? err.inspector : undefined,
      },
      { status: e.status },
    );
  }

  const estimate = buildEstimate(result.content, input);
  if (!estimate) {
    return NextResponse.json(
      {
        error: "I couldn't put together an estimate for that. Try a more specific destination.",
        kind: 'unparsed',
        inspector: result.inspector,
      },
      { status: 422 },
    );
  }

  const sources = extractSources(result.inspector.toolCalls);
  return NextResponse.json({
    estimate,
    sources,
    // If Otari never ran a search, the numbers are the model's guess — the UI says so plainly
    usedWebSearch: searchWasRun(result.inspector.toolCalls),
    inspector: result.inspector,
  });
}
