import {
  OtariError,
  agentGuardrails,
  chat,
  describeOtariError,
  getEndUserUsage,
  isOtariConfigured,
  modelFor,
  toOtariError,
} from '@/lib/otari';

const ENV = { ...process.env };
const res = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers });

beforeEach(() => {
  process.env.OTARI_API_KEY = 'otk_test';
  process.env.OTARI_BASE_URL = 'https://gateway.test/api/v1/';
});
afterEach(() => {
  process.env = { ...ENV };
  jest.restoreAllMocks();
});

describe('configuration', () => {
  it('detects whether a key is set', () => {
    expect(isOtariConfigured()).toBe(true);
    delete process.env.OTARI_API_KEY;
    expect(isOtariConfigured()).toBe(false);
  });

  it('uses the verified default models, overridable per role', () => {
    expect(modelFor('reader')).toBe('alibaba/qwen3-30b-a3b-instruct-2507');
    expect(modelFor('planner')).toBe('splitlyst-agent'); // the fallback routing policy
    expect(modelFor('vision')).toMatch(/qwen3-vl/);
    process.env.OTARI_MODEL_READER = 'my/other-model';
    expect(modelFor('reader')).toBe('my/other-model');
  });
});

describe('chat', () => {
  it('sends the model, messages and the end user (for per-user budgets) with the bearer key', async () => {
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(res(200, { choices: [{ message: { content: 'hi' } }] }));
    await chat({
      role: 'reader',
      userId: 'user-1',
      json: true,
      messages: [{ role: 'user', content: 'x' }],
    });

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://gateway.test/api/v1/chat/completions'); // trailing slash trimmed
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer otk_test');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toMatchObject({
      model: 'alibaba/qwen3-30b-a3b-instruct-2507',
      user: 'user-1',
      response_format: { type: 'json_object' },
    });
  });

  it('passes built-in tools, MCP servers and guardrails through', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(res(200, { choices: [] }));
    await chat({
      role: 'planner',
      messages: [],
      tools: [{ type: 'otari_code_execution' }],
      mcpServerIds: ['srv-1'],
      guardrails: [{ profile: 'prompt-injection', mode: 'block' }],
    });
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.model).toBe('splitlyst-agent');
    expect(body.tools).toEqual([{ type: 'otari_code_execution' }]);
    expect(body.mcp_server_ids).toEqual(['srv-1']);
    expect(body.guardrails).toEqual([{ profile: 'prompt-injection', mode: 'block' }]);
  });

  it('omits optional fields it was not given', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(res(200, { choices: [] }));
    await chat({ role: 'reader', messages: [] });
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(Object.keys(body).sort()).toEqual(['messages', 'model']);
  });

  it('reads the inspector from headers, usage and tool calls', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      res(
        200,
        {
          choices: [{ message: { content: 'done' } }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
            cost_usd: '0.000123',
          },
          otari_tool_calls: [{ type: 'code_execution', status: 'completed' }],
        },
        {
          'Otari-Model': 'zai-org/GLM-4.7',
          'Otari-Fallback': 'true',
          'Otari-End-User-Budget': 'budget-9',
          'Otari-Guardrails': JSON.stringify([{ profile: 'prompt-injection', valid: true }]),
        },
      ),
    );
    const { content, inspector } = await chat({ role: 'planner', messages: [] });
    expect(content).toBe('done');
    expect(inspector).toMatchObject({
      role: 'planner',
      model: 'zai-org/GLM-4.7', // the backup that actually answered
      fallback: true,
      endUserBudget: 'budget-9',
      usage: { totalTokens: 15, costUsd: 0.000123 },
    });
    expect(inspector.guardrails).toEqual([{ profile: 'prompt-injection', valid: true }]);
    expect(inspector.toolCalls).toHaveLength(1);
  });

  it('tolerates a malformed guardrails header', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(res(200, { choices: [] }, { 'Otari-Guardrails': 'not json' }));
    expect((await chat({ role: 'reader', messages: [] })).inspector.guardrails).toBeNull();
  });

  it('refuses to call out without a key', async () => {
    delete process.env.OTARI_API_KEY;
    const fetchSpy = jest.spyOn(global, 'fetch');
    await expect(chat({ role: 'reader', messages: [] })).rejects.toMatchObject({
      kind: 'not_configured',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('turns a network failure into an unavailable error', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('ECONNRESET'));
    await expect(chat({ role: 'reader', messages: [] })).rejects.toMatchObject({
      kind: 'unavailable',
    });
  });
});

describe('error mapping', () => {
  it.each([
    [402, {}, 'insufficient_funds'],
    [403, { code: 'guardrail_violation' }, 'guardrail_violation'],
    [403, { code: 'budget_exceeded', end_user: 'u1' }, 'budget_exceeded'],
    [403, { code: 'user_blocked' }, 'budget_exceeded'],
    [429, {}, 'rate_limited'],
    [400, {}, 'bad_request'],
    [422, {}, 'bad_request'],
    [500, {}, 'unavailable'],
    [503, {}, 'unavailable'],
  ])('HTTP %s %j -> %s', (status, body, kind) => {
    expect(toOtariError(status as number, body).kind).toBe(kind);
  });

  it('surfaces a budget refusal from chat() as a typed error', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(res(403, { detail: 'over budget', code: 'budget_exceeded' }));
    await expect(chat({ role: 'reader', messages: [] })).rejects.toBeInstanceOf(OtariError);
  });

  it('gives users friendly messages and sensible statuses, never raw gateway text', () => {
    const budget = describeOtariError(new OtariError('raw detail', 'budget_exceeded', 403));
    expect(budget).toMatchObject({ status: 429, kind: 'budget_exceeded' });
    expect(budget.message).toMatch(/allowance/i);
    expect(budget.message).not.toMatch(/raw detail/);

    expect(describeOtariError(new OtariError('x', 'guardrail_violation', 403)).status).toBe(403);
    expect(describeOtariError(new OtariError('x', 'unavailable', 500)).status).toBe(500);
    expect(describeOtariError(new Error('boom'))).toMatchObject({ status: 500, kind: 'unknown' });
  });
});

describe('getEndUserUsage', () => {
  it('finds the user by external id and reads spend and reset time', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      res(200, [
        { external_id: 'other', spend: 9 },
        {
          external_id: 'me',
          spend: 0.0123,
          current_requests: 4,
          blocked: false,
          next_budget_reset_at: '2026-11-12T00:00:00+00:00',
        },
      ]),
    );
    expect(await getEndUserUsage('me')).toEqual({
      spendUsd: 0.0123,
      requests: 4,
      blocked: false,
      nextResetAt: '2026-11-12T00:00:00+00:00',
    });
  });

  it('returns null for a new user, a failing gateway, or no key', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(res(200, []));
    expect(await getEndUserUsage('nobody')).toBeNull();
    jest.spyOn(global, 'fetch').mockResolvedValue(res(500, {}));
    expect(await getEndUserUsage('me')).toBeNull();
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('down'));
    expect(await getEndUserUsage('me')).toBeNull();
    delete process.env.OTARI_API_KEY;
    expect(await getEndUserUsage('me')).toBeNull();
  });
});

describe('guardrails', () => {
  it('is opt-in: nothing is sent until a profile is configured', () => {
    delete process.env.OTARI_GUARDRAIL_PROFILE;
    expect(agentGuardrails()).toBeUndefined();
    process.env.OTARI_GUARDRAIL_PROFILE = '   ';
    expect(agentGuardrails()).toBeUndefined();
    process.env.OTARI_GUARDRAIL_PROFILE = ' prompt-injection ';
    expect(agentGuardrails()).toEqual([{ profile: 'prompt-injection', mode: 'block' }]);
  });

  it('a blocked request is a typed error that still carries the guardrail verdict', async () => {
    const verdict = [{ profile: 'prompt-injection', mode: 'block', valid: false, score: 0.99 }];
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        res(
          403,
          { detail: 'blocked', code: 'guardrail_violation' },
          { 'Otari-Guardrails': JSON.stringify(verdict) },
        ),
      );
    const err = await chat({
      role: 'reader',
      messages: [],
      guardrails: [{ profile: 'prompt-injection', mode: 'block' }],
    }).catch((e) => e);
    expect(err).toBeInstanceOf(OtariError);
    expect(err.kind).toBe('guardrail_violation');
    expect(err.inspector.guardrails).toEqual(verdict);
    expect(err.inspector.role).toBe('reader');
    expect(describeOtariError(err)).toMatchObject({ status: 403, kind: 'guardrail_violation' });
    expect(describeOtariError(err).message).toMatch(/safety check/i);
  });
});

describe('real Otari guardrail block (nested error, verdict in the body, no header)', () => {
  // Captured from the live gateway: HTTP 403, no Otari-Guardrails header
  const liveBody = {
    detail: {
      message: 'Request blocked by guardrail policy.',
      code: 'guardrail_violation',
      guardrails: [{ profile: 'lakera-guard', explanation: null, score: 1 }],
    },
  };

  it('is recognised as a guardrail violation (not a generic outage)', () => {
    const err = toOtariError(403, liveBody);
    expect(err.kind).toBe('guardrail_violation');
    expect(err.message).toBe('Request blocked by guardrail policy.');
  });

  it('still reads the older top-level shape, and nested budget errors', () => {
    expect(toOtariError(403, { detail: 'x', code: 'guardrail_violation' }).kind).toBe(
      'guardrail_violation',
    );
    expect(toOtariError(403, { detail: { message: 'over', code: 'budget_exceeded' } }).kind).toBe(
      'budget_exceeded',
    );
  });

  it('exposes the flagged profile to the inspector even though the header is missing', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(res(403, liveBody));
    const err = await chat({
      role: 'reader',
      messages: [],
      guardrails: [{ profile: 'lakera-guard', mode: 'block' }],
    }).catch((e) => e);
    expect(err.kind).toBe('guardrail_violation');
    expect(err.inspector.guardrails).toEqual([
      { mode: 'block', profile: 'lakera-guard', explanation: null, score: 1, valid: false },
    ]);
  });

  it('a profile Otari does not know is a clear (logged) gateway error, not a block', () => {
    const err = toOtariError(502, {
      detail:
        "guardrail profile 'prompt-injection' requested but no guardrails service is configured.",
    });
    expect(err.kind).toBe('unavailable');
    expect(err.message).toMatch(/no guardrails service is configured/);
  });
});
