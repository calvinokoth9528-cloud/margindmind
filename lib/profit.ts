// Profit calculation utilities for MarginMind

export interface OrderMetrics {
  totalRevenue: number;
  totalCost: number;
  shippingCost: number;
  transactionFee: number;
  adSpend: number;
  netProfit: number;
  profitMargin: number;
}

export interface AggregatedMetrics {
  totalOrders: number;
  totalRevenue: number;
  totalProfit: number;
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

// Calculate profit for a single order
export function calculateOrderProfit(params: {
  revenue: number;
  productCost: number;
  shippingCost: number;
  transactionFeePercent?: number;
  adSpend?: number;
}): OrderMetrics {
  const { revenue, productCost, shippingCost, transactionFeePercent = 2.9, adSpend = 0 } = params;

  const transactionFee = revenue * (transactionFeePercent / 100) + 0.30;
  const totalCost = productCost + shippingCost + transactionFee + adSpend;
  const netProfit = revenue - totalCost;
  const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

  return {
    totalRevenue: revenue,
    totalCost,
    shippingCost,
    transactionFee,
    adSpend,
    netProfit,
    profitMargin,
  };
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

// Aggregate metrics across multiple orders
export function aggregateMetrics(orders: Array<OrderMetrics & { date: string }>): AggregatedMetrics {
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + o.totalRevenue, 0);
  const totalProfit = orders.reduce((sum, o) => sum + o.netProfit, 0);
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const averageMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  // Group by date for daily metrics
  const dailyMap = new Map<string, { revenue: number; profit: number; orders: number }>();
  orders.forEach((order) => {
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
    averageOrderValue,
    averageMargin,
    topProducts: [], // Would be populated from product-level data
    dailyMetrics,
  };
}

// Format currency
export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
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
