import Link from 'next/link'
import { Zap, Users, BarChart3, Shield, Smartphone, Globe } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100 sticky top-0 bg-white/80 backdrop-blur-md z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 gradient-brand rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">Splitlyst</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="btn btn-ghost btn-md">
              Sign in
            </Link>
            <Link href="/register" className="btn btn-primary btn-md">
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 pt-20 pb-24 text-center">
        <div className="inline-flex items-center gap-2 bg-brand-50 text-brand-700 rounded-full px-4 py-1.5 text-sm font-medium mb-8">
          <Zap className="w-3.5 h-3.5" />
          Free to use · No credit card required
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 mb-6 leading-tight text-balance">
          Split expenses.
          <br />
          <span className="text-transparent bg-clip-text gradient-brand">Stay friends.</span>
        </h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10 text-balance">
          Track shared expenses effortlessly with friends and groups. Split by equal shares,
          percentages, or custom amounts. Settle up in seconds.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/register" className="btn btn-primary btn-lg w-full sm:w-auto">
            Start splitting for free
          </Link>
          <Link href="/login" className="btn btn-secondary btn-lg w-full sm:w-auto">
            Sign in to your account
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 border-y border-gray-200 py-20">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            Everything you need to split fairly
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: Users,
                title: 'Groups & Friends',
                desc: 'Organize expenses by trips, households, or friend groups. Invite members with a link.',
                color: 'bg-blue-50 text-blue-600',
              },
              {
                icon: BarChart3,
                title: 'Smart Analytics',
                desc: 'Visualize spending patterns, track categories, and get insights into where your money goes.',
                color: 'bg-purple-50 text-purple-600',
              },
              {
                icon: Globe,
                title: 'Multi-Currency',
                desc: 'Travel the world and track expenses in local currencies with automatic conversion.',
                color: 'bg-orange-50 text-orange-600',
              },
              {
                icon: Shield,
                title: 'Secure & Private',
                desc: 'Your financial data is encrypted and never sold. We take privacy seriously.',
                color: 'bg-brand-50 text-brand-600',
              },
              {
                icon: Smartphone,
                title: 'Works Offline',
                desc: 'Install as a PWA on your phone. Add expenses even without an internet connection.',
                color: 'bg-pink-50 text-pink-600',
              },
              {
                icon: Zap,
                title: 'Instant Settle Up',
                desc: 'Automatically calculate the minimum number of payments needed to settle all debts.',
                color: 'bg-yellow-50 text-yellow-600',
              },
            ].map((f) => (
              <div key={f.title} className="card p-6">
                <div className={`w-10 h-10 rounded-xl ${f.color} flex items-center justify-center mb-4`}>
                  <f.icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Split types */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Split any way you want
            </h2>
            <p className="text-gray-500 mb-8">
              Not every expense should be split equally. Splitlyst supports four flexible
              split types to match how you actually share costs.
            </p>
            <div className="space-y-4">
              {[
                { type: 'Equal split', desc: 'Everyone pays the same amount' },
                { type: 'Percentage split', desc: 'Each person pays a percentage of the total' },
                { type: 'Share-based split', desc: 'Assign shares — pay proportionally' },
                { type: 'Custom split', desc: 'Enter exact amounts per person' },
              ].map((item) => (
                <div key={item.type} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center mt-0.5 shrink-0">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 12 12">
                      <path d="M10 3L5 8.5 2 5.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-900">{item.type}</span>
                    <p className="text-sm text-gray-500">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-6 space-y-3">
            <div className="text-sm font-medium text-gray-500 mb-2">Sample expense</div>
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div>
                <div className="font-semibold text-gray-900">Dinner at Nobu</div>
                <div className="text-sm text-gray-500">Paid by Alex · Food & Drink</div>
              </div>
              <div className="text-lg font-bold text-gray-900">$180.00</div>
            </div>
            <div className="space-y-2 pt-1">
              {[
                { name: 'Alex', amount: '$45.00', paid: true },
                { name: 'Jordan', amount: '$45.00', paid: false },
                { name: 'Sam', amount: '$45.00', paid: false },
                { name: 'Riley', amount: '$45.00', paid: false },
              ].map((p) => (
                <div key={p.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center text-xs font-semibold text-brand-700">
                      {p.name[0]}
                    </div>
                    <span className="text-sm text-gray-700">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{p.amount}</span>
                    {p.paid ? (
                      <span className="badge badge-green">paid</span>
                    ) : (
                      <span className="badge badge-red">owes</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="gradient-brand py-20">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to stop doing the math?
          </h2>
          <p className="text-brand-100 mb-8">
            Join thousands of people who use Splitlyst to keep friendships and finances separate.
          </p>
          <Link href="/register" className="btn bg-white text-brand-600 hover:bg-brand-50 btn-lg font-semibold">
            Create your free account
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 gradient-brand rounded flex items-center justify-center">
              <Zap className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-medium text-gray-600">Splitlyst</span>
          </div>
          <p className="text-sm text-gray-400">
            © {new Date().getFullYear()} Splitlyst. Built for real friendships.
          </p>
        </div>
      </footer>
    </div>
  )
}
