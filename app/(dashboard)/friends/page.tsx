'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  UserPlus,
  Plus,
  Search,
  Trash2,
  DollarSign,
  ArrowRightLeft,
  Check,
  X,
  Bell,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonList } from '@/components/ui/loading';
import { Modal, ConfirmModal } from '@/components/ui/modal';
import { formatCurrency } from '@/lib/utils';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';

function PayLinks({
  friend,
  amount,
  currency,
}: {
  friend: { name: string; venmo?: string | null; paypal?: string | null; upi?: string | null };
  amount: number;
  currency: string;
}) {
  const links: Array<{ label: string; href: string }> = [];
  const amt = amount.toFixed(2);
  const note = encodeURIComponent('Splitlyst settle up');
  if (friend.venmo) {
    links.push({
      label: 'Venmo',
      href: `https://venmo.com/${encodeURIComponent(friend.venmo.replace(/^@/, ''))}?txn=pay&amount=${amt}&note=${note}`,
    });
  }
  if (friend.paypal) {
    links.push({
      label: 'PayPal',
      href: `https://paypal.me/${encodeURIComponent(friend.paypal)}/${amt}${currency}`,
    });
  }
  if (friend.upi) {
    links.push({
      label: 'UPI',
      href: `upi://pay?pa=${encodeURIComponent(friend.upi)}&pn=${encodeURIComponent(friend.name)}&am=${amt}&cu=${currency}&tn=${note}`,
    });
  }
  return (
    <>
      {links.map((l) => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secondary btn-sm"
        >
          {l.label}
        </a>
      ))}
    </>
  );
}

export default function FriendsPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const { data: friends = [], isLoading } = useQuery({
    queryKey: ['friends'],
    queryFn: () => fetch('/api/friends').then((r) => r.json()),
  });

  const { data: balanceData } = useQuery({
    queryKey: ['balances'],
    queryFn: () => fetch('/api/balances').then((r) => r.json()),
  });

  const addMutation = useMutation({
    mutationFn: (email: string) =>
      fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      }).then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error);
        return json;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      toast({ type: 'success', title: 'Friend request sent!' });
      setShowAdd(false);
      setEmail('');
    },
    onError: (err: Error) => toast({ type: 'error', title: 'Failed', description: err.message }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/friends/${id}`, { method: 'DELETE' }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      toast({ type: 'success', title: 'Friend removed' });
      setRemovingId(null);
    },
  });

  const acceptMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/friends/${id}`, { method: 'PATCH' }).then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error);
        return json;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      toast({ type: 'success', title: 'Friend request accepted' });
    },
    onError: (err: Error) => toast({ type: 'error', title: 'Failed', description: err.message }),
  });

  const remindMutation = useMutation({
    mutationFn: (userId: string) =>
      fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      }).then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error);
        return json;
      }),
    onSuccess: () => toast({ type: 'success', title: 'Reminder sent' }),
    onError: (err: Error) => toast({ type: 'error', title: 'Failed', description: err.message }),
  });

  const balances: Record<string, number> = {};
  if (balanceData?.balances) {
    for (const b of balanceData.balances) {
      balances[b.user.id] = b.net;
    }
  }

  type FriendEntry = {
    id: string;
    status: string;
    isIncoming?: boolean;
    friend: {
      id: string;
      name: string;
      email: string;
      avatar: string | null;
      venmo?: string | null;
      paypal?: string | null;
      upi?: string | null;
    };
  };
  const incoming: FriendEntry[] = Array.isArray(friends)
    ? friends.filter((f: FriendEntry) => f.isIncoming)
    : [];
  const outgoing: FriendEntry[] = Array.isArray(friends)
    ? friends.filter((f: FriendEntry) => f.status === 'pending' && !f.isIncoming)
    : [];
  const filtered = (Array.isArray(friends) ? friends : []).filter(
    (f: FriendEntry) =>
      f.status === 'accepted' &&
      (f.friend.name.toLowerCase().includes(search.toLowerCase()) ||
        f.friend.email.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div>
      <Header title="Friends" />
      <div className="mx-auto max-w-3xl px-4 py-6 lg:px-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="page-title hidden lg:block">Friends</h1>
          <button
            onClick={() => setShowAdd(true)}
            className="btn btn-primary btn-md ml-auto gap-2 lg:ml-0"
          >
            <Plus className="h-4 w-4" />
            Add Friend
          </button>
        </div>

        {incoming.length > 0 && (
          <div className="mb-6">
            <h2 className="mb-2 text-sm font-semibold text-gray-700">Friend requests</h2>
            <div className="space-y-3">
              {incoming.map((f) => (
                <div key={f.id} className="card flex items-center gap-3 p-4">
                  <Avatar src={f.friend.avatar} name={f.friend.name} id={f.friend.id} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-900">{f.friend.name}</div>
                    <div className="text-xs text-gray-500">{f.friend.email}</div>
                  </div>
                  <button
                    onClick={() => acceptMutation.mutate(f.id)}
                    disabled={acceptMutation.isPending}
                    className="btn btn-primary btn-sm gap-1.5"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Accept
                  </button>
                  <button
                    onClick={() => removeMutation.mutate(f.id)}
                    className="btn btn-secondary btn-sm gap-1.5"
                    aria-label="Decline request"
                  >
                    <X className="h-3.5 w-3.5" />
                    Decline
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {outgoing.length > 0 && (
          <div className="mb-6">
            <h2 className="mb-2 text-sm font-semibold text-gray-700">Sent requests</h2>
            <div className="space-y-3">
              {outgoing.map((f) => (
                <div key={f.id} className="card flex items-center gap-3 p-4">
                  <Avatar src={f.friend.avatar} name={f.friend.name} id={f.friend.id} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-900">{f.friend.name}</div>
                    <div className="text-xs text-gray-500">Pending · {f.friend.email}</div>
                  </div>
                  <button
                    onClick={() => removeMutation.mutate(f.id)}
                    className="btn btn-secondary btn-sm"
                  >
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="relative mb-6">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
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
            icon={<UserPlus className="h-8 w-8" />}
            title={search ? 'No friends found' : 'No friends yet'}
            description={
              search ? 'Try a different search' : 'Add friends to start splitting expenses'
            }
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
            {filtered.map((f: FriendEntry) => {
              const net = balances[f.friend.id] || 0;
              return (
                <div key={f.id} className="card flex items-center gap-3 p-4">
                  <Avatar src={f.friend.avatar} name={f.friend.name} id={f.friend.id} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-900">{f.friend.name}</div>
                    <div className="text-xs text-gray-500">{f.friend.email}</div>
                  </div>
                  {Math.abs(net) > 0.01 && (
                    <div
                      className={cn(
                        'text-right text-sm font-semibold',
                        net > 0 ? 'text-brand-600' : 'text-red-500',
                      )}
                    >
                      {net > 0 ? 'owes you' : 'you owe'}
                      <br />
                      {formatCurrency(Math.abs(net), session?.user.currency)}
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Link
                      href={`/expenses/new?friendId=${f.friend.id}`}
                      className="btn btn-ghost btn-sm p-2"
                      title="Add expense"
                    >
                      <DollarSign className="h-4 w-4" />
                    </Link>
                    {net > 0.01 && (
                      <button
                        onClick={() => remindMutation.mutate(f.friend.id)}
                        className="btn btn-ghost btn-sm p-2"
                        title="Send a reminder"
                      >
                        <Bell className="h-4 w-4" />
                      </button>
                    )}
                    {net < -0.01 && (
                      <PayLinks
                        friend={f.friend}
                        amount={Math.abs(net)}
                        currency={session?.user.currency || 'USD'}
                      />
                    )}
                    {Math.abs(net) > 0.01 && (
                      <Link
                        href={
                          net < 0
                            ? `/expenses/new?type=payment&receiverId=${f.friend.id}&amount=${Math.abs(net).toFixed(2)}&currency=${session?.user?.currency || 'USD'}`
                            : `/expenses/new?type=payment&receiverId=${session?.user?.id}&amount=${Math.abs(net).toFixed(2)}&payerId=${f.friend.id}&currency=${session?.user?.currency || 'USD'}`
                        }
                        className="btn btn-primary btn-sm gap-1.5"
                        title="Settle up"
                      >
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                        Settle
                      </Link>
                    )}
                    <button
                      onClick={() => setRemovingId(f.id)}
                      className="btn btn-ghost btn-sm p-2 text-red-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add a friend" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Enter their email address to send a friend request. They must already have a Splitlyst
            account.
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
              Send Request
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
  );
}
