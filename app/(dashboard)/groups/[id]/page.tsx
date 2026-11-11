'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Plus,
  Settings2,
  UserPlus,
  ArrowUpRight,
  Download,
  Trash2,
  Link as LinkIcon,
  LogOut,
  Upload,
  Archive,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Avatar, AvatarGroup } from '@/components/ui/avatar';
import { Modal, ConfirmModal } from '@/components/ui/modal';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonList } from '@/components/ui/loading';
import { Dropdown } from '@/components/ui/dropdown';
import { formatCurrency, formatDate, getCategoryEmoji, getGroupCategoryEmoji } from '@/lib/utils';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { Money } from '@/components/ui/money';

type GroupExpense = {
  id: string;
  description: string;
  amount: number;
  currency: string;
  category: string;
  date: string;
  paidBy: { id: string; name: string };
  splits: unknown[];
};

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [addMemberEmail, setAddMemberEmail] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<'expenses' | 'balances'>('expenses');
  // The group endpoint returns the newest 50 expenses; the rest are fetched on demand
  const [moreExpenses, setMoreExpenses] = useState<GroupExpense[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [noMoreExpenses, setNoMoreExpenses] = useState(false);
  const [showDefaultSplit, setShowDefaultSplit] = useState(false);
  const [dsType, setDsType] = useState<'equal' | 'percentage' | 'shares'>('equal');
  const [dsValues, setDsValues] = useState<Record<string, number>>({});
  const [showImport, setShowImport] = useState(false);
  const [importCsv, setImportCsv] = useState('');
  const [importPreview, setImportPreview] = useState<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);

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

  // Newest 50 from the group endpoint + any pages fetched since (de-duplicated, newest first)
  const allExpenses: GroupExpense[] = [
    ...new Map(
      [...((group.expenses as GroupExpense[]) || []), ...moreExpenses].map((e) => [e.id, e]),
    ).values(),
  ];
  const canLoadMore = !noMoreExpenses && allExpenses.length < (group._count?.expenses ?? 0);

  const loadMoreExpenses = async () => {
    setLoadingMore(true);
    try {
      const cursor = allExpenses[allExpenses.length - 1]?.id;
      const r = await fetch(
        `/api/expenses?groupId=${id}&limit=100&view=list${cursor ? `&cursor=${cursor}` : ''}`,
      );
      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(json.error || 'Could not load more expenses');
      if (!json.expenses?.length) setNoMoreExpenses(true);
      setMoreExpenses((prev) => [...prev, ...json.expenses]);
    } catch (err) {
      toast({ type: 'error', title: (err as Error).message });
    } finally {
      setLoadingMore(false);
    }
  };

  const runImport = async (dryRun: boolean) => {
    setImportBusy(true);
    try {
      const r = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: id, csv: importCsv, dryRun }),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(json.error || `Import failed (${r.status})`);
      const skipped = json.skipped?.length ? ` (${json.skipped.length} skipped)` : '';
      if (dryRun) {
        setImportPreview(`${json.expenses} expenses and ${json.payments} payments found${skipped}`);
      } else {
        toast({
          type: 'success',
          title: 'Import complete',
          description: `${json.expenses} expenses, ${json.payments} payments${skipped}`,
        });
        setMoreExpenses([]);
        setNoMoreExpenses(false);
        queryClient.invalidateQueries({ queryKey: ['group', id] });
        queryClient.invalidateQueries({ queryKey: ['balances'] });
        setShowImport(false);
        setImportCsv('');
        setImportPreview(null);
      }
    } catch (err) {
      setImportPreview(null);
      toast({ type: 'error', title: 'Import failed', description: (err as Error).message });
    } finally {
      setImportBusy(false);
    }
  };

  const patchGroup = async (body: Record<string, unknown>) => {
    const r = await fetch(`/api/groups/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(json.error || 'Update failed');
    queryClient.invalidateQueries({ queryKey: ['group', id] });
    queryClient.invalidateQueries({ queryKey: ['balances', id] });
  };

  const toggleSimplify = async () => {
    try {
      await patchGroup({ simplifyDebts: group.simplifyDebts === false });
      toast({ type: 'success', title: 'Group settings updated' });
    } catch (err) {
      toast({ type: 'error', title: (err as Error).message });
    }
  };

  const openDefaultSplit = () => {
    const def = group.defaultSplit as {
      type: 'equal' | 'percentage' | 'shares';
      values?: Record<string, number>;
    } | null;
    setDsType(def?.type ?? 'equal');
    setDsValues(def?.values ?? {});
    setShowDefaultSplit(true);
  };

  const saveDefaultSplit = async () => {
    try {
      await patchGroup({
        defaultSplit: dsType === 'equal' ? null : { type: dsType, values: dsValues },
      });
      toast({ type: 'success', title: 'Default split saved' });
      setShowDefaultSplit(false);
    } catch (err) {
      toast({ type: 'error', title: (err as Error).message });
    }
  };

  const revokeInviteLink = async () => {
    const r = await fetch(`/api/groups/${id}/invite`, { method: 'DELETE' });
    if (!r.ok) {
      toast({ type: 'error', title: 'Could not revoke invite link' });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['group', id] });
    toast({ type: 'success', title: 'Invite link revoked' });
  };

  const toggleArchive = async () => {
    const r = await fetch(`/api/groups/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isArchived: !group.isArchived }),
    });
    if (!r.ok) {
      toast({ type: 'error', title: 'Could not update group' });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['group', id] });
    queryClient.invalidateQueries({ queryKey: ['groups'] });
    toast({ type: 'success', title: group.isArchived ? 'Group restored' : 'Group archived' });
    if (!group.isArchived) router.push('/groups');
  };

  const copyInviteLink = async () => {
    try {
      let code: string | undefined = group.inviteCode;
      if (!code) {
        const r = await fetch(`/api/groups/${id}/invite`, { method: 'POST' });
        const json = await r.json();
        if (!r.ok) throw new Error(json.error);
        code = json.inviteCode as string;
        queryClient.invalidateQueries({ queryKey: ['group', id] });
      }
      await navigator.clipboard.writeText(`${window.location.origin}/join/${code}`);
      toast({ type: 'success', title: 'Invite link copied' });
    } catch (err) {
      toast({
        type: 'error',
        title: 'Could not create invite link',
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const leaveGroup = async () => {
    if (!window.confirm('Leave this group? Your past expenses stay in the group history.')) return;
    const r = await fetch(`/api/groups/${id}/members`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: session?.user?.id }),
    });
    if (!r.ok) {
      const json = await r.json().catch(() => ({}));
      toast({ type: 'error', title: 'Failed to leave group', description: json.error });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['groups'] });
    router.push('/groups');
  };
  const balances = balanceData?.balances || [];

  return (
    <div>
      <Header
        title={group.name}
        back="/groups"
        actions={
          <Dropdown
            trigger={
              <button
                className="rounded-lg p-2 hover:bg-gray-100"
                data-testid="group-menu"
                aria-label="Group menu"
              >
                <Settings2 className="h-5 w-5 text-gray-600" />
              </button>
            }
            items={[
              {
                label: 'Add member',
                icon: <UserPlus className="h-4 w-4" />,
                onClick: () => setShowAddMember(true),
              },
              ...(isAdmin
                ? [
                    {
                      label: 'Copy invite link',
                      icon: <LinkIcon className="h-4 w-4" />,
                      onClick: copyInviteLink,
                    },
                    ...(group.inviteCode
                      ? [
                          {
                            label: 'Revoke invite link',
                            icon: <LinkIcon className="h-4 w-4" />,
                            onClick: revokeInviteLink,
                          },
                        ]
                      : []),
                    {
                      label:
                        group.simplifyDebts === false
                          ? 'Turn on simplify debts'
                          : 'Turn off simplify debts',
                      icon: <Settings2 className="h-4 w-4" />,
                      onClick: toggleSimplify,
                    },
                    {
                      label: 'Default split',
                      icon: <Settings2 className="h-4 w-4" />,
                      onClick: openDefaultSplit,
                    },
                    {
                      label: group.isArchived ? 'Unarchive group' : 'Archive group',
                      icon: <Archive className="h-4 w-4" />,
                      onClick: toggleArchive,
                    },
                  ]
                : []),
              {
                label: 'Import from Splitwise',
                icon: <Upload className="h-4 w-4" />,
                onClick: () => setShowImport(true),
              },
              {
                label: 'Export CSV',
                icon: <Download className="h-4 w-4" />,
                onClick: () => window.open(`/api/export?groupId=${id}&type=csv`),
              },
              { separator: true },
              {
                label: 'Leave group',
                icon: <LogOut className="h-4 w-4" />,
                onClick: leaveGroup,
                variant: 'danger' as const,
              },
              ...(isAdmin
                ? [
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
            {allExpenses.length === 0 ? (
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
              <>
                {allExpenses.map((expense) => (
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
                            <Money amount={expense.amount} currency={expense.currency} />
                          </div>
                          <div className="text-xs text-gray-500">
                            {expense.splits.length} people
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
                {canLoadMore && (
                  <button
                    onClick={loadMoreExpenses}
                    disabled={loadingMore}
                    className="btn btn-secondary btn-md w-full"
                    data-testid="load-more-expenses"
                  >
                    {loadingMore
                      ? 'Loading…'
                      : `Show more (${(group._count?.expenses ?? 0) - allExpenses.length} older)`}
                  </button>
                )}
              </>
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
                  {group.simplifyDebts === false
                    ? 'Who owes whom (debt simplification is off):'
                    : 'Suggested payments to settle up:'}
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
                          href={`/expenses/new?type=payment&receiverId=${s.to?.id}&amount=${s.amount.toFixed(2)}&groupId=${id}&currency=${group.currency}`}
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

      {/* Default split modal */}
      <Modal
        open={showDefaultSplit}
        onClose={() => setShowDefaultSplit(false)}
        title="Default split"
        size="sm"
      >
        <div className="space-y-4" data-testid="default-split-modal">
          <p className="text-sm text-gray-500">
            New expenses in this group start with this split (you can still change it per expense).
          </p>
          <select
            value={dsType}
            onChange={(e) => setDsType(e.target.value as typeof dsType)}
            className="input"
            data-testid="ds-type"
          >
            <option value="equal">Equal</option>
            <option value="percentage">Percentage</option>
            <option value="shares">Shares</option>
          </select>
          {dsType !== 'equal' &&
            group.members?.map((m: { user: { id: string; name: string } }) => (
              <div key={m.user.id} className="flex items-center gap-3">
                <span className="flex-1 text-sm">{m.user.name}</span>
                <input
                  type="number"
                  min="0"
                  value={dsValues[m.user.id] ?? (dsType === 'shares' ? 1 : 0)}
                  onChange={(e) =>
                    setDsValues({ ...dsValues, [m.user.id]: parseFloat(e.target.value) || 0 })
                  }
                  className="input w-24"
                  data-testid={`ds-${m.user.name}`}
                />
                <span className="w-4 text-xs text-gray-400">
                  {dsType === 'percentage' ? '%' : 'x'}
                </span>
              </div>
            ))}
          <div className="flex gap-3">
            <button
              onClick={() => setShowDefaultSplit(false)}
              className="btn btn-secondary btn-md flex-1"
            >
              Cancel
            </button>
            <button
              onClick={saveDefaultSplit}
              className="btn btn-primary btn-md flex-1"
              data-testid="ds-save"
            >
              Save
            </button>
          </div>
        </div>
      </Modal>

      {/* Import modal */}
      <Modal
        open={showImport}
        onClose={() => setShowImport(false)}
        title="Import from Splitwise"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Export your group from Splitwise as CSV and choose the file. People are matched to group
            members by name.
          </p>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setImportPreview(null);
              setImportCsv(await file.text());
            }}
            className="input"
          />
          {importPreview && <p className="text-sm font-medium text-brand-700">{importPreview}</p>}
          <div className="flex gap-3">
            <button
              onClick={() => runImport(true)}
              disabled={!importCsv || importBusy}
              className="btn btn-secondary btn-md flex-1"
            >
              Preview
            </button>
            <button
              onClick={() => runImport(false)}
              disabled={!importCsv || !importPreview || importBusy}
              className="btn btn-primary btn-md flex-1"
            >
              Import
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
