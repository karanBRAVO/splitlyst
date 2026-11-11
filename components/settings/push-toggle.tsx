'use client';

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { toast } from '@/components/ui/toaster';

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function PushToggle() {
  const [supported, setSupported] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    if (!ok) return;
    fetch('/api/push')
      .then((r) => r.json())
      .then((j) => {
        setSupported(true);
        setConfigured(!!j.enabled);
      });
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => {});
  }, []);

  if (!supported || !configured) return null;

  const toggle = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      if (subscribed) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await fetch('/api/push', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
          await sub.unsubscribe();
        }
        setSubscribed(false);
        toast({ type: 'success', title: 'Push notifications off' });
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Notification permission was denied');
      const { publicKey } = await fetch('/api/push').then((r) => r.json());
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const res = await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setSubscribed(true);
      toast({ type: 'success', title: 'Push notifications on' });
    } catch (err) {
      toast({ type: 'error', title: 'Push notifications', description: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-3">
        <Bell className="h-5 w-5 text-gray-500" />
        <div>
          <div className="text-sm font-medium text-gray-900">Push notifications</div>
          <div className="text-xs text-gray-500">
            New expenses, payments and reminders on this device
          </div>
        </div>
      </div>
      <button
        onClick={toggle}
        disabled={busy}
        data-testid="push-toggle"
        className={subscribed ? 'btn btn-secondary btn-sm' : 'btn btn-primary btn-sm'}
      >
        {subscribed ? 'Turn off' : 'Turn on'}
      </button>
    </div>
  );
}
