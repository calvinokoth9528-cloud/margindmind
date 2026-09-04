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
    const period = parseInt(searchParams.get('period') || '30');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    const orders = await prisma.order.findMany({
      where: {
        shop: { userId },
        orderDate: { gte: startDate },
      },
      orderBy: { orderDate: 'desc' },
    });

    return NextResponse.json({
      orders: orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        totalRevenue: order.totalRevenue,
        totalCost: order.totalCost,
        netProfit: order.netProfit,
        profitMargin: order.profitMargin,
        status: order.status,
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
