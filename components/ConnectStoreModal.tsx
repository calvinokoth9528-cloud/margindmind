'use client';

import { useState } from 'react';
import { X, Globe, Store, AlertCircle } from 'lucide-react';

const PLATFORMS = [
  { id: 'SHOPIFY', label: 'Shopify' },
  { id: 'AMAZON', label: 'Amazon' },
  { id: 'ETSY', label: 'Etsy' },
  { id: 'WOOCOMMERCE', label: 'WooCommerce' },
] as const;

interface ConnectStoreModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ConnectStoreModal({ open, onClose }: ConnectStoreModalProps) {
  const [platform, setPlatform] = useState<string>('SHOPIFY');
  const [shopUrl, setShopUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const isShopify = platform === 'SHOPIFY';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopUrl || submitting) return;

    try {
      setSubmitting(true);
      setError(null);
      const response = await fetch(`/api/shopify?shop=${encodeURIComponent(shopUrl)}`);
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
            ) : (
              <div className="mb-4 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
                <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">
                  {platform.charAt(0) + platform.slice(1).toLowerCase()} integration is
                  coming soon. Shopify is fully supported today.
                </p>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || (!isShopify)}
              className="w-full btn-primary py-2 disabled:opacity-50 disabled:cursor-not-allowed"
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