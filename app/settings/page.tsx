'use client';

import { useState, useEffect } from 'react';
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
} from 'lucide-react';

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    emailNotifications: true,
    orderAlerts: true,
    weeklyReports: false,
    marketingEmails: false,
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  const handleSave = async () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
    }, 1000);
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  if (!session) return null;

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
                  defaultValue={session.user?.name || ''}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  defaultValue={session.user?.email || ''}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-500"
                />
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
              <label className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Email notifications</span>
                <input
                  type="checkbox"
                  checked={settings.emailNotifications}
                  onChange={(e) =>
                    setSettings({ ...settings, emailNotifications: e.target.checked })
                  }
                  className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Order alerts</span>
                <input
                  type="checkbox"
                  checked={settings.orderAlerts}
                  onChange={(e) =>
                    setSettings({ ...settings, orderAlerts: e.target.checked })
                  }
                  className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Weekly reports</span>
                <input
                  type="checkbox"
                  checked={settings.weeklyReports}
                  onChange={(e) =>
                    setSettings({ ...settings, weeklyReports: e.target.checked })
                  }
                  className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
              </label>
            </div>
          </div>

          {/* Billing Section */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-4">
              <CreditCard className="h-5 w-5 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-900">Billing</h3>
            </div>
            <div className="text-sm text-gray-600 mb-4">
              Current plan: <span className="font-semibold text-gray-900">Free</span>
            </div>
            <Link href="/dashboard" className="btn-primary text-sm">
              View Billing Details
            </Link>
          </div>

          {/* Security Section */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="h-5 w-5 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-900">Security</h3>
            </div>
            <div className="space-y-3">
              <button className="btn-secondary text-left w-full">
                Change Password
              </button>
              <button className="btn-secondary text-left w-full">
                Two-Factor Authentication
              </button>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary"
            >
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
