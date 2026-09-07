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
  Search,
  Globe,
  Pencil,
  Check,
  X,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { formatCurrency } from '@/lib/profit';

interface Product {
  id: string;
  title: string;
  sku: string | null;
  cost: number;
  price: number;
  profit: number;
  margin: number;
  orders: number;
}

export default function ProductsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [costInput, setCostInput] = useState('');
  const [savingCost, setSavingCost] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchProducts();
    }
  }, [session]);

  const handleSaveCost = async (product: Product) => {
    const cost = parseFloat(costInput);
    if (isNaN(cost) || cost < 0) {
      setNotice({ type: 'error', text: 'Enter a valid cost (0 or more).' });
      return;
    }
    try {
      setSavingCost(true);
      setNotice(null);
      const response = await fetch(`/api/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cost }),
      });
      const result = await response.json();
      if (response.ok) {
        setEditingId(null);
        setNotice({
          type: 'success',
          text: `Cost updated to ${formatCurrency(cost)} — ${result.ordersRecomputed} historical order${
            result.ordersRecomputed === 1 ? '' : 's'
          } recalculated.`,
        });
        fetchProducts();
      } else {
        setNotice({ type: 'error', text: result.error || 'Failed to update cost.' });
      }
    } catch (err) {
      console.error('Failed to update cost:', err);
      setNotice({ type: 'error', text: 'Failed to update cost.' });
    } finally {
      setSavingCost(false);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/products');
      if (response.ok) {
        const result = await response.json();
        setProducts(result.products || []);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(
    (product) =>
      product.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.sku && product.sku.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (status === 'loading' || loading) {
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
          <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-md">
            <TrendingUp className="h-5 w-5" />
            Dashboard
          </Link>
          <Link href="/orders" className="flex items-center gap-3 px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-md">
            <ShoppingCart className="h-5 w-5" />
            Orders
          </Link>
          <Link href="/products" className="flex items-center gap-3 px-3 py-2 bg-brand-50 text-brand-700 rounded-md">
            <Package className="h-5 w-5" />
            Products
          </Link>
          <Link href="/stores" className="flex items-center gap-3 px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-md">
            <Globe className="h-5 w-5" />
            Stores
          </Link>
          <Link href="/settings" className="flex items-center gap-3 px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-md">
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
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm"
            />
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <div key={product.id} className="card p-6">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-semibold text-gray-900">{product.title}</h3>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  {product.sku || 'No SKU'}
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Price</span>
                  <span className="text-gray-900">{formatCurrency(product.price)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Cost</span>
                  {editingId === product.id ? (
                    <span className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={costInput}
                        onChange={(e) => setCostInput(e.target.value)}
                        autoFocus
                        className="w-24 px-2 py-1 border border-gray-300 rounded-md text-sm text-right"
                      />
                      <button
                        onClick={() => handleSaveCost(product)}
                        disabled={savingCost}
                        className="text-brand-600 hover:text-brand-700 disabled:opacity-50"
                        aria-label="Save cost"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-gray-400 hover:text-gray-600"
                        aria-label="Cancel"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span className="text-gray-900">
                        {formatCurrency(product.cost)}
                      </span>
                      <button
                        onClick={() => {
                          setEditingId(product.id);
                          setCostInput(String(product.cost));
                        }}
                        className="text-gray-400 hover:text-brand-600"
                        aria-label="Edit cost"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Profit</span>
                  <span className="text-brand-600 font-medium">{formatCurrency(product.profit)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Margin</span>
                  <span className={product.margin >= 20 ? 'text-brand-600' : product.margin >= 10 ? 'text-yellow-600' : 'text-red-600'}>
                    {product.margin.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Orders</span>
                  <span className="text-gray-900">{product.orders}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="card p-12 text-center mt-6">
            <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No products found</h3>
            <p className="text-gray-600">Connect a store to import products.</p>
          </div>
        )}
      </main>
    </div>
  );
}
