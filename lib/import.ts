// Normalize raw CSV rows (from parseCsv) into orders that fit the MarginMind schema.
// Understands the MarginMind template AND common e-commerce exports (Shopify order
// export columns like Name, Paid at, Lineitem quantity/name/sku/price, etc.).
import { parseNumber, parseDate } from './csv.ts';
import type { CsvRow } from './csv.ts';
import { calculateProviderFee, roundMoney } from './fees.ts';

export interface ImportOptions {
  /** Payment-provider id selecting the fee profile (defaults to 'other'). */
  paymentProvider?: string;
  /** Custom fee overrides (Shop custom fee); beats paymentProvider when both set. */
  customFee?: { feePercent?: number | null; feeFixed?: number | null } | null;
  /** Tax rate (%) applied to revenue for pre/post-tax profit. */
  taxRate?: number;
}

export const DEFAULT_IMPORT_OPTIONS: ImportOptions = { paymentProvider: 'other' };

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
  taxAmount: number;
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
  | 'total'
  | 'transactionFee'
  | 'salesTax';

// Aliases are compared against lowercased headers with spaces, underscores
// AND dashes removed (e.g. "Order ID", "order_id", "orderid" and the
// hyphenated "amazon-order-id"-style headers all match). This covers Shopify
// exports, the MarginMind template, and Etsy/Amazon/Jumia/Kilimall reports.
const FIELD_ALIASES: Record<FieldKey, string[]> = {
  orderId: ['orderid', 'amazonorderid', 'merchantorderid', 'order', 'name', 'ordernumber', 'id'],
  orderNumber: ['ordernumber', 'name', 'order', 'orderid'],
  orderDate: [
    'paidat',
    'saledate',
    'datepaid',
    'createdat',
    'purchasedate',
    'ordertime',
    'date',
    'orderdate',
    'created',
    'updatedat',
  ],
  status: ['financialstatus', 'status', 'fulfillmentstatus', 'orderstatus', 'paymentstatus'],
  productTitle: [
    'lineitemname',
    'producttitle',
    'productname',
    'product',
    'title',
    'itemname',
    'varianttitle',
    'itemtitle',
  ],
  sku: ['lineitemsku', 'variantsku', 'merchantsku', 'sellersku', 'suppliersku', 'productsku', 'sku', 'itemsku', 'sku1'],
  quantity: [
    'lineitemquantity',
    'quantity',
    'quantityshipped',
    'qty',
    'itemquantity',
    'numberofitems',
    'units',
    'count',
  ],
  unitPrice: [
    'lineitemprice',
    'unitprice',
    'price',
    'itemprice',
    'paidprice',
    'priceeach',
  ],
  unitCost: ['cost', 'unitcost', 'productcost', 'landedcost', 'cogs', 'costofgoods'],
  shipping: [
    'shipping',
    'ordershipping',
    'shippingprice',
    'shippingfee',
    'shippingcost',
    'totalshipping',
    'fulfillmentcost',
  ],
  adSpend: ['adspend', 'ads', 'advertising', 'marketingspend', 'adcost'],
  total: ['total', 'ordertotal', 'ordervalue', 'totalprice', 'totalrevenue', 'revenue', 'amount'],
  // Optional: when the export carries the platform's actual fees/tax we use
  // them verbatim (more accurate than the provider profile estimate).
  transactionFee: ['cardprocessingfees', 'transactionfees', 'transactionfee', 'sellingfees'],
  salesTax: ['salestax', 'saletax', 'ordersalestax', 'itemtax', 'vatpaidbybuyer', 'vatpaid', 'tax'],
};

const normalizeHeader = (header: string) =>
  header.trim().toLowerCase().replace(/[\s_-]+/g, '');

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
  transactionFee: number;
  salesTax: number;
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
    orderNumber: get('orderNumber').trim(),
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
    transactionFee: parseNumber(get('transactionFee')),
    salesTax: parseNumber(get('salesTax')),
    hasTotalColumn,
    hasOrderId: orderIdRaw.trim() !== '',
  };
}

// ---------------------------------------------------------------------------
// Public build function
// ---------------------------------------------------------------------------

export function buildImportFromRows(
  rows: CsvRow[],
  options: ImportOptions = DEFAULT_IMPORT_OPTIONS
): BuildImportResult {
  if (rows.length === 0) {
    return { orders: [], skipped: [] };
  }

  const feeProvider = options.paymentProvider || 'other';
  const customFee = options.customFee ?? null;
  const taxRate = options.taxRate ?? 0;

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
    // Prefer the platform's own reported fee/tax from the export when present
    // (Etsy "Card Processing Fees", Amazon "Item Tax", etc.); fall back to
    // the shop's provider profile and tax rate.
    const transactionFee =
      first.transactionFee > 0
        ? first.transactionFee
        : calculateProviderFee(totalRevenue, feeProvider, customFee);
    const taxAmount =
      first.salesTax > 0 ? first.salesTax : totalRevenue * (taxRate / 100);
    const adSpend = first.adSpend;
    const netProfit =
      totalRevenue -
      totalCost -
      shippingCost -
      transactionFee -
      taxAmount -
      adSpend;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    let externalId = key;
    // Fall back to the order id (e.g. an Amazon/Jumia order number) when the
    // export has no dedicated order-number column.
    let orderNumber =
      first.orderNumber || (key.startsWith('__row_') ? '' : key);
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
      totalRevenue: roundMoney(totalRevenue),
      shippingCost: roundMoney(shippingCost),
      transactionFee: roundMoney(transactionFee),
      taxAmount: roundMoney(taxAmount),
      adSpend: roundMoney(adSpend),
      totalCost: roundMoney(totalCost),
      netProfit: roundMoney(netProfit),
      profitMargin: roundMoney(profitMargin),
      items,
    });
  }

  return { orders, skipped };
}

