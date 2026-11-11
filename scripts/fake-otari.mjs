// A tiny fake of the Otari gateway for browser tests: deterministic, free, and able to simulate
// failures. Markers in the user's text trigger behaviours:
//   [budget] -> 403 budget_exceeded   [down] -> 503   [fallback] -> backup model answered
//   [junk]   -> reply that is not JSON  [guard] / "ignore all previous instructions" -> 403
//   guardrail_violation (only when the request names a guardrail, like the real gateway)
// Verifier (requests that declare otari_code_execution) also understands:
//   [nocode] -> answers without running code   [wrong] -> a deliberately wrong split
import http from 'node:http';

const PORT = Number(process.env.FAKE_OTARI_PORT || 3199);
const spend = new Map(); // external user id -> spend
const requests = new Map();
let last = null;
const lastBy = { reader: null, verifier: null, trip: null }; // last request per kind

function parseExpense(text) {
  const amount = Number((/(\d+(?:\.\d+)?)/.exec(text) || [])[1] || 0);
  const description =
    (text.split(/\d/)[0] || 'Expense').replace(/\b(for|of)\s*$/i, '').trim() || 'Expense';
  const withPart = /\bwith\s+(.+?)(?:,|\.|$|\bI paid\b)/i.exec(text);
  const participants = withPart
    ? withPart[1]
        .split(/,|\band\b/i)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  let paidBy = 'me';
  const named = /\b([A-Z][a-z]+)\s+paid\b/.exec(text);
  if (named) paidBy = named[1];
  const category = /dinner|lunch|food/i.test(text) ? 'food' : 'general';
  return {
    description,
    amount,
    currency: 'INR',
    category,
    paidBy,
    participants,
    splitType: 'equal',
  };
}

// The split rules the verifier prompt describes
function computeShares(data) {
  const n = data.people.length;
  const round = (x) => Math.round(x * 100) / 100;
  if (data.splitType === 'percentage')
    return data.people.map((p) => ({
      person: p.person,
      amount: round((data.total * (p.percentage || 0)) / 100),
    }));
  if (data.splitType === 'custom')
    return data.people.map((p) => ({ person: p.person, amount: round(p.amount || 0) }));
  const base = Math.floor((data.total / n) * 100) / 100;
  const remainder = round(data.total - base * n);
  return data.people.map((p, i) => ({
    person: p.person,
    amount: round(base + (i === 0 ? remainder : 0)),
  }));
}

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  res.end(JSON.stringify(body));
};

http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    if (url.pathname === '/health') return send(res, 200, { ok: true });
    if (req.method === 'GET' && url.pathname === '/__last') {
      const kind = url.searchParams.get('kind');
      return send(res, 200, (kind && lastBy[kind]) || last || {});
    }
    if (req.method === 'POST' && url.pathname === '/__reset') {
      spend.clear();
      requests.clear();
      return send(res, 200, { ok: true });
    }

    if (!(req.headers.authorization || '').startsWith('Bearer otk_'))
      return send(res, 401, { detail: 'bad key' });

    if (req.method === 'GET' && url.pathname === '/api/v1/end-users') {
      return send(
        res,
        200,
        [...spend.entries()].map(([id, s]) => ({
          external_id: id,
          spend: s,
          current_requests: requests.get(id) || 0,
          blocked: false,
          next_budget_reset_at: new Date(Date.now() + 86_400_000).toISOString(),
        })),
      );
    }
    if (req.method === 'POST' && url.pathname === '/api/v1/chat/completions') {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        const body = JSON.parse(raw || '{}');
        last = body;
        const isVerifier = (body.tools || []).some((t) => t.type === 'otari_code_execution');
        const isTrip = (body.tools || []).some((t) => t.type === 'otari_web_search');
        lastBy[isTrip ? 'trip' : isVerifier ? 'verifier' : 'reader'] = body;
        const userMsg = [...(body.messages || [])].reverse().find((m) => m.role === 'user');
        const content = typeof userMsg?.content === 'string' ? userMsg.content : '';
        const text = (/<expense>([\s\S]*)<\/expense>/.exec(content) || [, content])[1];
        const marked = (m) => content.includes(m);

        if (marked('[budget]'))
          return send(res, 403, {
            detail: `End user '${body.user}' is over budget`,
            code: 'budget_exceeded',
            end_user: body.user,
          });
        // A request that names a guardrail gets prompt-injection screening, like the real gateway
        const guard = (body.guardrails || [])[0];
        const injection =
          /ignore (all )?(your |previous |prior )*instructions|reveal your system prompt/i.test(
            content,
          ) || marked('[guard]');
        const guardHeader = (valid) =>
          guard
            ? {
                'Otari-Guardrails': JSON.stringify([
                  {
                    profile: guard.profile,
                    mode: guard.mode || 'block',
                    valid,
                    score: valid ? 0.01 : 0.99,
                    status: 'evaluated',
                  },
                ]),
              }
            : {};
        if (guard && injection)
          // the real gateway nests the error and lists flagged profiles in the body (no header)
          return send(res, 403, {
            detail: {
              message: 'Request blocked by guardrail policy.',
              code: 'guardrail_violation',
              guardrails: [{ profile: guard.profile, explanation: null, score: 1 }],
            },
          });
        if (marked('[down]')) return send(res, 503, { detail: 'upstream down' });

        const cost = 0.0123;
        if (body.user) {
          spend.set(body.user, (spend.get(body.user) || 0) + cost);
          requests.set(body.user, (requests.get(body.user) || 0) + 1);
        }
        const fallback = marked('[fallback]');
        const model = fallback ? 'zai-org/GLM-4.7' : 'Qwen/Qwen3-30B-A3B-Instruct-2507';
        const hdrs = {
          'Otari-Model': model,
          'Otari-Fallback': fallback ? 'true' : 'false',
          'Otari-End-User-Budget': 'fake-budget',
        };
        const usage = {
          prompt_tokens: 60,
          completion_tokens: 25,
          total_tokens: 85,
          cost_usd: String(cost),
        };

        // Trip planner request: the researcher searches the web and estimates costs
        if ((body.tools || []).some((t) => t.type === 'otari_web_search')) {
          let trip = null;
          try {
            trip = JSON.parse((/<trip>([\s\S]*)<\/trip>/.exec(content) || [])[1]);
          } catch {}
          if (!trip) return send(res, 400, { detail: 'bad trip input' });
          const perPersonPerDay =
            { budget: 1500, 'mid-range': 3500, comfortable: 8000 }[trip.style] || 3500;
          const total = perPersonPerDay * trip.days * trip.people;
          const share = {
            Stay: 0.4,
            Food: 0.25,
            'Local transport': 0.15,
            Activities: 0.15,
            Other: 0.05,
          };
          const categories = Object.entries(share).map(([name, f]) => ({
            name,
            amount: Math.round(total * f * 100) / 100,
            note: `typical ${name.toLowerCase()} costs`,
          }));
          const researcher = fallback ? 'zai-org/GLM-4.7' : 'Qwen/Qwen3-235B-A22B-Instruct-2507';
          const reply = marked('[badjson]')
            ? 'I could not find enough information.'
            : JSON.stringify({
                // a deliberately wrong "total" the server must ignore: it recomputes from categories
                total: 1,
                summary: `Rough ${trip.style} costs for ${trip.people} people for ${trip.days} days.`,
                categories,
              });
          return send(
            res,
            200,
            {
              model: researcher,
              choices: [{ message: { role: 'assistant', content: reply } }],
              usage: { ...usage, cost_usd: '0.0105' },
              ...(marked('[nosearch]')
                ? {}
                : {
                    otari_tool_calls: [
                      {
                        id: 'otari_ws_fake',
                        type: 'web_search',
                        status: 'completed',
                        query: `typical travel costs ${trip.destination}`,
                        sources: [
                          {
                            url: 'https://example.com/travel-costs',
                            title: 'Typical travel costs 2026',
                          },
                          { url: 'https://example.org/where-to-stay', title: 'Where to stay' },
                          {
                            url: 'https://example.com/travel-costs',
                            title: 'Duplicate of the first',
                          },
                          { url: 'javascript:alert(1)', title: 'Hostile link' },
                          { url: 'not a url', title: 'Garbage' },
                        ],
                      },
                    ],
                  }),
            },
            { ...hdrs, 'Otari-Model': researcher, ...guardHeader(true) },
          );
        }

        // Verifier request: the planner computes the split with code
        if ((body.tools || []).some((t) => t.type === 'otari_code_execution')) {
          let data = null;
          try {
            data = JSON.parse((/<data>([\s\S]*)<\/data>/.exec(content) || [])[1]);
          } catch {}
          if (!data) return send(res, 400, { detail: 'bad verifier input' });
          let shares = computeShares(data);
          if (marked('[wrong]'))
            shares = shares.map((s, i) => (i === 0 ? { ...s, amount: s.amount + 1 } : s));
          const plannerModel = fallback ? 'zai-org/GLM-4.7' : 'Qwen/Qwen3-235B-A22B-Instruct-2507';
          return send(
            res,
            200,
            {
              model: plannerModel,
              choices: [
                {
                  message: {
                    role: 'assistant',
                    content: JSON.stringify({
                      total: shares.reduce((a, s) => a + s.amount, 0),
                      shares,
                    }),
                  },
                },
              ],
              usage: { ...usage, cost_usd: '0.0101' },
              ...(marked('[nocode]')
                ? {}
                : {
                    otari_tool_calls: [
                      {
                        id: 'otari_ci_fake',
                        type: 'code_execution',
                        status: 'completed',
                        code: 'compute(...)',
                        stdout: 'ok',
                        exit_code: 0,
                      },
                    ],
                  }),
            },
            { ...hdrs, 'Otari-Model': plannerModel },
          );
        }

        const reply = text.includes('[junk]')
          ? 'Sorry, I cannot do that.'
          : JSON.stringify(parseExpense(text));
        send(
          res,
          200,
          { model, choices: [{ message: { role: 'assistant', content: reply } }], usage },
          { ...hdrs, ...guardHeader(true) },
        );
      });
      return;
    }
    send(res, 404, { detail: 'not found' });
  })
  .listen(PORT, () => console.log(`fake otari on :${PORT}`));
