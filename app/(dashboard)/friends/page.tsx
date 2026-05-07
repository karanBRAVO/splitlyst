'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { UserPlus, Plus, Search, Trash2, DollarSign } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Avatar } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'
import { SkeletonList } from '@/components/ui/loading'
import { Modal, ConfirmModal } from '@/components/ui/modal'
import { formatCurrency } from '@/lib/utils'
import { toast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'

export default function FriendsPage() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const { data: friends = [], isLoading } = useQuery({
    queryKey: ['friends'],
    queryFn: () => fetch('/api/friends').then((r) => r.json()),
  })

  const { data: balanceData } = useQuery({
    queryKey: ['balances'],
    queryFn: () => fetch('/api/balances').then((r) => r.json()),
  })

  const addMutation = useMutation({
    mutationFn: (email: string) =>
      fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      }).then(async (r) => {
        const json = await r.json()
        if (!r.ok) throw new Error(json.error)
        return json
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] })
      toast({ type: 'success', title: 'Friend added!' })
      setShowAdd(false)
      setEmail('')
    },
    onError: (err: Error) => toast({ type: 'error', title: 'Failed', description: err.message }),
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/friends/${id}`, { method: 'DELETE' }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] })
      toast({ type: 'success', title: 'Friend removed' })
      setRemovingId(null)
    },
  })

  const balances: Record<string, number> = {}
  if (balanceData?.balances) {
    for (const b of balanceData.balances) {
      balances[b.user.id] = b.net
    }
  }

  const filtered = friends.filter((f: any) =>
    f.friend.name.toLowerCase().includes(search.toLowerCase()) ||
    f.friend.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <Header title="Friends" />
      <div className="max-w-3xl mx-auto px-4 py-6 lg:px-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="page-title hidden lg:block">Friends</h1>
          <button onClick={() => setShowAdd(true)} className="btn btn-primary btn-md gap-2 ml-auto lg:ml-0">
            <Plus className="w-4 h-4" />
            Add Friend
          </button>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search friends..."
            className="input pl-10"
          />
        </div>

        {isLoading ? (
          <SkeletonList count={4} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<UserPlus className="w-8 h-8" />}
            title={search ? 'No friends found' : 'No friends yet'}
            description={search ? 'Try a different search' : 'Add friends to start splitting expenses'}
            action={
              !search && (
                <button onClick={() => setShowAdd(true)} className="btn btn-primary btn-md">
                  Add your first friend
                </button>
              )
            }
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((f: any) => {
              const net = balances[f.friend.id] || 0
              return (
                <div key={f.id} className="card p-4 flex items-center gap-3">
                  <Avatar src={f.friend.avatar} name={f.friend.name} id={f.friend.id} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900">{f.friend.name}</div>
                    <div className="text-xs text-gray-500">{f.friend.email}</div>
                  </div>
                  {Math.abs(net) > 0.01 && (
                    <div className={cn('text-sm font-semibold text-right', net > 0 ? 'text-brand-600' : 'text-red-500')}>
                      {net > 0 ? 'owes you' : 'you owe'}
                      <br />
                      {formatCurrency(Math.abs(net), session?.user.currency)}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/expenses/new?friendId=${f.friend.id}`}
                      className="btn btn-ghost btn-sm p-2"
                      title="Add expense"
                    >
                      <DollarSign className="w-4 h-4" />
                    </Link>
                    <button
                      onClick={() => setRemovingId(f.id)}
                      className="btn btn-ghost btn-sm p-2 text-red-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add a friend" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Enter their email address to add them. They must already have a Splitlyst account.
          </p>
          <div>
            <label className="label">Email address</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addMutation.mutate(email)}
              type="email"
              className="input"
              placeholder="friend@example.com"
              autoFocus
            />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowAdd(false)} className="btn btn-secondary btn-md flex-1">
              Cancel
            </button>
            <button
              onClick={() => addMutation.mutate(email)}
              disabled={!email || addMutation.isPending}
              className="btn btn-primary btn-md flex-1"
            >
              Add Friend
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!removingId}
        onClose={() => setRemovingId(null)}
        onConfirm={() => removingId && removeMutation.mutate(removingId)}
        title="Remove friend?"
        description="This won't delete any shared expenses."
        confirmLabel="Remove"
        confirmVariant="danger"
        loading={removeMutation.isPending}
      />
    </div>
  )
}
