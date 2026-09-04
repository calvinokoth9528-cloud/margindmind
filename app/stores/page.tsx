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
  Plus,
  RefreshCw,
  Trash2,
  Globe,
  AlertCircle,
} from 'lucide-react';
import { formatCurrency, formatPercent } from '@/lib/profit';

interface Shop {
  id: string;
  shopUrl: string;
  platform: string;
  lastSync: string | null;
}

export default function StoresPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchShops();
    }
  }, [session]);

  const fetchShops = async () => {
    try {
      const response = await fetch('/api/shops');
      if (response.ok) {
        const result = await response.json();
        setShops(result.shops || []);
      }
    } catch (error) {
      console.error('Failed to fetch shops:', error);
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

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
            href="/stores"
            className="flex items-center gap-3 px-3 py-2 bg-brand-50 text-brand-700 rounded-md"
          >
            <Globe className="h-5 w-5" />
            Stores
          </Link>
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-md"
          >
            <ShoppingCart className="h-5 w-5" />
            Orders
          </Link>
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-md"
          >
            <Package className="h-5 w-5" />
            Products
          </Link>
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-md"
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

      {/* Main Content */}
      <main className="ml-64 p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Connected Stores</h1>
            <p className="text-gray-600">Manage your e-commerce store connections</p>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="btn-secondary"
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            Back to Dashboard
          </button>
        </div>

        <div className="mb-6">
          <button
            onClick={() => router.push('/dashboard')}
            className="btn-primary"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Store
          </button>
        </div>

        {shops.length === 0 ? (
          <div className="card p-12 text-center">
            <Globe className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No stores connected
            </h3>
            <p className="text-gray-600 mb-6">
              Connect your first e-commerce store to start tracking profits automatically.
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="btn-primary"
            >
              <Plus className="h-4 w-4 mr-2" />
              Connect a Store
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {shops.map((shop) => (
              <div key={shop.id} className="card p-6">
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-4">
                    <div className="bg-brand-100 rounded-lg p-3">
                      <Globe className="h-8 w-8 text-brand-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {shop.shopUrl}
                      </h3>
                      <p className="text-sm text-gray-500 capitalize">
                        {shop.platform.toLowerCase()}
                      </p>
                      {shop.lastSync && (
                        <p className="text-sm text-gray-500 mt-1">
                          Last synced: {new Date(shop.lastSync).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button className="btn-secondary text-sm">
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Sync
                    </button>
                    <button className="text-red-600 hover:text-red-700 p-2 rounded-md hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="card p-6 mt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
            <div>
              <h4 className="font-semibold text-gray-900">Note</h4>
              <p className="text-sm text-gray-600 mt-1">
                To connect a real Shopify store, you need to create a Shopify app with the correct
                OAuth scopes. This demo uses placeholder credentials for development.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
