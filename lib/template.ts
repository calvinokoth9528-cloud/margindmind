// Client-safe CSV template for the importer (no Node-only imports here).
import { toCsv } from './csv.ts';
import type { CsvRow } from './csv.ts';

export const CSV_TEMPLATE_HEADERS = [
  'Order ID',
  'Order Number',
  'Order Date',
  'Status',
  'Product Title',
  'SKU',
  'Quantity',
  'Unit Price',
  'Unit Cost',
  'Shipping',
  'Ad Spend',
];

export function buildTemplateCsv(): string {
  const rows: CsvRow[] = [
    {
      'Order ID': '1001',
      'Order Number': '#1001',
      'Order Date': '2026-09-01',
      Status: 'paid',
      'Product Title': 'Premium Widget',
      SKU: 'WDG-001',
      Quantity: '2',
      'Unit Price': '49.99',
      'Unit Cost': '15.00',
      Shipping: '5.99',
      'Ad Spend': '12.50',
    },
    {
      'Order ID': '1002',
      'Order Number': '#1002',
      'Order Date': '2026-09-02',
      Status: 'paid',
      'Product Title': 'Basic Gadget',
      SKU: 'GDG-001',
      Quantity: '1',
      'Unit Price': '29.99',
      'Unit Cost': '8.00',
      Shipping: '0.00',
      'Ad Spend': '3.00',
    },
  ];
  return toCsv(rows, { includeBom: true });
}