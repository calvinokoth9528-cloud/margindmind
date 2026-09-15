'use client';

import { useState } from 'react';
import { X, Globe, Store, AlertCircle } from 'lucide-react';
import { COUNTRIES } from '@/lib/fees';

const PLATFORMS = [
  { id: 'SHOPIFY', label: 'Shopify' },
  { id: 'ETSY', label: 'Etsy' },
  { id: 'AMAZON', label: 'Amazon' },
  { id: 'WOOCOMMERCE', label: 'WooCommerce' },
  { id: 'JUMIA', label: 'Jumia' },
  { id: 'KILIMALL', label: 'Kilimall' },
  { id: 'CSV', label: 'Other (CSV import)' },
] as const;

const CSV_PLATFORMS = new Set(['ETSY', 'AMAZON', 'WOOCOMMERCE', 'JUMIA', 'KILIMALL', 'CSV']);

// Platform → suggested fee profile for the store (fees are editable later)
const PLATFORM_PROVIDERS: Record<string, string> = {
  ETSY: 'etsy',
  AMAZON: 'amazon',
  JUMIA: 'jumia',
  KILIMALL: 'kilimall',
  WOOCOMMERCE: 'stripe',
  SHOPIFY: 'shopify',
  CSV: 'other',
};

interface ConnectStoreModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ConnectStoreModal({ open, onClose }: ConnectStoreModalProps) {
  const [platform, setPlatform] = useState<string>('SHOPIFY');
  const [shopUrl, setShopUrl] = useState('');
  const [country, setCountry] = useState('US');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const isShopify = platform === 'SHOPIFY';
  const isCsvPlatform = CSV_PLATFORMS.has(platform);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isShopify || !shopUrl || submitting) return;

    try {
      setSubmitting(true);
      setError(null);
      const response = await fetch(
        `/api/shopify?shop=${encodeURIComponent(shopUrl)}&country=${encodeURIComponent(country)}`
      );
      const result = await response.json();

      if (response.ok && result.authUrl) {
        window.location.href = result.authUrl;
      } else {
        setError(result.error || 'Failed to start store connection.');
      }
    } catch (err) {
      console.error('Failed to initiate store connection:', err);
      setError('Failed to start store connection. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex justify-between items-center p-6 border-b">
          <h3 className="text-lg font-semibold">Connect Your Store</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">
          <p className="text-sm text-gray-600 mb-4">
            Connect your Shopify store to import orders and automatically calculate your
            true profit margins.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Platform
              </label>
              <select
                value={platform}
                onChange={(e) => {
                  setPlatform(e.target.value);
                  setShopUrl('');
                }}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                {PLATFORMS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {isShopify ? (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Store URL
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      value={shopUrl}
                      onChange={(e) => setShopUrl(e.target.value)}
                      placeholder="your-store.myshopify.com"
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Country
                  </label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Sets the store's currency and payment-fee profile.
                  </p>
                </div>
              </>
            ) : isCsvPlatform ? (
              <div className="mb-4 flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <AlertCircle className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-800">
                  {platform === 'CSV' ? (
                    <>
                      Connect via <strong>Stores → Import CSV</strong> — upload your
                      order export and we'll detect the columns automatically.
                    </>
                  ) : (
                    <>
                      No API needed: download your order report from{' '}
                      {platform === 'ETSY'
                        ? 'Etsy (Shop Manager → Settings → Download Data)'
                        : platform === 'AMAZON'
                        ? 'Amazon Seller Central (Fulfilled Shipments report)'
                        : platform === 'JUMIA'
                        ? 'Jumia Vendor Center (orders report)'
                        : platform === 'KILIMALL'
                        ? 'Kilimall Seller Center (orders export)'
                        : 'WooCommerce (order export plugin or Admin → Export)'}{' '}
                      and use <strong>Import CSV</strong> — its columns are detected
                      automatically, with {PLATFORM_PROVIDERS[platform] === 'etsy'
                        ? '6.5% + $0.20'
                        : PLATFORM_PROVIDERS[platform] === 'amazon'
                        ? '15%'
                        : PLATFORM_PROVIDERS[platform] === 'jumia'
                        ? '12.5%'
                        : '10%'}{' '}
                      marketplace fees applied.
                    </>
                  )}
                </p>
              </div>
            ) : null}

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || isShopify}
              className="w-full btn-primary py-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ display: isShopify ? undefined : 'none' }}
            >
              <Store className="h-4 w-4 mr-2" />
              {submitting ? 'Connecting...' : 'Connect Store'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}