import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { z } from 'zod';

const costSchema = z.object({
  cost: z.number().min(0).max(1_000_000),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).userId;
    const { id } = await params;

    const body = await request.json();
    const { cost } = costSchema.parse(body);

    // The product must belong to a shop owned by this user
    const product = await prisma.product.findFirst({
      where: { id, shop: { userId } },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    await prisma.product.update({
      where: { id },
      data: { cost },
    });

    // Recompute historical profit for every order that sold this product.
    // Product costs change over time, but we apply the new landed cost to past
    // line items so reported profit reflects the current cost basis.
    const lineItems = await prisma.orderItem.findMany({
      where: { productId: id },
      select: { id: true, orderId: true },
    });

    const affectedOrderIds = Array.from(
      new Set(lineItems.map((li) => li.orderId))
    );

    await prisma.orderItem.updateMany({
      where: { productId: id },
      data: { cost },
    });

    let ordersRecomputed = 0;
    if (affectedOrderIds.length > 0) {
      const orders = await prisma.order.findMany({
        where: { id: { in: affectedOrderIds } },
        include: { items: true },
      });

      for (const order of orders) {
        const totalCost = order.items.reduce(
          (sum, item) => sum + item.cost * item.quantity,
          0
        );
        const netProfit =
          order.totalRevenue -
          totalCost -
          order.shippingCost -
          order.transactionFee -
          order.adSpend;
        const profitMargin =
          order.totalRevenue > 0 ? (netProfit / order.totalRevenue) * 100 : 0;

        await prisma.order.update({
          where: { id: order.id },
          data: { totalCost, netProfit, profitMargin },
        });
        ordersRecomputed++;
      }
    }

    return NextResponse.json({
      success: true,
      product: { id, cost },
      ordersRecomputed,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Product cost update error:', error);
    return NextResponse.json({ error: 'Failed to update product cost' }, { status: 500 });
  }
}