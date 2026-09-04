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

    const products = await prisma.product.findMany({
      where: {
        shop: { userId },
      },
      include: {
        orderItems: {
          include: { order: true },
        },
      },
    });

    const productData = products.map((product) => {
      let totalOrders = 0;
      let totalRevenue = 0;
      let totalCost = 0;

      product.orderItems.forEach((item) => {
        totalOrders += item.quantity;
        totalRevenue += item.price * item.quantity;
        totalCost += item.cost * item.quantity;
      });

      const profit = totalRevenue - totalCost;
      const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

      return {
        id: product.id,
        title: product.title,
        sku: product.sku,
        cost: product.cost,
        price: product.price,
        profit,
        margin,
        orders: totalOrders,
      };
    });

    return NextResponse.json({ products: productData });
  } catch (error) {
    console.error('Products API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}
