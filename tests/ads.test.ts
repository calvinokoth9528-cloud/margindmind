import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv } from '../lib/csv.ts';
import { parseAdSpendRows, computeBackfill } from '../lib/ads.ts';

describe('parseAdSpendRows', () => {
  it('parses Meta Ads exports (Day + Amount spent)', () => {
    const csv = [
      'Day,Amount spent (USD)',
      '2026-09-01,42.50',
      '2026-09-02,38.10',
      '2026-09-01,10.00', // second campaign row same day: totals accumulate
    ].join('\n');

    const result = parseAdSpendRows(parseCsv(csv));
    assert.equal(result.platform, 'meta');
    assert.equal(result.rowsParsed, 3);
    assert.equal(result.byDate.get('2026-09-01'), 52.5);
    assert.equal(result.byDate.get('2026-09-02'), 38.1);
    assert.equal(result.skipped.length, 0);
  });

  it('parses Google Ads exports (Day + Cost)', () => {
    const csv = [
      'Day,Cost',
      '2026-09-01,51.00',
      '2026-09-02,44.25',
    ].join('\n');

    const result = parseAdSpendRows(parseCsv(csv));
    assert.equal(result.platform, 'google');
    assert.equal(result.rowsParsed, 2);
    assert.equal(result.byDate.get('2026-09-01'), 51);
  });

  it('detects the platform from a Platform/Source column', () => {
    const csv = [
      'Date,Amount,Platform',
      '2026-09-01,20,google',
      '2026-09-02,25,google',
    ].join('\n');

    const result = parseAdSpendRows(parseCsv(csv));
    assert.equal(result.platform, 'google');
  });

  it('skips rows with unparseable dates and reports them', () => {
    const csv = [
      'Date,Amount',
      'not-a-date,30',
      '2026-09-01,20',
    ].join('\n');

    const result = parseAdSpendRows(parseCsv(csv));
    assert.equal(result.rowsParsed, 1);
    assert.equal(result.skipped.length, 1);
    assert.match(result.skipped[0].reason, /date/i);
    assert.equal(result.skipped[0].rowNumber, 2);
  });

  it('returns an error entry when required columns are missing', () => {
    const csv = ['Foo,Bar', '1,2'].join('\n');

    const result = parseAdSpendRows(parseCsv(csv));
    assert.equal(result.rowsParsed, 0);
    assert.equal(result.byDate.size, 0);
    assert.equal(result.skipped.length, 1);
    assert.match(result.skipped[0].reason, /columns/i);
  });

  it('handles empty input', () => {
    const result = parseAdSpendRows([]);
    assert.equal(result.rowsParsed, 0);
    assert.equal(result.byDate.size, 0);
  });
});

describe('computeBackfill', () => {
  const dailySpend = new Map([
    ['2026-09-01', 100],
    ['2026-09-02', 50],
  ]);

  const orders = [
    { id: 'a', orderDate: new Date('2026-09-01T10:00:00Z') },
    { id: 'b', orderDate: new Date('2026-09-01T18:00:00Z') },
    { id: 'c', orderDate: new Date('2026-09-02T12:00:00Z') },
    // day with no spend
    { id: 'd', orderDate: new Date('2026-09-03T12:00:00Z') },
  ];

  it('splits each day evenly across that day\'s orders', () => {
    const result = computeBackfill(dailySpend, orders);
    assert.equal(result.perOrder.get('a'), 50);
    assert.equal(result.perOrder.get('b'), 50);
    assert.equal(result.perOrder.get('c'), 50);
    assert.equal(result.perOrder.has('d'), false);
    assert.equal(result.ordersUpdated, 3);
    assert.equal(result.daysImported, 2);
  });

  it('keeps existing spend when overwrite is false', () => {
    const withSpend = [
      { id: 'a', orderDate: new Date('2026-09-01T10:00:00Z'), currentAdSpend: 99 },
      { id: 'b', orderDate: new Date('2026-09-01T18:00:00Z'), currentAdSpend: 0 },
    ];
    const result = computeBackfill(dailySpend, withSpend, { overwrite: false });
    assert.equal(result.perOrder.has('a'), false);
    assert.equal(result.perOrder.get('b'), 50);
  });

  it('ignores spend on days without orders', () => {
    const only = new Map([['2026-08-01', 75]]);
    const result = computeBackfill(only, orders);
    assert.equal(result.ordersUpdated, 0);
    assert.equal(result.daysImported, 0);
  });
});
