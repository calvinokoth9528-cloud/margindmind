import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import {
  fetchShopifyOrders,
  fetchShopifyProducts,
  transformShopifyOrder,
  transformShopifyProduct,
} from '@/lib/shopify';

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

    const shop = await prisma.shop.findFirst({
      where: { id, userId },
    });

    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    if (shop.platform !== 'SHOPIFY') {
      return NextResponse.json(
        { error: 'Sync is only supported for Shopify stores' },
        { status: 400 }
      );
    }

    const config = {
      shopUrl: `${shop.shopUrl}.myshopify.com`,
      accessToken: shop.accessToken,
    };

    // 1. Import products
    const shopifyProducts = await fetchShopifyProducts(config);
    let productsImported = 0;
    const productIdMap = new Map<string, string>(); // externalId -> db id
    const productCosts = new Map<string, number>(); // externalId -> cost

    for (const sp of shopifyProducts) {
      const transformed = transformShopifyProduct(sp);
      const upserted = await prisma.product.upsert({
        where: {
          shopId_externalId: {
            shopId: shop.id,
            externalId: transformed.externalId,
          },
        },
        update: {
          title: transformed.title,
          sku: transformed.sku,
          price: transformed.price,
        },
        create: {
          shopId: shop.id,
          externalId: transformed.externalId,
          title: transformed.title,
          sku: transformed.sku,
          price: transformed.price,
          cost: 0, // Shopify doesn't expose landed cost via the basic API
        },
      });
      if (!productIdMap.has(transformed.externalId)) {
        productIdMap.set(transformed.externalId, upserted.id);
      }
      productCosts.set(transformed.externalId, upserted.cost);
      productsImported++;
    }

    // 2. Import orders (incremental since last sync)
    const since = shop.lastSync ?? undefined;
    const shopifyOrders = await fetchShopifyOrders(config, since);

    let ordersImported = 0;
    let ordersUpdated = 0;

    for (const so of shopifyOrders) {
      // Recompute fees with the shop's payment-provider profile on every sync
      const transformed = transformShopifyOrder(so, productCosts, shop.paymentProvider);

      const existing = await prisma.order.findUnique({
        where: {
          shopId_externalId: {
            shopId: shop.id,
            externalId: transformed.externalId,
          },
        },
      });

      if (existing) {
        ordersUpdated++;
      } else {
        ordersImported++;
      }

      // Upsert the order and rebuild its items
      const order = await prisma.order.upsert({
        where: {
          shopId_externalId: {
            shopId: shop.id,
            externalId: transformed.externalId,
          },
        },
        update: {
          orderNumber: transformed.orderNumber,
          totalRevenue: transformed.totalRevenue,
          totalCost: transformed.totalCost,
          shippingCost: transformed.shippingCost,
          transactionFee: transformed.transactionFee,
          adSpend: transformed.adSpend,
          netProfit: transformed.netProfit,
          profitMargin: transformed.profitMargin,
          status: transformed.status,
          orderDate: transformed.orderDate,
        },
        create: {
          shopId: shop.id,
          externalId: transformed.externalId,
          orderNumber: transformed.orderNumber,
          totalRevenue: transformed.totalRevenue,
          totalCost: transformed.totalCost,
          shippingCost: transformed.shippingCost,
          transactionFee: transformed.transactionFee,
          adSpend: transformed.adSpend,
          netProfit: transformed.netProfit,
          profitMargin: transformed.profitMargin,
          status: transformed.status,
          orderDate: transformed.orderDate,
        },
      });

      // Replace line items so edits stay in sync with the source store
      await prisma.orderItem.deleteMany({ where: { orderId: order.id } });

      if (transformed.items.length > 0) {
        await prisma.orderItem.createMany({
          data: transformed.items.map((item) => ({
            orderId: order.id,
            productId: productIdMap.get(item.productExternalId) ?? null,
            quantity: item.quantity,
            price: item.price,
            cost: item.cost,
          })),
        });
      }
    }

    // 3. Mark the sync time
    await prisma.shop.update({
      where: { id: shop.id },
      data: { lastSync: new Date() },
    });

    return NextResponse.json({
      success: true,
      productsImported,
      ordersImported,
      ordersUpdated,
    });
  } catch (error) {
    console.error('Shopify sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync Shopify store' },
      { status: 500 }
    );
  }
}