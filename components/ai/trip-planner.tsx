'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { AlertTriangle, ExternalLink, Globe, Loader2, Users } from 'lucide-react';
import { OtariInspectorPanel } from '@/components/ai/otari-inspector';
import { CURRENCIES } from '@/types';
import { formatCurrency } from '@/lib/utils';
import type { OtariInspector } from '@/lib/otari';
import type { Source, TripEstimate } from '@/lib/ai-trip';

type Result = {
  estimate: TripEstimate;
  sources: Source[];
  usedWebSearch: boolean;
  inspector: OtariInspector;
};
type ApiError = Error & { kind?: string; inspector?: OtariInspector | null };

const STYLES = [
  { value: 'budget', label: 'Budget' },
  { value: 'mid-range', label: 'Mid-range' },
  { value: 'comfortable', label: 'Comfortable' },
] as const;

export function TripPlanner() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [destination, setDestination] = useState('');
  const [days, setDays] = useState(3);
  const [people, setPeople] = useState(4);
  const [style, setStyle] = useState<(typeof STYLES)[number]['value']>('mid-range');
  const [currency, setCurrency] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [inspector, setInspector] = useState<OtariInspector | null>(null);
  const [error, setError] = useState<{ message: string; kind?: string } | null>(null);

  const cur = currency || session?.user?.currency || 'USD';

  const estimate = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/agent/trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination, days, people, style, currency: cur }),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) {
        const err = new Error(json.error || 'The planner could not help with that.') as ApiError;
        err.kind = json.kind;
        err.inspector = json.inspector ?? null;
        throw err;
      }
      return json as Result;
    },
    onMutate: () => {
      setError(null);
      setResult(null);
    },
    onSuccess: (r) => {
      setResult(r);
      setInspector(r.inspector);
    },
    onError: (err: ApiError) => {
      setError({ message: err.message, kind: err.kind });
      setInspector(err.inspector ?? null);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['agent-status'] }),
  });

  const e = result?.estimate;
  const groupHref = e
    ? `/groups/new?${new URLSearchParams({ name: `${e.destination} trip`, category: 'trip', currency: e.currency })}`
    : '#';

  return (
    <div className="space-y-5" data-testid="trip-planner">
      <p className="text-sm text-gray-500">
        Tell the agent where you&apos;re going. It searches the live web for typical prices and
        shows an estimate with the pages it used. Nothing is saved.
      </p>

      <div className="card space-y-3 p-4">
        <input
          value={destination}
          onChange={(ev) => setDestination(ev.target.value)}
          className="input"
          placeholder="Destination, e.g. Goa, India"
          data-testid="trip-destination"
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="text-xs text-gray-500">
            Days
            <input
              type="number"
              min={1}
              max={60}
              value={days}
              onChange={(ev) => setDays(Number(ev.target.value))}
              className="input mt-1"
              data-testid="trip-days"
            />
          </label>
          <label className="text-xs text-gray-500">
            People
            <input
              type="number"
              min={1}
              max={30}
              value={people}
              onChange={(ev) => setPeople(Number(ev.target.value))}
              className="input mt-1"
              data-testid="trip-people"
            />
          </label>
          <label className="text-xs text-gray-500">
            Style
            <select
              value={style}
              onChange={(ev) => setStyle(ev.target.value as typeof style)}
              className="input mt-1"
              data-testid="trip-style"
            >
              {STYLES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-gray-500">
            Currency
            <select
              value={cur}
              onChange={(ev) => setCurrency(ev.target.value)}
              className="input mt-1"
              data-testid="trip-currency"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          onClick={() => estimate.mutate()}
          disabled={destination.trim().length < 2 || estimate.isPending}
          className="btn btn-primary btn-md w-full gap-2"
          data-testid="trip-estimate"
        >
          {estimate.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Globe className="h-4 w-4" />
          )}
          {estimate.isPending
            ? 'Searching the web… (can take up to a minute)'
            : 'Estimate with live web data'}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          data-testid="trip-error"
          data-kind={error.kind}
          className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error.message}</span>
        </div>
      )}

      {result && e && (
        <div className="card space-y-4 p-5" data-testid="trip-result">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
                Estimated budget
              </div>
              <div className="mt-1 text-lg font-semibold text-gray-900">{e.destination}</div>
              <div className="text-sm text-gray-500">
                {e.days} days · {e.people} people
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900" data-testid="trip-total">
                {formatCurrency(e.total, e.currency)}
              </div>
              <div className="text-xs text-gray-500" data-testid="trip-per-person">
                {formatCurrency(e.perPerson, e.currency)} per person ·{' '}
                {formatCurrency(e.perPersonPerDay, e.currency)} / day
              </div>
            </div>
          </div>

          {e.summary && <p className="text-sm text-gray-600">{e.summary}</p>}

          <div className="divide-y divide-gray-100 rounded-xl border border-gray-100">
            {e.categories.map((c) => (
              <div key={c.name} className="px-3 py-2 text-sm" data-testid="trip-category">
                <div className="flex justify-between">
                  <span className="font-medium">{c.name}</span>
                  <span>{formatCurrency(c.amount, e.currency)}</span>
                </div>
                {c.note && <div className="text-xs text-gray-400">{c.note}</div>}
              </div>
            ))}
          </div>

          {result.usedWebSearch && result.sources.length > 0 ? (
            <div data-testid="trip-sources">
              <div className="mb-1 text-xs font-semibold tracking-wide text-gray-400 uppercase">
                Based on {result.sources.length} web pages
              </div>
              <ul className="space-y-1 text-sm">
                {result.sources.map((s) => (
                  <li key={s.url}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex items-center gap-1 text-brand-700 hover:underline"
                    >
                      {s.title} <ExternalLink className="h-3 w-3" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div
              data-testid="trip-no-sources"
              className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800"
            >
              No web pages were used for this one, so treat it as a rough guess, not live data.
            </div>
          )}

          <p className="text-[11px] text-gray-400">
            Estimates only — prices change. Check before booking.
          </p>

          <Link
            href={groupHref}
            className="btn btn-primary btn-md w-full gap-2"
            data-testid="trip-create-group"
          >
            <Users className="h-4 w-4" /> Create a group for this trip
          </Link>
        </div>
      )}

      <OtariInspectorPanel inspectors={[inspector]} />
    </div>
  );
}
