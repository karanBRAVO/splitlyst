'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { MailWarning } from 'lucide-react';
import { toast } from '@/components/ui/toaster';
import { useT } from '@/lib/use-t';

export function VerifyBanner() {
  const t = useT();
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => fetch('/api/users/me').then((r) => r.json()),
  });

  const resend = useMutation({
    mutationFn: () =>
      fetch('/api/auth/verify-email', { method: 'POST' }).then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error);
        return json as { devUrl?: string; alreadyVerified?: boolean };
      }),
    onSuccess: (res) =>
      toast({
        type: 'success',
        title: res.alreadyVerified ? 'Already verified' : 'Verification email sent',
        description: res.devUrl ? `Dev link: ${res.devUrl}` : undefined,
      }),
    onError: (err: Error) => toast({ type: 'error', title: 'Failed', description: err.message }),
  });

  if (!profile || profile.error || profile.emailVerified) return null;

  return (
    <div
      data-testid="verify-banner"
      className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800"
    >
      <MailWarning className="h-4 w-4 shrink-0" />
      <span className="flex-1">{t('verify.banner')}</span>
      <button
        onClick={() => resend.mutate()}
        disabled={resend.isPending}
        className="font-medium underline hover:no-underline"
      >
        {t('verify.resend')}
      </button>
    </div>
  );
}
