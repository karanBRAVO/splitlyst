'use client';

import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { convertAmount } from '@/lib/currency';

/** Exchange rates (USD base), cached for an hour and shared by every <Money /> on the page. */
export function useRates() {
  const { data } = useQuery({
    queryKey: ['rates'],
    queryFn: async () => {
      const res = await fetch('/api/currency');
      if (!res.ok) throw new Error('rates unavailable');
      return (await res.json()).rates as Record<string, number>;
    },
    staleTime: 60 * 60 * 1000,
  });
  return data;
}

/** Convert into the signed-in user's preferred currency (null while rates are loading). */
export function useConvertToUserCurrency() {
  const { data: session } = useSession();
  const rates = useRates();
  const userCurrency = session?.user?.currency || 'USD';
  return {
    userCurrency,
    convert: (amount: number, from: string): number | null =>
      rates ? convertAmount(amount, from, userCurrency, rates) : null,
  };
}
