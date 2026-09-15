import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv } from '../lib/csv.ts';
import { buildImportFromRows, detectField } from '../lib/import.ts';
import { buildTemplateCsv } from '../lib/template.ts';

describe('detectField', () => {
  it('matches headers regardless of case, spaces, or underscores', () => {
    const headers = ['Order ID', 'order_id', 'Created at', 'SKU'];
    assert.equal(detectField(headers, 'orderId')?.index, 0);
    assert.equal(detectField(headers, 'orderDate')?.header, 'Created at');
    assert.equal(detectField(['order_id'], 'orderId')?.index, 0);
    assert.equal(detectField(['sku'], 'sku')?.index, 0);
    assert.equal(detectField(['something else'], 'orderId'), null);
  });
});

describe('buildImportFromRows', () => {
  it('imports template rows into orders with correct profit math', () => {
    // Order #1001: 2 x $49.99 Premium Widget (cost $15) + $5.99 shipping + $12.50 ads
    const rows = parseCsv(buildTemplateCsv());
    const { orders, skipped } = buildImportFromRows(rows, { paymentProvider: 'shopify' });

    assert.equal(skipped.length, 0);
    assert.equal(orders.length, 2);

    const first = orders[0];
    assert.equal(first.orderNumber, '#1001');
    // Revenue = line items (2 × 49.99) + shipping passed to the customer
    assert.equal(first.totalRevenue, 105.97);
    assert.equal(first.totalCost, 30);
    assert.equal(first.shippingCost, 5.99);
    assert.equal(first.adSpend, 12.5);
    assert.equal(first.items.length, 1);
    assert.equal(first.items[0].quantity, 2);
    assert.equal(first.items[0].unitCost, 15);

    // fee on the full revenue; shipping nets out of profit (revenue in, cost out)
    const expectedFee = Math.round((105.97 * 0.029 + 0.3) * 100) / 100;
    assert.equal(first.transactionFee, expectedFee);
    const expectedProfit =
      Math.round((105.97 - 30 - 5.99 - expectedFee - 12.5) * 100) / 100;
    assert.equal(first.netProfit, expectedProfit);
  });

  it('groups Shopify-style multi-line orders into a single order', () => {
    // Shopify export repeats the order (Name + Total) once per line item
    const csv = [
      'Name,Financial Status,Paid at,Total,Lineitem quantity,Lineitem name,Lineitem SKU,Lineitem price',
      '#2001,paid,2026-08-15,129.97,2,Premium Widget,WDG-001,49.99',
      '#2001,paid,2026-08-15,129.97,1,Basic Gadget,GDG-001,29.99',
    ].join('\n');

    const { orders, skipped } = buildImportFromRows(parseCsv(csv));
    assert.equal(skipped.length, 0);
    assert.equal(orders.length, 1);

    const order = orders[0];
    assert.equal(order.items.length, 2);
    // Total taken once, not doubled
    assert.equal(order.totalRevenue, 129.97);
    assert.equal(order.status, 'paid');
    assert.equal(order.orderDate.toISOString().slice(0, 10), '2026-08-15');
  });

  it('skips rows with unparseable dates when a date column exists', () => {
    const csv = [
      'Order ID,Order Date,Product Title,Unit Price',
      'X1,not-a-date,Widget,10',
      'X2,2026-09-01,Gadget,20',
    ].join('\n');

    const { orders, skipped } = buildImportFromRows(parseCsv(csv));
    assert.equal(orders.length, 1);
    assert.equal(skipped.length, 1);
    assert.match(skipped[0].reason, /date/i);
    assert.equal(skipped[0].rowNumber, 2);
  });

  it('uses today when no date column exists at all', () => {
    const csv = ['Order ID,Product Title,Unit Price', 'X1,Widget,10'].join('\n');
    const { orders, skipped } = buildImportFromRows(parseCsv(csv));
    assert.equal(skipped.length, 0);
    assert.equal(orders.length, 1);
    const today = new Date().toISOString().slice(0, 10);
    assert.equal(orders[0].orderDate.toISOString().slice(0, 10), today);
  });

  it('computes revenue from line items when no total column exists', () => {
    const csv = [
      'Order ID,Order Date,Product Title,Quantity,Unit Price,Unit Cost',
      'X1,2026-09-01,Widget,3,10,4',
    ].join('\n');
    const { orders } = buildImportFromRows(parseCsv(csv));
    assert.equal(orders[0].totalRevenue, 30);
    assert.equal(orders[0].totalCost, 12);
  });

  it('uses the selected payment provider fee profile', () => {
    const csv = [
      'Order ID,Order Date,Product Title,Quantity,Unit Price,Unit Cost',
      'X1,2026-09-01,Widget,1,100,40',
    ].join('\n');

    // Shopify Payments: 2.9% + 0.30 → 3.20 fee on $100
    const shopify = buildImportFromRows(parseCsv(csv), { paymentProvider: 'shopify' });
    assert.ok(Math.abs(shopify.orders[0].transactionFee - 3.2) < 1e-9);

    // PayPal: 3.49% + 0.49 → 3.98 fee on $100
    const paypal = buildImportFromRows(parseCsv(csv), { paymentProvider: 'paypal' });
    assert.ok(Math.abs(paypal.orders[0].transactionFee - 3.98) < 1e-9);

    // No processing: zero fee
    const none = buildImportFromRows(parseCsv(csv), { paymentProvider: 'none' });
    assert.equal(none.orders[0].transactionFee, 0);

    // Default (no options) behaves like the 'other' profile
    const fallback = buildImportFromRows(parseCsv(csv));
    assert.ok(Math.abs(fallback.orders[0].transactionFee - 3.2) < 1e-9);
  });

  it('imports Etsy Sold Order Items exports with platform fees', () => {
    const csv = [
      'Sale Date,Order ID,Item Name,Quantity,Price,Order Shipping,Order Sales Tax,Card Processing Fees,SKU',
      '8/28/2026,3012345678,Handmade Beaded Necklace,2,25.00,4.50,2.20,3.60,BN-001',
    ].join('\n');

    const { orders, skipped } = buildImportFromRows(parseCsv(csv), { paymentProvider: 'etsy' });
    assert.equal(skipped.length, 0);
    assert.equal(orders.length, 1);

    const order = orders[0];
    assert.equal(order.orderNumber, '3012345678');
    assert.equal(order.items[0].productTitle, 'Handmade Beaded Necklace');
    // Revenue = items (2 × 25) + shipping
    assert.equal(order.totalRevenue, 54.5);
    // Etsy's own reported fees/tax are used verbatim, not the profile estimate
    assert.equal(order.transactionFee, 3.6);
    assert.equal(order.taxAmount, 2.2);
  });

  it('imports Amazon Fulfilled Shipments exports (tab-style hyphen headers)', () => {
    const csv = [
      'amazon-order-id,purchase-date,sku,product-name,quantity-shipped,item-price,item-tax,shipping-price',
      '111-2345678-9012345,2026-08-20T12:00:00+00:00,ASIN-WDG,Wireless Widget,1,29.99,2.4,4.99',
    ].join('\n');

    const { orders, skipped } = buildImportFromRows(parseCsv(csv), { paymentProvider: 'amazon' });
    assert.equal(skipped.length, 0);
    assert.equal(orders.length, 1);

    const order = orders[0];
    assert.equal(order.orderNumber, '111-2345678-9012345');
    assert.equal(order.totalRevenue, 34.98);
    assert.equal(order.taxAmount, 2.4); // Amazon's reported item tax used verbatim
    assert.equal(order.shippingCost, 4.99);
  });

  it('imports Jumia-style seller reports with KES amounts', () => {
    const csv = [
      'Order Number,Order Date,Product Name,Seller SKU,Quantity,Paid Price,Shipping Fee',
      'JM-88231,2026-09-02,Maasai Blanket,KE-MBL-001,1,3500,250',
    ].join('\n');

    const { orders, skipped } = buildImportFromRows(parseCsv(csv), { paymentProvider: 'jumia' });
    assert.equal(skipped.length, 0);
    assert.equal(orders.length, 1);

    const order = orders[0];
    assert.equal(order.totalRevenue, 3750);
    // No fee/tax columns in this export → Jumia profile estimate (12.5%) applies
    assert.ok(Math.abs(order.transactionFee - 3750 * 0.125) < 1e-9);
  });

  it('skips empty rows and reports unknown rows', () => {
    const csv = ['A,B', '1,2', ',,', '3,4'].join('\n');
    const { orders, skipped } = buildImportFromRows(parseCsv(csv));
    // rows "1,2" / "3,4" have no product/total → not skipped but produce no orders? They
    // have a total? No — headers A/B aren't mapped, so rows carry nothing → skipped.
    assert.equal(skipped.length, 2);
    assert.equal(orders.length, 0);
  });
});