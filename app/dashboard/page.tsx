'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Package,
  Settings,
  LogOut,
  Plus,
  RefreshCw,
  Globe,
  Calendar,
} from 'lucide-react';
import ConnectStoreModal from '@/components/ConnectStoreModal';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import {
  formatCurrency,
  formatPercent,
  calculateBreakEven,
  projectProfit,
} from '@/lib/profit';

interface DashboardData {
  metrics: {
    totalOrders: number;
    totalRevenue: number;
    totalProfit: number;
    totalTax?: number;
    totalRefunds?: number;
    averageOrderValue: number;
    averageMargin: number;
    dailyMetrics: Array<{
      date: string;
      revenue: number;
      profit: number;
      orders: number;
    }>;
  };
  comparison: {
    revenueChangePct: number | null;
    profitChangePct: number | null;
    ordersChangePct: number | null;
  };
  topProducts: Array<{
    id: string;
    title: string;
    revenue: number;
    profit: number;
    margin: number;
    units: number;
  }>;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    totalRevenue: number;
    netProfit: number;
    profitMargin: number;
    status: string;
    date: string;
  }>;
  shopCount: number;
  currency?: string;
  refundSummary?: {
    count: number;
    total: number;
  };
}

interface ShopOption {
  id: string;
  shopUrl: string;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('30');
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [fixedCosts, setFixedCosts] = useState('2000');
  const [growthRate, setGrowthRate] = useState('5');
  const [shops, setShops] = useState<ShopOption[]>([]);
  const [shopId, setShopId] = useState('');
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Amounts are displayed in the currency reported by the API
  // (most common across the user's shops).
  const currency = data?.currency || 'USD';
  const fmt = (amount: number) => formatCurrency(amount, currency);

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

  useEffect(() => {
    if (session) {
      fetchDashboardData();
      fetchShops();
    }
  }, [session, period, shopId, useCustomRange, fromDate, toDate]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (useCustomRange && fromDate) params.set('from', fromDate);
      if (useCustomRange && toDate) params.set('to', toDate);
      if (!params.has('from') && !params.has('to')) params.set('period', period);
      if (shopId) params.set('shopId', shopId);
      const response = await fetch(`/api/dashboard?${params.toString()}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else {
        setError('Failed to load dashboard data. Please try again.');
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Full-screen spinner only while the session resolves or on very first load.
  // Refreshing/period changes keep the existing content on screen.
  if (status === 'loading' || (loading && !data)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const topProducts = data?.topProducts ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-8">
          <TrendingUp className="h-8 w-8 text-brand-600" />
          <span className="text-xl font-bold text-gray-900">MarginMind</span>
        </div>

        <nav className="space-y-1">
          <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2 bg-brand-50 text-brand-700 rounded-md">
            <DollarSign className="h-5 w-5" />
            Dashboard
          </Link>
          <Link href="/orders" className="flex items-center gap-3 px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-md">
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

      {/* Main Content */}
      <main className="ml-64 p-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600">Welcome back, {session.user?.name || 'there'}!</p>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
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
              className={`btn-secondary py-2 ${useCustomRange ? 'border-brand-400 text-brand-700' : ''}`}
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
            <button
              onClick={fetchDashboardData}
              className="btn-secondary"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </button>
            <button
              onClick={() => setShowConnectModal(true)}
              className="btn-primary"
            >
              <Plus className="h-4 w-4 mr-2" />
              Connect Store
            </button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="card p-4 mb-6 border-red-200 bg-red-50">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">Total Revenue</span>
              <DollarSign className="h-5 w-5 text-gray-400" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {data ? fmt(data.metrics.totalRevenue) : '$0.00'}
            </p>
            <div className="flex items-center gap-2 mt-1">
              {data && data.comparison.revenueChangePct !== null ? (
                <span
                  className={`text-xs font-medium flex items-center gap-0.5 ${
                    data.comparison.revenueChangePct >= 0
                      ? 'text-brand-600'
                      : 'text-red-600'
                  }`}
                >
                  {data.comparison.revenueChangePct >= 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {formatPercent(Math.abs(data.comparison.revenueChangePct))} vs prev. {period}d
                </span>
              ) : (
                <p className="text-sm text-gray-500">+{period} days</p>
              )}
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">Net Profit</span>
              <TrendingUp className="h-5 w-5 text-brand-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {data ? fmt(data.metrics.totalProfit) : '$0.00'}
            </p>
            <div className="flex items-center gap-2 mt-1">
              {data && data.comparison.profitChangePct !== null ? (
                <span
                  className={`text-xs font-medium flex items-center gap-0.5 ${
                    data.comparison.profitChangePct >= 0
                      ? 'text-brand-600'
                      : 'text-red-600'
                  }`}
                >
                  {data.comparison.profitChangePct >= 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {formatPercent(Math.abs(data.comparison.profitChangePct))} vs prev. {period}d
                </span>
              ) : (
                <p className="text-sm text-gray-500 mt-1">
                  {formatPercent(data?.metrics.averageMargin ?? 0)} margin
                </p>
              )}
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">Total Orders</span>
              <ShoppingCart className="h-5 w-5 text-gray-400" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {data?.metrics.totalOrders || 0}
            </p>
            <div className="flex items-center gap-2 mt-1">
              {data && data.comparison.ordersChangePct !== null ? (
                <span
                  className={`text-xs font-medium flex items-center gap-0.5 ${
                    data.comparison.ordersChangePct >= 0
                      ? 'text-brand-600'
                      : 'text-red-600'
                  }`}
                >
                  {data.comparison.ordersChangePct >= 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {formatPercent(Math.abs(data.comparison.ordersChangePct))} vs prev. {period}d
                </span>
              ) : (
                <p className="text-sm text-gray-500 mt-1">
                  Avg: {data ? fmt(data.metrics.averageOrderValue) : '$0.00'}
                </p>
              )}
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">Connected Stores</span>
              <Package className="h-5 w-5 text-gray-400" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{data?.shopCount || 0}</p>
            <p className="text-sm text-brand-600 mt-1">Active</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-4">Revenue & Profit Trend</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.metrics.dailyMetrics || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(date) =>
                      new Date(date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })
                    }
                  />
                  <YAxis tickFormatter={(value) => `$${value}`} />
                  <Tooltip
                    formatter={(value) => fmt(Number(value))}
                    labelFormatter={(date) => new Date(String(date)).toLocaleDateString()}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#16a34a"
                    strokeWidth={2}
                    dot={false}
                    name="Revenue"
                  />
                  <Line
                    type="monotone"
                    dataKey="profit"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={false}
                    name="Profit"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-4">Daily Orders</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.metrics.dailyMetrics || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(date) =>
                      new Date(date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })
                    }
                  />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(date) => new Date(String(date)).toLocaleDateString()}
                  />
                  <Bar dataKey="orders" fill="#16a34a" name="Orders" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Refund & tax summary */}
        {data?.refundSummary && (data.refundSummary.count > 0 || (data.metrics.totalTax ?? 0) > 0) && (
          <div className="card p-4 mb-8 flex flex-wrap gap-6 items-center">
            <div>
              <p className="text-sm text-gray-500">Tax collected (est.)</p>
              <p className="text-lg font-semibold text-gray-900">
                {fmt(data.metrics.totalTax ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Refunds</p>
              <p className="text-lg font-semibold text-red-600">
                {fmt(data.refundSummary.total)}
                <span className="text-sm font-normal text-gray-500 ml-1">
                  ({data.refundSummary.count} order{data.refundSummary.count === 1 ? '' : 's'})
                </span>
              </p>
            </div>
          </div>
        )}

        {/* Top Products */}
        <div className="card mb-8">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold">Top Products by Profit</h3>
          </div>
          {topProducts.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              No product-level data yet. Sync a store to see which products drive your
              profit.
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {topProducts.map((product, index) => {
                const maxRevenue = Math.max(
                  ...topProducts.map((p) => p.revenue),
                  1
                );
                return (
                  <div key={product.id} className="px-6 py-4 flex items-center gap-4">
                    <span className="w-6 text-sm font-semibold text-gray-400">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {product.title}
                        </p>
                        <p className="text-sm text-brand-600 font-medium">
                          {fmt(product.profit)}
                        </p>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-500 rounded-full"
                          style={{ width: `${(product.revenue / maxRevenue) * 100}%` }}
                        />
                      </div>
                      <div className="flex justify-between mt-1 text-xs text-gray-500">
                        <span>
                          {fmt(product.revenue)} revenue · {product.units} sold
                        </span>
                        <span>{formatPercent(product.margin)} margin</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Orders */}
        <div className="card">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold">Recent Orders</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Order
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Revenue
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Profit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Margin
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data?.recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      No orders yet. Connect your store to start tracking profits.
                    </td>
                  </tr>
                ) : (
                  data?.recentOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {order.orderNumber}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(order.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {fmt(order.totalRevenue)}
                      </td>
                      <td className="px-6 py-4 text-sm text-brand-600 font-medium">
                        {fmt(order.netProfit)}
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
                          {formatPercent(order.profitMargin)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Insights: break-even & projections */}
        {data && (
          <div className="card mt-8 p-6">
            <h3 className="text-lg font-semibold mb-1">Insights</h3>
            <p className="text-sm text-gray-500 mb-4">
              Break-even planning based on this period's {period}-day average margin.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monthly fixed costs ($)
                </label>
                <input
                  type="number"
                  min="0"
                  value={fixedCosts}
                  onChange={(e) => setFixedCosts(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-500"
                />
                <label className="block text-sm font-medium text-gray-700 mb-1 mt-4">
                  Monthly growth rate (%)
                </label>
                <input
                  type="number"
                  step="1"
                  value={growthRate}
                  onChange={(e) => setGrowthRate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-500"
                />
                <p className="text-xs text-gray-400 mt-3">
                  Base profit for projections: {fmt(data.metrics.totalProfit)}{' '}
                  over the last {period} days.
                </p>
              </div>

              <div className="lg:col-span-1">
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Break-even monthly revenue
                </h4>
                {(() => {
                  const fixed = parseFloat(fixedCosts) || 0;
                  const breakEven = calculateBreakEven(fixed, data.metrics.averageMargin);
                  if (!isFinite(breakEven)) {
                    return (
                      <p className="text-amber-700 text-sm bg-amber-50 border border-amber-200 rounded-md p-3">
                        Your average margin is {formatPercent(data.metrics.averageMargin)} —
                        at or below zero, so break-even can't be reached with the current
                        cost structure. Raise prices or cut landed costs.
                      </p>
                    );
                  }
                  return (
                    <div className="bg-brand-50 border border-brand-200 rounded-md p-4">
                      <p className="text-2xl font-bold text-gray-900">
                        {fmt(breakEven)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        per month covers {fmt(fixed)} of fixed costs at{' '}
                        {formatPercent(data.metrics.averageMargin)} average margin.
                      </p>
                    </div>
                  );
                })()}
              </div>

              <div className="lg:col-span-1">
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Projected monthly profit (next 6 months)
                </h4>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={projectProfit(
                        data.metrics.totalProfit,
                        parseFloat(growthRate) || 0,
                        6
                      ).map((value, i) => ({ month: `M${i + 1}`, profit: Math.round(value) }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis
                        tickFormatter={(value) => `$${Math.round(Number(value) / 1000)}k`}
                      />
                      <Tooltip formatter={(value) => fmt(Number(value))} />
                      <Line
                        type="monotone"
                        dataKey="profit"
                        stroke="#16a34a"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        name="Projected profit"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        <ConnectStoreModal
          open={showConnectModal}
          onClose={() => setShowConnectModal(false)}
        />
      </main>
    </div>
  );
}
