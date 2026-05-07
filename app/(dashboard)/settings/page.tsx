'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { signOut } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { Camera, Zap, LogOut, Shield, Bell, Globe, User } from 'lucide-react'
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

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Spinner className="w-8 h-8" />
    </div>
  )

  return (
    <div>
      <Header title="Settings" />
      <div className="max-w-4xl mx-auto px-4 py-6 lg:px-6">
        <h1 className="page-title hidden lg:block mb-6">Settings</h1>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar */}
          <div className="lg:w-48 shrink-0">
            <nav className="flex lg:flex-col gap-1 overflow-x-auto scrollbar-none">
              {sections.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all',
                    activeSection === s.id
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-gray-600 hover:bg-gray-50'
                  )}
                >
                  <s.icon className="w-4 h-4 shrink-0" />
                  {s.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {activeSection === 'profile' && (
              <div className="card p-6 space-y-6">
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
                    <button className="absolute bottom-0 right-0 w-7 h-7 bg-brand-500 rounded-full flex items-center justify-center shadow-lg hover:bg-brand-600 transition-colors">
                      <Camera className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{session?.user?.name}</div>
                    <div className="text-sm text-gray-500">{session?.user?.email}</div>
                    {profile?.isPro && (
                      <span className="badge badge-yellow mt-1 gap-1">
                        <Zap className="w-3 h-3" /> Pro
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
                    <input {...profileForm.register('name')} className="input" placeholder="Your name" />
                  </div>
                  <div>
                    <label className="label">Phone (optional)</label>
                    <input {...profileForm.register('phone')} className="input" placeholder="+1 (555) 000-0000" type="tel" />
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
                        { label: 'Friends', value: (profile?._count?.friendsAsA || 0) + (profile?._count?.friendsAsB || 0) },
                      ].map((stat) => (
                        <div key={stat.label} className="bg-gray-50 rounded-xl p-3">
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
                    {updateProfile.isPending ? <Spinner className="w-4 h-4" /> : 'Save Changes'}
                  </button>
                </form>
              </div>
            )}

            {activeSection === 'security' && (
              <div className="card p-6 space-y-6">
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
                  <button type="submit" disabled={updatePassword.isPending} className="btn btn-primary btn-md">
                    {updatePassword.isPending ? <Spinner className="w-4 h-4" /> : 'Change Password'}
                  </button>
                </form>

                <div className="border-t border-gray-100 pt-6">
                  <h3 className="font-medium text-gray-900 mb-3">Account</h3>
                  <button
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    className="btn btn-danger btn-md gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              </div>
            )}

            {activeSection === 'preferences' && (
              <div className="card p-6 space-y-6">
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
                    <p className="text-xs text-gray-400 mt-1">Used as the default for new expenses</p>
                  </div>
                  <div>
                    <label className="label">Timezone</label>
                    <select {...profileForm.register('timezone')} className="input">
                      {['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
                        'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai',
                        'Asia/Kolkata', 'Australia/Sydney'].map((tz) => (
                        <option key={tz} value={tz}>{tz}</option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" disabled={updateProfile.isPending} className="btn btn-primary btn-md">
                    {updateProfile.isPending ? <Spinner className="w-4 h-4" /> : 'Save Preferences'}
                  </button>
                </form>

                {!profile?.isPro && (
                  <div className="border border-brand-200 bg-brand-50 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-4 h-4 text-brand-600" />
                      <span className="font-semibold text-brand-700">Upgrade to Pro</span>
                    </div>
                    <p className="text-sm text-brand-600 mb-3">
                      Unlock advanced analytics, receipt scanning, recurring expense templates, and more.
                    </p>
                    <button className="btn btn-primary btn-sm">Upgrade — $4.99/mo</button>
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
