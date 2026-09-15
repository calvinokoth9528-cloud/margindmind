import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { applyRefund } from '@/lib/profit';
import { z } from 'zod';

const refundSchema = z.object({
  // Full refund when omitted
  amount: z.number().min(0).optional(),
  reason: z.string().max(200).optional(),
  // Set false to undo a refund (clears refundedAt/amount/reason)
  undo: z.boolean().optional(),
});

export async function POST(
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

    const order = await prisma.order.findFirst({
      where: { id, shop: { userId } },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const { amount, reason, undo } = refundSchema.parse(body);

    // Undo: restore the pre-refund state (stored amounts reset)
    if (undo) {
      if (!order.refundedAt) {
        return NextResponse.json({ error: 'Order is not refunded' }, { status: 400 });
      }
      // Recompute as if no refund happened
      const keptRevenue = order.totalRevenue;
      const netProfit =
        keptRevenue -
        order.totalCost -
        order.shippingCost -
        order.transactionFee -
        order.taxAmount -
        order.adSpend;
      const profitMargin =
        keptRevenue > 0 ? (netProfit / keptRevenue) * 100 : 0;

      const restored = await prisma.order.update({
        where: { id: order.id },
        data: {
          refundedAt: null,
          refundAmount: 0,
          refundReason: null,
          netProfit,
          profitMargin,
        },
      });

      return NextResponse.json({
        success: true,
        order: {
          id: restored.id,
          refundedAt: restored.refundedAt,
          refundAmount: restored.refundAmount,
          netProfit: restored.netProfit,
        },
      });
    }

    if (order.refundedAt) {
      return NextResponse.json(
        { error: 'Order already refunded. Undo it first to change the amount.' },
        { status: 400 }
      );
    }

    const refundAmount = amount ?? order.totalRevenue;
    if (refundAmount <= 0 || refundAmount > order.totalRevenue) {
      return NextResponse.json(
        { error: `Refund amount must be between 0 and ${order.totalRevenue}` },
        { status: 400 }
      );
    }

    const result = applyRefund({
      order: {
        totalRevenue: order.totalRevenue,
        totalCost: order.totalCost,
        shippingCost: order.shippingCost,
        transactionFee: order.transactionFee,
        taxAmount: order.taxAmount,
        adSpend: order.adSpend,
        refundAmount: 0,
      },
      refundAmount,
    });

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        refundedAt: new Date(),
        refundAmount: result.refundAmount,
        refundReason: reason || null,
        netProfit: result.netProfitAfterRefund,
        profitMargin: result.profitMarginAfterRefund,
      },
    });

    return NextResponse.json({
      success: true,
      order: {
        id: updated.id,
        refundedAt: updated.refundedAt,
        refundAmount: updated.refundAmount,
        refundReason: updated.refundReason,
        netProfit: updated.netProfit,
        profitMargin: updated.profitMargin,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Refund error:', error);
    return NextResponse.json({ error: 'Failed to process refund' }, { status: 500 });
  }
}
