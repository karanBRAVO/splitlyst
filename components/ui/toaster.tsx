'use client'

import { useEffect, useState } from 'react'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  type: ToastType
  title: string
  description?: string
  duration?: number
}

type ToastListener = (toasts: Toast[]) => void

let toasts: Toast[] = []
const listeners: Set<ToastListener> = new Set()

function notify() {
  listeners.forEach((l) => l([...toasts]))
}

export function toast(options: Omit<Toast, 'id'>) {
  const id = Math.random().toString(36).slice(2)
  const t: Toast = { ...options, id, duration: options.duration ?? 4000 }
  toasts = [t, ...toasts].slice(0, 5)
  notify()
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== id)
    notify()
  }, t.duration)
  return id
}

export function useToasts() {
  const [items, setItems] = useState<Toast[]>([])
  useEffect(() => {
    const handler = (t: Toast[]) => setItems(t)
    listeners.add(handler)
    return () => { listeners.delete(handler) }
  }, [])
  return items
}

const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="w-5 h-5 text-brand-500 shrink-0" />,
  error: <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />,
  info: <Info className="w-5 h-5 text-blue-500 shrink-0" />,
  warning: <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />,
}

export function Toaster() {
  const items = useToasts()

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {items.map((t) => (
        <div
          key={t.id}
          className={cn(
            'flex items-start gap-3 p-4 rounded-xl shadow-lg border bg-white pointer-events-auto animate-slide-up',
            t.type === 'error' && 'border-red-200',
            t.type === 'success' && 'border-brand-200',
            t.type === 'warning' && 'border-yellow-200',
            t.type === 'info' && 'border-blue-200'
          )}
        >
          {icons[t.type]}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">{t.title}</p>
            {t.description && (
              <p className="text-sm text-gray-500 mt-0.5">{t.description}</p>
            )}
          </div>
          <button
            onClick={() => {
              toasts = toasts.filter((x) => x.id !== t.id)
              notify()
            }}
            className="text-gray-400 hover:text-gray-600 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
