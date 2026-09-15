import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateOrderProfit,
  aggregateMetrics,
  aggregateProductMetrics,
  comparePeriods,
  formatCurrency,
  formatPercent,
  calculateBreakEven,
  projectProfit,
} from '../lib/profit.ts';

describe('calculateOrderProfit', () => {
  it('calculates fees, costs, net profit and margin correctly', () => {
    const result = calculateOrderProfit({
      revenue: 100,
      productCost: 40,
      shippingCost: 10,
      transactionFeePercent: 2.9,
      adSpend: 5,
    });

    // fee = 100 * 0.029 + 0.30 = 3.20
    assert.ok(Math.abs(result.transactionFee - 3.2) < 1e-9);
    // totalCost = 40 + 10 + 3.2 + 5 = 58.2
    assert.equal(result.totalCost, 58.2);
    // netProfit = 100 - 58.2 = 41.8
    assert.equal(result.netProfit, 41.8);
    // margin = 41.8%
    assert.ok(Math.abs(result.profitMargin - 41.8) < 1e-9);
  });

  it('defaults fee to 2.9% and ad spend to 0', () => {
    const result = calculateOrderProfit({
      revenue: 50,
      productCost: 20,
      shippingCost: 0,
    });
    assert.ok(Math.abs(result.transactionFee - (50 * 0.029 + 0.3)) < 1e-9);
    assert.equal(result.adSpend, 0);
  });

  it('returns 0 margin when revenue is 0', () => {
    const result = calculateOrderProfit({
      revenue: 0,
      productCost: 0,
      shippingCost: 0,
    });
    assert.equal(result.profitMargin, 0);
  });
});

describe('aggregateMetrics', () => {
  const orders = [
    { totalRevenue: 100, totalCost: 50, shippingCost: 5, transactionFee: 3, taxAmount: 0, adSpend: 2, netProfit: 40, profitMargin: 40, date: '2026-09-01' },
    { totalRevenue: 200, totalCost: 100, shippingCost: 5, transactionFee: 6, taxAmount: 0, adSpend: 4, netProfit: 85, profitMargin: 42.5, date: '2026-09-02' },
    { totalRevenue: 150, totalCost: 75, shippingCost: 5, transactionFee: 5, taxAmount: 0, adSpend: 3, netProfit: 62, profitMargin: 41.33, date: '2026-09-01' },
  ];

  it('aggregates totals, AOV and average margin', () => {
    const m = aggregateMetrics(orders);
    assert.equal(m.totalOrders, 3);
    assert.equal(m.totalRevenue, 450);
    assert.equal(m.totalProfit, 187);
    assert.equal(m.averageOrderValue, 150);
    assert.ok(Math.abs(m.averageMargin - 187 / 4.5) < 1e-9); // 41.55...%
  });

  it('groups daily metrics and sorts by date', () => {
    const m = aggregateMetrics(orders);
    assert.equal(m.dailyMetrics.length, 2);
    assert.deepEqual(
      m.dailyMetrics.map((d) => d.date),
      ['2026-09-01', '2026-09-02']
    );
    assert.equal(m.dailyMetrics[0].orders, 2);
    assert.equal(m.dailyMetrics[0].revenue, 250);
  });

  it('excludes refunded orders by default and sums refunds/tax', () => {
    const withRefund = [
      { ...orders[0], taxAmount: 7 }, // kept order with tax
      ...orders.slice(1),
      { totalRevenue: 80, totalCost: 40, shippingCost: 0, transactionFee: 2, taxAmount: 6, adSpend: 0, netProfit: 32, profitMargin: 40, refundAmount: 80, date: '2026-09-03' },
    ];

    const m = aggregateMetrics(withRefund);
    assert.equal(m.totalOrders, 3); // refunded order excluded
    assert.equal(m.totalRevenue, 450);
    assert.equal(m.totalRefunds, 80);
    assert.equal(m.totalTax, 7); // refunded order's tax excluded too

    const including = aggregateMetrics(withRefund, { includeRefunded: true });
    assert.equal(including.totalOrders, 4);
    assert.equal(including.totalRevenue, 530);
    assert.equal(including.totalTax, 13);
  });
});

describe('aggregateProductMetrics', () => {
  const orders = [
    {
      items: [
        { quantity: 2, price: 50, cost: 20, product: { id: 'p1', title: 'Widget' } },
        { quantity: 1, price: 100, cost: 60, product: { id: 'p2', title: 'Gadget' } },
      ],
    },
    {
      items: [
        { quantity: 1, price: 50, cost: 20, product: { id: 'p1', title: 'Widget' } },
      ],
    },
    {
      items: [
        { quantity: 1, price: 5, cost: 10, product: null }, // should be skipped
      ],
    },
  ];

  it('aggregates per product and sorts by profit descending', () => {
    const products = aggregateProductMetrics(orders);
    assert.equal(products.length, 2);
    // Widget: revenue 150, cost 60, profit 90; Gadget: revenue 100, cost 60, profit 40
    assert.equal(products[0].id, 'p1');
    assert.equal(products[0].profit, 90);
    assert.equal(products[0].units, 3);
    assert.equal(products[0].margin, 60);
    assert.equal(products[1].id, 'p2');
    assert.equal(products[1].profit, 40);
  });

  it('returns empty array for no items', () => {
    assert.deepEqual(aggregateProductMetrics([]), []);
  });
});

describe('comparePeriods', () => {
  it('computes percentage changes', () => {
    const cmp = comparePeriods(
      { revenue: 120, profit: 60, orders: 12 },
      { revenue: 100, profit: 50, orders: 10 }
    );
    assert.equal(cmp.revenueChangePct, 20);
    assert.equal(cmp.profitChangePct, 20);
    assert.equal(cmp.ordersChangePct, 20);
  });

  it('returns null when the previous period is zero', () => {
    const cmp = comparePeriods(
      { revenue: 120, profit: 60, orders: 12 },
      { revenue: 0, profit: 0, orders: 0 }
    );
    assert.equal(cmp.revenueChangePct, null);
    assert.equal(cmp.profitChangePct, null);
    assert.equal(cmp.ordersChangePct, null);
  });
});

describe('formatting helpers', () => {
  it('formats currency', () => {
    assert.equal(formatCurrency(1234.5), '$1,234.50');
    assert.equal(formatCurrency(0), '$0.00');
  });

  it('formats percentage with one decimal', () => {
    assert.equal(formatPercent(41.84), '41.8%');
    assert.equal(formatPercent(0), '0.0%');
  });
});

describe('calculateBreakEven', () => {
  it('computes break-even revenue', () => {
    // fixed 1000 / 25% margin = 4000
    assert.equal(calculateBreakEven(1000, 25), 4000);
  });

  it('returns Infinity when margin is zero or negative', () => {
    assert.equal(calculateBreakEven(1000, 0), Infinity);
    assert.equal(calculateBreakEven(1000, -5), Infinity);
  });
});

describe('projectProfit', () => {
  it('compounds growth across months', () => {
    const projections = projectProfit(1000, 10, 3);
    assert.deepEqual(projections, [1100, 1210, 1331]);
  });
});