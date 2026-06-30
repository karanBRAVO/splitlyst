'use client';

import { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

type ToastListener = (toasts: Toast[]) => void;

let toasts: Toast[] = [];
const listeners: Set<ToastListener> = new Set();

function notify() {
  listeners.forEach((l) => l([...toasts]));
}

export function toast(options: Omit<Toast, 'id'>) {
  const id = Math.random().toString(36).slice(2);
  const t: Toast = { ...options, id, duration: options.duration ?? 4000 };
  toasts = [t, ...toasts].slice(0, 5);
  notify();
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== id);
    notify();
  }, t.duration);
  return id;
}

export function useToasts() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    const handler = (t: Toast[]) => setItems(t);
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);
  return items;
}

const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="h-5 w-5 shrink-0 text-brand-500" />,
  error: <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />,
  info: <Info className="h-5 w-5 shrink-0 text-blue-500" />,
  warning: <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-500" />,
};

export function Toaster() {
  const items = useToasts();

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-full max-w-sm flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto flex animate-slide-up items-start gap-3 rounded-xl border bg-white p-4 shadow-lg',
            t.type === 'error' && 'border-red-200',
            t.type === 'success' && 'border-brand-200',
            t.type === 'warning' && 'border-yellow-200',
            t.type === 'info' && 'border-blue-200',
          )}
        >
          {icons[t.type]}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900">{t.title}</p>
            {t.description && <p className="mt-0.5 text-sm text-gray-500">{t.description}</p>}
          </div>
          <button
            onClick={() => {
              toasts = toasts.filter((x) => x.id !== t.id);
              notify();
            }}
            className="shrink-0 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
