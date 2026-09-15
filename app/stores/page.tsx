'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  CheckCircle2,
  FileSpreadsheet,
  Pencil,
  X,
  Check,
  Megaphone,
} from 'lucide-react';
import ConnectStoreModal from '@/components/ConnectStoreModal';
import ImportCsvModal from '@/components/ImportCsvModal';
import AdSpendModal from '@/components/AdSpendModal';
import {
  COUNTRIES,
  CURRENCIES,
  FEE_PROFILES,
  getFeeProfile,
  defaultTaxRateForCountry,
} from '@/lib/fees';

interface Shop {
  id: string;
  shopUrl: string;
  platform: string;
  country: string;
  currency: string;
  paymentProvider: string;
  feePercent: number | null;
  feeFixed: number | null;
  taxRate: number | null;
  lastSync: string | null;
}

export default function StoresPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
        </div>
      }
    >
      <StoresPageContent />
    </Suspense>
  );
}

function StoresPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAdSpendModal, setShowAdSpendModal] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingShopId, setEditingShopId] = useState<string | null>(null);
  const [editCountry, setEditCountry] = useState('US');
  const [editCurrency, setEditCurrency] = useState('USD');
  const [editProvider, setEditProvider] = useState('other');
  const [useCustomFee, setUseCustomFee] = useState(false);
  const [editFeePercent, setEditFeePercent] = useState('');
  const [editFeeFixed, setEditFeeFixed] = useState('');
  const [editTaxRate, setEditTaxRate] = useState('');
  const [savingShopId, setSavingShopId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchShops = useCallback(async () => {
    try {
      const response = await fetch('/api/shops');
      if (response.ok) {
        const result = await response.json();
        setShops(result.shops || []);
      } else {
        setError('Failed to load stores.');
      }
    } catch (err) {
      console.error('Failed to fetch shops:', err);
      setError('Failed to load stores.');
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
      fetchShops();
    }
  }, [session, fetchShops]);

  // Show success/error banners from OAuth redirect query params
  useEffect(() => {
    const connected = searchParams.get('connected');
    const errorParam = searchParams.get('error');

    if (connected) {
      setNotice({ type: 'success', text: `Store "${connected}" connected successfully!` });
      // Clean the URL so refresh doesn't re-show the banner
      router.replace('/stores');
    } else if (errorParam) {
      const messages: Record<string, string> = {
        missing_params: 'Connection failed: missing OAuth parameters.',
        state_mismatch: 'Connection failed: security check did not pass. Please try again.',
        unauthorized: 'Connection failed: you must be logged in.',
        connection_failed: 'Connection failed: could not reach Shopify. Please try again.',
      };
      setNotice({
        type: 'error',
        text: messages[errorParam] || 'Store connection failed. Please try again.',
      });
      router.replace('/stores');
    }
  }, [searchParams, router]);

  const handleSync = async (shop: Shop) => {
    try {
      setSyncingId(shop.id);
      setNotice(null);
      const response = await fetch(`/api/shops/${shop.id}/sync`, { method: 'POST' });
      const result = await response.json();

      if (response.ok) {
        setNotice({
          type: 'success',
          text: `Synced: ${result.ordersImported} new orders, ${result.ordersUpdated} updated, ${result.productsImported} products.`,
        });
      } else {
        setNotice({ type: 'error', text: result.error || 'Sync failed.' });
      }
    } catch (err) {
      console.error('Sync failed:', err);
      setNotice({ type: 'error', text: 'Sync failed. Please try again.' });
    } finally {
      setSyncingId(null);
      fetchShops();
    }
  };

  const startEditShop = (shop: Shop) => {
    setEditingShopId(shop.id);
    setEditCountry(shop.country || 'US');
    setEditCurrency(shop.currency || 'USD');
    setEditProvider(shop.paymentProvider || 'other');
    const hasCustomFee = shop.feePercent != null && shop.feeFixed != null;
    setUseCustomFee(hasCustomFee);
    setEditFeePercent(hasCustomFee ? String(shop.feePercent) : '');
    setEditFeeFixed(hasCustomFee ? String(shop.feeFixed) : '');
    setEditTaxRate(
      shop.taxRate != null
        ? String(shop.taxRate)
        : String(defaultTaxRateForCountry(shop.country || 'US'))
    );
    setNotice(null);
  };

  const handleSaveShopSettings = async (shop: Shop) => {
    try {
      setSavingShopId(shop.id);
      setNotice(null);
      const custom = useCustomFee && editFeePercent !== '' && editFeeFixed !== '';
      const response = await fetch(`/api/shops/${shop.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country: editCountry,
          currency: editCurrency,
          paymentProvider: editProvider,
          feePercent: custom ? parseFloat(editFeePercent) : null,
          feeFixed: custom ? parseFloat(editFeeFixed) : null,
          taxRate: editTaxRate === '' ? null : parseFloat(editTaxRate),
          recomputeFees: true,
        }),
      });
      const result = await response.json();

      if (response.ok) {
        const profile = custom
          ? { label: 'custom rate', percent: parseFloat(editFeePercent), fixed: parseFloat(editFeeFixed) }
          : getFeeProfile(editProvider);
        setNotice({
          type: 'success',
          text: `Store updated — fees ${profile.label}: ${profile.percent}% + ${profile.fixed.toFixed(2)}, tax ${editTaxRate}% — historical orders recomputed.`,
        });
        setEditingShopId(null);
        fetchShops();
      } else {
        setNotice({ type: 'error', text: result.error || 'Failed to update store.' });
      }
    } catch (err) {
      console.error('Store update failed:', err);
      setNotice({ type: 'error', text: 'Failed to update store. Please try again.' });
    } finally {
      setSavingShopId(null);
    }
  };

  const handleDelete = async (shop: Shop) => {
    if (!window.confirm(`Remove ${shop.shopUrl} and all of its imported data?`)) return;
    try {
      setDeletingId(shop.id);
      setNotice(null);
      const response = await fetch(`/api/shops/${shop.id}`, { method: 'DELETE' });

      if (response.ok) {
        setNotice({ type: 'success', text: `Store "${shop.shopUrl}" removed.` });
        setShops((prev) => prev.filter((s) => s.id !== shop.id));
      } else {
        setNotice({ type: 'error', text: 'Failed to remove store.' });
      }
    } catch (err) {
      console.error('Delete failed:', err);
      setNotice({ type: 'error', text: 'Failed to remove store.' });
    } finally {
      setDeletingId(null);
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
            className="flex items-center gap-3 px-3 py-2 bg-brand-50 text-brand-700 rounded-md"
          >
            <Globe className="h-5 w-5" />
            Stores
          </Link>
          <Link
            href="/settings"
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
          <div className="flex gap-3">
            <button
              onClick={() => setShowAdSpendModal(true)}
              className="btn-secondary"
              disabled={shops.length === 0}
            >
              <Megaphone className="h-4 w-4 mr-2" />
              Ad Spend
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="btn-secondary"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Import CSV
            </button>
            <button
              onClick={() => setShowConnectModal(true)}
              className="btn-primary"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Store
            </button>
          </div>
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

        {error && !notice && (
          <div className="card p-4 mb-6 border-red-200 bg-red-50">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {shops.length === 0 ? (
          <div className="card p-12 text-center">
            <Globe className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No stores connected
            </h3>
            <p className="text-gray-600 mb-6">
              Connect a store with OAuth, or import your orders straight from a CSV export.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowImportModal(true)}
                className="btn-secondary"
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Import from CSV
              </button>
              <button onClick={() => setShowConnectModal(true)} className="btn-primary">
                <Plus className="h-4 w-4 mr-2" />
                Connect a Store
              </button>
            </div>
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
                    {editingShopId === shop.id ? (
                      <div className="flex-1 mr-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                              Country
                            </label>
                            <select
                              value={editCountry}
                              onChange={(e) => setEditCountry(e.target.value)}
                              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                            >
                              {COUNTRIES.map((c) => (
                                <option key={c.code} value={c.code}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                              Currency
                            </label>
                            <select
                              value={editCurrency}
                              onChange={(e) => setEditCurrency(e.target.value)}
                              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                            >
                              {CURRENCIES.map((c) => (
                                <option key={c.code} value={c.code}>
                                  {c.code} — {c.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                              Payment provider
                            </label>
                            <select
                              value={editProvider}
                              onChange={(e) => setEditProvider(e.target.value)}
                              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                            >
                              {Object.values(FEE_PROFILES).map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.label} ({p.percent}% + {p.fixed.toFixed(2)})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                          <div className="sm:col-span-3">
                            <label className="flex items-center gap-2 text-sm text-gray-700">
                              <input
                                type="checkbox"
                                checked={useCustomFee}
                                onChange={(e) => setUseCustomFee(e.target.checked)}
                                className="rounded border-gray-300"
                              />
                              Use custom fee rate (overrides the provider preset)
                            </label>
                          </div>
                          {useCustomFee && (
                            <>
                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">
                                  Fee percent (%)
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={editFeePercent}
                                  onChange={(e) => setEditFeePercent(e.target.value)}
                                  placeholder="2.9"
                                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">
                                  Fixed fee per order
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={editFeeFixed}
                                  onChange={(e) => setEditFeeFixed(e.target.value)}
                                  placeholder="0.30"
                                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                                />
                              </div>
                            </>
                          )}
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                              Tax rate (%)
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              value={editTaxRate}
                              onChange={(e) => setEditTaxRate(e.target.value)}
                              placeholder={String(defaultTaxRateForCountry(editCountry))}
                              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                            />
                          </div>
                        </div>

                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => handleSaveShopSettings(shop)}
                            disabled={savingShopId === shop.id}
                            className="btn-primary text-sm py-1.5 px-3 disabled:opacity-50"
                          >
                            <Check className="h-4 w-4 mr-1" />
                            {savingShopId === shop.id ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            onClick={() => setEditingShopId(null)}
                            className="btn-secondary text-sm py-1.5 px-3"
                          >
                            <X className="h-4 w-4 mr-1" />
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {shop.shopUrl}
                      </h3>
                      <p className="text-sm text-gray-500 capitalize">
                        {shop.platform.toLowerCase()}
                        {' · '}
                        {shop.currency || 'USD'}
                        {' · '}
                        {getFeeProfile(shop.paymentProvider).label}
                      </p>
                      {shop.lastSync ? (
                        <p className="text-sm text-gray-500 mt-1">
                          Last synced: {new Date(shop.lastSync).toLocaleString()}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-400 mt-1">Never synced</p>
                      )}
                    </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {editingShopId !== shop.id && (
                      <button
                        onClick={() => startEditShop(shop)}
                        className="text-gray-500 hover:text-gray-700 p-2 rounded-md hover:bg-gray-50"
                        aria-label={`Edit settings for ${shop.shopUrl}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    {shop.platform === 'SHOPIFY' ? (
                      <button
                        onClick={() => handleSync(shop)}
                        disabled={syncingId === shop.id}
                        className="btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <RefreshCw
                          className={`h-4 w-4 mr-1 ${
                            syncingId === shop.id ? 'animate-spin' : ''
                          }`}
                        />
                        {syncingId === shop.id ? 'Syncing...' : 'Sync'}
                      </button>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 self-center">
                        <FileSpreadsheet className="h-3 w-3 mr-1" />
                        CSV import
                      </span>
                    )}
                    <button
                      onClick={() => handleDelete(shop)}
                      disabled={deletingId === shop.id}
                      className="text-red-600 hover:text-red-700 p-2 rounded-md hover:bg-red-50 disabled:opacity-50"
                      aria-label={`Remove ${shop.shopUrl}`}
                    >
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
                To connect a real Shopify store, create a Shopify app with the correct
                OAuth scopes and set <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">SHOPIFY_API_KEY</code> and{' '}
                <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">SHOPIFY_API_SECRET</code>{' '}
                in your environment. This demo uses placeholder credentials for development.
              </p>
            </div>
          </div>
        </div>

        <ConnectStoreModal
          open={showConnectModal}
          onClose={() => setShowConnectModal(false)}
        />
        <ImportCsvModal
          open={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImported={fetchShops}
        />
        <AdSpendModal
          open={showAdSpendModal}
          shops={shops.map((s) => ({ id: s.id, shopUrl: s.shopUrl }))}
          onClose={() => setShowAdSpendModal(false)}
          onImported={fetchShops}
        />
      </main>
    </div>
  );
}