'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, MessageCircle, Send } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Avatar } from '@/components/ui/avatar';
import { SkeletonList } from '@/components/ui/loading';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmModal } from '@/components/ui/modal';
import { formatCurrency, formatDate, getCategoryEmoji } from '@/lib/utils';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { Money } from '@/components/ui/money';

export default function ExpenseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: expense, isLoading } = useQuery({
    queryKey: ['expense', id],
    queryFn: () => fetch(`/api/expenses/${id}`).then((r) => r.json()),
  });

  const deleteMutation = useMutation({
    mutationFn: () => fetch(`/api/expenses/${id}`, { method: 'DELETE' }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['balances'] });
      toast({ type: 'success', title: 'Expense deleted' });
      router.back();
    },
    onError: () => toast({ type: 'error', title: 'Failed to delete' }),
  });

  const commentMutation = useMutation({
    mutationFn: (text: string) =>
      fetch(`/api/expenses/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      }).then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error);
        return json;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense', id] });
      setComment('');
    },
    onError: (err: Error) => toast({ type: 'error', title: 'Failed', description: err.message }),
  });

  if (isLoading)
    return (
      <div className="p-8">
        <SkeletonList count={4} />
      </div>
    );
  if (!expense || expense.error)
    return (
      <div className="p-8">
        <EmptyState title="Expense not found" />
      </div>
    );

  const isMyExpense = expense.paidById === session?.user?.id;
  const splitTypeLabels: Record<string, string> = {
    equal: 'Split equally',
    percentage: 'Split by percentage',
    shares: 'Split by shares',
    itemized: 'Itemized',
    custom: 'Custom split',
  };

  return (
    <div>
      <Header
        title="Expense Details"
        back={expense.groupId ? `/groups/${expense.groupId}` : '/expenses'}
        actions={
          isMyExpense ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-lg p-2 text-red-400 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          ) : undefined
        }
      />

      <div className="mx-auto max-w-2xl space-y-4 px-4 py-6 lg:px-6">
        {/* Main card */}
        <div className="card p-5">
          <div className="mb-4 flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-3xl">
              {getCategoryEmoji(expense.category)}
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900">{expense.description}</h1>
              {expense.group && (
                <span className="badge badge-gray mt-1 text-xs">{expense.group.name}</span>
              )}
              <div className="mt-2 flex items-center gap-3">
                <span className="text-3xl font-bold text-gray-900">
                  <Money amount={expense.amount} currency={expense.currency} />
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between border-b border-gray-100 py-2">
              <span className="text-gray-500">Paid by</span>
              <div className="flex items-center gap-2">
                <Avatar src={expense.paidBy?.avatar} name={expense.paidBy?.name || '?'} size="xs" />
                <span className="font-medium text-gray-900">
                  {expense.paidById === session?.user?.id ? 'You' : expense.paidBy?.name}
                </span>
              </div>
            </div>
            <div className="flex justify-between border-b border-gray-100 py-2">
              <span className="text-gray-500">Date</span>
              <span className="font-medium text-gray-900">{formatDate(expense.date)}</span>
            </div>
            <div className="flex justify-between border-b border-gray-100 py-2">
              <span className="text-gray-500">Category</span>
              <span className="font-medium text-gray-900 capitalize">{expense.category}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-500">Split type</span>
              <span className="font-medium text-gray-900">
                {splitTypeLabels[expense.splitType]}
              </span>
            </div>
            {expense.notes && (
              <div className="border-t border-gray-100 pt-2">
                <span className="text-gray-500">Notes: </span>
                <span className="text-gray-700">{expense.notes}</span>
              </div>
            )}
          </div>
        </div>

        {/* Splits */}
        <div className="card">
          <div className="border-b border-gray-100 p-4">
            <h2 className="font-semibold text-gray-900">How it&apos;s split</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {expense.splits?.map(
              (split: {
                id: string;
                userId: string;
                amount: number;
                user?: { id: string; name: string; avatar: string | null };
              }) => {
                const isMe = split.userId === session?.user?.id;
                const isPayer = expense.paidById === split.userId;
                return (
                  <div key={split.id} className="flex items-center gap-3 p-4">
                    <Avatar src={split.user?.avatar} name={split.user?.name || '?'} size="sm" />
                    <div className="flex-1">
                      <span className="font-medium text-gray-900">
                        {isMe ? 'You' : split.user?.name}
                      </span>
                      {isPayer && <span className="badge badge-green ml-2 text-[10px]">paid</span>}
                    </div>
                    <div
                      className={cn('font-semibold', isPayer ? 'text-brand-600' : 'text-red-500')}
                    >
                      <Money amount={split.amount} currency={expense.currency} />
                    </div>
                  </div>
                );
              },
            )}
          </div>
        </div>

        {/* Itemized breakdown */}
        {expense.items?.length > 0 && (
          <div className="card p-4" data-testid="items-breakdown">
            <h2 className="mb-3 font-semibold text-gray-900">Items</h2>
            <div className="space-y-1.5 text-sm">
              {expense.items.map(
                (it: { id: string; name: string; amount: number; assignedTo: string[] }) => (
                  <div key={it.id} className="flex justify-between">
                    <span className="text-gray-700">
                      {it.name}{' '}
                      <span className="text-xs text-gray-400">
                        (
                        {it.assignedTo
                          .map(
                            (uid) =>
                              expense.splits?.find(
                                (s: { userId: string; user: { name: string } }) => s.userId === uid,
                              )?.user.name ?? '?',
                          )
                          .join(', ')}
                        )
                      </span>
                    </span>
                    <span>{formatCurrency(it.amount, expense.currency)}</span>
                  </div>
                ),
              )}
              {expense.tax > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Tax</span>
                  <span>{formatCurrency(expense.tax, expense.currency)}</span>
                </div>
              )}
              {expense.tip > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Tip</span>
                  <span>{formatCurrency(expense.tip, expense.currency)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Receipt */}
        {expense.receiptUrl && (
          <div className="card p-4">
            <h2 className="mb-3 font-semibold text-gray-900">Receipt</h2>
            <a href={expense.receiptUrl} target="_blank" rel="noopener noreferrer">
              <img
                src={expense.receiptUrl}
                alt="Receipt"
                className="max-h-96 rounded-lg border border-gray-200 object-contain"
              />
            </a>
          </div>
        )}

        {/* Attachments */}
        {expense.attachments?.length > 0 && (
          <div className="card p-4">
            <h2 className="mb-3 font-semibold text-gray-900">Attachments</h2>
            <div className="flex flex-wrap gap-3">
              {expense.attachments.map((att: { id: string; url: string; filename: string }) => (
                <a
                  key={att.id}
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-gray-200 p-3 text-sm hover:bg-gray-50"
                >
                  📎 {att.filename}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Comments */}
        <div className="card">
          <div className="flex items-center gap-2 border-b border-gray-100 p-4">
            <MessageCircle className="h-4 w-4 text-gray-400" />
            <h2 className="font-semibold text-gray-900">Comments</h2>
          </div>
          <div className="space-y-4 p-4">
            {(expense.comments || []).length === 0 ? (
              <p className="py-2 text-center text-sm text-gray-400">No comments yet</p>
            ) : (
              expense.comments.map(
                (c: {
                  id: string;
                  text: string;
                  user?: { id: string; name: string; avatar: string | null };
                }) => (
                  <div key={c.id} className="flex items-start gap-3">
                    <Avatar src={c.user?.avatar} name={c.user?.name || '?'} size="xs" />
                    <div className="flex-1 rounded-xl bg-gray-50 p-3">
                      <div className="mb-1 text-xs font-medium text-gray-700">{c.user?.name}</div>
                      <p className="text-sm text-gray-700">{c.text}</p>
                    </div>
                  </div>
                ),
              )
            )}

            <div className="flex gap-2 pt-2">
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && comment && commentMutation.mutate(comment)}
                placeholder="Add a comment..."
                className="input flex-1 text-sm"
              />
              <button
                onClick={() => comment && commentMutation.mutate(comment)}
                disabled={!comment || commentMutation.isPending}
                className="btn btn-primary btn-md px-3"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete expense?"
        description="This will permanently remove this expense and update all balances."
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
