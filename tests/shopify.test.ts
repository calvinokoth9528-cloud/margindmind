import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
  calculateShopifyFee,
  transformShopifyOrder,
  transformShopifyProduct,
  verifyShopifyWebhook,
} from '../lib/shopify.ts';

describe('calculateShopifyFee', () => {
  const closeTo = (actual: number, expected: number) =>
    assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ~= ${expected}`);

  it('charges 2.9% + $0.30 on the basic plan', () => {
    closeTo(calculateShopifyFee(100, 'basic'), 3.2);
  });

  it('charges 2.6% on the standard plan', () => {
    closeTo(calculateShopifyFee(100, 'shopify'), 2.9);
  });

  it('charges 2.4% on the advanced plan', () => {
    closeTo(calculateShopifyFee(100, 'advanced'), 2.7);
  });

  it('defaults to basic fee for unknown plans', () => {
    closeTo(calculateShopifyFee(100, 'unknown-plan'), 3.2);
  });
});

describe('transformShopifyOrder', () => {
  const shopifyOrder: any = {
    id: 123456,
    name: '#1001',
    total_price: '149.97',
    total_shipping: '5.99',
    financial_status: 'paid',
    created_at: '2026-09-01T10:00:00Z',
    line_items: [
      { id: 1, product_id: 'prod_1', title: 'Widget', quantity: 3, price: '49.99', sku: 'WDG-001' },
      { id: 2, product_id: 'prod_2', title: 'Gadget', quantity: 1, price: '10.00', sku: 'GDG-001' },
    ],
  };

  it('computes costs, fees, profit and margin', () => {
    const costs = new Map([
      ['prod_1', 15],
      ['prod_2', 8],
    ]);

    const result = transformShopifyOrder(shopifyOrder, costs);

    assert.equal(result.externalId, '123456');
    assert.equal(result.orderNumber, '#1001');
    assert.equal(result.totalRevenue, 149.97);
    // product cost = 15*3 + 8*1 = 53
    assert.equal(result.totalCost, 53);
    assert.equal(result.shippingCost, 5.99);
    // fee = 149.97 * 0.029 + 0.30 = 4.65 (rounded)
    assert.ok(Math.abs(result.transactionFee - (149.97 * 0.029 + 0.3)) < 1e-9);
    // profit = 149.97 - 53 - 5.99 - fee
    const expectedProfit = 149.97 - 53 - 5.99 - (149.97 * 0.029 + 0.3);
    assert.ok(Math.abs(result.netProfit - expectedProfit) < 1e-9);
    assert.ok(Math.abs(result.profitMargin - (expectedProfit / 149.97) * 100) < 1e-9);
    assert.equal(result.status, 'paid');
    assert.equal(result.orderDate.toISOString(), '2026-09-01T10:00:00.000Z');
  });

  it('maps line items to product external ids with quantities', () => {
    const result = transformShopifyOrder(shopifyOrder, new Map());
    assert.equal(result.items.length, 2);
    assert.equal(result.items[0].productExternalId, 'prod_1');
    assert.equal(result.items[0].quantity, 3);
    assert.equal(result.items[0].price, 49.99);
    assert.equal(result.items[0].cost, 0); // unknown cost defaults to 0
  });

  it('uses the shop payment provider fee profile when given', () => {
    const costs = new Map<string, number>();

    // Default: Shopify Payments 2.9% + $0.30
    const defaultFee = transformShopifyOrder(shopifyOrder, costs).transactionFee;
    assert.ok(Math.abs(defaultFee - (149.97 * 0.029 + 0.3)) < 1e-9);

    // PayPal: 3.49% + $0.49
    const paypalFee = transformShopifyOrder(shopifyOrder, costs, 'paypal').transactionFee;
    assert.ok(Math.abs(paypalFee - (149.97 * 0.0349 + 0.49)) < 1e-9);

    // None: zero fee
    const noFee = transformShopifyOrder(shopifyOrder, costs, 'none').transactionFee;
    assert.equal(noFee, 0);
  });

  it('skips line items without a product id', () => {
    const orderWithGiftCard = {
      ...shopifyOrder,
      line_items: [
        { id: 9, product_id: null, title: 'Gift card', quantity: 1, price: '25.00', sku: '' },
      ],
    };
    const result = transformShopifyOrder(orderWithGiftCard, new Map());
    assert.equal(result.items.length, 0);
    assert.equal(result.totalCost, 0);
  });

  it('falls back to pending status when missing', () => {
    const result = transformShopifyOrder(
      { ...shopifyOrder, financial_status: undefined },
      new Map()
    );
    assert.equal(result.status, 'pending');
  });
});

describe('transformShopifyProduct', () => {
  it('extracts the first variant price and sku', () => {
    const result = transformShopifyProduct({
      id: 'prod_1',
      title: 'Widget',
      variants: [{ id: 'v1', sku: 'WDG-001', price: '49.99' }],
    });
    assert.equal(result.externalId, 'prod_1');
    assert.equal(result.title, 'Widget');
    assert.equal(result.sku, 'WDG-001');
    assert.equal(result.price, 49.99);
  });

  it('handles products with no variants', () => {
    const result = transformShopifyProduct({ id: 'prod_2', title: 'Empty', variants: [] });
    assert.equal(result.sku, null);
    assert.equal(result.price, 0);
  });
});

describe('verifyShopifyWebhook', () => {
  it('accepts a valid signature and rejects a tampered one', () => {
    const secret = 'shpss_test_secret';
    const payload = JSON.stringify({ id: 1, event: 'orders/create' });

    const validHmac = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    assert.equal(verifyShopifyWebhook(payload, validHmac, secret), true);
    assert.equal(verifyShopifyWebhook(payload, validHmac, 'wrong-secret'), false);
    assert.equal(verifyShopifyWebhook(payload, 'tampered-signature', secret), false);
  });
});