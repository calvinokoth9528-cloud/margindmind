// Ad spend import: parse daily-spend exports from Meta Ads and Google Ads
// (plus a generic template), then backfill Order.adSpend for affected shops.
import type { CsvRow } from './csv.ts';
import { parseDate, parseNumber } from './csv.ts';
import { roundMoney } from './fees.ts';

export type AdPlatform = 'meta' | 'google' | 'manual';

export interface ParsedAdSpend {
  platform: AdPlatform;
  // spend grouped by YYYY-MM-DD
  byDate: Map<string, number>;
  rowsParsed: number;
  skipped: Array<{ rowNumber: number; reason: string }>;
}

// Header aliases (normalized like lib/import.ts: lowercase, no spaces/underscores)
const PLATFORM_HEADERS = ['platform', 'source', 'network'];

const normalizeHeader = (header: string) =>
  header.trim().toLowerCase().replace(/[\s_]+/g, '');

function detectHeader(headers: string[], aliases: string[]): string | null {
  const normalized = headers.map(normalizeHeader);
  for (const alias of aliases) {
    const index = normalized.indexOf(alias);
    if (index !== -1) return headers[index];
  }
  return null;
}

function detectPlatform(rows: CsvRow[], headers: string[]): AdPlatform {
  const platformHeader = detectHeader(headers, PLATFORM_HEADERS);
  if (platformHeader) {
    for (const row of rows) {
      const value = (row[platformHeader] || '').toLowerCase();
      if (value.includes('meta') || value.includes('facebook') || value.includes('fb')) {
        return 'meta';
      }
      if (value.includes('google') || value.includes('adwords')) {
        return 'google';
      }
    }
  }
  // Fall back to column names: Google exports use Cost/Day, Meta uses "Amount spent"
  const normalized = headers.map(normalizeHeader).join('|');
  if (
    normalized.includes('cost') ||
    normalized.includes('spend') ||
    normalized.includes('spent') ||
    normalized.includes('amount')
  ) {
    if (normalized.includes('amountspent')) return 'meta';
    if (normalized.includes('day')) return 'google';
  }
  return 'manual';
}

/**
 * Parse ad-spend rows into a per-day total. Understands:
 * - Meta Ads export: "Day", "Amount spent (USD)" (and reporting starts/ends)
 * - Google Ads export: "Day", "Cost"
 * - Generic template: "Date", "Amount", optional "Platform"
 */
export function parseAdSpendRows(rows: CsvRow[]): ParsedAdSpend {
  const byDate = new Map<string, number>();
  const skipped: Array<{ rowNumber: number; reason: string }> = [];
  let rowsParsed = 0;

  if (rows.length === 0) {
    return { platform: 'manual', byDate, rowsParsed, skipped };
  }

  const headers = Object.keys(rows[0]);
  const platform = detectPlatform(rows, headers);

  const dateHeader =
    detectHeader(headers, ['day', 'date']) ||
    headers.find((h) => normalizeHeader(h).includes('date')) ||
    headers.find((h) => normalizeHeader(h) === 'day') ||
    null;
  const amountHeader =
    detectHeader(headers, [
      'amountspent',
      'amount',
      'spend',
      'cost',
      'costmicros',
      'totalcost',
    ]) ||
    // Fuzzy fallback for variants like "Amount spent (USD)" or "Total Cost ($)"
    headers.find((h) =>
      /amount|spend|spent|cost/.test(normalizeHeader(h))
    ) ||
    null;

  if (!dateHeader || !amountHeader) {
    return {
      platform,
      byDate,
      rowsParsed: 0,
      skipped: [
        {
          rowNumber: 1,
          reason:
            'Could not find date ("Day"/"Date") and spend ("Amount spent"/"Cost"/"Amount") columns',
        },
      ],
    };
  }

  rows.forEach((row, index) => {
    const date = parseDate(row[dateHeader]);
    const amount = parseNumber(row[amountHeader]);

    if (!date) {
      // Meta exports carry "Reporting starts"/"Reporting ends" rows without day values
      if ((row[dateHeader] || '').trim() !== '') {
        skipped.push({
          rowNumber: index + 2,
          reason: `Unparseable date "${row[dateHeader]}"`,
        });
      }
      return;
    }
    if (isNaN(amount) || amount < 0) {
      skipped.push({ rowNumber: index + 2, reason: 'Missing or negative spend amount' });
      return;
    }

    const key = date.toISOString().slice(0, 10);
    byDate.set(key, (byDate.get(key) || 0) + amount);
    rowsParsed++;
  });

  return { platform, byDate, rowsParsed, skipped };
}

export interface BackfillResult {
  ordersUpdated: number;
  daysImported: number;
}

/**
 * Backfill Order.adSpend from daily totals: each day's spend is split evenly
 * across that day's orders for the shop. Pure function over provided data so
 * it can be unit tested; the route performs the DB writes.
 */
export function computeBackfill(
  dailySpend: Map<string, number>,
  orders: Array<{ id: string; orderDate: Date; currentAdSpend?: number }>,
  options: { overwrite?: boolean } = {}
): BackfillResult & { perOrder: Map<string, number> } {
  const overwrite = options.overwrite ?? true;
  const orderCountByDay = new Map<string, number>();

  orders.forEach((order) => {
    const key = order.orderDate.toISOString().slice(0, 10);
    orderCountByDay.set(key, (orderCountByDay.get(key) || 0) + 1);
  });

  const perOrder = new Map<string, number>();
  let ordersUpdated = 0;
  let daysImported = 0;

  dailySpend.forEach((amount, day) => {
    const count = orderCountByDay.get(day) || 0;
    if (count === 0) return; // spend with no matching orders: tracked on the day, not per order
    daysImported++;
    const share = roundMoney(amount / count);
    orders.forEach((order) => {
      const key = order.orderDate.toISOString().slice(0, 10);
      if (key !== day) return;
      if (!overwrite && (order.currentAdSpend ?? 0) > 0) return;
      perOrder.set(order.id, share);
      ordersUpdated++;
    });
  });

  return { ordersUpdated, daysImported, perOrder };
}
