import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { toCsv } from '@/lib/csv';
import type { CsvRow } from '@/lib/csv';

const ORDERS_HEADERS = [
  'Order Number',
  'Order Date',
  'Status',
  'Store',
  'Revenue',
  'Product Cost',
  'Shipping',
  'Transaction Fee',
  'Tax',
  'Ad Spend',
  'Refund Amount',
  'Net Profit',
  'Margin %',
];

const PRODUCTS_HEADERS = [
  'Title',
  'SKU',
  'Store',
  'Price',
  'Cost',
  'Units Sold',
  'Revenue',
  'Profit',
  'Margin %',
];

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = (session.user as any).userId;

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'orders';
    const shopId = searchParams.get('shopId') || null;
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    // Shared ownership filter; optional store + date range narrowing
    const shopWhere: Record<string, unknown> = { userId };
    if (shopId) shopWhere.id = shopId;

    const orderDateRange: Record<string, Date> = {};
    if (from) orderDateRange.gte = new Date(`${from}T00:00:00`);
    if (to) orderDateRange.lte = new Date(`${to}T23:59:59.999`);
    const hasDateRange = Object.keys(orderDateRange).length > 0;

    if (type === 'products') {
      const products = await prisma.product.findMany({
        where: { shop: shopWhere },
        include: {
          shop: { select: { shopUrl: true } },
          orderItems: { include: { order: true } },
        },
      });

      const rows: CsvRow[] = products.map((product) => {
        let units = 0;
        let revenue = 0;
        let cost = 0;
        product.orderItems.forEach((item) => {
          if (
            hasDateRange &&
            (item.order.orderDate < orderDateRange.gte! ||
              item.order.orderDate > orderDateRange.lte!)
          ) {
            return;
          }
          units += item.quantity;
          revenue += item.price * item.quantity;
          cost += item.cost * item.quantity;
        });
        const profit = revenue - cost;
        const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
        return {
          Title: product.title,
          SKU: product.sku || '',
          Store: product.shop.shopUrl,
          Price: product.price.toFixed(2),
          Cost: product.cost.toFixed(2),
          'Units Sold': String(units),
          Revenue: revenue.toFixed(2),
          Profit: profit.toFixed(2),
          'Margin %': margin.toFixed(1),
        };
      });

      const csv = toCsv(rows.length > 0 ? rows : [zipHeaders(PRODUCTS_HEADERS)]);
      return csvResponse(csv, 'margindmind-products.csv');
    }

    // Default: orders
    const orders = await prisma.order.findMany({
      where: {
        shop: shopWhere,
        ...(hasDateRange ? { orderDate: orderDateRange } : {}),
      },
      include: { shop: { select: { shopUrl: true } } },
      orderBy: { orderDate: 'desc' },
    });

    const rows: CsvRow[] = orders.map((order) => ({
      'Order Number': order.orderNumber,
      'Order Date': order.orderDate.toISOString().slice(0, 10),
      Status: order.status,
      Store: order.shop.shopUrl,
      Revenue: order.totalRevenue.toFixed(2),
      'Product Cost': order.totalCost.toFixed(2),
      Shipping: order.shippingCost.toFixed(2),
      'Transaction Fee': order.transactionFee.toFixed(2),
      Tax: order.taxAmount.toFixed(2),
      'Ad Spend': order.adSpend.toFixed(2),
      'Refund Amount': (order.refundAmount || 0).toFixed(2),
      'Net Profit': order.netProfit.toFixed(2),
      'Margin %': order.profitMargin.toFixed(1),
    }));

    const csv = toCsv(rows.length > 0 ? rows : [zipHeaders(ORDERS_HEADERS)]);
    return csvResponse(csv, 'margindmind-orders.csv');
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Failed to export' }, { status: 500 });
  }
}

// Header-only row so empty exports still carry column names
function zipHeaders(headers: string[]): CsvRow {
  const row: CsvRow = {};
  headers.forEach((h) => (row[h] = ''));
  return row;
}

function csvResponse(csv: string, filename: string): NextResponse {
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
