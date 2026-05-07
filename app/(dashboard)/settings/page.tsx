'use client'

import { useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { signOut } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { Camera, Zap, LogOut, Shield, Globe, User } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Avatar } from '@/components/ui/avatar'
import { Spinner } from '@/components/ui/loading'
import { toast } from '@/components/ui/toaster'
import { CURRENCIES } from '@/types'
import { cn } from '@/lib/utils'

export default function SettingsPage() {
  const { data: session, update } = useSession()
  const queryClient = useQueryClient()
  const [activeSection, setActiveSection] = useState('profile')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar: data.url }),
      })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      await update({ image: data.url })
      toast({ type: 'success', title: 'Photo updated!' })
    } catch (err: any) {
      toast({ type: 'error', title: 'Upload failed', description: err.message })
    } finally {
      setUploadingAvatar(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => fetch('/api/users/me').then((r) => r.json()),
  })

  const profileForm = useForm({
    values: {
      name: profile?.name || '',
      bio: profile?.bio || '',
      phone: profile?.phone || '',
      currency: profile?.currency || 'USD',
      timezone: profile?.timezone || 'UTC',
    },
  })

  const passwordForm = useForm({
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  const updateProfile = useMutation({
    mutationFn: (data: any) =>
      fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(async (r) => {
        const json = await r.json()
        if (!r.ok) throw new Error(json.error)
        return json
      }),
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      await update({ name: data.name, currency: data.currency })
      toast({ type: 'success', title: 'Profile updated!' })
    },
    onError: (err: Error) => toast({ type: 'error', title: 'Failed', description: err.message }),
  })

  const upgradeToPro = useMutation({
    mutationFn: () =>
      fetch('/api/users/upgrade', { method: 'POST' }).then(async (r) => {
        const json = await r.json()
        if (!r.ok) throw new Error(json.error)
        return json
      }),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      await update({ isPro: true })
      toast({
        type: 'success',
        title: 'Welcome to Pro!',
        description: 'All Pro features are now unlocked.',
      })
    },
    onError: (err: Error) => toast({ type: 'error', title: 'Failed', description: err.message }),
  })

  const updatePassword = useMutation({
    mutationFn: (data: any) =>
      fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(async (r) => {
        const json = await r.json()
        if (!r.ok) throw new Error(json.error)
        return json
      }),
    onSuccess: () => {
      toast({ type: 'success', title: 'Password updated!' })
      passwordForm.reset()
    },
    onError: (err: Error) => toast({ type: 'error', title: 'Failed', description: err.message }),
  })

  const sections = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'preferences', label: 'Preferences', icon: Globe },
  ]

  if (isLoading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    )

  return (
    <div>
      <Header title="Settings" />
      <div className="mx-auto max-w-4xl px-4 py-6 lg:px-6">
        <h1 className="page-title mb-6 hidden lg:block">Settings</h1>

        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Sidebar */}
          <div className="shrink-0 lg:w-48">
            <nav className="scrollbar-none flex gap-1 overflow-x-auto lg:flex-col">
              {sections.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className={cn(
                    'flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                    activeSection === s.id
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-gray-600 hover:bg-gray-50'
                  )}
                >
                  <s.icon className="h-4 w-4 shrink-0" />
                  {s.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            {activeSection === 'profile' && (
              <div className="card space-y-6 p-6">
                <h2 className="font-semibold text-gray-900">Profile Settings</h2>

                {/* Avatar */}
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Avatar
                      src={session?.user?.image}
                      name={session?.user?.name || 'User'}
                      id={session?.user?.id}
                      size="xl"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 shadow-lg transition-colors hover:bg-brand-600 disabled:opacity-60"
                      title="Change photo"
                    >
                      {uploadingAvatar ? (
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : (
                        <Camera className="h-3.5 w-3.5 text-white" />
                      )}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{session?.user?.name}</div>
                    <div className="text-sm text-gray-500">{session?.user?.email}</div>
                    {profile?.isPro && (
                      <span className="badge badge-yellow mt-1 gap-1">
                        <Zap className="h-3 w-3" /> Pro
                      </span>
                    )}
                  </div>
                </div>

                <form
                  onSubmit={profileForm.handleSubmit((data) => updateProfile.mutate(data))}
                  className="space-y-4"
                >
                  <div>
                    <label className="label">Display name</label>
                    <input
                      {...profileForm.register('name')}
                      className="input"
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <label className="label">Phone (optional)</label>
                    <input
                      {...profileForm.register('phone')}
                      className="input"
                      placeholder="+1 (555) 000-0000"
                      type="tel"
                    />
                  </div>
                  <div>
                    <label className="label">Bio (optional)</label>
                    <textarea
                      {...profileForm.register('bio')}
                      className="input resize-none"
                      rows={3}
                      placeholder="Tell people a bit about yourself"
                    />
                  </div>
                  <div>
                    <label className="label">Stats</label>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      {[
                        { label: 'Expenses', value: profile?._count?.paidExpenses || 0 },
                        { label: 'Groups', value: profile?._count?.groupMembers || 0 },
                        {
                          label: 'Friends',
                          value:
                            (profile?._count?.friendsAsA || 0) + (profile?._count?.friendsAsB || 0),
                        },
                      ].map((stat) => (
                        <div key={stat.label} className="rounded-xl bg-gray-50 p-3">
                          <div className="text-xl font-bold text-gray-900">{stat.value}</div>
                          <div className="text-xs text-gray-500">{stat.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={updateProfile.isPending}
                    className="btn btn-primary btn-md"
                  >
                    {updateProfile.isPending ? <Spinner className="h-4 w-4" /> : 'Save Changes'}
                  </button>
                </form>
              </div>
            )}

            {activeSection === 'security' && (
              <div className="card space-y-6 p-6">
                <h2 className="font-semibold text-gray-900">Security</h2>
                <form
                  onSubmit={passwordForm.handleSubmit((data) => {
                    if (data.newPassword !== data.confirmPassword) {
                      toast({ type: 'error', title: "Passwords don't match" })
                      return
                    }
                    updatePassword.mutate({
                      currentPassword: data.currentPassword,
                      newPassword: data.newPassword,
                    })
                  })}
                  className="space-y-4"
                >
                  <div>
                    <label className="label">Current password</label>
                    <input
                      {...passwordForm.register('currentPassword', { required: true })}
                      type="password"
                      className="input"
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <label className="label">New password</label>
                    <input
                      {...passwordForm.register('newPassword', { required: true, minLength: 8 })}
                      type="password"
                      className="input"
                      placeholder="Min. 8 characters"
                    />
                  </div>
                  <div>
                    <label className="label">Confirm new password</label>
                    <input
                      {...passwordForm.register('confirmPassword', { required: true })}
                      type="password"
                      className="input"
                      placeholder="Repeat new password"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={updatePassword.isPending}
                    className="btn btn-primary btn-md"
                  >
                    {updatePassword.isPending ? <Spinner className="h-4 w-4" /> : 'Change Password'}
                  </button>
                </form>

                <div className="border-t border-gray-100 pt-6">
                  <h3 className="mb-3 font-medium text-gray-900">Account</h3>
                  <button
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    className="btn btn-danger btn-md gap-2"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </div>
            )}

            {activeSection === 'preferences' && (
              <div className="card space-y-6 p-6">
                <h2 className="font-semibold text-gray-900">Preferences</h2>
                <form
                  onSubmit={profileForm.handleSubmit((data) => updateProfile.mutate(data))}
                  className="space-y-4"
                >
                  <div>
                    <label className="label">Default currency</label>
                    <select {...profileForm.register('currency')} className="input">
                      {CURRENCIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.symbol} {c.code} — {c.name}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-400">
                      Used as the default for new expenses
                    </p>
                  </div>
                  <div>
                    <label className="label">Timezone</label>
                    <select {...profileForm.register('timezone')} className="input">
                      {[
                        'UTC',
                        'America/New_York',
                        'America/Chicago',
                        'America/Denver',
                        'America/Los_Angeles',
                        'Europe/London',
                        'Europe/Paris',
                        'Europe/Berlin',
                        'Asia/Tokyo',
                        'Asia/Shanghai',
                        'Asia/Kolkata',
                        'Australia/Sydney',
                      ].map((tz) => (
                        <option key={tz} value={tz}>
                          {tz}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={updateProfile.isPending}
                    className="btn btn-primary btn-md"
                  >
                    {updateProfile.isPending ? <Spinner className="h-4 w-4" /> : 'Save Preferences'}
                  </button>
                </form>

                {!profile?.isPro ? (
                  <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <Zap className="h-4 w-4 text-brand-600" />
                      <span className="font-semibold text-brand-700">Upgrade to Pro</span>
                    </div>
                    <p className="mb-3 text-sm text-brand-600">
                      Unlock advanced analytics, recurring expense templates, smart settle-up, and
                      more.
                    </p>
                    <button
                      onClick={() => upgradeToPro.mutate()}
                      disabled={upgradeToPro.isPending}
                      className="btn btn-primary btn-sm gap-1.5"
                    >
                      <Zap className="h-3.5 w-3.5" />
                      {upgradeToPro.isPending ? 'Activating…' : 'Activate Pro — Free'}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4">
                    <Zap className="h-5 w-5 shrink-0 text-brand-600" />
                    <div>
                      <div className="font-semibold text-brand-700">You&apos;re on Pro</div>
                      <div className="text-sm text-brand-600">All Pro features are active.</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
