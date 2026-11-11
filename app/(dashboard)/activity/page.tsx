'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Activity, Bell, CheckCheck } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonList } from '@/components/ui/loading';
import { Money } from '@/components/ui/money';
import { formatDateRelative, cn } from '@/lib/utils';
import {
  categoryOf,
  groupByDay,
  headline,
  type ActivityCategory,
  type ActivityEntry,
} from '@/lib/activity';

const typeIcons: Record<string, string> = {
  expense_added: '💸',
  expense_updated: '✏️',
  expense_deleted: '🗑️',
  payment_recorded: '💰',
  group_created: '👥',
  member_added: '👋',
};

const FILTERS: Array<{ id: ActivityCategory; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'payments', label: 'Payments' },
  { id: 'groups', label: 'Groups' },
];

type Notification = {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
};

const IMPACT_STYLE = {
  lent: { label: 'you lent', className: 'text-brand-600' },
  borrowed: { label: 'you owe', className: 'text-red-500' },
  paid: { label: 'you paid', className: 'text-gray-600' },
  received: { label: 'you received', className: 'text-brand-600' },
} as const;

export default function ActivityPage() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const viewerId = session?.user?.id;
  const [filter, setFilter] = useState<ActivityCategory>('all');

  const { data: activities = [], isLoading } = useQuery<ActivityEntry[]>({
    queryKey: ['activity'],
    queryFn: () => fetch('/api/activity?limit=100').then((r) => r.json()),
  });

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: () => fetch('/api/notifications').then((r) => r.json()),
  });

  const markAllRead = useMutation({
    mutationFn: () =>
      fetch('/api/notifications?markAllRead=true', { method: 'PATCH' }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });

  const list = Array.isArray(notifications) ? notifications : [];
  const unreadCount = list.filter((n) => !n.read).length;

  // Mark as read a moment after opening, but keep them listed (read ones just turn muted)
  useEffect(() => {
    if (unreadCount === 0) return;
    const t = setTimeout(() => markAllRead.mutate(), 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadCount > 0]);

  const visible = (Array.isArray(activities) ? activities : []).filter(
    (a) => filter === 'all' || categoryOf(a.type) === filter,
  );
  const days = groupByDay(visible);

  return (
    <div>
      <Header title="Activity" />
      <div className="mx-auto max-w-3xl px-4 py-6 lg:px-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="page-title hidden lg:block">Activity</h1>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              className="btn btn-ghost btn-sm ml-auto gap-2 text-brand-600"
            >
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </button>
          )}
        </div>

        {/* Notifications: recent messages addressed to you */}
        {list.length > 0 && (
          <section className="mb-8" data-testid="notifications">
            <div className="mb-3 flex items-center gap-2">
              <Bell className="h-4 w-4 text-brand-500" />
              <h2 className="text-sm font-semibold text-gray-700">Notifications</h2>
              {unreadCount > 0 && <span className="badge badge-green">{unreadCount} new</span>}
            </div>
            <div className="space-y-2">
              {list.slice(0, 8).map((n) => (
                <div
                  key={n.id}
                  className={cn('card p-4', n.read ? 'opacity-70' : 'border-l-4 border-brand-500')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{n.title}</div>
                      <div className="mt-0.5 text-sm text-gray-600">{n.message}</div>
                    </div>
                    <div className="shrink-0 text-xs text-gray-400">
                      {formatDateRelative(n.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Activity feed */}
        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-gray-700">Everything that happened</h2>
            <div className="flex gap-1.5" role="tablist" aria-label="Filter activity">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  role="tab"
                  aria-selected={filter === f.id}
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-all',
                    filter === f.id
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <SkeletonList count={5} />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={<Activity className="h-8 w-8" />}
              title={filter === 'all' ? 'No activity yet' : `No ${filter} activity`}
              description="Expenses, payments and group changes involving you will appear here"
            />
          ) : (
            <div className="space-y-6" data-testid="activity-feed">
              {days.map((day) => (
                <div key={day.label}>
                  <h3 className="mb-2 text-xs font-semibold tracking-wide text-gray-400 uppercase">
                    {day.label}
                  </h3>
                  <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-100 bg-white">
                    {day.items.map((a) => {
                      const h = headline(a, viewerId);
                      const impact = a.impact ? IMPACT_STYLE[a.impact.kind] : null;
                      return (
                        <div
                          key={a.id}
                          className="flex items-start gap-3 p-3.5"
                          data-testid="activity-item"
                        >
                          <div className="relative shrink-0">
                            <Avatar
                              src={a.user.avatar}
                              name={a.user.name}
                              id={a.user.id}
                              size="md"
                            />
                            <span className="absolute -right-1 -bottom-1 text-sm">
                              {typeIcons[a.type] ?? '📋'}
                            </span>
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-gray-800">
                              <span className="font-semibold text-gray-900">{h.actor}</span>{' '}
                              {h.verb}
                              {h.subject && (
                                <>
                                  {' '}
                                  {a.expense ? (
                                    <Link
                                      href={`/expenses/${a.expense.id}`}
                                      className="font-semibold text-gray-900 hover:text-brand-700"
                                    >
                                      “{h.subject}”
                                    </Link>
                                  ) : (
                                    <span className="font-semibold text-gray-900">
                                      “{h.subject}”
                                    </span>
                                  )}
                                </>
                              )}
                              {h.amount && (
                                <>
                                  {' '}
                                  <Money
                                    amount={h.amount.value}
                                    currency={h.amount.currency}
                                    className="text-gray-500"
                                  />
                                </>
                              )}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-gray-400">
                              {a.group && (
                                <Link
                                  href={`/groups/${a.group.id}`}
                                  className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600 hover:bg-gray-200"
                                >
                                  {a.group.name}
                                </Link>
                              )}
                              <span>{formatDateRelative(a.createdAt)}</span>
                            </div>
                          </div>

                          {a.impact && impact && (
                            <div className="shrink-0 text-right">
                              <div className={cn('text-[11px] font-medium', impact.className)}>
                                {impact.label}
                              </div>
                              <Money
                                amount={a.impact.amount}
                                currency={a.impact.currency}
                                className={cn('text-sm font-semibold', impact.className)}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
