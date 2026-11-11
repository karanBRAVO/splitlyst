'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Minus, Plus, Paperclip, X, Trash2 } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Avatar } from '@/components/ui/avatar';
import { toast } from '@/components/ui/toaster';
import { Spinner } from '@/components/ui/loading';
import { CURRENCIES, EXPENSE_CATEGORIES, SplitType } from '@/types';
import { formatCurrency, roundToTwoDecimals } from '@/lib/utils';
import { enqueueExpense } from '@/lib/offline-queue';
import { cn } from '@/lib/utils';

const schema = z.object({
  description: z.string().min(1, 'Description required').max(200),
  amount: z.string().min(1, 'Amount required'),
  currency: z.string().length(3),
  category: z.string(),
  date: z.string(),
  splitType: z.enum(['equal', 'percentage', 'shares', 'custom', 'itemized']),
  notes: z.string().max(500).optional(),
  paidById: z.string(),
});

type FormData = z.infer<typeof schema>;

export default function NewExpenseForm() {
  const { data: session } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const groupId = searchParams.get('groupId');
  const friendId = searchParams.get('friendId');
  const presetAmount = searchParams.get('amount');
  const presetReceiverId = searchParams.get('receiverId');
  const presetPayerId = searchParams.get('payerId');
  const presetCurrency = searchParams.get('currency');
  const isPayment = searchParams.get('type') === 'payment';

  const [participants, setParticipants] = useState<
    Array<{
      userId: string;
      name: string;
      avatar?: string | null;
      percentage?: number;
      shares?: number;
      customAmount?: number;
    }>
  >([]);
  const initializedRef = useRef(false);
  type ItemRow = { id: string; name: string; amount: string; assignedTo: string[] };
  const [items, setItems] = useState<ItemRow[]>([]);
  const [tax, setTax] = useState('');
  const [tip, setTip] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringInterval, setRecurringInterval] = useState<
    'daily' | 'weekly' | 'monthly' | 'yearly'
  >('monthly');
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  const handleReceiptChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingReceipt(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('folder', 'receipts');
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Upload failed');
      setReceiptUrl(json.url);
    } catch (err) {
      toast({
        type: 'error',
        title: 'Receipt upload failed',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setUploadingReceipt(false);
    }
  };

  const { data: group } = useQuery({
    queryKey: ['group', groupId],
    queryFn: () => fetch(`/api/groups/${groupId}`).then((r) => r.json()),
    enabled: !!groupId,
  });

  const { data: friends = [] } = useQuery({
    queryKey: ['friends'],
    queryFn: () => fetch('/api/friends').then((r) => r.json()),
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      // Payments hide the description field, but the schema requires one
      description: isPayment ? 'Payment' : '',
      category: 'general', // not rendered in payment mode, but required by the schema
      currency:
        (CURRENCIES.some((c) => c.code === presetCurrency) ? presetCurrency : null) ||
        session?.user?.currency ||
        'USD',
      date: new Date().toISOString().split('T')[0],
      splitType: 'equal',
      paidById: session?.user?.id || '',
      amount: presetAmount || '',
    },
  });

  // The session may not be loaded on first render (direct page load), so the default payer
  // must be filled in once it arrives — otherwise the expense is submitted with no payer.
  useEffect(() => {
    if (session?.user?.id && !getValues('paidById')) setValue('paidById', session.user.id);
  }, [session?.user?.id, getValues, setValue]);

  // Initialize participants once when the required data is available.
  // useRef guard prevents re-running on every render (friends/session are new
  // references each render even when the data hasn't changed).
  useEffect(() => {
    if (!session?.user) return;
    if (groupId && !group?.members) return; // wait for group to load
    if (friendId && friends.length === 0) return; // wait for friends to load
    if (initializedRef.current) return;

    initializedRef.current = true;
    const me = { userId: session.user.id, name: session.user.name!, avatar: session.user.image };

    if (groupId && group?.members) {
      const def = group.defaultSplit as {
        type: 'equal' | 'percentage' | 'shares';
        values?: Record<string, number>;
      } | null;
      setParticipants(
        group.members.map((m: { user: { id: string; name: string; avatar: string | null } }) => ({
          userId: m.user.id,
          name: m.user.name,
          avatar: m.user.avatar,
          ...(def?.type === 'percentage' ? { percentage: def.values?.[m.user.id] ?? 0 } : {}),
          ...(def?.type === 'shares' ? { shares: def.values?.[m.user.id] ?? 1 } : {}),
        })),
      );
      if (def && def.type !== 'equal') setValue('splitType', def.type);
    } else if (friendId) {
      const friend = friends.find(
        (f: { friend: { id: string; name: string; avatar: string | null } }) =>
          f.friend.id === friendId,
      );
      if (friend) {
        setParticipants([
          me,
          { userId: friend.friend.id, name: friend.friend.name, avatar: friend.friend.avatar },
        ]);
      } else {
        setParticipants([me]);
      }
    } else {
      setParticipants([me]);
    }
  }, [session, group, friendId, friends, groupId, presetReceiverId, setValue]);

  const splitType = watch('splitType');
  const amountStr = watch('amount');
  const totalAmount = parseFloat(amountStr) || 0;

  const equalSplit =
    participants.length > 0 ? roundToTwoDecimals(totalAmount / participants.length) : 0;

  const totalCustom = participants.reduce((s, p) => s + (p.customAmount || 0), 0);
  const totalPercentage = participants.reduce((s, p) => s + (p.percentage || 0), 0);
  const itemsSubtotal = items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const itemizedTotal = roundToTwoDecimals(
    itemsSubtotal + (parseFloat(tax) || 0) + (parseFloat(tip) || 0),
  );

  // Itemized: the amount field mirrors items + tax + tip
  useEffect(() => {
    if (splitType === 'itemized')
      setValue('amount', itemizedTotal > 0 ? itemizedTotal.toFixed(2) : '');
  }, [splitType, itemizedTotal, setValue]);

  // Always land somewhere predictable after saving (history may hold a login page after a deep link).
  const goAfterSave = (isPaymentFlow = false) =>
    router.push(groupId ? `/groups/${groupId}` : isPaymentFlow ? '/payments' : '/expenses');

  const mutation = useMutation({
    // Run even when offline: the mutation itself queues the expense locally instead of pausing
    networkMode: 'always',
    mutationFn: async (payload: Record<string, unknown>) => {
      const queueOffline = () => {
        enqueueExpense(payload);
        return { queued: true };
      };
      if (typeof navigator !== 'undefined' && !navigator.onLine) return queueOffline();
      let r: Response;
      try {
        r = await fetch('/api/expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch {
        return queueOffline(); // network failure
      }
      const json = await r.json();
      if (!r.ok) throw new Error(json.error);
      return json;
    },
    onSuccess: (res: { queued?: boolean }) => {
      if (res?.queued) {
        toast({
          type: 'success',
          title: 'Saved offline',
          description: 'It will be added automatically when you are back online.',
        });
        // Offline: stay here (navigating needs the network) and clear the form for the next entry
        setValue('description', '');
        setValue('amount', '');
        setItems([]);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['balances'] });
      queryClient.invalidateQueries({ queryKey: ['activity'] });
      if (groupId) queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      toast({ type: 'success', title: 'Expense added!' });
      goAfterSave();
    },
    onError: (err: Error) => toast({ type: 'error', title: 'Failed', description: err.message }),
  });

  const paymentMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error);
        return json;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['balances'] });
      queryClient.invalidateQueries({ queryKey: ['activity'] });
      toast({ type: 'success', title: 'Payment recorded!' });
      goAfterSave(true);
    },
    onError: (err: Error) => toast({ type: 'error', title: 'Failed', description: err.message }),
  });

  const onSubmit = (data: FormData) => {
    const amount = parseFloat(data.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({ type: 'error', title: 'Enter a valid amount' });
      return;
    }

    if (isPayment) {
      paymentMutation.mutate({
        payerId: presetPayerId || session?.user?.id,
        receiverId: presetReceiverId,
        amount,
        currency: data.currency,
        groupId: groupId || null,
        notes: data.notes,
      });
      return;
    }

    if (participants.length < 1) {
      toast({ type: 'error', title: 'Add at least one participant' });
      return;
    }

    if (splitType === 'itemized') {
      const cleaned = items
        .map((i) => ({
          name: i.name.trim(),
          amount: parseFloat(i.amount),
          assignedTo: i.assignedTo,
        }))
        .filter((i) => i.name && i.amount > 0);
      if (cleaned.length === 0) {
        toast({ type: 'error', title: 'Add at least one item with a name and price' });
        return;
      }
      if (cleaned.some((i) => i.assignedTo.length === 0)) {
        toast({ type: 'error', title: 'Assign every item to at least one person' });
        return;
      }
      mutation.mutate({
        description: data.description,
        amount: roundToTwoDecimals(
          cleaned.reduce((s, i) => s + i.amount, 0) +
            (parseFloat(tax) || 0) +
            (parseFloat(tip) || 0),
        ),
        currency: data.currency,
        category: data.category,
        date: new Date(data.date).toISOString(),
        groupId: groupId || null,
        paidById: data.paidById,
        splitType: 'itemized',
        items: cleaned,
        tax: parseFloat(tax) || 0,
        tip: parseFloat(tip) || 0,
        participants: participants.map((p) => p.userId),
        notes: data.notes,
        receiptUrl,
        isRecurring: false,
      });
      return;
    }

    let splits: Array<{ userId: string; percentage?: number; shares?: number; amount?: number }> =
      [];
    if (splitType === 'equal') {
      splits = participants.map((p) => ({ userId: p.userId }));
    } else if (splitType === 'percentage') {
      if (Math.abs(totalPercentage - 100) > 0.01) {
        toast({
          type: 'error',
          title: `Percentages must sum to 100% (currently ${totalPercentage}%)`,
        });
        return;
      }
      splits = participants.map((p) => ({ userId: p.userId, percentage: p.percentage || 0 }));
    } else if (splitType === 'shares') {
      splits = participants.map((p) => ({ userId: p.userId, shares: p.shares || 1 }));
    } else {
      if (Math.abs(totalCustom - amount) > 0.02) {
        toast({
          type: 'error',
          title: `Custom amounts must sum to total (${formatCurrency(amount, data.currency)})`,
        });
        return;
      }
      splits = participants.map((p) => ({ userId: p.userId, amount: p.customAmount || 0 }));
    }

    mutation.mutate({
      description: data.description,
      amount,
      currency: data.currency,
      category: data.category,
      date: new Date(data.date).toISOString(),
      groupId: groupId || null,
      paidById: data.paidById,
      splitType: data.splitType,
      participants: participants.map((p) => p.userId),
      splits,
      notes: data.notes,
      receiptUrl,
      isRecurring,
      recurringInterval: isRecurring ? recurringInterval : undefined,
    });
  };

  const rawMembers: Array<{ userId: string; name: string; avatar: string | null | undefined }> =
    groupId && group?.members
      ? group.members.map((m: { user: { id: string; name: string; avatar: string | null } }) => ({
          userId: m.user.id,
          name: m.user.name,
          avatar: m.user.avatar,
        }))
      : [
          ...(session?.user
            ? [{ userId: session.user.id, name: session.user.name!, avatar: session.user.image }]
            : []),
          ...friends
            .filter((f: { status: string }) => f.status === 'accepted')
            .map((f: { friend: { id: string; name: string; avatar: string | null } }) => ({
              userId: f.friend.id,
              name: f.friend.name,
              avatar: f.friend.avatar,
            })),
        ];
  // Never render the same person twice (React keys must be unique)
  const allMembers = rawMembers.filter(
    (m, i, arr) => arr.findIndex((x) => x.userId === m.userId) === i,
  );

  const nameOf = (id?: string | null) =>
    !id
      ? '…'
      : id === session?.user?.id
        ? 'You'
        : (allMembers.find((m) => m.userId === id)?.name ?? '…');

  const toggleParticipant = (member: { userId: string; name: string; avatar?: string | null }) => {
    if (groupId) return; // Can't change for group expenses
    const isIn = participants.some((p) => p.userId === member.userId);
    if (isIn) {
      if (member.userId === session?.user?.id) return; // Can't remove self
      setParticipants(participants.filter((p) => p.userId !== member.userId));
    } else {
      setParticipants([...participants, { ...member, percentage: 0, shares: 1, customAmount: 0 }]);
    }
  };

  const isPending = mutation.isPending || paymentMutation.isPending;

  return (
    <div>
      <Header
        title={isPayment ? 'Record Payment' : 'Add Expense'}
        back={groupId ? `/groups/${groupId}` : '/expenses'}
      />
      <div className="mx-auto max-w-lg px-4 py-6 lg:px-6">
        <div className="mb-6 hidden lg:block">
          <h1 className="page-title">{isPayment ? 'Record a Payment' : 'Add an Expense'}</h1>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Description */}
          {!isPayment && (
            <div>
              <label className="label">Description *</label>
              <input
                {...register('description')}
                className="input"
                placeholder="e.g. Dinner, Netflix, Rent..."
              />
              {errors.description && (
                <p className="mt-1 text-xs text-red-500">{errors.description.message}</p>
              )}
            </div>
          )}

          {/* Amount + Currency */}
          <div>
            <label className="label">Amount *</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute top-1/2 left-3 -translate-y-1/2 font-medium text-gray-400">
                  {CURRENCIES.find((c) => c.code === watch('currency'))?.symbol || '$'}
                </span>
                <input
                  {...register('amount')}
                  type="number"
                  step="0.01"
                  min="0.01"
                  readOnly={splitType === 'itemized' || isPayment}
                  style={{
                    paddingLeft: `${1.1 + (CURRENCIES.find((c) => c.code === watch('currency'))?.symbol.length ?? 1) * 0.65}rem`,
                  }}
                  className={cn(
                    'input',
                    isPayment && 'cursor-not-allowed bg-gray-50 text-gray-700',
                  )}
                  placeholder="0.00"
                />
              </div>
              {isPayment ? (
                <>
                  <input type="hidden" {...register('currency')} />
                  <div className="input flex w-24 cursor-not-allowed items-center bg-gray-50 text-gray-700">
                    {watch('currency')}
                  </div>
                </>
              ) : (
                <select {...register('currency')} className="input w-24">
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {isPayment && (
              <p className="mt-1 text-xs text-gray-500">
                This is the amount outstanding between you — it is calculated from your balance and
                can&apos;t be edited.
              </p>
            )}
            {errors.amount && <p className="mt-1 text-xs text-red-500">{errors.amount.message}</p>}
          </div>

          {/* Category + Date */}
          {!isPayment && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Category</label>
                <select {...register('category')} className="input">
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.emoji} {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Date</label>
                <input {...register('date')} type="date" className="input" />
              </div>
            </div>
          )}

          {/* Paid by / payment summary */}
          {isPayment ? (
            <div
              className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm"
              data-testid="payment-summary"
            >
              <span className="font-medium text-gray-900">
                {nameOf(presetPayerId || session?.user?.id)}
              </span>{' '}
              pays <span className="font-medium text-gray-900">{nameOf(presetReceiverId)}</span>
            </div>
          ) : (
            <div>
              <label className="label">Paid by</label>
              <select {...register('paidById')} className="input">
                {participants.map((p) => (
                  <option key={p.userId} value={p.userId}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!isPayment && (
            <>
              {/* Split type */}
              <div>
                <label className="label">Split type</label>
                <div className="grid grid-cols-5 gap-2">
                  {(['equal', 'percentage', 'shares', 'custom', 'itemized'] as SplitType[]).map(
                    (type) => (
                      <label key={type} className="cursor-pointer">
                        <input
                          {...register('splitType')}
                          type="radio"
                          value={type}
                          className="sr-only"
                        />
                        <div
                          className={cn(
                            'rounded-lg border-2 py-2 text-center text-xs font-medium capitalize transition-all',
                            splitType === type
                              ? 'border-brand-500 bg-brand-50 text-brand-700'
                              : 'border-gray-200 text-gray-600 hover:border-gray-300',
                          )}
                        >
                          {type}
                        </div>
                      </label>
                    ),
                  )}
                </div>
              </div>

              {/* Participants */}
              <div>
                <label className="label">Split with</label>
                <div className="space-y-2">
                  {allMembers.map((member) => {
                    const participant = participants.find((p) => p.userId === member.userId);
                    const isIn = !!participant;
                    const isSelf = member.userId === session?.user?.id;

                    return (
                      <div
                        key={member.userId}
                        className={cn(
                          'flex items-center gap-3 rounded-xl border p-3 transition-all',
                          isIn
                            ? 'border-brand-200 bg-brand-50/30'
                            : 'border-gray-200 bg-white opacity-60',
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => toggleParticipant(member)}
                          disabled={isSelf || !!groupId}
                          className={cn(
                            'flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-all',
                            isIn ? 'border-brand-500 bg-brand-500' : 'border-gray-300',
                            (isSelf || !!groupId) && 'cursor-default opacity-50',
                          )}
                        >
                          {isIn && (
                            <svg
                              className="h-3 w-3 text-white"
                              fill="none"
                              viewBox="0 0 12 12"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M2.5 6l2.5 2.5 4.5-4.5"
                              />
                            </svg>
                          )}
                        </button>
                        <Avatar src={member.avatar} name={member.name} size="sm" />
                        <span className="flex-1 text-sm font-medium text-gray-900">
                          {isSelf ? 'You' : member.name}
                        </span>

                        {isIn && (
                          <div className="shrink-0 text-right text-sm font-medium">
                            {splitType === 'equal' && (
                              <span className="text-gray-700">
                                {formatCurrency(equalSplit, watch('currency'))}
                              </span>
                            )}
                            {splitType === 'percentage' && (
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="1"
                                value={participant?.percentage || 0}
                                onChange={(e) =>
                                  setParticipants(
                                    participants.map((p) =>
                                      p.userId === member.userId
                                        ? { ...p, percentage: parseFloat(e.target.value) || 0 }
                                        : p,
                                    ),
                                  )
                                }
                                className="w-16 rounded border border-gray-200 px-2 py-1 text-center text-xs"
                                placeholder="0%"
                              />
                            )}
                            {splitType === 'shares' && (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setParticipants(
                                      participants.map((p) =>
                                        p.userId === member.userId
                                          ? { ...p, shares: Math.max(1, (p.shares || 1) - 1) }
                                          : p,
                                      ),
                                    )
                                  }
                                  className="flex h-6 w-6 items-center justify-center rounded border border-gray-200 hover:bg-gray-100"
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span className="w-6 text-center text-xs font-bold">
                                  {participant?.shares || 1}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setParticipants(
                                      participants.map((p) =>
                                        p.userId === member.userId
                                          ? { ...p, shares: (p.shares || 1) + 1 }
                                          : p,
                                      ),
                                    )
                                  }
                                  className="flex h-6 w-6 items-center justify-center rounded border border-gray-200 hover:bg-gray-100"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                            {splitType === 'custom' && (
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={participant?.customAmount || 0}
                                onChange={(e) =>
                                  setParticipants(
                                    participants.map((p) =>
                                      p.userId === member.userId
                                        ? { ...p, customAmount: parseFloat(e.target.value) || 0 }
                                        : p,
                                    ),
                                  )
                                }
                                className="w-20 rounded border border-gray-200 px-2 py-1 text-center text-xs"
                                placeholder="0.00"
                              />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Split summary */}
                {splitType === 'custom' && totalAmount > 0 && (
                  <div
                    className={cn(
                      'mt-2 text-right text-xs font-medium',
                      Math.abs(totalCustom - totalAmount) < 0.02
                        ? 'text-brand-600'
                        : 'text-red-500',
                    )}
                  >
                    {formatCurrency(totalCustom, watch('currency'))} /{' '}
                    {formatCurrency(totalAmount, watch('currency'))}
                    {Math.abs(totalCustom - totalAmount) > 0.02 &&
                      ` (${formatCurrency(totalAmount - totalCustom, watch('currency'))} remaining)`}
                  </div>
                )}
                {splitType === 'percentage' && (
                  <div
                    className={cn(
                      'mt-2 text-right text-xs font-medium',
                      Math.abs(totalPercentage - 100) < 0.01 ? 'text-brand-600' : 'text-red-500',
                    )}
                  >
                    {totalPercentage}% / 100%
                  </div>
                )}
              </div>

              {splitType === 'itemized' && (
                <div className="space-y-3" data-testid="itemized-editor">
                  <label className="label">Items</label>
                  {items.map((item) => (
                    <div key={item.id} className="rounded-xl border border-gray-200 p-3">
                      <div className="flex gap-2">
                        <input
                          value={item.name}
                          onChange={(e) =>
                            setItems(
                              items.map((i) =>
                                i.id === item.id ? { ...i, name: e.target.value } : i,
                              ),
                            )
                          }
                          className="input"
                          placeholder="Item name"
                          data-testid="item-name"
                        />
                        <input
                          value={item.amount}
                          onChange={(e) =>
                            setItems(
                              items.map((i) =>
                                i.id === item.id ? { ...i, amount: e.target.value } : i,
                              ),
                            )
                          }
                          type="number"
                          step="0.01"
                          min="0"
                          className="input w-28"
                          placeholder="0.00"
                          data-testid="item-amount"
                        />
                        <button
                          type="button"
                          onClick={() => setItems(items.filter((i) => i.id !== item.id))}
                          className="btn btn-ghost btn-sm p-2 text-red-400"
                          aria-label="Remove item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {participants.map((p) => {
                          const on = item.assignedTo.includes(p.userId);
                          return (
                            <button
                              key={p.userId}
                              type="button"
                              onClick={() =>
                                setItems(
                                  items.map((i) =>
                                    i.id === item.id
                                      ? {
                                          ...i,
                                          assignedTo: on
                                            ? i.assignedTo.filter((u) => u !== p.userId)
                                            : [...i.assignedTo, p.userId],
                                        }
                                      : i,
                                  ),
                                )
                              }
                              data-testid={`assign-${p.name}`}
                              className={cn(
                                'rounded-full border px-2.5 py-1 text-xs font-medium transition-all',
                                on
                                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                                  : 'border-gray-200 text-gray-500 hover:border-gray-300',
                              )}
                            >
                              {p.userId === session?.user?.id ? 'You' : p.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setItems([
                        ...items,
                        {
                          id: crypto.randomUUID(),
                          name: '',
                          amount: '',
                          assignedTo: participants.map((p) => p.userId),
                        },
                      ])
                    }
                    className="btn btn-secondary btn-sm gap-1.5"
                    data-testid="add-item"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add item
                  </button>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Tax</label>
                      <input
                        value={tax}
                        onChange={(e) => setTax(e.target.value)}
                        type="number"
                        step="0.01"
                        min="0"
                        className="input"
                        placeholder="0.00"
                        data-testid="tax"
                      />
                    </div>
                    <div>
                      <label className="label">Tip</label>
                      <input
                        value={tip}
                        onChange={(e) => setTip(e.target.value)}
                        type="number"
                        step="0.01"
                        min="0"
                        className="input"
                        placeholder="0.00"
                        data-testid="tip"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    Tax and tip are shared in proportion to what each person ordered. Total:{' '}
                    <strong>{formatCurrency(itemizedTotal, watch('currency'))}</strong>
                  </p>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="label">Notes (optional)</label>
                <textarea
                  {...register('notes')}
                  className="input resize-none"
                  rows={2}
                  placeholder="Any additional details..."
                />
              </div>

              {/* Recurring */}
              <div>
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  Repeat this expense
                </label>
                {isRecurring && (
                  <select
                    value={recurringInterval}
                    onChange={(e) =>
                      setRecurringInterval(e.target.value as typeof recurringInterval)
                    }
                    className="input mt-2"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                )}
              </div>

              {/* Receipt */}
              <div>
                <label className="label">Receipt (optional)</label>
                {receiptUrl ? (
                  <div className="flex items-center gap-3 rounded-xl border border-gray-200 p-2">
                    <img
                      src={receiptUrl}
                      alt="Receipt"
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                    <span className="flex-1 text-sm text-gray-600">Receipt attached</span>
                    <button
                      type="button"
                      onClick={() => setReceiptUrl(null)}
                      className="btn btn-secondary btn-sm"
                      aria-label="Remove receipt"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <label className="btn btn-secondary btn-md cursor-pointer gap-2">
                    {uploadingReceipt ? (
                      <Spinner className="h-4 w-4" />
                    ) : (
                      <Paperclip className="h-4 w-4" />
                    )}
                    {uploadingReceipt ? 'Uploading…' : 'Attach receipt'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={handleReceiptChange}
                      disabled={uploadingReceipt}
                    />
                  </label>
                )}
              </div>
            </>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="btn btn-secondary btn-lg flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || uploadingReceipt || (!isPayment && participants.length === 0)}
              className="btn btn-primary btn-lg flex-1"
            >
              {isPending ? (
                <Spinner className="h-4 w-4" />
              ) : isPayment ? (
                'Record Payment'
              ) : (
                'Add Expense'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
