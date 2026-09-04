'use client';

import { useState, useEffect } from 'react';
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
  Calendar,
   X,
   Store,
   Globe,
} from 'lucide-react';
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
import { formatCurrency, formatPercent } from '@/lib/profit';

interface DashboardData {
  metrics: {
    totalOrders: number;
    totalRevenue: number;
    totalProfit: number;
    averageOrderValue: number;
    averageMargin: number;
    dailyMetrics: Array<{
      date: string;
      revenue: number;
      profit: number;
      orders: number;
    }>;
  };
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
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [shopUrl, setShopUrl] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchDashboardData();
    }
  }, [session, period]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/dashboard?period=${period}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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
          <div className="flex gap-3">
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

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">Total Revenue</span>
              <DollarSign className="h-5 w-5 text-gray-400" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {data ? formatCurrency(data.metrics.totalRevenue) : '$0.00'}
            </p>
            <p className="text-sm text-brand-600 mt-1">+{period} days</p>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">Net Profit</span>
              <TrendingUp className="h-5 w-5 text-brand-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {data ? formatCurrency(data.metrics.totalProfit) : '$0.00'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {data ? formatPercent(data.metrics.averageMargin) : '0%'} margin
            </p>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">Total Orders</span>
              <ShoppingCart className="h-5 w-5 text-gray-400" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {data?.metrics.totalOrders || 0}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Avg: {data ? formatCurrency(data.metrics.averageOrderValue) : '$0.00'}
            </p>
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
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(date) => new Date(date).toLocaleDateString()}
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
                    labelFormatter={(date) => new Date(date).toLocaleDateString()}
                  />
                  <Bar dataKey="orders" fill="#16a34a" name="Orders" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
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
                        {formatCurrency(order.totalRevenue)}
                      </td>
                      <td className="px-6 py-4 text-sm text-brand-600 font-medium">
                        {formatCurrency(order.netProfit)}
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

        {/* Connect Store Modal */}
        {showConnectModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="flex justify-between items-center p-6 border-b">
                <h3 className="text-lg font-semibold">Connect Your Store</h3>
                <button
                  onClick={() => setShowConnectModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6">
                <p className="text-sm text-gray-600 mb-4">
                  Connect your Store, Amazon, or other e-commerce store to import orders
                  and automatically calculate your true profit margins.
                </p>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!shopUrl) return;

                    try {
                      const response = await fetch(`/api/shopify?shop=${encodeURIComponent(shopUrl)}`, {
                        method: 'GET',
                      });

                      const result = await response.json();
                      if (result.authUrl) {
                        window.location.href = result.authUrl;
                      }
                    } catch (error) {
                      console.error('Failed to initiate store connection:', error);
                    }
                  }}
                >
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Platform
                    </label>
                    <select className="w-full border border-gray-300 rounded-md px-3 py-2">
                      <option>Store</option>
                      <option>Amazon</option>
                      <option>Etsy</option>
                      <option>WooCommerce</option>
                    </select>
                  </div>

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

                  <button
                    type="submit"
                    className="w-full btn-primary py-2"
                  >
                  <Store className="h-4 w-4 mr-2" />
                  Connect Store
                </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
