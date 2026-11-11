'use client';

import { useSession } from 'next-auth/react';
import { translate } from '@/lib/i18n';

/** Returns a translate function bound to the signed-in user's language. */
export function useT() {
  const { data: session } = useSession();
  const locale = session?.user?.locale;
  return (key: string) => translate(locale, key);
}
