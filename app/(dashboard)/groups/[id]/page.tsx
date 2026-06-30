'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Plus, Settings2, UserPlus, ArrowUpRight, Download, Trash2 } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Avatar, AvatarGroup } from '@/components/ui/avatar';
import { Modal, ConfirmModal } from '@/components/ui/modal';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonList } from '@/components/ui/loading';
import { Dropdown } from '@/components/ui/dropdown';
import { formatCurrency, formatDate, getCategoryEmoji, getGroupCategoryEmoji } from '@/lib/utils';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [addMemberEmail, setAddMemberEmail] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<'expenses' | 'balances'>('expenses');

  const { data: group, isLoading } = useQuery({
    queryKey: ['group', id],
    queryFn: () => fetch(`/api/groups/${id}`).then((r) => r.json()),
  });

  const { data: balanceData } = useQuery({
    queryKey: ['balances', id],
    queryFn: () => fetch(`/api/balances?groupId=${id}`).then((r) => r.json()),
  });

  const addMemberMutation = useMutation({
    mutationFn: (email: string) =>
      fetch(`/api/groups/${id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      }).then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error);
        return json;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group', id] });
      toast({ type: 'success', title: 'Member added!' });
      setShowAddMember(false);
      setAddMemberEmail('');
    },
    onError: (err: Error) => toast({ type: 'error', title: 'Failed', description: err.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/groups/${id}`, { method: 'DELETE' }).then(async (r) => {
        if (!r.ok) throw new Error('Failed to delete group');
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      toast({ type: 'success', title: 'Group deleted' });
      router.push('/groups');
    },
    onError: (err: Error) => toast({ type: 'error', title: 'Error', description: err.message }),
  });

  if (isLoading)
    return (
      <div className="p-8">
        <SkeletonList count={5} />
      </div>
    );
  if (!group || group.error)
    return (
      <div className="p-8">
        <EmptyState title="Group not found" description="This group may have been deleted." />
      </div>
    );

  const isAdmin = group.members?.some(
    (m: { userId: string; role: string }) => m.userId === session?.user?.id && m.role === 'admin',
  );
  const simplified = balanceData?.simplified || [];
  const balances = balanceData?.balances || [];

  return (
    <div>
      <Header
        title={group.name}
        back="/groups"
        actions={
          <Dropdown
            trigger={
              <button className="rounded-lg p-2 hover:bg-gray-100">
                <Settings2 className="h-5 w-5 text-gray-600" />
              </button>
            }
            items={[
              {
                label: 'Add member',
                icon: <UserPlus className="h-4 w-4" />,
                onClick: () => setShowAddMember(true),
              },
              {
                label: 'Export CSV',
                icon: <Download className="h-4 w-4" />,
                onClick: () => window.open(`/api/export?groupId=${id}&type=csv`),
              },
              ...(isAdmin
                ? [
                    { separator: true },
                    {
                      label: 'Delete group',
                      icon: <Trash2 className="h-4 w-4" />,
                      onClick: () => setShowDeleteConfirm(true),
                      variant: 'danger' as const,
                    },
                  ]
                : []),
            ]}
          />
        }
      />

      <div className="mx-auto max-w-4xl px-4 py-6 lg:px-6">
        {/* Group header */}
        <div className="card mb-6 p-5">
          <div className="flex items-start gap-4">
            <div className="gradient-brand flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl">
              {getGroupCategoryEmoji(group.category)}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-bold text-gray-900">{group.name}</h1>
              {group.description && (
                <p className="mt-0.5 text-sm text-gray-500">{group.description}</p>
              )}
              <div className="mt-3 flex items-center gap-4">
                <AvatarGroup
                  users={
                    group.members?.map(
                      (m: { user: { id: string; name: string; avatar: string | null } }) => m.user,
                    ) || []
                  }
                  max={5}
                  size="xs"
                />
                <span className="text-xs text-gray-500">{group.members?.length} members</span>
                <span className="text-xs text-gray-500">{group._count?.expenses} expenses</span>
                <span className="text-xs font-medium text-gray-600">{group.currency}</span>
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <Link
              href={`/expenses/new?groupId=${id}`}
              className="btn btn-primary btn-md flex-1 gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Expense
            </Link>
            <button
              onClick={() => setShowAddMember(true)}
              className="btn btn-secondary btn-md gap-2"
            >
              <UserPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Member</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-xl bg-gray-100 p-1">
          <button
            onClick={() => setActiveTab('expenses')}
            className={cn(
              'flex-1 rounded-lg py-2 text-sm font-medium transition-all',
              activeTab === 'expenses'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700',
            )}
          >
            Expenses ({group._count?.expenses || 0})
          </button>
          <button
            onClick={() => setActiveTab('balances')}
            className={cn(
              'flex-1 rounded-lg py-2 text-sm font-medium transition-all',
              activeTab === 'balances'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700',
            )}
          >
            Balances
          </button>
        </div>

        {activeTab === 'expenses' ? (
          <div className="space-y-3">
            {(group.expenses || []).length === 0 ? (
              <EmptyState
                icon={<ArrowUpRight className="h-8 w-8" />}
                title="No expenses yet"
                description="Add the first expense for this group"
                action={
                  <Link href={`/expenses/new?groupId=${id}`} className="btn btn-primary btn-md">
                    Add expense
                  </Link>
                }
              />
            ) : (
              group.expenses.map(
                (expense: {
                  id: string;
                  description: string;
                  amount: number;
                  currency: string;
                  category: string;
                  date: string;
                  paidBy: { name: string };
                  splits: unknown[];
                }) => (
                  <Link key={expense.id} href={`/expenses/${expense.id}`}>
                    <div className="card cursor-pointer p-4 transition-colors hover:border-brand-300">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-xl">
                          {getCategoryEmoji(expense.category)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-gray-900">
                            {expense.description}
                          </div>
                          <div className="mt-0.5 text-xs text-gray-500">
                            {expense.paidBy.name} · {formatDate(expense.date)}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="font-semibold text-gray-900">
                            {formatCurrency(expense.amount, expense.currency)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {expense.splits.length} people
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ),
              )
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {simplified.length === 0 ? (
              <div className="card p-6 text-center">
                <div className="mb-3 text-4xl">🎉</div>
                <h3 className="font-semibold text-gray-900">All settled up!</h3>
                <p className="mt-1 text-sm text-gray-500">No outstanding balances in this group</p>
              </div>
            ) : (
              <>
                <div className="mb-3 text-sm font-medium text-gray-500">
                  Suggested payments to settle up:
                </div>
                {simplified.map(
                  (
                    s: {
                      from?: { id: string; name: string; avatar: string | null };
                      to?: { id: string; name: string };
                      amount: number;
                    },
                    i: number,
                  ) => (
                    <div key={i} className="card flex items-center gap-3 p-4">
                      <Avatar src={s.from?.avatar} name={s.from?.name || '?'} size="sm" />
                      <div className="flex-1">
                        <span className="font-medium text-gray-900">{s.from?.name}</span>
                        <span className="mx-2 text-gray-500">→</span>
                        <span className="font-medium text-gray-900">{s.to?.name}</span>
                      </div>
                      <div className="font-semibold text-brand-600">
                        {formatCurrency(s.amount, group.currency)}
                      </div>
                      {s.from?.id === session?.user?.id && (
                        <Link
                          href={`/expenses/new?type=payment&receiverId=${s.to?.id}&amount=${s.amount}&groupId=${id}`}
                          className="btn btn-primary btn-sm"
                        >
                          Pay
                        </Link>
                      )}
                    </div>
                  ),
                )}
              </>
            )}

            <div className="divider" />

            <div className="mb-3 text-sm font-medium text-gray-500">Individual balances:</div>
            {balances.map(
              (b: { user: { id: string; name: string; avatar: string | null }; net: number }) => (
                <div key={b.user.id} className="flex items-center gap-3">
                  <Avatar src={b.user.avatar} name={b.user.name} id={b.user.id} size="sm" />
                  <div className="flex-1 text-sm font-medium text-gray-900">{b.user.name}</div>
                  <div
                    className={cn(
                      'text-sm font-semibold',
                      b.net > 0.01
                        ? 'text-brand-600'
                        : b.net < -0.01
                          ? 'text-red-500'
                          : 'text-gray-500',
                    )}
                  >
                    {b.net > 0.01
                      ? `+${formatCurrency(b.net, group.currency)}`
                      : b.net < -0.01
                        ? `-${formatCurrency(Math.abs(b.net), group.currency)}`
                        : 'Settled'}
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </div>

      {/* Add member modal */}
      <Modal
        open={showAddMember}
        onClose={() => setShowAddMember(false)}
        title="Add member"
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="label">Email address</label>
            <input
              value={addMemberEmail}
              onChange={(e) => setAddMemberEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addMemberMutation.mutate(addMemberEmail)}
              type="email"
              className="input"
              placeholder="friend@example.com"
              autoFocus
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowAddMember(false)}
              className="btn btn-secondary btn-md flex-1"
            >
              Cancel
            </button>
            <button
              onClick={() => addMemberMutation.mutate(addMemberEmail)}
              disabled={!addMemberEmail || addMemberMutation.isPending}
              className="btn btn-primary btn-md flex-1"
            >
              Add Member
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete group?"
        description="This will permanently delete the group and all its expenses. This cannot be undone."
        confirmLabel="Delete Group"
        confirmVariant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
