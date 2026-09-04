import Link from 'next/link';
import { TrendingUp, DollarSign, BarChart3, Shield, Zap, Check } from 'lucide-react';
import { PLANS } from '@/lib/stripe';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-8 w-8 text-brand-600" />
            <span className="text-xl font-bold text-gray-900">MarginMind</span>
          </div>
          <nav className="flex gap-4">
            <Link href="/login" className="text-gray-600 hover:text-gray-900 px-3 py-2">
              Log in
            </Link>
            <Link href="/login" className="btn-primary">
              Get Started Free
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          Know Your <span className="text-brand-600">True Profit</span> on Every Sale
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
          Stop guessing. MarginMind connects to your Shopify, Amazon, and other stores to show
          you exactly how much you're making after fees, shipping, and ad spend.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/login" className="btn-primary text-lg px-8 py-3">
            Start Free Trial
          </Link>
          <Link href="#pricing" className="btn-secondary text-lg px-8 py-3">
            View Pricing
          </Link>
        </div>
        <p className="text-sm text-gray-500 mt-4">14-day free trial · No credit card required</p>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
          Everything You Need to Maximize Profits
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="card p-6">
            <DollarSign className="h-12 w-12 text-brand-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">True Profit Calculation</h3>
            <p className="text-gray-600">
              Automatically calculate net profit after all fees, shipping costs, and ad spend.
              No more spreadsheets.
            </p>
          </div>
          <div className="card p-6">
            <BarChart3 className="h-12 w-12 text-brand-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Real-Time Analytics</h3>
            <p className="text-gray-600">
              See your profit margins, revenue trends, and top-performing products in real time.
            </p>
          </div>
          <div className="card p-6">
            <Shield className="h-12 w-12 text-brand-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Multi-Platform</h3>
            <p className="text-gray-600">
              Connect Shopify, Amazon, Etsy, and WooCommerce. Track all your stores in one place.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-brand-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-brand-600">1</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Connect Your Store</h3>
              <p className="text-gray-600">
                Securely link your Shopify, Amazon, or other e-commerce platforms in seconds.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-brand-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-brand-600">2</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">We Sync Your Data</h3>
              <p className="text-gray-600">
                Orders, products, and costs are automatically imported and organized.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-brand-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-brand-600">3</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">See Your Profits</h3>
              <p className="text-gray-600">
                Get clear insights on exactly how much you're making on every sale.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">
          Simple, Transparent Pricing
        </h2>
        <p className="text-center text-gray-600 mb-12">
          Start free, upgrade when you're ready. All plans include a 14-day free trial.
        </p>
        <div className="grid md:grid-cols-4 gap-6">
          {Object.values(PLANS).map((plan) => (
            <div
              key={plan.id}
              className={`card p-6 ${
                plan.id === 'PRO' ? 'border-brand-500 border-2 relative' : ''
              }`}
            >
              {plan.id === 'PRO' && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                  Most Popular
                </span>
              )}
              <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
              <div className="mb-4">
                <span className="text-4xl font-bold">${plan.price}</span>
                {plan.price > 0 && <span className="text-gray-500">/month</span>}
              </div>
              <ul className="space-y-2 mb-6">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-brand-600 mt-0.5 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/login"
                className={`block text-center py-2 rounded-md ${
                  plan.id === 'PRO' ? 'btn-primary' : 'btn-secondary'
                }`}
              >
                {plan.price === 0 ? 'Get Started' : 'Start Free Trial'}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-brand-600 py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Start Maximizing Your Profits Today
          </h2>
          <p className="text-brand-100 mb-8">
            Join thousands of e-commerce sellers who know their true numbers.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center bg-white text-brand-600 font-semibold px-8 py-3 rounded-md hover:bg-brand-50 transition-colors"
          >
            Get Started Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-brand-500" />
              <span className="font-semibold text-white">MarginMind</span>
            </div>
            <p className="text-sm">© 2024 MarginMind. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
