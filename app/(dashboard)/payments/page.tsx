'use client';

import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Wallet } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonList } from '@/components/ui/loading';
import { formatDate } from '@/lib/utils';
import { Money } from '@/components/ui/money';

type Person = { id: string; name: string; avatar: string | null };
type Payment = {
  id: string;
  amount: number;
  currency: string;
  notes: string | null;
  createdAt: string;
  payer: Person;
  receiver: Person;
};

export default function PaymentsPage() {
  const { data: session } = useSession();
  const { data: payments = [], isLoading } = useQuery<Payment[]>({
    queryKey: ['payments'],
    queryFn: () => fetch('/api/payments').then((r) => r.json()),
  });

  return (
    <div>
      <Header title="Payments" />
      <div className="mx-auto max-w-3xl px-4 py-6 lg:px-6">
        <h1 className="page-title mb-6 hidden lg:block">Payments</h1>

        {isLoading ? (
          <SkeletonList count={4} />
        ) : !Array.isArray(payments) || payments.length === 0 ? (
          <EmptyState
            icon={<Wallet className="h-8 w-8" />}
            title="No payments yet"
            description="Payments you record or receive when settling up will show here"
          />
        ) : (
          <div className="space-y-3">
            {payments.map((p) => {
              const sent = p.payer.id === session?.user?.id;
              return (
                <div key={p.id} className="card flex items-center gap-3 p-4">
                  <Avatar src={p.payer.avatar} name={p.payer.name} id={p.payer.id} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                      <span className="truncate">{sent ? 'You' : p.payer.name}</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      <span className="truncate">{!sent ? 'you' : p.receiver.name}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDate(p.createdAt)}
                      {p.notes ? ` · ${p.notes}` : ''}
                    </div>
                  </div>
                  <div
                    className={sent ? 'font-semibold text-red-500' : 'font-semibold text-brand-600'}
                  >
                    {sent ? '-' : '+'}
                    <Money amount={p.amount} currency={p.currency} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
