import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, parseNumber, parseDate, toCsv } from '../lib/csv.ts';

describe('parseCsv', () => {
  it('parses simple rows with headers', () => {
    const rows = parseCsv('a,b,c\n1,2,3\n4,5,6\n');
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[0], { a: '1', b: '2', c: '3' });
    assert.deepEqual(rows[1], { a: '4', b: '5', c: '6' });
  });

  it('handles quoted fields with commas and escaped quotes', () => {
    const csv = 'name,note\nWidget,"hello, world"\nGadget,"said ""hi"""\n';
    const rows = parseCsv(csv);
    assert.equal(rows[0].note, 'hello, world');
    assert.equal(rows[1].note, 'said "hi"');
  });

  it('handles CRLF and strips the BOM', () => {
    const csv = '\uFEFFa,b\r\n1,2\r\n3,4\r\n';
    const rows = parseCsv(csv);
    assert.equal(rows.length, 2);
    assert.equal(rows[1].a, '3');
  });

  it('detects semicolon and tab delimiters', () => {
    const semicolon = parseCsv('a;b\n1;2\n');
    assert.deepEqual(semicolon[0], { a: '1', b: '2' });

    const tab = parseCsv('a\tb\n1\t2\n');
    assert.deepEqual(tab[0], { a: '1', b: '2' });
  });

  it('skips empty lines and handles missing trailing newline', () => {
    const rows = parseCsv('a,b\n1,2\n\n3,4');
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[1], { a: '3', b: '4' });
  });

  it('returns empty array for empty input', () => {
    assert.deepEqual(parseCsv(''), []);
    assert.deepEqual(parseCsv('\n\n'), []);
  });
});

describe('parseNumber', () => {
  it('strips currency symbols, commas and percentages', () => {
    assert.equal(parseNumber('$1,234.50'), 1234.5);
    assert.equal(parseNumber('€99,99'), 9999);
    assert.equal(parseNumber('12.5%'), 12.5);
    assert.equal(parseNumber('£7'), 7);
  });

  it('handles empties and garbage', () => {
    assert.equal(parseNumber(''), 0);
    assert.equal(parseNumber(undefined), 0);
    assert.equal(parseNumber(null), 0);
    assert.equal(parseNumber('N/A'), 0);
  });
});

describe('parseDate', () => {
  it('parses ISO timestamps', () => {
    assert.equal(parseDate('2026-09-01')?.toISOString().slice(0, 10), '2026-09-01');
    assert.equal(
      parseDate('2026-09-01T10:30:00Z')?.toISOString(),
      '2026-09-01T10:30:00.000Z'
    );
  });

  it('parses US-style dates', () => {
    const d = parseDate('09/01/2026');
    assert.equal(d?.getMonth(), 8);
    assert.equal(d?.getDate(), 1);
    assert.equal(d?.getFullYear(), 2026);

    const short = parseDate('9-1-26 14:30');
    assert.equal(short?.getFullYear(), 2026);
  });

  it('parses EU-style dates when the day can not be a US month', () => {
    const d = parseDate('31/12/2026');
    assert.equal(d?.getMonth(), 11); // December
    assert.equal(d?.getDate(), 31);
  });

  it('returns null for unparseable input', () => {
    assert.equal(parseDate('not a date'), null);
    assert.equal(parseDate(''), null);
  });
});

describe('toCsv', () => {
  it('quotes fields containing delimiters', () => {
    const csv = toCsv([{ name: 'Widget, Deluxe', note: 'said "hi"' }]);
    assert.equal(csv, 'name,note\r\n"Widget, Deluxe","said ""hi"""');
  });
});