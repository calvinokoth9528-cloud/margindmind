'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  TrendingUp,
  ShoppingCart,
  Package,
  Settings,
  LogOut,
  Globe,
  User,
  Bell,
  Shield,
  CreditCard,
  Save,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  KeyRound,
} from 'lucide-react';
import { PLANS } from '@/lib/stripe';

interface SettingsData {
  user: { id: string; email: string; name: string | null };
  settings: {
    emailNotifications: boolean;
    orderAlerts: boolean;
    weeklyReports: boolean;
    marketingEmails: boolean;
  };
  subscription: {
    plan: string;
    status: string;
    currentPeriodEnd: string | null;
  } | null;
}

const NOTIFICATION_LABELS = [
  { key: 'emailNotifications', label: 'Email notifications' },
  { key: 'orderAlerts', label: 'Order alerts (new orders, sync issues)' },
  { key: 'weeklyReports', label: 'Weekly profit summary' },
  { key: 'marketingEmails', label: 'Product news & tips' },
] as const;

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [notificationPrefs, setNotificationPrefs] = useState<
    SettingsData['settings']
  >({ emailNotifications: true, orderAlerts: true, weeklyReports: false, marketingEmails: false });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Password form state
  const [pwOpen, setPwOpen] = useState(false);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');

  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const result = await response.json();
        setData(result);
        setName(result.user.name || '');
        setNotificationPrefs(result.settings);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchSettings();
    }
  }, [session, fetchSettings]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setNotice(null);
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, settings: notificationPrefs }),
      });

      if (response.ok) {
        setNotice({ type: 'success', text: 'Settings saved.' });
        // Keep the session display name fresh for the dashboard greeting
        await fetchSettings();
      } else {
        const result = await response.json();
        setNotice({ type: 'error', text: result.error || 'Failed to save settings.' });
      }
    } catch (err) {
      console.error('Save settings failed:', err);
      setNotice({ type: 'error', text: 'Failed to save settings.' });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwNew !== pwConfirm) {
      setPwError('New passwords do not match.');
      return;
    }
    try {
      setPwSaving(true);
      setPwError('');
      const response = await fetch('/api/settings/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew }),
      });
      const result = await response.json();

      if (response.ok) {
        setNotice({ type: 'success', text: 'Password changed successfully.' });
        setPwOpen(false);
        setPwCurrent('');
        setPwNew('');
        setPwConfirm('');
      } else {
        setPwError(result.error || 'Failed to change password.');
      }
    } catch (err) {
      console.error('Password change failed:', err);
      setPwError('Failed to change password.');
    } finally {
      setPwSaving(false);
    }
  };

  const handleUpgrade = async (planId: string) => {
    try {
      setCheckoutLoading(planId);
      setNotice(null);
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId }),
      });
      const result = await response.json();

      if (response.ok && result.url) {
        window.location.href = result.url;
      } else {
        const msg =
          result.error === 'Stripe is not configured'
            ? 'Stripe is not configured yet. Add your Stripe keys to enable upgrades.'
            : result.error || 'Could not start checkout.';
        setNotice({ type: 'error', text: msg });
      }
    } catch (err) {
      console.error('Checkout failed:', err);
      setNotice({ type: 'error', text: 'Could not start checkout.' });
    } finally {
      setCheckoutLoading(null);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  if (!session) return null;

  const currentPlan = data?.subscription?.plan || 'FREE';
  const paidPlanIds = ['STARTER', 'PRO', 'ENTERPRISE'];
  const planOrder = ['FREE', 'STARTER', 'PRO', 'ENTERPRISE'];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-8">
          <TrendingUp className="h-8 w-8 text-brand-600" />
          <span className="text-xl font-bold text-gray-900">MarginMind</span>
        </div>

        <nav className="space-y-1">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-md"
          >
            <TrendingUp className="h-5 w-5" />
            Dashboard
          </Link>
          <Link
            href="/orders"
            className="flex items-center gap-3 px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-md"
          >
            <ShoppingCart className="h-5 w-5" />
            Orders
          </Link>
          <Link
            href="/products"
            className="flex items-center gap-3 px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-md"
          >
            <Package className="h-5 w-5" />
            Products
          </Link>
          <Link
            href="/stores"
            className="flex items-center gap-3 px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-md"
          >
            <Globe className="h-5 w-5" />
            Stores
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-3 px-3 py-2 bg-brand-50 text-brand-700 rounded-md"
          >
            <Settings className="h-5 w-5" />
            Settings
          </Link>
        </nav>

        <div className="absolute bottom-4 left-4 right-4">
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="flex items-center gap-3 px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-md w-full"
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </button>
        </div>
      </aside>

      <main className="ml-64 p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        </div>

        {notice && (
          <div
            className={`card p-4 mb-6 flex items-center gap-2 ${
              notice.type === 'success'
                ? 'border-green-200 bg-green-50'
                : 'border-red-200 bg-red-50'
            }`}
          >
            {notice.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600" />
            )}
            <p
              className={`text-sm ${
                notice.type === 'success' ? 'text-green-700' : 'text-red-700'
              }`}
            >
              {notice.text}
            </p>
          </div>
        )}

        <div className="space-y-6 max-w-3xl">
          {/* Profile Section */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-4">
              <User className="h-5 w-5 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-900">Profile</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={data?.user.email || ''}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                />
                <p className="text-xs text-gray-400 mt-1">Email changes coming soon.</p>
              </div>
            </div>
          </div>

          {/* Notification Settings */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-4">
              <Bell className="h-5 w-5 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
            </div>
            <div className="space-y-3">
              {NOTIFICATION_LABELS.map((item) => (
                <label key={item.key} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{item.label}</span>
                  <input
                    type="checkbox"
                    checked={notificationPrefs[item.key]}
                    onChange={(e) =>
                      setNotificationPrefs((prev) => ({
                        ...prev,
                        [item.key]: e.target.checked,
                      }))
                    }
                    className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                  />
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Preferences are saved per account. Email delivery will activate once SMTP is
              configured.
            </p>
          </div>

          {/* Billing Section */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-4">
              <CreditCard className="h-5 w-5 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-900">Billing</h3>
            </div>

            <div className="mb-4 p-4 bg-gray-50 rounded-md flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">
                  Current plan:{' '}
                  <span className="font-semibold text-gray-900 capitalize">
                    {currentPlan.toLowerCase()}
                  </span>
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Status:{' '}
                  <span className="capitalize">
                    {data?.subscription?.status || 'active'}
                  </span>
                  {data?.subscription?.currentPeriodEnd
                    ? ` · renews ${new Date(
                        data.subscription.currentPeriodEnd
                      ).toLocaleDateString()}`
                    : ''}
                </p>
              </div>
              <Sparkles className="h-6 w-6 text-brand-500" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              {paidPlanIds.map((planId) => {
                const plan = PLANS[planId];
                const isCurrent = planId === currentPlan;
                const isDowngrade =
                  planOrder.indexOf(planId) < planOrder.indexOf(currentPlan);
                return (
                  <button
                    key={planId}
                    onClick={() => handleUpgrade(planId)}
                    disabled={isCurrent || checkoutLoading !== null}
                    className={`p-4 rounded-lg border text-left transition-colors ${
                      isCurrent
                        ? 'border-brand-500 bg-brand-50 cursor-default'
                        : 'border-gray-200 hover:border-brand-300 hover:bg-brand-50/50 disabled:opacity-50'
                    }`}
                  >
                    <p className="font-semibold text-gray-900">{plan.name}</p>
                    <p className="text-sm text-gray-500">
                      ${plan.price}
                      {plan.price > 0 ? '/month' : ''}
                    </p>
                    {isCurrent && (
                      <p className="text-xs text-brand-600 font-medium mt-1">
                        ✓ Current plan
                      </p>
                    )}
                    {!isCurrent &&
                      (isDowngrade ? (
                        <p className="text-xs text-gray-500 mt-1">Switch plan</p>
                      ) : (
                        <p className="text-xs text-brand-600 font-medium mt-1">
                          {checkoutLoading === planId ? 'Redirecting…' : 'Upgrade'}
                        </p>
                      ))}
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-gray-400">
              Upgrades run through Stripe checkout. Billing management (invoices, cancel)
              is available in the Stripe customer portal once keys are configured.
            </p>
          </div>

          {/* Security Section */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="h-5 w-5 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-900">Security</h3>
            </div>

            {!pwOpen ? (
              <button
                onClick={() => setPwOpen(true)}
                className="btn-secondary text-left w-full"
              >
                <KeyRound className="h-4 w-4 mr-2" />
                Change Password
              </button>
            ) : (
              <form onSubmit={handleChangePassword} className="space-y-3 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Current password
                  </label>
                  <input
                    type="password"
                    value={pwCurrent}
                    onChange={(e) => setPwCurrent(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New password
                  </label>
                  <input
                    type="password"
                    value={pwNew}
                    onChange={(e) => setPwNew(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-500"
                    required
                    minLength={8}
                    placeholder="At least 8 characters"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm new password
                  </label>
                  <input
                    type="password"
                    value={pwConfirm}
                    onChange={(e) => setPwConfirm(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-500"
                    required
                    minLength={8}
                  />
                </div>
                {pwError && <p className="text-sm text-red-600">{pwError}</p>}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={pwSaving}
                    className="btn-primary text-sm disabled:opacity-50"
                  >
                    {pwSaving ? 'Updating…' : 'Update Password'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPwOpen(false);
                      setPwError('');
                    }}
                    className="btn-secondary text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <p className="text-xs text-gray-400 mt-3">
              Two-factor authentication is on the roadmap.
            </p>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? (
                <>Saving...</>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Settings
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}