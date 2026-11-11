'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft, Copy, CheckCircle } from 'lucide-react';
import { toast } from '@/components/ui/toaster';
import { Spinner } from '@/components/ui/loading';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // resetUrl is returned for self-hosted installs without an email service
      setResetUrl(data.resetUrl || null);
      if (!data.resetUrl) {
        toast({
          type: 'success',
          title: 'Request received',
          description:
            "If an account exists for that email, we've sent a reset link. Check your inbox and spam folder.",
        });
      }
    } catch (err) {
      toast({
        type: 'error',
        title: 'Error',
        description: err instanceof Error ? err.message : 'Something went wrong',
      });
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    if (!resetUrl) return;
    navigator.clipboard.writeText(resetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (resetUrl) {
    return (
      <div className="card p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50">
            <CheckCircle className="h-7 w-7 text-brand-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Reset link ready</h1>
          <p className="mt-1 text-sm text-gray-500">
            Copy this link and open it to set your new password. It expires in 1 hour.
          </p>
        </div>

        <div className="mb-4 flex items-center gap-2 rounded-xl bg-gray-50 p-3 break-all">
          <span className="flex-1 text-xs text-gray-600">{resetUrl}</span>
          <button
            onClick={copyLink}
            className="btn btn-ghost btn-sm shrink-0 p-2"
            title="Copy link"
          >
            {copied ? (
              <CheckCircle className="h-4 w-4 text-brand-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        </div>

        <Link href={resetUrl} className="btn btn-primary btn-lg mb-3 w-full">
          Open reset page
        </Link>
        <Link href="/login" className="btn btn-secondary btn-lg w-full">
          Back to sign in
        </Link>

        <p className="mt-4 text-center text-xs text-gray-400">
          Note: In production, configure SMTP to email this link automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-8">
      <div className="mb-8">
        <Link
          href="/login"
          className="mb-6 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Forgot password?</h1>
        <p className="mt-1 text-sm text-gray-500">
          Enter your email and we&apos;ll generate a reset link.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Email address</label>
          <div className="relative">
            <Mail className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              className="input pl-10"
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !email}
          className="btn btn-primary btn-lg w-full"
        >
          {loading ? <Spinner className="h-4 w-4" /> : 'Send reset link'}
        </button>
      </form>
    </div>
  );
}
