'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { toast } from '@/components/ui/toaster';
import { Spinner } from '@/components/ui/loading';

async function call(body: Record<string, unknown>) {
  const r = await fetch('/api/users/me/2fa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await r.json();
  if (!r.ok) throw new Error(json.error);
  return json;
}

export function TwoFactorCard({ enabled }: { enabled: boolean }) {
  const queryClient = useQueryClient();
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [recovery, setRecovery] = useState<string[] | null>(null);

  const onError = (err: Error) =>
    toast({ type: 'error', title: 'Two-factor authentication', description: err.message });

  const start = useMutation({
    mutationFn: () => call({ action: 'setup' }),
    onSuccess: (res) => setSetup(res),
    onError,
  });
  const enable = useMutation({
    mutationFn: () => call({ action: 'enable', code }),
    onSuccess: (res) => {
      setRecovery(res.recoveryCodes);
      setSetup(null);
      setCode('');
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast({ type: 'success', title: 'Two-factor authentication enabled' });
    },
    onError,
  });
  const disable = useMutation({
    mutationFn: () => call({ action: 'disable', password }),
    onSuccess: () => {
      setPassword('');
      setRecovery(null);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast({ type: 'success', title: 'Two-factor authentication disabled' });
    },
    onError,
  });

  return (
    <div className="border-t border-gray-100 pt-6" data-testid="two-factor">
      <h3 className="mb-1 flex items-center gap-2 font-medium text-gray-900">
        <ShieldCheck className="h-4 w-4" /> Two-factor authentication
      </h3>
      <p className="mb-3 text-sm text-gray-500">
        {enabled
          ? 'Enabled. You will be asked for a code from your authenticator app when signing in.'
          : 'Add a second step at sign-in using an authenticator app (Google Authenticator, Authy, 1Password…).'}
      </p>

      {recovery && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-2 text-sm font-medium text-amber-800">
            Save these recovery codes now — each works once and they won&apos;t be shown again.
          </p>
          <div className="grid grid-cols-2 gap-1 font-mono text-sm" data-testid="recovery-codes">
            {recovery.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
        </div>
      )}

      {!enabled && !setup && (
        <button
          onClick={() => start.mutate()}
          disabled={start.isPending}
          className="btn btn-secondary btn-md"
        >
          {start.isPending ? <Spinner className="h-4 w-4" /> : 'Set up two-factor'}
        </button>
      )}

      {!enabled && setup && (
        <div className="space-y-3">
          <img src={setup.qr} alt="2FA QR code" className="h-40 w-40 rounded-lg border" />
          <p className="text-xs text-gray-500">
            Can&apos;t scan? Enter this key manually:{' '}
            <code data-testid="totp-secret" className="font-mono">
              {setup.secret}
            </code>
          </p>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              className="input max-w-[10rem]"
              placeholder="6-digit code"
              data-testid="totp-code"
            />
            <button
              onClick={() => enable.mutate()}
              disabled={code.replace(/\s/g, '').length !== 6 || enable.isPending}
              className="btn btn-primary btn-md"
            >
              Verify & enable
            </button>
          </div>
        </div>
      )}

      {enabled && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            placeholder="Password to disable"
          />
          <button
            onClick={() => disable.mutate()}
            disabled={!password || disable.isPending}
            className="btn btn-danger btn-md whitespace-nowrap"
          >
            Disable
          </button>
        </div>
      )}
    </div>
  );
}
