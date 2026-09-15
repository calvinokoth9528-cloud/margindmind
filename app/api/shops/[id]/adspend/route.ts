import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { parseCsv } from '@/lib/csv';
import { parseAdSpendRows, computeBackfill } from '@/lib/ads';
import { z } from 'zod';

const MAX_CSV_BYTES = 5 * 1024 * 1024; // 5 MB

const schema = z.object({
  csv: z.string().min(1).max(MAX_CSV_BYTES),
  overwrite: z.boolean().optional(),
});

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

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

    const shop = await prisma.shop.findFirst({ where: { id, userId } });
    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    const body = await request.json();
    const { csv, overwrite } = schema.parse(body);

    const rows = parseCsv(csv);
    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'No data rows found in the CSV. Check that it has a header row.' },
        { status: 400 }
      );
    }

    const parsed = parseAdSpendRows(rows);
    if (parsed.byDate.size === 0) {
      return NextResponse.json(
        {
          error:
            'Could not recognize ad spend. Expect "Day"/"Date" + "Amount spent"/"Cost" columns (Meta or Google Ads exports work as-is).',
          details: parsed.skipped.slice(0, 5),
        },
        { status: 400 }
      );
    }

    // Persist daily totals (upsert by shop+date)
    let daysImported = 0;
    for (const [dayKey, amount] of Array.from(parsed.byDate.entries())) {
      const date = startOfDay(new Date(`${dayKey}T00:00:00Z`));
      await prisma.adSpendDay.upsert({
        where: { shopId_date: { shopId: shop.id, date } },
        update: { amount, source: parsed.platform },
        create: {
          shopId: shop.id,
          date,
          amount,
          source: parsed.platform,
        },
      });
      daysImported++;
    }

    // Backfill order-level ad spend: split each day evenly across that day's orders
    const orders = await prisma.order.findMany({
      where: { shopId: shop.id },
      select: {
        id: true,
        orderDate: true,
        adSpend: true,
        totalRevenue: true,
        totalCost: true,
        shippingCost: true,
        transactionFee: true,
        taxAmount: true,
        refundAmount: true,
      },
    });

    const backfill = computeBackfill(
      parsed.byDate,
      orders.map((o) => ({
        id: o.id,
        orderDate: o.orderDate,
        currentAdSpend: o.adSpend,
      })),
      { overwrite }
    );

    for (const [orderId, share] of Array.from(backfill.perOrder.entries())) {
      const order = orders.find((o) => o.id === orderId);
      if (!order) continue;

      const keptRevenue = order.totalRevenue - (order.refundAmount || 0);
      const netProfit =
        keptRevenue -
        order.totalCost -
        order.shippingCost -
        order.transactionFee -
        order.taxAmount -
        share;
      const marginBase = keptRevenue > 0 ? keptRevenue : order.totalRevenue;
      const profitMargin = marginBase > 0 ? (netProfit / marginBase) * 100 : 0;

      await prisma.order.update({
        where: { id: orderId },
        data: { adSpend: share, netProfit, profitMargin },
      });
    }

    return NextResponse.json({
      success: true,
      platform: parsed.platform,
      daysImported,
      ordersUpdated: backfill.ordersUpdated,
      rowsSkipped: parsed.skipped.length,
      skippedSamples: parsed.skipped.slice(0, 3),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid upload', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Ad spend import error:', error);
    return NextResponse.json({ error: 'Failed to import ad spend' }, { status: 500 });
  }
}
