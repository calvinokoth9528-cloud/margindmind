import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).userId;
    const searchParams = request.nextUrl.searchParams;
    const shopId = searchParams.get('shopId') || null;
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const dateFilter: Record<string, Date> = {};
    if (from) dateFilter.gte = new Date(`${from}T00:00:00`);
    if (to) dateFilter.lte = new Date(`${to}T23:59:59.999`);

    // Legacy preset (days back) still supported when no explicit range is given
    if (!from && !to) {
      const period = parseInt(searchParams.get('period') || '30');
      if (!isNaN(period) && period > 0) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - period);
        dateFilter.gte = startDate;
      }
    }

    const shopWhere: Record<string, unknown> = { userId };
    if (shopId) shopWhere.id = shopId;

    const [orders, shops] = await Promise.all([
      prisma.order.findMany({
        where: {
          shop: shopWhere,
          ...(Object.keys(dateFilter).length > 0 ? { orderDate: dateFilter } : {}),
        },
        orderBy: { orderDate: 'desc' },
      }),
      prisma.shop.findMany({
        where: { userId },
        select: { id: true, currency: true },
      }),
    ]);

    // Most common currency across the shops in scope, for display
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

    return NextResponse.json({
      currency: displayCurrency,
      orders: orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        totalRevenue: order.totalRevenue,
        totalCost: order.totalCost,
        netProfit: order.netProfit,
        profitMargin: order.profitMargin,
        status: order.status,
        refundedAt: order.refundedAt,
        refundAmount: order.refundAmount,
        refundReason: order.refundReason,
        orderDate: order.orderDate.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Orders API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}
