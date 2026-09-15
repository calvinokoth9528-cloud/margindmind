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
  Search,
  Calendar,
  Globe,
  Download,
  Undo2,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { formatCurrency } from '@/lib/profit';

interface Order {
  id: string;
  orderNumber: string;
  totalRevenue: number;
  totalCost: number;
  netProfit: number;
  profitMargin: number;
  status: string;
  orderDate: string;
  refundedAt: string | null;
  refundAmount: number;
  refundReason: string | null;
}

interface ShopOption {
  id: string;
  shopUrl: string;
}

export default function OrdersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [shops, setShops] = useState<ShopOption[]>([]);
  const [shopId, setShopId] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [period, setPeriod] = useState('30');
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  const fetchShops = useCallback(async () => {
    try {
      const response = await fetch('/api/shops');
      if (response.ok) {
        const result = await response.json();
        setShops(result.shops || []);
      }
    } catch (err) {
      console.error('Failed to fetch shops:', err);
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (useCustomRange && fromDate) params.set('from', fromDate);
      if (useCustomRange && toDate) params.set('to', toDate);
      if (!params.has('from') && !params.has('to')) params.set('period', period);
      if (shopId) params.set('shopId', shopId);
      const response = await fetch(`/api/orders?${params.toString()}`);
      if (response.ok) {
        const result = await response.json();
        setOrders(result.orders || []);
        if (result.currency) setCurrency(result.currency);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  }, [session, period, shopId, useCustomRange, fromDate, toDate]);

  useEffect(() => {
    if (session) {
      fetchOrders();
      fetchShops();
    }
  }, [session, period, shopId, useCustomRange, fromDate, toDate, fetchOrders, fetchShops]);

  const handleRefund = async (order: Order) => {
    const reason = window.prompt(
      `Refund ${order.orderNumber} — enter refund amount (${formatCurrency(order.totalRevenue, currency)} max, leave blank for full):`,
      ''
    );
    if (reason === null) return; // cancelled
    const amount = reason.trim() === '' ? undefined : parseFloat(reason.trim());
    if (amount !== undefined && (isNaN(amount) || amount <= 0 || amount > order.totalRevenue)) {
      setNotice({ type: 'error', text: 'Enter a valid refund amount.' });
      return;
    }
    if (!window.confirm(`Refund ${order.orderNumber}? Revenue and profit will be adjusted.`)) return;

    try {
      setRefundingId(order.id);
      setNotice(null);
      const response = await fetch(`/api/orders/${order.id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(amount !== undefined ? { amount } : {}), reason: 'Customer request' }),
      });
      const result = await response.json();

      if (response.ok) {
        setNotice({
          type: 'success',
          text: `${order.orderNumber} refunded ${formatCurrency(result.order.refundAmount, currency)} — profit updated.`,
        });
        fetchOrders();
      } else {
        setNotice({ type: 'error', text: result.error || 'Refund failed.' });
      }
    } catch (err) {
      console.error('Refund failed:', err);
      setNotice({ type: 'error', text: 'Refund failed. Please try again.' });
    } finally {
      setRefundingId(null);
    }
  };

  const handleUndoRefund = async (order: Order) => {
    if (!window.confirm(`Undo refund on ${order.orderNumber}? Profit will be restored.`)) return;

    try {
      setRefundingId(order.id);
      setNotice(null);
      const response = await fetch(`/api/orders/${order.id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ undo: true }),
      });
      const result = await response.json();

      if (response.ok) {
        setNotice({ type: 'success', text: `Refund on ${order.orderNumber} undone.` });
        fetchOrders();
      } else {
        setNotice({ type: 'error', text: result.error || 'Failed to undo refund.' });
      }
    } catch (err) {
      console.error('Undo refund failed:', err);
      setNotice({ type: 'error', text: 'Failed to undo refund.' });
    } finally {
      setRefundingId(null);
    }
  };

  const handleExport = () => {
    const params = new URLSearchParams({ type: 'orders' });
    if (shopId) params.set('shopId', shopId);
    if (useCustomRange && fromDate) params.set('from', fromDate);
    if (useCustomRange && toDate) params.set('to', toDate);
    window.location.href = `/api/export/csv?${params.toString()}`;
  };

  const filteredOrders = orders.filter(
    (order) =>
      order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.status.toLowerCase().includes(searchTerm.toLowerCase())
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
          <Link href="/orders" className="flex items-center gap-3 px-3 py-2 bg-brand-50 text-brand-700 rounded-md">
            <ShoppingCart className="h-5 w-5" />
            Orders
          </Link>
          <Link href="/products" className="flex items-center gap-3 px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-md">
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
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <div className="flex flex-wrap gap-2 items-center">
            {useCustomRange ? (
              <>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="border border-gray-300 rounded-md px-2 py-2 text-sm"
                />
                <span className="text-gray-400 text-sm">to</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="border border-gray-300 rounded-md px-2 py-2 text-sm"
                />
                <button
                  onClick={() => {
                    setUseCustomRange(false);
                    setFromDate('');
                    setToDate('');
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Use presets
                </button>
              </>
            ) : (
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="365">Last year</option>
              </select>
            )}
            <button
              onClick={() => setUseCustomRange(!useCustomRange)}
              className={`btn-secondary text-sm py-2 ${useCustomRange ? 'border-brand-400 text-brand-700' : ''}`}
              title="Custom date range"
            >
              <Calendar className="h-4 w-4" />
            </button>
            {shops.length > 1 && (
              <select
                value={shopId}
                onChange={(e) => setShopId(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="">All stores</option>
                {shops.map((shop) => (
                  <option key={shop.id} value={shop.id}>
                    {shop.shopUrl}
                  </option>
                ))}
              </select>
            )}
            <button onClick={handleExport} className="btn-secondary text-sm py-2">
              <Download className="h-4 w-4 mr-1" />
              Export
            </button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>
        </div>

        {notice && (
          <div
            className={`card p-3 mb-4 flex items-center gap-2 ${
              notice.type === 'success'
                ? 'border-green-200 bg-green-50'
                : 'border-red-200 bg-red-50'
            }`}
          >
            {notice.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <p className={`text-sm ${notice.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
              {notice.text}
            </p>
          </div>
        )}

        <div className="card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Profit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Margin</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                      No orders found.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{order.orderNumber}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(order.orderDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {formatCurrency(order.totalRevenue, currency)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatCurrency(order.totalCost, currency)}
                      </td>
                      <td className="px-6 py-4 text-sm text-brand-600 font-medium">
                        {formatCurrency(order.netProfit, currency)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={
                            order.profitMargin >= 20
                              ? 'text-brand-600'
                              : order.profitMargin >= 10
                              ? 'text-yellow-600'
                              : 'text-red-600'
                          }
                        >
                          {order.profitMargin.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={
                          order.refundedAt
                            ? 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800'
                            : order.status === 'paid'
                            ? 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800'
                            : order.status === 'pending'
                            ? 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800'
                            : 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800'
                        }>
                          {order.refundedAt ? 'refunded' : order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm whitespace-nowrap">
                        {order.refundedAt ? (
                          <button
                            onClick={() => handleUndoRefund(order)}
                            disabled={refundingId === order.id}
                            className="text-gray-500 hover:text-gray-700 text-xs inline-flex items-center gap-1 disabled:opacity-50"
                            title={`Refund ${formatCurrency(order.refundAmount, currency)}${order.refundReason ? ` — ${order.refundReason}` : ''}`}
                          >
                            <Undo2 className="h-3.5 w-3.5" />
                            Undo
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRefund(order)}
                            disabled={refundingId === order.id}
                            className="text-red-600 hover:text-red-700 text-xs inline-flex items-center gap-1 disabled:opacity-50"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Refund
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
