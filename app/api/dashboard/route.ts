import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import {
  aggregateMetrics,
  aggregateProductMetrics,
  comparePeriods,
} from '@/lib/profit';

const orderInclude = {
  items: {
    include: { product: true },
  },
} as const;

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).userId;
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || '30';
    const shopId = searchParams.get('shopId') || null;
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    // Custom date range wins over the period preset; comparison uses the
    // equally-sized window immediately before it either way.
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    if (fromParam) {
      startDate = new Date(`${fromParam}T00:00:00`);
      endDate = toParam ? new Date(`${toParam}T23:59:59.999`) : now;
      if (isNaN(startDate.getTime())) {
        return NextResponse.json({ error: 'Invalid from date' }, { status: 400 });
      }
    } else {
      const daysAgo = parseInt(period);
      if (isNaN(daysAgo) || daysAgo <= 0) {
        return NextResponse.json({ error: 'Invalid period' }, { status: 400 });
      }
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - daysAgo);
      startDate.setHours(0, 0, 0, 0);
    }

    const rangeMs = endDate.getTime() - startDate.getTime();

    // Previous period of the same length, immediately before the current one
    const prevEndDate = new Date(startDate);
    const prevStartDate = new Date(startDate.getTime() - rangeMs);

    const shopWhere: Record<string, unknown> = { userId };
    if (shopId) shopWhere.id = shopId;

    const [orders, prevOrders, shops] = await Promise.all([
      prisma.order.findMany({
        where: {
          shop: shopWhere,
          orderDate: { gte: startDate, lte: endDate },
        },
        include: orderInclude,
        orderBy: { orderDate: 'desc' },
      }),
      prisma.order.findMany({
        where: {
          shop: shopWhere,
          orderDate: { gte: prevStartDate, lt: prevEndDate },
        },
        orderBy: { orderDate: 'desc' },
      }),
      prisma.shop.findMany({
        where: { userId },
        select: { id: true, currency: true },
      }),
    ]);

    // Amounts are shown in the most common currency among the shops in scope.
    const scopedShopIds = new Set(shopId ? [shopId] : shops.map((s) => s.id));
    const currencyCounts = new Map<string, number>();
    shops.forEach((s) => {
      if (!scopedShopIds.has(s.id)) return;
      const code = (s.currency || 'USD').toUpperCase();
      currencyCounts.set(code, (currencyCounts.get(code) || 0) + 1);
    });
    const displayCurrency =
      Array.from(currencyCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ??
      'USD';
    const shopCount = shopId ? 1 : shops.length;

    const toMetrics = (
      list: Array<{
        totalRevenue: number;
        totalCost: number;
        shippingCost: number;
        transactionFee: number;
        taxAmount: number;
        adSpend: number;
        netProfit: number;
        profitMargin: number;
        refundAmount: number | null;
        orderDate: Date;
      }>
    ) =>
      list.map((order) => ({
        totalRevenue: order.totalRevenue,
        totalCost: order.totalCost,
        shippingCost: order.shippingCost,
        transactionFee: order.transactionFee,
        taxAmount: order.taxAmount,
        adSpend: order.adSpend,
        netProfit: order.netProfit,
        profitMargin: order.profitMargin,
        refundAmount: order.refundAmount || 0,
        date: order.orderDate.toISOString().split('T')[0],
      }));

    const metrics = aggregateMetrics(toMetrics(orders));
    const prevMetrics = aggregateMetrics(toMetrics(prevOrders));

    const comparison = comparePeriods(
      {
        revenue: metrics.totalRevenue,
        profit: metrics.totalProfit,
        orders: metrics.totalOrders,
      },
      {
        revenue: prevMetrics.totalRevenue,
        profit: prevMetrics.totalProfit,
        orders: prevMetrics.totalOrders,
      }
    );

    const topProducts = aggregateProductMetrics(orders).slice(0, 5);

    // Refund summary for the period
    const refundedOrders = orders.filter((o) => o.refundAmount && o.refundAmount > 0);
    const refundSummary = {
      count: refundedOrders.length,
      total: refundedOrders.reduce((sum, o) => sum + (o.refundAmount || 0), 0),
    };

    // Get recent orders for table
    const recentOrders = orders.slice(0, 10).map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      totalRevenue: order.totalRevenue,
      netProfit: order.netProfit,
      profitMargin: order.profitMargin,
      status: order.status,
      refunded: !!order.refundAmount,
      date: order.orderDate,
    }));

    return NextResponse.json({
      metrics,
      comparison,
      topProducts,
      recentOrders,
      shopCount,
      currency: displayCurrency,
      refundSummary,
      period: fromParam ? 'custom' : parseInt(period),
      from: fromParam,
      to: toParam,
    });
  } catch (error) {
    console.error('Dashboard data error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
