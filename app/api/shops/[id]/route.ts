import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import {
  COUNTRY_CODES,
  CURRENCY_CODES,
  PAYMENT_PROVIDER_IDS,
  resolveFeeProfile,
  resolveTaxRate,
} from '@/lib/fees';
import { z } from 'zod';

const optionalNonNegative = z.number().min(0).max(100).nullable().optional();

const updateSchema = z
  .object({
    country: z.string().refine((c) => COUNTRY_CODES.includes(c.toUpperCase()), {
      message: 'Unsupported country',
    }),
    currency: z.string().refine((c) => CURRENCY_CODES.includes(c.toUpperCase()), {
      message: 'Unsupported currency',
    }),
    paymentProvider: z.string().refine((p) => PAYMENT_PROVIDER_IDS.includes(p), {
      message: 'Unknown payment provider',
    }),
    // Custom fee profile: percent + fixed override the preset. Send null to
    // clear and return to the preset profile.
    feePercent: optionalNonNegative,
    feeFixed: z.number().min(0).max(1000).nullable().optional(),
    // Shop-level tax rate (%); null = use country default
    taxRate: optionalNonNegative,
    recomputeFees: z.boolean().optional(),
  })
  .partial();

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

    const shop = await prisma.shop.findFirst({
      where: { id, userId },
    });

    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    const body = await request.json();
    const data = updateSchema.parse(body);

    // Effective profile AFTER the change (used for fee recomputation)
    const effectiveProvider = data.paymentProvider ?? shop.paymentProvider;
    const effectiveCustom = {
      feePercent: 'feePercent' in data ? data.feePercent : shop.feePercent,
      feeFixed: 'feeFixed' in data ? data.feeFixed : shop.feeFixed,
    };
    const effectiveTaxRate = resolveTaxRate(
      'taxRate' in data ? data.taxRate : shop.taxRate,
      data.country ? data.country.toUpperCase() : shop.country
    );

    const feeChanged =
      (data.paymentProvider !== undefined && data.paymentProvider !== shop.paymentProvider) ||
      ('feePercent' in data && data.feePercent !== shop.feePercent) ||
      ('feeFixed' in data && data.feeFixed !== shop.feeFixed);
    const taxChanged =
      'taxRate' in data &&
      (data.taxRate ?? null) !== shop.taxRate;

    // Recompute historical orders when fees or tax changed (opt-out).
    if ((feeChanged || taxChanged) && data.recomputeFees !== false) {
      const profile = resolveFeeProfile(effectiveProvider, effectiveCustom);

      const orders = await prisma.order.findMany({
        where: { shopId: shop.id },
        select: {
          id: true,
          totalRevenue: true,
          totalCost: true,
          shippingCost: true,
          adSpend: true,
          refundAmount: true,
        },
      });

      for (const order of orders) {
        const fee =
          order.totalRevenue * (profile.percent / 100) + profile.fixed;
        const tax = order.totalRevenue * (effectiveTaxRate / 100);
        // Refunded orders keep their refund economics: revenue kept is what
        // remains after the refund, while costs (incl. gateway fee) stay.
        const keptRevenue = order.totalRevenue - (order.refundAmount || 0);
        const netProfit =
          keptRevenue -
          order.totalCost -
          order.shippingCost -
          fee -
          tax -
          order.adSpend;
        const marginBase = keptRevenue > 0 ? keptRevenue : order.totalRevenue;
        const profitMargin = marginBase > 0 ? (netProfit / marginBase) * 100 : 0;

        await prisma.order.update({
          where: { id: order.id },
          data: {
            transactionFee: fee,
            taxAmount: tax,
            netProfit,
            profitMargin,
          },
        });
      }
    }

    const updated = await prisma.shop.update({
      where: { id: shop.id },
      data: {
        country: data.country ? data.country.toUpperCase() : undefined,
        currency: data.currency ? data.currency.toUpperCase() : undefined,
        paymentProvider: data.paymentProvider,
        feePercent: 'feePercent' in data ? data.feePercent : undefined,
        feeFixed: 'feeFixed' in data ? data.feeFixed : undefined,
        taxRate: 'taxRate' in data ? data.taxRate : undefined,
      },
    });

    return NextResponse.json({
      success: true,
      shop: {
        id: updated.id,
        country: updated.country,
        currency: updated.currency,
        paymentProvider: updated.paymentProvider,
        feePercent: updated.feePercent,
        feeFixed: updated.feeFixed,
        taxRate: updated.taxRate,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Shop update error:', error);
    return NextResponse.json({ error: 'Failed to update store' }, { status: 500 });
  }
}
