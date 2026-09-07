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

    const daysAgo = parseInt(period);
    if (isNaN(daysAgo) || daysAgo <= 0) {
      return NextResponse.json({ error: 'Invalid period' }, { status: 400 });
    }

    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - daysAgo);
    startDate.setHours(0, 0, 0, 0);

    // Previous period of the same length, immediately before the current one
    const prevEndDate = new Date(startDate);
    const prevStartDate = new Date(startDate);
    prevStartDate.setDate(prevStartDate.getDate() - daysAgo);

    const shopWhere = { userId };

    const [orders, prevOrders, shopCount] = await Promise.all([
      prisma.order.findMany({
        where: {
          shop: shopWhere,
          orderDate: { gte: startDate },
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
      prisma.shop.count({ where: shopWhere }),
    ]);

    const toMetrics = (
      list: Array<{
        totalRevenue: number;
        totalCost: number;
        shippingCost: number;
        transactionFee: number;
        adSpend: number;
        netProfit: number;
        profitMargin: number;
        orderDate: Date;
      }>
    ) =>
      list.map((order) => ({
        totalRevenue: order.totalRevenue,
        totalCost: order.totalCost,
        shippingCost: order.shippingCost,
        transactionFee: order.transactionFee,
        adSpend: order.adSpend,
        netProfit: order.netProfit,
        profitMargin: order.profitMargin,
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

    // Get recent orders for table
    const recentOrders = orders.slice(0, 10).map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      totalRevenue: order.totalRevenue,
      netProfit: order.netProfit,
      profitMargin: order.profitMargin,
      status: order.status,
      date: order.orderDate,
    }));

    return NextResponse.json({
      metrics,
      comparison,
      topProducts,
      recentOrders,
      shopCount,
      period: daysAgo,
    });
  } catch (error) {
    console.error('Dashboard data error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}