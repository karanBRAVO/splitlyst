'use client';

import { Cpu, ShieldCheck, ShieldAlert, Wrench, Repeat, Coins } from 'lucide-react';
import type { OtariInspector } from '@/lib/otari';

/** Shows which Otari features handled a request, so every AI answer is auditable. */
export function OtariInspectorPanel({ inspectors }: { inspectors: Array<OtariInspector | null> }) {
  const shown = inspectors.filter((i): i is OtariInspector => !!i);
  if (shown.length === 0) return null;
  return (
    <div data-testid="otari-inspector" className="space-y-2">
      <div className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
        What happened (Otari)
      </div>
      {shown.map((i) => (
        <InspectorRow key={i.role} inspector={i} />
      ))}
    </div>
  );
}

function InspectorRow({ inspector }: { inspector: OtariInspector }) {
  const flagged = inspector.guardrails?.some((g) => g.valid === false);
  const tools = inspector.toolCalls.map((t) => String(t.type ?? 'tool'));

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
      <div className="flex flex-wrap gap-2">
        <span
          className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1"
          data-testid={`inspector-model-${inspector.role}`}
        >
          <Cpu className="h-3 w-3" /> {inspector.model ?? 'unknown model'}
          <span className="text-gray-400">({inspector.role})</span>
        </span>
        {inspector.fallback && (
          <span
            data-testid={`inspector-fallback-${inspector.role}`}
            className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-amber-800"
          >
            <Repeat className="h-3 w-3" /> backup model used
          </span>
        )}
        {tools.map((t, i) => (
          <span key={i} className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1">
            <Wrench className="h-3 w-3" /> {t}
          </span>
        ))}
        {inspector.guardrails && (
          <span
            data-testid={`inspector-guardrail-${inspector.role}`}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${flagged ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}
          >
            {flagged ? <ShieldAlert className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
            guardrail {flagged ? 'flagged' : 'passed'}
          </span>
        )}
        {inspector.usage && (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1"
            data-testid={`inspector-usage-${inspector.role}`}
          >
            <Coins className="h-3 w-3" /> {inspector.usage.totalTokens} tokens
            {inspector.usage.costUsd !== null && ` · $${inspector.usage.costUsd.toFixed(5)}`}
          </span>
        )}
        {inspector.endUserBudget && (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1"
            title={inspector.endUserBudget}
          >
            per-user budget on
          </span>
        )}
      </div>
    </div>
  );
}
