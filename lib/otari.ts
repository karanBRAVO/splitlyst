// Thin client for the Otari gateway (https://otari.ai — open-source AI gateway by Mozilla AI).
// One OpenAI-compatible endpoint; Otari handles provider routing, budgets, guardrails and tools.

export type OtariRole = 'reader' | 'planner' | 'vision' | 'researcher';

const DEFAULT_BASE = 'https://api.otari.ai/api/v1';

export function otariBaseUrl(): string {
  return (process.env.OTARI_BASE_URL || DEFAULT_BASE).replace(/\/$/, '');
}

export function isOtariConfigured(): boolean {
  return !!process.env.OTARI_API_KEY;
}

/**
 * Which open-weight model plays which role (all verified live on the account).
 * Override any of them with OTARI_MODEL_<ROLE>. The planner defaults to the *routing policy*
 * `splitlyst-agent` (Qwen3-235B with a GLM-4.7 backup), so fallbacks happen inside Otari.
 */
export function modelFor(role: OtariRole): string {
  const defaults: Record<OtariRole, string> = {
    // fast, non-reasoning and cheap: plain English -> structured JSON (measured ~2s; a reasoning
    // model like gpt-oss-120b took 5-25s and could run out of tokens before answering)
    reader: 'alibaba/qwen3-30b-a3b-instruct-2507',
    planner: 'splitlyst-agent', // fallback policy: alibaba/qwen3-235b-a22b-instruct-2507 -> z-ai/glm-4.7
    vision: 'alibaba/qwen3-vl-30b-a3b-instruct', // reads receipt photos
    researcher: 'alibaba/qwen3-235b-a22b-instruct-2507', // web search (faster than GLM)
  };
  return process.env[`OTARI_MODEL_${role.toUpperCase()}`] || defaults[role];
}

/** What the "Otari inspector" shows under an AI answer: proof of which gateway features ran. */
export interface OtariInspector {
  role: OtariRole;
  /** The model that actually answered (Otari-Model header); differs from the request when a backup served it */
  model: string | null;
  /** True when a backup in a routing policy answered (Otari-Fallback header) */
  fallback: boolean;
  /** Guardrail verdicts (Otari-Guardrails header), when a guardrail applied */
  guardrails: Array<Record<string, unknown>> | null;
  /** Per-user budget this end user is on (Otari-End-User-Budget header) */
  endUserBudget: string | null;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costUsd: number | null;
  } | null;
  /** Built-in tools Otari ran for this request (otari_tool_calls) */
  toolCalls: Array<Record<string, unknown>>;
}

export type OtariErrorKind =
  | 'not_configured'
  | 'budget_exceeded'
  | 'insufficient_funds'
  | 'guardrail_violation'
  | 'rate_limited'
  | 'unavailable'
  | 'bad_request';

export class OtariError extends Error {
  constructor(
    message: string,
    public readonly kind: OtariErrorKind,
    public readonly status = 500,
    public readonly detail?: unknown,
  ) {
    super(message);
    this.name = 'OtariError';
  }
}

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | Array<Record<string, unknown>>;
};

export interface ChatOptions {
  role: OtariRole;
  messages: ChatMessage[];
  /** Overrides the role's model (or routing-policy name) */
  model?: string;
  /** Stable Splitlyst user id: Otari bills this end user against their own per-user budget */
  userId?: string;
  /** Otari built-in tools (otari_web_search, otari_web_fetch, otari_code_execution) */
  tools?: Array<Record<string, unknown>>;
  mcpServerIds?: string[];
  mcpServers?: Array<Record<string, unknown>>;
  /** e.g. [{ profile: 'prompt-injection', mode: 'block' }] */
  guardrails?: Array<{ profile: string; mode?: 'block' | 'monitor' }>;
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface ChatResult {
  content: string;
  inspector: OtariInspector;
  raw: Record<string, unknown>;
}

interface GatewayResponse {
  model?: string;
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cost_usd?: string | number;
  };
  otari_tool_calls?: Array<Record<string, unknown>>;
}

function parseJsonHeader(value: string | null): Array<Record<string, unknown>> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return null;
  }
}

export function toOtariError(status: number, body: unknown): OtariError {
  const b = (body ?? {}) as {
    detail?: unknown;
    code?: string;
    error?: { message?: string; code?: string };
  };
  const code = b.code ?? b.error?.code ?? '';
  const message =
    (typeof b.detail === 'string' && b.detail) ||
    b.error?.message ||
    `Otari request failed (${status})`;
  if (status === 402) return new OtariError(message, 'insufficient_funds', status, body);
  if (status === 403 && code === 'guardrail_violation')
    return new OtariError(message, 'guardrail_violation', status, body);
  if (status === 403 && (code === 'budget_exceeded' || code === 'user_blocked'))
    return new OtariError(message, 'budget_exceeded', status, body);
  if (status === 429) return new OtariError(message, 'rate_limited', status, body);
  if (status === 400 || status === 422) return new OtariError(message, 'bad_request', status, body);
  return new OtariError(message, 'unavailable', status, body);
}

export async function chat(options: ChatOptions): Promise<ChatResult> {
  if (!isOtariConfigured()) {
    throw new OtariError('AI is not configured (set OTARI_API_KEY).', 'not_configured', 503);
  }

  const model = options.model ?? modelFor(options.role);
  const body: Record<string, unknown> = {
    model,
    messages: options.messages,
    ...(options.userId ? { user: options.userId } : {}),
    ...(options.tools?.length ? { tools: options.tools } : {}),
    ...(options.mcpServerIds?.length ? { mcp_server_ids: options.mcpServerIds } : {}),
    ...(options.mcpServers?.length ? { mcp_servers: options.mcpServers } : {}),
    ...(options.guardrails?.length ? { guardrails: options.guardrails } : {}),
    ...(options.json ? { response_format: { type: 'json_object' } } : {}),
    ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
  };

  let res: Response;
  try {
    res = await fetch(`${otariBaseUrl()}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OTARI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: options.signal,
    });
  } catch (err) {
    throw new OtariError(`Could not reach Otari: ${(err as Error).message}`, 'unavailable', 502);
  }

  const json = (await res.json().catch(() => ({}))) as GatewayResponse;
  if (!res.ok) throw toOtariError(res.status, json);

  const cost = json.usage?.cost_usd !== undefined ? Number(json.usage.cost_usd) : null;
  const usage = json.usage
    ? {
        promptTokens: json.usage.prompt_tokens ?? 0,
        completionTokens: json.usage.completion_tokens ?? 0,
        totalTokens: json.usage.total_tokens ?? 0,
        costUsd: cost !== null && Number.isFinite(cost) ? cost : null,
      }
    : null;

  return {
    content: json.choices?.[0]?.message?.content ?? '',
    raw: json as Record<string, unknown>,
    inspector: {
      role: options.role,
      model: res.headers.get('Otari-Model') ?? json.model ?? null,
      fallback: res.headers.get('Otari-Fallback') === 'true',
      guardrails: parseJsonHeader(res.headers.get('Otari-Guardrails')),
      endUserBudget: res.headers.get('Otari-End-User-Budget'),
      usage,
      toolCalls: Array.isArray(json.otari_tool_calls) ? json.otari_tool_calls : [],
    },
  };
}

export interface EndUserUsage {
  spendUsd: number;
  requests: number;
  blocked: boolean;
  nextResetAt: string | null;
}

/** What this user has spent against their per-user budget (null if they haven't used the AI yet). */
export async function getEndUserUsage(externalId: string): Promise<EndUserUsage | null> {
  if (!isOtariConfigured()) return null;
  const res = await fetch(`${otariBaseUrl()}/end-users`, {
    headers: { Authorization: `Bearer ${process.env.OTARI_API_KEY}` },
  }).catch(() => null);
  if (!res || !res.ok) return null;
  const list = (await res.json().catch(() => [])) as Array<{
    external_id?: string;
    spend?: number;
    current_requests?: number;
    blocked?: boolean;
    next_budget_reset_at?: string;
  }>;
  const u = Array.isArray(list) ? list.find((e) => e.external_id === externalId) : null;
  if (!u) return null;
  return {
    spendUsd: Number(u.spend) || 0,
    requests: Number(u.current_requests) || 0,
    blocked: !!u.blocked,
    nextResetAt: u.next_budget_reset_at ?? null,
  };
}

/** Friendly message + HTTP status for the UI, so a budget/guardrail refusal never looks like a crash. */
export function describeOtariError(err: unknown): {
  message: string;
  status: number;
  kind: string;
} {
  if (err instanceof OtariError) {
    const friendly: Record<OtariErrorKind, string> = {
      not_configured: 'AI features are not set up on this server yet.',
      budget_exceeded:
        "You've used today's AI allowance. It resets automatically — try again later.",
      insufficient_funds: 'The AI workspace is out of credit right now.',
      guardrail_violation: 'That request was blocked by a safety guardrail.',
      rate_limited: 'The AI is busy. Please try again in a moment.',
      unavailable: 'The AI service is unavailable right now. Please try again.',
      bad_request: 'The AI could not process that request.',
    };
    const status =
      err.kind === 'budget_exceeded'
        ? 429
        : err.kind === 'guardrail_violation'
          ? 403
          : err.status >= 400
            ? err.status
            : 502;
    return { message: friendly[err.kind], status, kind: err.kind };
  }
  return { message: 'Something went wrong with the AI request.', status: 500, kind: 'unknown' };
}
