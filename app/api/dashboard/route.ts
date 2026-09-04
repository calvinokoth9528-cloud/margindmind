import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { aggregateMetrics } from '@/lib/profit';

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
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);

    // Fetch orders for the period
    const orders = await prisma.order.findMany({
      where: {
        shop: { userId },
        orderDate: { gte: startDate },
      },
      include: {
        items: {
          include: { product: true },
        },
      },
      orderBy: { orderDate: 'desc' },
    });

    // Transform to metrics format
    const orderMetrics = orders.map((order) => ({
      totalRevenue: order.totalRevenue,
      totalCost: order.totalCost,
      shippingCost: order.shippingCost,
      transactionFee: order.transactionFee,
      adSpend: order.adSpend,
      netProfit: order.netProfit,
      profitMargin: order.profitMargin,
      date: order.orderDate.toISOString().split('T')[0],
    }));

    // Aggregate metrics
    const metrics = aggregateMetrics(orderMetrics);

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

    // Get shop count
    const shopCount = await prisma.shop.count({
      where: { userId },
    });

    return NextResponse.json({
      metrics,
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
