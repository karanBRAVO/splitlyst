'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, CheckCircle } from 'lucide-react'
import { toast } from '@/components/ui/toaster'
import { Spinner } from '@/components/ui/loading'

export default function ResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (password !== confirm) {
      toast({ type: 'error', title: "Passwords don't match" })
      return
    }
    if (password.length < 8) {
      toast({ type: 'error', title: 'Password must be at least 8 characters' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setDone(true)
      setTimeout(() => router.push('/login'), 2500)
    } catch (err) {
      toast({
        type: 'error',
        title: 'Reset failed',
        description: err instanceof Error ? err.message : 'Something went wrong',
      })
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="card p-8 text-center">
        <h1 className="mb-2 text-xl font-bold text-gray-900">Invalid link</h1>
        <p className="mb-4 text-sm text-gray-500">This reset link is missing a token.</p>
        <Link href="/forgot-password" className="btn btn-primary btn-md">
          Request a new link
        </Link>
      </div>
    )
  }

  if (done) {
    return (
      <div className="card p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50">
          <CheckCircle className="h-7 w-7 text-brand-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">Password updated!</h1>
        <p className="mt-1 text-sm text-gray-500">Redirecting you to sign in…</p>
      </div>
    )
  }

  return (
    <div className="card p-8">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Set new password</h1>
        <p className="mt-1 text-sm text-gray-500">Choose a password with at least 8 characters.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">New password</label>
          <div className="relative">
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPassword ? 'text' : 'password'}
              className="input pr-10"
              placeholder="Min. 8 characters"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="label">Confirm password</label>
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            type="password"
            className="input"
            placeholder="Repeat new password"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading || !password || !confirm}
          className="btn btn-primary btn-lg w-full"
        >
          {loading ? <Spinner className="h-4 w-4" /> : 'Update password'}
        </button>
      </form>
    </div>
  )
}
