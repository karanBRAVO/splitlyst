'use client';

import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  Users,
  PlusCircle,
  ArrowRight,
  Receipt,
  CreditCard,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Avatar } from '@/components/ui/avatar';
import { SkeletonList } from '@/components/ui/loading';
import { EmptyState } from '@/components/ui/empty-state';
import { formatCurrency, formatDateRelative } from '@/lib/utils';
import { cn } from '@/lib/utils';

export default function DashboardPage() {
  const { data: session } = useSession();
  const user = session?.user;

  const { data: balanceData, isLoading: balancesLoading } = useQuery({
    queryKey: ['balances'],
    queryFn: () => fetch('/api/balances').then((r) => r.json()),
  });

  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: ['activity'],
    queryFn: () => fetch('/api/activity?limit=10').then((r) => r.json()),
  });

  const { data: groupsData } = useQuery({
    queryKey: ['groups'],
    queryFn: () => fetch('/api/groups').then((r) => r.json()),
  });

  const balances = balanceData?.balances || [];
  const totalOwed = balanceData?.totalOwed || 0;
  const totalOwes = balanceData?.totalOwes || 0;
  const net = balanceData?.net || 0;
  const activities = activityData || [];
  const groups = groupsData || [];

  return (
    <div>
      <Header />
      <div className="mx-auto max-w-4xl px-4 py-6 lg:px-6">
        {/* Welcome */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Hi, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="mt-0.5 text-sm text-gray-500">Here&apos;s your expense summary</p>
        </div>

        {/* Balance Summary */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-medium text-gray-500">Total owed to you</div>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50">
                <TrendingUp className="h-4 w-4 text-brand-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-brand-600">
              {formatCurrency(totalOwed, user?.currency)}
            </div>
          </div>

          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-medium text-gray-500">You owe others</div>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50">
                <TrendingDown className="h-4 w-4 text-red-500" />
              </div>
            </div>
            <div className="text-2xl font-bold text-red-500">
              {formatCurrency(totalOwes, user?.currency)}
            </div>
          </div>

          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-medium text-gray-500">Net balance</div>
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg',
                  net >= 0 ? 'bg-brand-50' : 'bg-red-50',
                )}
              >
                <CreditCard
                  className={cn('h-4 w-4', net >= 0 ? 'text-brand-600' : 'text-red-500')}
                />
              </div>
            </div>
            <div className={cn('text-2xl font-bold', net >= 0 ? 'text-brand-600' : 'text-red-500')}>
              {net >= 0 ? '+' : ''}
              {formatCurrency(net, user?.currency)}
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          <Link
            href="/expenses/new"
            className="card flex flex-col items-center gap-2 p-4 text-center transition-colors hover:border-brand-300 hover:bg-brand-50/30"
          >
            <div className="gradient-brand flex h-10 w-10 items-center justify-center rounded-xl">
              <PlusCircle className="h-5 w-5 text-white" />
            </div>
            <span className="text-xs font-medium text-gray-700">Add Expense</span>
          </Link>
          <Link
            href="/groups/new"
            className="card flex flex-col items-center gap-2 p-4 text-center transition-colors hover:border-brand-300 hover:bg-brand-50/30"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-gray-700">New Group</span>
          </Link>
          <Link
            href="/expenses"
            className="card flex flex-col items-center gap-2 p-4 text-center transition-colors hover:border-brand-300 hover:bg-brand-50/30"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100">
              <Receipt className="h-5 w-5 text-purple-600" />
            </div>
            <span className="text-xs font-medium text-gray-700">All Expenses</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Balances */}
          <div className="card">
            <div className="flex items-center justify-between border-b border-gray-100 p-4">
              <h2 className="font-semibold text-gray-900">Balances</h2>
              <Link
                href="/friends"
                className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="p-4">
              {balancesLoading ? (
                <SkeletonList count={3} />
              ) : balances.length === 0 ? (
                <EmptyState
                  title="All settled up!"
                  description="No outstanding balances"
                  className="py-8"
                />
              ) : (
                <div className="space-y-3">
                  {balances
                    .slice(0, 5)
                    .map(
                      (b: {
                        user: { id: string; name: string; avatar: string | null };
                        net: number;
                      }) => (
                        <div key={b.user.id} className="flex items-center gap-3">
                          <Avatar src={b.user.avatar} name={b.user.name} id={b.user.id} size="sm" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-gray-900">
                              {b.user.name}
                            </div>
                          </div>
                          <div
                            className={cn(
                              'text-sm font-semibold',
                              b.net > 0 ? 'text-brand-600' : 'text-red-500',
                            )}
                          >
                            {b.net > 0 ? 'owes you' : 'you owe'}
                            <br />
                            <span className="text-base">
                              {formatCurrency(Math.abs(b.net), user?.currency)}
                            </span>
                          </div>
                        </div>
                      ),
                    )}
                </div>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="card">
            <div className="flex items-center justify-between border-b border-gray-100 p-4">
              <h2 className="font-semibold text-gray-900">Recent Activity</h2>
              <Link
                href="/activity"
                className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="p-4">
              {activityLoading ? (
                <SkeletonList count={3} />
              ) : activities.length === 0 ? (
                <EmptyState
                  title="No activity yet"
                  description="Add an expense to get started"
                  className="py-8"
                />
              ) : (
                <div className="space-y-4">
                  {activities
                    .slice(0, 6)
                    .map(
                      (a: {
                        id: string;
                        description: string;
                        createdAt: string;
                        user: { id: string; name: string; avatar: string | null };
                      }) => (
                        <div key={a.id} className="flex items-start gap-3">
                          <Avatar src={a.user.avatar} name={a.user.name} id={a.user.id} size="xs" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm leading-snug text-gray-700">{a.description}</p>
                            <p className="mt-0.5 text-xs text-gray-400">
                              {formatDateRelative(a.createdAt)}
                            </p>
                          </div>
                        </div>
                      ),
                    )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Groups */}
        {groups.length > 0 && (
          <div className="mt-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Your Groups</h2>
              <Link
                href="/groups"
                className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {groups
                .slice(0, 3)
                .map(
                  (g: {
                    id: string;
                    name: string;
                    avatar: string | null;
                    members?: unknown[];
                    _count?: { expenses: number };
                  }) => (
                    <Link
                      key={g.id}
                      href={`/groups/${g.id}`}
                      className="card p-4 transition-colors hover:border-brand-300"
                    >
                      <div className="flex items-center gap-3">
                        <div className="gradient-brand flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg">
                          {g.avatar ? (
                            <img
                              src={g.avatar}
                              alt={g.name}
                              className="h-full w-full rounded-xl object-cover"
                            />
                          ) : (
                            '👥'
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-gray-900">{g.name}</div>
                          <div className="text-xs text-gray-500">
                            {g.members?.length || 0} members · {g._count?.expenses || 0} expenses
                          </div>
                        </div>
                      </div>
                    </Link>
                  ),
                )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
