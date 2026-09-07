import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';

export async function DELETE(
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

    const shop = await prisma.shop.findFirst({
      where: { id, userId },
    });

    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    // Delete dependent records first (Prisma default referential action is Restrict)
    const orders = await prisma.order.findMany({
      where: { shopId: shop.id },
      select: { id: true },
    });

    if (orders.length > 0) {
      await prisma.orderItem.deleteMany({
        where: { orderId: { in: orders.map((o) => o.id) } },
      });
      await prisma.order.deleteMany({ where: { shopId: shop.id } });
    }

    await prisma.product.deleteMany({ where: { shopId: shop.id } });
    await prisma.shop.delete({ where: { id: shop.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Shop delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete shop' },
      { status: 500 }
    );
  }
}