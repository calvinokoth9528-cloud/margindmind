// Lightweight CSV parsing utilities (no external dependencies).

export type CsvRow = Record<string, string>;

// Parse CSV text into an array of objects using the first row as headers.
// Handles quoted fields, escaped quotes, CRLF/LF, and detects the delimiter
// (comma, semicolon, or tab) from the first non-empty line.
export function parseCsv(text: string): CsvRow[] {
  const normalized = text.replace(/^\uFEFF/, ''); // strip BOM
  const delimiter = detectDelimiter(normalized);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    const next = normalized[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      field = '';
      if (row.some((cell) => cell.trim() !== '')) rows.push(row);
      row = [];
    } else if (char === '\r') {
      // handled by the \n branch; lone \r at EOF is dropped below
    } else {
      field += char;
    }
  }

  // Push the final field/row if the text didn't end with a newline
  if (field !== '' || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell.trim() !== '')) rows.push(row);
  }

  if (rows.length === 0) return [];

  const [headers, ...dataRows] = rows;
  const cleanHeaders = headers.map((h, index) =>
    h.trim() === '' ? `column_${index + 1}` : h.trim()
  );

  return dataRows.map((cells) => {
    const record: CsvRow = {};
    cleanHeaders.forEach((header, index) => {
      record[header] = (cells[index] ?? '').trim();
    });
    return record;
  });
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim() !== '') || '';
  const counts = [
    { delimiter: ',', count: (firstLine.match(/,/g) || []).length },
    { delimiter: '\t', count: (firstLine.match(/\t/g) || []).length },
    { delimiter: ';', count: (firstLine.match(/;/g) || []).length },
  ];
  counts.sort((a, b) => b.count - a.count);
  return counts[0].delimiter;
}

// Parse a value that may be a currency amount, percentage, or plain number.
export function parseNumber(value: string | undefined | null): number {
  if (value === undefined || value === null) return 0;
  const cleaned = value
    .replace(/[$£€\s,]/g, '')
    .replace(/%$/, '')
    .trim();
  if (cleaned === '') return 0;
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

// Parse common date formats into a Date. Returns null when unparseable.
export function parseDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const cleaned = value.trim();
  if (cleaned === '') return null;

  // ISO 8601 / full timestamps (e.g. 2026-09-01, 2026-09-01T10:00:00Z)
  const iso = Date.parse(cleaned);
  if (!isNaN(iso)) return new Date(iso);

  // Numeric dates like 09/01/2026, 9-1-26, 01.09.2026 (with optional time).
  // When both parts are valid months we default to the US M/D/Y reading;
  // when one side can only be a day (e.g. 31/12/2026) we use the EU D/M/Y reading.
  const numericMatch = cleaned.match(
    /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (numericMatch) {
    const [, first, second, year, hour, minute, secondPart] = numericMatch;
    const a = parseInt(first, 10);
    const b = parseInt(second, 10);
    const fullYear =
      year.length === 2 ? 2000 + parseInt(year, 10) : parseInt(year, 10);

    let month: number;
    let day: number;
    if (a > 12) {
      month = b; // EU: first part must be the day
      day = a;
    } else if (b > 12) {
      month = a; // US: second part must be the day
      day = b;
    } else {
      month = a; // ambiguous → US default
      day = b;
    }

    if (month < 1 || month > 12 || day < 1 || day > 31) return null;

    const date = new Date(
      fullYear,
      month - 1,
      day,
      hour ? parseInt(hour, 10) : 12,
      minute ? parseInt(minute, 10) : 0,
      secondPart ? parseInt(secondPart, 10) : 0
    );
    return isNaN(date.getTime()) ? null : date;
  }

  return null;
}

export interface SerializeOptions {
  includeBom?: boolean;
}

// Serialize objects into CSV text (quotes fields containing delimiters/quotes/newlines).
export function toCsv(rows: CsvRow[], options: SerializeOptions = {}): string {
  if (rows.length === 0) return '';

  const headers = Object.keys(rows[0]);
  const escapeField = (value: string | number): string => {
    const str = String(value);
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [headers.map(escapeField).join(',')];
  rows.forEach((row) => {
    lines.push(headers.map((header) => escapeField(row[header] ?? '')).join(','));
  });

  return (options.includeBom ? '\uFEFF' : '') + lines.join('\r\n');
}