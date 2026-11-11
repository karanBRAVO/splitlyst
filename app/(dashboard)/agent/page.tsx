'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Sparkles, Check, X, AlertTriangle, ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Money } from '@/components/ui/money';
import { Spinner } from '@/components/ui/loading';
import { toast } from '@/components/ui/toaster';
import { OtariInspectorPanel } from '@/components/ai/otari-inspector';
import { getCategoryEmoji, formatDateRelative } from '@/lib/utils';
import type { OtariInspector } from '@/lib/otari';

type Proposal = {
  draft: {
    description: string;
    amount: number;
    currency: string;
    category: string;
    splitType: 'equal' | 'percentage' | 'custom';
    groupId: string | null;
    paidById: string;
    paidByName: string;
    participantIds: string[];
    splits: Array<{ userId: string; amount?: number; percentage?: number }>;
    shares: Array<{ userId: string; name: string; amount: number }>;
    unmatched: string[];
  };
  inspector: OtariInspector;
};

type Verification = {
  status: 'verified' | 'mismatch' | 'unverified' | 'unavailable';
  codeRan?: boolean;
  mismatches?: Array<{ person: number; expected: number; actual: number | null }>;
  inspector?: OtariInspector;
  message?: string;
};

type ApiError = Error & { kind?: string; inspector?: OtariInspector | null };

const EXAMPLES = [
  'Dinner 3200 with Priya and Amit, I paid',
  'Cab 450, Rahul paid, split with me',
  'Groceries 1800 shared equally with everyone',
];

export default function AgentPage() {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [groupId, setGroupId] = useState('');
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [lastInspector, setLastInspector] = useState<OtariInspector | null>(null);
  const [plannerInspector, setPlannerInspector] = useState<OtariInspector | null>(null);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [error, setError] = useState<{ message: string; kind?: string } | null>(null);

  const { data: status } = useQuery({
    queryKey: ['agent-status'],
    queryFn: () => fetch('/api/agent/status').then((r) => r.json()),
    refetchInterval: 30_000,
  });
  const { data: groups = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['groups', false],
    queryFn: () => fetch('/api/groups?archived=false').then((r) => r.json()),
  });

  const propose = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/agent/propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, groupId: groupId || null }),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) {
        const err = new Error(json.error || 'The agent could not help with that.') as ApiError;
        err.kind = json.kind;
        err.inspector = json.inspector ?? null;
        throw err;
      }
      return json as Proposal;
    },
    onMutate: () => {
      setError(null);
      setProposal(null);
      setVerification(null);
      setPlannerInspector(null);
    },
    onSuccess: (p) => {
      setProposal(p);
      setLastInspector(p.inspector);
    },
    onError: (err: ApiError) => {
      setError({ message: err.message, kind: err.kind });
      setLastInspector(err.inspector ?? null);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['agent-status'] }),
  });

  // Second step: a stronger model re-computes the split with real code. Never blocks confirming.
  const verify = useMutation({
    mutationFn: async (d: Proposal['draft']) => {
      const r = await fetch('/api/agent/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: d.description,
          amount: d.amount,
          currency: d.currency,
          splitType: d.splitType,
          people: d.shares.map((s) => {
            const explicit = d.splits.find((x) => x.userId === s.userId);
            return {
              name: s.name,
              ...(d.splitType === 'percentage' ? { percentage: explicit?.percentage } : {}),
              ...(d.splitType === 'custom' ? { amount: explicit?.amount } : {}),
            };
          }),
        }),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(json.error || 'Could not run the check');
      return json as Verification;
    },
    onSuccess: (v) => {
      setVerification(v);
      setPlannerInspector(v.inspector ?? null);
      queryClient.invalidateQueries({ queryKey: ['agent-status'] });
    },
    onError: () => setVerification({ status: 'unavailable' }),
  });

  // Run the check as soon as there is a proposal (the proposal itself shows immediately)
  useEffect(() => {
    if (proposal) verify.mutate(proposal.draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposal]);

  const confirm = useMutation({
    mutationFn: async (d: Proposal['draft']) => {
      const body: Record<string, unknown> = {
        description: d.description,
        amount: d.amount,
        currency: d.currency,
        category: d.category,
        groupId: d.groupId,
        paidById: d.paidById,
        splitType: d.splitType,
        participants: d.participantIds,
        date: new Date().toISOString(),
      };
      if (d.splitType === 'percentage')
        body.splits = d.splits.map((s) => ({ userId: s.userId, percentage: s.percentage }));
      if (d.splitType === 'custom')
        body.splits = d.splits.map((s) => ({ userId: s.userId, amount: s.amount }));
      const r = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(json.error || 'Could not save the expense');
      return json as { id: string };
    },
    onSuccess: (expense) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['balances'] });
      queryClient.invalidateQueries({ queryKey: ['activity'] });
      toast({ type: 'success', title: 'Expense added!' });
      setProposal(null);
      setText('');
      setSavedId(expense.id);
    },
    onError: (err: Error) => toast({ type: 'error', title: 'Failed', description: err.message }),
  });
  const [savedId, setSavedId] = useState<string | null>(null);

  const allowance = status?.allowance as
    | {
        limitUsd: number;
        spentUsd: number;
        remainingUsd: number;
        blocked: boolean;
        resetsAt: string | null;
      }
    | undefined;
  const pct = allowance ? Math.min(100, (allowance.spentUsd / allowance.limitUsd) * 100) : 0;

  if (status && status.enabled === false) {
    return (
      <div>
        <Header title="AI Agent" />
        <div className="mx-auto max-w-2xl px-4 py-10 text-center text-gray-500">
          AI features are not set up on this server yet.
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="AI Agent" />
      <div className="mx-auto max-w-2xl space-y-5 px-4 py-6 lg:px-6">
        <div>
          <h1 className="page-title hidden items-center gap-2 lg:flex">
            <Sparkles className="h-6 w-6 text-brand-500" /> AI Agent
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Describe an expense in plain English. The agent proposes it — nothing is saved until you
            confirm.
          </p>
        </div>

        {allowance && (
          <div className="card p-4" data-testid="allowance">
            <div className="mb-1.5 flex items-center justify-between text-xs text-gray-500">
              <span>Your daily AI allowance</span>
              <span data-testid="allowance-text">
                ${allowance.spentUsd.toFixed(4)} of ${allowance.limitUsd.toFixed(2)} used
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full ${pct >= 90 ? 'bg-red-500' : 'bg-brand-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {allowance.resetsAt && (
              <div className="mt-1 text-[11px] text-gray-400">
                Resets {formatDateRelative(allowance.resetsAt)}
              </div>
            )}
          </div>
        )}

        <div className="card space-y-3 p-4">
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="input"
            data-testid="agent-group"
          >
            <option value="">Personal / friends (no group)</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="input resize-none"
            rows={3}
            placeholder="e.g. Dinner 3200 with Priya and Amit, I paid"
            data-testid="agent-text"
          />
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setText(ex)}
                className="rounded-full border border-gray-200 px-2.5 py-1 text-xs text-gray-500 hover:border-gray-300"
              >
                {ex}
              </button>
            ))}
          </div>
          <button
            onClick={() => propose.mutate()}
            disabled={text.trim().length < 3 || propose.isPending}
            className="btn btn-primary btn-md w-full gap-2"
            data-testid="agent-propose"
          >
            {propose.isPending ? <Spinner className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            {propose.isPending ? 'Thinking…' : 'Propose expense'}
          </button>
        </div>

        {error && (
          <div
            role="alert"
            data-testid="agent-error"
            data-kind={error.kind}
            className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error.message}</span>
          </div>
        )}

        {savedId && !proposal && (
          <div
            className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800"
            data-testid="agent-saved"
          >
            Saved.{' '}
            <Link href={`/expenses/${savedId}`} className="font-medium underline">
              View the expense
            </Link>
          </div>
        )}

        {proposal && (
          <div className="card space-y-4 p-5" data-testid="agent-proposal">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
                  Proposed expense
                </div>
                <div className="mt-1 text-lg font-semibold text-gray-900">
                  {getCategoryEmoji(proposal.draft.category)} {proposal.draft.description}
                </div>
                <div className="text-sm text-gray-500">Paid by {proposal.draft.paidByName}</div>
              </div>
              <Money
                amount={proposal.draft.amount}
                currency={proposal.draft.currency}
                className="text-2xl font-bold text-gray-900"
              />
            </div>

            <div className="divide-y divide-gray-100 rounded-xl border border-gray-100">
              {proposal.draft.shares.map((s) => (
                <div key={s.userId} className="flex justify-between px-3 py-2 text-sm">
                  <span>{s.name}</span>
                  <Money
                    amount={s.amount}
                    currency={proposal.draft.currency}
                    showConverted={false}
                  />
                </div>
              ))}
            </div>

            <VerifyBadge pending={verify.isPending} verification={verification} />

            {proposal.draft.unmatched.length > 0 && (
              <div
                className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800"
                data-testid="agent-unmatched"
              >
                I couldn&apos;t find: {proposal.draft.unmatched.join(', ')}. They were left out —
                check the split before confirming.
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setProposal(null);
                }}
                className="btn btn-secondary btn-md flex-1 gap-1.5"
                data-testid="agent-discard"
              >
                <X className="h-4 w-4" /> Discard
              </button>
              <button
                onClick={() => confirm.mutate(proposal.draft)}
                disabled={confirm.isPending}
                className="btn btn-primary btn-md flex-1 gap-1.5"
                data-testid="agent-confirm"
              >
                {confirm.isPending ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Confirm &amp; add
              </button>
            </div>
          </div>
        )}

        <OtariInspectorPanel inspectors={[lastInspector, plannerInspector]} />
      </div>
    </div>
  );
}

function VerifyBadge({
  pending,
  verification,
}: {
  pending: boolean;
  verification: Verification | null;
}) {
  if (pending || !verification) {
    return (
      <div
        data-testid="agent-verify"
        data-status="checking"
        className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Double-checking the maths with real code…
      </div>
    );
  }
  const map = {
    verified: {
      cls: 'bg-green-50 text-green-700',
      icon: <ShieldCheck className="h-3.5 w-3.5" />,
      text: 'Verified: a second model ran code and got the same split.',
    },
    mismatch: {
      cls: 'bg-amber-50 text-amber-800',
      icon: <ShieldAlert className="h-3.5 w-3.5" />,
      text: 'The code check disagreed with the numbers above. The exact server maths is what gets saved — please eyeball the split.',
    },
    unverified: {
      cls: 'bg-gray-50 text-gray-500',
      icon: <ShieldAlert className="h-3.5 w-3.5" />,
      text: "Couldn't confirm with code this time. The numbers above are computed exactly by the server.",
    },
    unavailable: {
      cls: 'bg-gray-50 text-gray-500',
      icon: <ShieldAlert className="h-3.5 w-3.5" />,
      text: 'The code check is unavailable right now. The numbers above are computed exactly by the server.',
    },
  } as const;
  const v = map[verification.status];
  return (
    <div
      data-testid="agent-verify"
      data-status={verification.status}
      className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${v.cls}`}
    >
      <span className="mt-0.5">{v.icon}</span>
      <span>{v.text}</span>
    </div>
  );
}
