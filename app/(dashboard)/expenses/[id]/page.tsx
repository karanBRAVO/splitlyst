'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Edit2, Trash2, MessageCircle, Send } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Avatar } from '@/components/ui/avatar'
import { SkeletonList } from '@/components/ui/loading'
import { EmptyState } from '@/components/ui/empty-state'
import { ConfirmModal } from '@/components/ui/modal'
import { formatCurrency, formatDate, getCategoryEmoji } from '@/lib/utils'
import { toast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'

export default function ExpenseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: session } = useSession()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [comment, setComment] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const { data: expense, isLoading } = useQuery({
    queryKey: ['expense', id],
    queryFn: () => fetch(`/api/expenses/${id}`).then((r) => r.json()),
  })

  const deleteMutation = useMutation({
    mutationFn: () => fetch(`/api/expenses/${id}`, { method: 'DELETE' }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['balances'] })
      toast({ type: 'success', title: 'Expense deleted' })
      router.back()
    },
    onError: () => toast({ type: 'error', title: 'Failed to delete' }),
  })

  const commentMutation = useMutation({
    mutationFn: (text: string) =>
      fetch(`/api/expenses/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      }).then(async (r) => {
        const json = await r.json()
        if (!r.ok) throw new Error(json.error)
        return json
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense', id] })
      setComment('')
    },
    onError: (err: Error) => toast({ type: 'error', title: 'Failed', description: err.message }),
  })

  if (isLoading) return <div className="p-8"><SkeletonList count={4} /></div>
  if (!expense || expense.error) return (
    <div className="p-8">
      <EmptyState title="Expense not found" />
    </div>
  )

  const isMyExpense = expense.paidById === session?.user?.id
  const splitTypeLabels: Record<string, string> = {
    equal: 'Split equally',
    percentage: 'Split by percentage',
    shares: 'Split by shares',
    custom: 'Custom split',
  }

  return (
    <div>
      <Header
        title="Expense Details"
        back={expense.groupId ? `/groups/${expense.groupId}` : '/expenses'}
        actions={
          isMyExpense ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          ) : undefined
        }
      />

      <div className="max-w-2xl mx-auto px-4 py-6 lg:px-6 space-y-4">
        {/* Main card */}
        <div className="card p-5">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center text-3xl shrink-0">
              {getCategoryEmoji(expense.category)}
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900">{expense.description}</h1>
              {expense.group && (
                <span className="badge badge-gray text-xs mt-1">{expense.group.name}</span>
              )}
              <div className="flex items-center gap-3 mt-2">
                <span className="text-3xl font-bold text-gray-900">
                  {formatCurrency(expense.amount, expense.currency)}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Paid by</span>
              <div className="flex items-center gap-2">
                <Avatar src={expense.paidBy?.avatar} name={expense.paidBy?.name || '?'} size="xs" />
                <span className="font-medium text-gray-900">
                  {expense.paidById === session?.user?.id ? 'You' : expense.paidBy?.name}
                </span>
              </div>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Date</span>
              <span className="font-medium text-gray-900">{formatDate(expense.date)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Category</span>
              <span className="font-medium text-gray-900 capitalize">{expense.category}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-500">Split type</span>
              <span className="font-medium text-gray-900">{splitTypeLabels[expense.splitType]}</span>
            </div>
            {expense.notes && (
              <div className="pt-2 border-t border-gray-100">
                <span className="text-gray-500">Notes: </span>
                <span className="text-gray-700">{expense.notes}</span>
              </div>
            )}
          </div>
        </div>

        {/* Splits */}
        <div className="card">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">How it&apos;s split</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {expense.splits?.map((split: any) => {
              const isMe = split.userId === session?.user?.id
              const isPayer = expense.paidById === split.userId
              return (
                <div key={split.id} className="flex items-center gap-3 p-4">
                  <Avatar src={split.user?.avatar} name={split.user?.name || '?'} size="sm" />
                  <div className="flex-1">
                    <span className="font-medium text-gray-900">
                      {isMe ? 'You' : split.user?.name}
                    </span>
                    {isPayer && <span className="ml-2 badge badge-green text-[10px]">paid</span>}
                  </div>
                  <div className={cn(
                    'font-semibold',
                    isPayer ? 'text-brand-600' : 'text-red-500'
                  )}>
                    {formatCurrency(split.amount, expense.currency)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Attachments */}
        {expense.attachments?.length > 0 && (
          <div className="card p-4">
            <h2 className="font-semibold text-gray-900 mb-3">Attachments</h2>
            <div className="flex gap-3 flex-wrap">
              {expense.attachments.map((att: any) => (
                <a
                  key={att.id}
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm"
                >
                  📎 {att.filename}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Comments */}
        <div className="card">
          <div className="p-4 border-b border-gray-100 flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-gray-400" />
            <h2 className="font-semibold text-gray-900">Comments</h2>
          </div>
          <div className="p-4 space-y-4">
            {(expense.comments || []).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-2">No comments yet</p>
            ) : (
              expense.comments.map((c: any) => (
                <div key={c.id} className="flex items-start gap-3">
                  <Avatar src={c.user?.avatar} name={c.user?.name || '?'} size="xs" />
                  <div className="flex-1 bg-gray-50 rounded-xl p-3">
                    <div className="text-xs font-medium text-gray-700 mb-1">{c.user?.name}</div>
                    <p className="text-sm text-gray-700">{c.text}</p>
                  </div>
                </div>
              ))
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
                <Send className="w-4 h-4" />
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
  )
}
