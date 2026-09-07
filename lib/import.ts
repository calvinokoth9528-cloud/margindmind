// Normalize raw CSV rows (from parseCsv) into orders that fit the MarginMind schema.
// Understands the MarginMind template AND common e-commerce exports (Shopify order
// export columns like Name, Paid at, Lineitem quantity/name/sku/price, etc.).
import { parseNumber, parseDate } from './csv.ts';
import type { CsvRow } from './csv.ts';
import { calculateShopifyFee } from './shopify.ts';

export interface ImportLineItem {
  productTitle: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
}

export interface ImportOrder {
  externalId: string;
  orderNumber: string;
  orderDate: Date;
  status: string;
  totalRevenue: number;
  shippingCost: number;
  transactionFee: number;
  adSpend: number;
  totalCost: number;
  netProfit: number;
  profitMargin: number;
  items: ImportLineItem[];
}

export interface SkippedRow {
  rowNumber: number;
  reason: string;
}

export interface BuildImportResult {
  orders: ImportOrder[];
  skipped: SkippedRow[];
}

// ---------------------------------------------------------------------------
// Column mapping
// ---------------------------------------------------------------------------

type FieldKey =
  | 'orderId'
  | 'orderNumber'
  | 'orderDate'
  | 'status'
  | 'productTitle'
  | 'sku'
  | 'quantity'
  | 'unitPrice'
  | 'unitCost'
  | 'shipping'
  | 'adSpend'
  | 'total';

// Aliases are compared against lowercased headers with spaces and underscores
// removed (e.g. "Order ID", "order_id" and "orderid" all match 'orderid').
const FIELD_ALIASES: Record<FieldKey, string[]> = {
  orderId: ['orderid', 'order', 'name', 'ordernumber', 'id'],
  orderNumber: ['ordernumber', 'name', 'order', 'orderid'],
  orderDate: ['paidat', 'createdat', 'date', 'orderdate', 'created', 'updatedat'],
  status: ['financialstatus', 'status', 'fulfillmentstatus', 'orderstatus'],
  productTitle: [
    'lineitemname',
    'producttitle',
    'product',
    'title',
    'itemname',
    'varianttitle',
    'productname',
    'itemtitle',
  ],
  sku: ['lineitemsku', 'variantsku', 'productsku', 'sku', 'itemsku', 'sku1'],
  quantity: ['lineitemquantity', 'quantity', 'qty', 'itemquantity', 'units', 'count'],
  unitPrice: ['lineitemprice', 'unitprice', 'price', 'itemprice', 'priceeach'],
  unitCost: ['cost', 'unitcost', 'productcost', 'landedcost', 'cogs', 'costofgoods'],
  shipping: ['shipping', 'shippingcost', 'totalshipping', 'fulfillmentcost'],
  adSpend: ['adspend', 'ads', 'advertising', 'marketingspend', 'adcost'],
  total: ['total', 'totalprice', 'totalrevenue', 'revenue', 'amount', 'ordertotal'],
};

const normalizeHeader = (header: string) =>
  header.trim().toLowerCase().replace(/[\s_]+/g, '');

export function detectField(
  headers: string[],
  field: FieldKey
): { index: number; header: string } | null {
  const normalized = headers.map(normalizeHeader);
  const aliases = FIELD_ALIASES[field];
  for (const alias of aliases) {
    const index = normalized.indexOf(alias);
    if (index !== -1) return { index, header: headers[index] };
  }
  return null;
}

interface RowFields {
  orderId: string;
  orderNumber: string;
  orderDate: Date | null;
  status: string;
  productTitle: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  shipping: number;
  adSpend: number;
  total: number;
  hasTotalColumn: boolean;
  hasOrderId: boolean;
}

function extractRow(row: CsvRow, headers: string[], index: number): RowFields {
  const get = (field: FieldKey): string => {
    const detected = detectField(headers, field);
    if (!detected) return '';
    return row[detected.header] ?? '';
  };

  const orderIdRaw = get('orderId');
  const totalRaw = get('total');
  const hasTotalColumn =
    detectField(headers, 'total') !== null && totalRaw.trim() !== '';

  return {
    orderId: orderIdRaw.trim(),
    orderNumber: get('orderNumber').trim() || `#${1000 + index}`,
    orderDate: parseDate(get('orderDate')),
    status: (get('status').trim() || 'paid').toLowerCase(),
    productTitle: get('productTitle').trim(),
    sku: get('sku').trim(),
    quantity: parseNumber(get('quantity')) || 1,
    unitPrice: parseNumber(get('unitPrice')),
    unitCost: parseNumber(get('unitCost')),
    shipping: parseNumber(get('shipping')),
    adSpend: parseNumber(get('adSpend')),
    total: parseNumber(totalRaw),
    hasTotalColumn,
    hasOrderId: orderIdRaw.trim() !== '',
  };
}

// ---------------------------------------------------------------------------
// Public build function
// ---------------------------------------------------------------------------

export function buildImportFromRows(rows: CsvRow[]): BuildImportResult {
  if (rows.length === 0) {
    return { orders: [], skipped: [] };
  }

  const headers = Object.keys(rows[0]);
  const skipped: SkippedRow[] = [];
  const hasDateColumn = detectField(headers, 'orderDate') !== null;

  // First pass: extract per-row fields and group by order id (Shopify repeats
  // the same order once per line item).
  const groups = new Map<string, RowFields[]>();

  rows.forEach((row, index) => {
    const fields = extractRow(row, headers, index);

    if (!hasDateColumn && !fields.orderDate) {
      fields.orderDate = new Date();
    }

    if (!fields.orderDate) {
      skipped.push({
        rowNumber: index + 2, // +2 accounts for the header row
        reason: 'Order date could not be parsed',
      });
      return;
    }

    // A row must describe at least one sellable line
    if (!fields.productTitle && fields.unitPrice <= 0 && fields.total <= 0) {
      skipped.push({
        rowNumber: index + 2,
        reason: 'No product or amount found on this row',
      });
      return;
    }

    const key = fields.hasOrderId ? fields.orderId : `__row_${index}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(fields);
  });

  // Second pass: assemble groups into orders
  const orders: ImportOrder[] = [];
  let generatedOrder = 0;

  for (const [key, groupRows] of Array.from(groups.entries())) {
    const first = groupRows[0];

    // Items from each row (fall back to a single line when only order-level
    // totals exist and there is no product info).
    const items: ImportLineItem[] = [];
    for (const row of groupRows) {
      if (row.productTitle) {
        items.push({
          productTitle: row.productTitle,
          sku: row.sku || undefined,
          quantity: row.quantity,
          unitPrice: row.unitPrice,
          unitCost: row.unitCost,
        });
      }
    }

    if (items.length === 0 && first.unitPrice <= 0 && first.total <= 0) {
      skipped.push({
        rowNumber: 2,
        reason: `Order "${first.orderNumber}" has no line items or amount`,
      });
      continue;
    }

    // Revenue: prefer an explicit order total (taken once per group); otherwise
    // derive from line items.
    let totalRevenue: number;
    if (first.hasTotalColumn && first.total > 0) {
      totalRevenue = first.total;
    } else {
      totalRevenue =
        items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) +
        first.shipping;
    }

    const totalCost = items.reduce(
      (sum, item) => sum + item.unitCost * item.quantity,
      0
    );
    const shippingCost = first.shipping;
    const transactionFee = calculateShopifyFee(totalRevenue);
    const adSpend = first.adSpend;
    const netProfit =
      totalRevenue - totalCost - shippingCost - transactionFee - adSpend;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    let externalId = key;
    let orderNumber = first.orderNumber;
    if (key.startsWith('__row_')) {
      externalId = `csv_${Date.now()}_${generatedOrder++}`;
      orderNumber = orderNumber || `#${1000 + generatedOrder}`;
    }

    // Ignore zero-revenue line-less rows that carried only a total of 0
    if (totalRevenue <= 0 && items.length === 0) continue;

    orders.push({
      externalId,
      orderNumber,
      orderDate: first.orderDate as Date,
      status: first.status,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      shippingCost: Math.round(shippingCost * 100) / 100,
      transactionFee: Math.round(transactionFee * 100) / 100,
      adSpend: Math.round(adSpend * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100,
      profitMargin: Math.round(profitMargin * 100) / 100,
      items,
    });
  }

  return { orders, skipped };
}

