'use client';

import { SessionProvider } from 'next-auth/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { flushQueue, queuedCount } from '@/lib/offline-queue';
import { toast } from '@/components/ui/toaster';
import { Toaster } from '@/components/ui/toaster';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            retry: 1,
          },
        },
      }),
  );

  // Replay expenses that were saved while offline.
  useEffect(() => {
    const flush = async () => {
      if (queuedCount() === 0) return;
      const { sent, dropped } = await flushQueue();
      if (sent > 0) {
        queryClient.invalidateQueries();
        toast({ type: 'success', title: `Synced ${sent} offline expense${sent > 1 ? 's' : ''}` });
      }
      if (dropped > 0) {
        toast({ type: 'error', title: `${dropped} offline expense(s) could not be saved` });
      }
    };
    flush();
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, [queryClient]);

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster />
      </QueryClientProvider>
    </SessionProvider>
  );
}
