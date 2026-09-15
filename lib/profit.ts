// Profit calculation utilities for MarginMind

export interface OrderMetrics {
  totalRevenue: number;
  totalCost: number;
  shippingCost: number;
  transactionFee: number;
  taxAmount: number;
  adSpend: number;
  netProfit: number;
  profitMargin: number;
}

export interface AggregatedMetrics {
  totalOrders: number;
  totalRevenue: number;
  totalProfit: number;
  totalTax: number;
  totalRefunds: number;
  averageOrderValue: number;
  averageMargin: number;
  topProducts: Array<{
    id: string;
    title: string;
    revenue: number;
    profit: number;
    margin: number;
  }>;
  dailyMetrics: Array<{
    date: string;
    revenue: number;
    profit: number;
    orders: number;
  }>;
}

// Calculate profit for a single order.
// `feeProfile` allows custom percent/fixed overrides (Shop custom fees).
export function calculateOrderProfit(params: {
  revenue: number;
  productCost: number;
  shippingCost: number;
  transactionFeePercent?: number;
  transactionFeeFixed?: number;
  taxRate?: number;
  adSpend?: number;
}): OrderMetrics {
  const {
    revenue,
    productCost,
    shippingCost,
    transactionFeePercent = 2.9,
    transactionFeeFixed = 0.3,
    taxRate = 0,
    adSpend = 0,
  } = params;

  const transactionFee = revenue * (transactionFeePercent / 100) + transactionFeeFixed;
  const taxAmount = revenue * (taxRate / 100);
  const totalCost = productCost + shippingCost + transactionFee + taxAmount + adSpend;
  const netProfit = revenue - totalCost;
  const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

  return {
    totalRevenue: revenue,
    totalCost,
    shippingCost,
    transactionFee,
    taxAmount,
    adSpend,
    netProfit,
    profitMargin,
  };
}

export interface RefundResult {
  refundAmount: number;
  netProfitAfterRefund: number;
  profitMarginAfterRefund: number;
}

/**
 * Compute post-refund economics for an order. Refunds reverse the revenue
 * proportionally; product cost, shipping, and ad spend are usually NOT
 * recovered (goods already shipped), but the payment processor's fee is
 * typically kept by the gateway, so it is also NOT reversed.
 */
export function applyRefund(params: {
  order: {
    totalRevenue: number;
    totalCost: number;
    shippingCost: number;
    transactionFee: number;
    taxAmount: number;
    adSpend: number;
    refundAmount: number;
  };
  refundAmount: number;
}): RefundResult {
  const { order, refundAmount } = params;
  const clamped = Math.max(0, Math.min(refundAmount, order.totalRevenue));

  // Revenue still kept by the merchant after the refund
  const keptRevenue = order.totalRevenue - clamped;
  const costs = order.totalCost + order.shippingCost + order.transactionFee + order.taxAmount + order.adSpend;
  const netProfitAfterRefund = keptRevenue - costs;
  const profitMarginAfterRefund = keptRevenue > 0 ? (netProfitAfterRefund / keptRevenue) * 100 : 0;

  return { refundAmount: clamped, netProfitAfterRefund, profitMarginAfterRefund };
}

export interface ProductMetrics {
  id: string;
  title: string;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  units: number;
}

export interface PeriodComparison {
  revenueChangePct: number | null;
  profitChangePct: number | null;
  ordersChangePct: number | null;
}

// Aggregate product-level metrics from orders with line items
export function aggregateProductMetrics(
  orders: Array<{
    items: Array<{
      quantity: number;
      price: number;
      cost: number;
      product: { id: string; title: string } | null;
    }>;
  }>
): ProductMetrics[] {
  const productMap = new Map<
    string,
    {
      id: string;
      title: string;
      revenue: number;
      cost: number;
      units: number;
    }
  >();

  orders.forEach((order) => {
    order.items.forEach((item) => {
      if (!item.product) return;
      const existing = productMap.get(item.product.id) || {
        id: item.product.id,
        title: item.product.title,
        revenue: 0,
        cost: 0,
        units: 0,
      };
      existing.revenue += item.price * item.quantity;
      existing.cost += item.cost * item.quantity;
      existing.units += item.quantity;
      productMap.set(item.product.id, existing);
    });
  });

  return Array.from(productMap.values())
    .map((p) => {
      const profit = p.revenue - p.cost;
      return {
        ...p,
        profit,
        margin: p.revenue > 0 ? (profit / p.revenue) * 100 : 0,
      };
    })
    .sort((a, b) => b.profit - a.profit);
}

// Compare the current period against a previous period of equal length.
// Returns null deltas when the baseline period has no data (cannot compute % change).
export function comparePeriods(
  current: { revenue: number; profit: number; orders: number },
  previous: { revenue: number; profit: number; orders: number }
): PeriodComparison {
  const pctChange = (cur: number, prev: number): number | null => {
    if (prev === 0) return null;
    return ((cur - prev) / Math.abs(prev)) * 100;
  };

  return {
    revenueChangePct: pctChange(current.revenue, previous.revenue),
    profitChangePct: pctChange(current.profit, previous.profit),
    ordersChangePct: pctChange(current.orders, previous.orders),
  };
}

// Aggregate metrics across multiple orders. Refunded orders are excluded
// from revenue/profit trends (refunds are tracked separately).
export function aggregateMetrics(
  orders: Array<
    OrderMetrics & {
      date: string;
      refundAmount?: number;
    }
  >,
  options: { includeRefunded?: boolean } = {}
): AggregatedMetrics {
  const includeRefunded = options.includeRefunded ?? false;
  const effective = includeRefunded
    ? orders
    : orders.filter((o) => !o.refundAmount);

  const totalOrders = effective.length;
  const totalRevenue = effective.reduce((sum, o) => sum + o.totalRevenue, 0);
  const totalProfit = effective.reduce((sum, o) => sum + o.netProfit, 0);
  const totalTax = effective.reduce((sum, o) => sum + (o.taxAmount ?? 0), 0);
  const totalRefunds = orders.reduce((sum, o) => sum + (o.refundAmount ?? 0), 0);
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const averageMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  // Group by date for daily metrics (same exclusion rule)
  const dailyMap = new Map<string, { revenue: number; profit: number; orders: number }>();
  effective.forEach((order) => {
    const existing = dailyMap.get(order.date) || { revenue: 0, profit: 0, orders: 0 };
    dailyMap.set(order.date, {
      revenue: existing.revenue + order.totalRevenue,
      profit: existing.profit + order.netProfit,
      orders: existing.orders + 1,
    });
  });

  const dailyMetrics = Array.from(dailyMap.entries())
    .map(([date, metrics]) => ({
      date,
      ...metrics,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalOrders,
    totalRevenue,
    totalProfit,
    totalTax,
    totalRefunds,
    averageOrderValue,
    averageMargin,
    topProducts: [], // Would be populated from product-level data
    dailyMetrics,
  };
}

// Format currency. Falls back gracefully when the currency code is unknown
// (e.g. a custom store value) or Intl cannot format it.
export function formatCurrency(amount: number, currency = 'USD'): string {
  if (!currency) currency = 'USD';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

// Format percentage
export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

// Calculate break-even point
export function calculateBreakEven(fixedCosts: number, averageMargin: number): number {
  if (averageMargin <= 0) return Infinity;
  return fixedCosts / (averageMargin / 100);
}

// Project future profits
export function projectProfit(
  currentMonthlyProfit: number,
  growthRate: number,
  months: number
): number[] {
  const projections: number[] = [];
  let projected = currentMonthlyProfit;

  for (let i = 0; i < months; i++) {
    projected *= 1 + growthRate / 100;
    projections.push(projected);
  }

  return projections;
}
