import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { parseCsv } from '@/lib/csv';
import { buildImportFromRows } from '@/lib/import';
import { z } from 'zod';

const MAX_CSV_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_ROWS = 10_000;

const importSchema = z.object({
  storeName: z.string().min(1).max(60),
  csv: z.string().min(1).max(MAX_CSV_BYTES),
});

const slugify = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'csv-import';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).userId;
    const body = await request.json();
    const { storeName, csv } = importSchema.parse(body);

    const rows = parseCsv(csv);
    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'No data rows found in the CSV. Check that it has a header row.' },
        { status: 400 }
      );
    }
    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `CSV has ${rows.length} rows; the limit is ${MAX_ROWS}.` },
        { status: 400 }
      );
    }

    const { orders, skipped } = buildImportFromRows(rows);
    if (orders.length === 0) {
      return NextResponse.json(
        {
          error:
            'Could not recognize any orders. Make sure columns match the template (Order ID, Product Title, Quantity, Unit Price, ...) or a Shopify export.',
          details: skipped.slice(0, 5),
        },
        { status: 400 }
      );
    }

    // Find or create the store for this import
    const shopUrl = slugify(storeName);
    const shop = await prisma.shop.upsert({
      where: {
        userId_shopUrl: { userId, shopUrl },
      },
      update: {
        platform: 'CSV',
        lastSync: new Date(),
      },
      create: {
        userId,
        shopUrl,
        platform: 'CSV',
        accessToken: '',
        lastSync: new Date(),
      },
    });

    // Upsert products referenced by the import
    const productIds = new Map<string, string>(); // product externalId -> db id
    let productsImported = 0;

    for (const order of orders) {
      for (const item of order.items) {
        const externalId = item.sku || `title-${item.productTitle.toLowerCase()}`;
        if (productIds.has(externalId)) continue;

        const product = await prisma.product.upsert({
          where: {
            shopId_externalId: { shopId: shop.id, externalId },
          },
          update: {
            title: item.productTitle,
            sku: item.sku || null,
            price: item.unitPrice,
            cost: item.unitCost,
          },
          create: {
            shopId: shop.id,
            externalId,
            title: item.productTitle,
            sku: item.sku || null,
            price: item.unitPrice,
            cost: item.unitCost,
          },
        });
        productIds.set(externalId, product.id);
        productsImported++;
      }
    }

    // Upsert orders and rebuild their line items
    let ordersCreated = 0;
    let ordersUpdated = 0;

    for (const order of orders) {
      const existing = await prisma.order.findUnique({
        where: {
          shopId_externalId: { shopId: shop.id, externalId: order.externalId },
        },
      });

      if (existing) {
        ordersUpdated++;
      } else {
        ordersCreated++;
      }

      const data = {
        orderNumber: order.orderNumber,
        totalRevenue: order.totalRevenue,
        totalCost: order.totalCost,
        shippingCost: order.shippingCost,
        transactionFee: order.transactionFee,
        adSpend: order.adSpend,
        netProfit: order.netProfit,
        profitMargin: order.profitMargin,
        status: order.status,
        orderDate: order.orderDate,
      };

      const saved = await prisma.order.upsert({
        where: {
          shopId_externalId: { shopId: shop.id, externalId: order.externalId },
        },
        update: data,
        create: {
          shopId: shop.id,
          externalId: order.externalId,
          ...data,
        },
      });

      await prisma.orderItem.deleteMany({ where: { orderId: saved.id } });

      if (order.items.length > 0) {
        await prisma.orderItem.createMany({
          data: order.items.map((item) => ({
            orderId: saved.id,
            productId:
              productIds.get(item.sku || `title-${item.productTitle.toLowerCase()}`) ??
              null,
            quantity: item.quantity,
            price: item.unitPrice,
            cost: item.unitCost,
          })),
        });
      }
    }

    return NextResponse.json({
      success: true,
      storeName: storeName.trim(),
      ordersCreated,
      ordersUpdated,
      ordersSkipped: skipped.length,
      productsImported,
      skippedSamples: skipped.slice(0, 3),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid upload', details: error.issues },
        { status: 400 }
      );
    }
    console.error('CSV import error:', error);
    return NextResponse.json({ error: 'Failed to import CSV' }, { status: 500 });
  }
}