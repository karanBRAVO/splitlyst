'use client';

import { useEffect, useState } from 'react';
import { getProviders, signIn } from 'next-auth/react';
import { GoogleIcon } from '@/components/ui/google-icon';

/**
 * "or — Continue with Google", shown on the login and sign-up pages. It only appears when the server
 * has Google configured (GOOGLE_CLIENT_ID/SECRET). Google creates the account on first use, so the
 * same button serves both signing in and signing up.
 */
export function GoogleButton({ callbackUrl = '/dashboard' }: { callbackUrl?: string }) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    getProviders().then((p) => setEnabled(!!p?.google));
  }, []);

  if (!enabled) return null;

  return (
    <>
      <div className="my-4 flex items-center gap-3 text-xs text-gray-400">
        <div className="h-px flex-1 bg-gray-200" /> or <div className="h-px flex-1 bg-gray-200" />
      </div>
      <button
        type="button"
        onClick={() => signIn('google', { callbackUrl })}
        className="btn btn-secondary btn-lg w-full gap-3"
        data-testid="google-signin"
      >
        <GoogleIcon className="h-5 w-5" />
        Continue with Google
      </button>
    </>
  );
}
