'use client';

import { useRef, useState } from 'react';
import {
  X,
  Upload,
  Download,
  Store,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { buildTemplateCsv } from '@/lib/template';

interface ImportCsvModalProps {
  open: boolean;
  onClose: () => void;
  onImported?: () => void;
}

interface ImportResult {
  success: boolean;
  storeName: string;
  ordersCreated: number;
  ordersUpdated: number;
  ordersSkipped: number;
  productsImported: number;
  skippedSamples?: Array<{ rowNumber: number; reason: string }>;
}

const MAX_FILE_MB = 5;

export default function ImportCsvModal({
  open,
  onClose,
  onImported,
}: ImportCsvModalProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [storeName, setStoreName] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  if (!open) return null;

  const handleFile = (file: File) => {
    setError(null);
    setResult(null);

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please choose a .csv file.');
      setFileName(null);
      setFileContent(null);
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`File is larger than ${MAX_FILE_MB} MB.`);
      setFileName(null);
      setFileContent(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFileName(file.name);
      setFileContent(String(reader.result || ''));
    };
    reader.onerror = () => {
      setError('Could not read the file.');
    };
    reader.readAsText(file);
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([buildTemplateCsv()], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'margindmind-import-template.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleUpload = async () => {
    if (!storeName.trim() || !fileContent) return;

    try {
      setUploading(true);
      setError(null);
      setResult(null);

      const response = await fetch('/api/import/csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeName: storeName.trim(), csv: fileContent }),
      });
      const data = await response.json();

      if (response.ok) {
        setResult(data);
        onImported?.();
      } else {
        setError(data.error || 'Import failed. Please check the file and try again.');
      }
    } catch (err) {
      console.error('CSV import failed:', err);
      setError('Import failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    // Reset state on close so reopening starts clean
    setStoreName('');
    setFileName(null);
    setFileContent(null);
    setError(null);
    setResult(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h3 className="text-lg font-semibold">Import Orders from CSV</h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {!result ? (
            <>
              <div className="mb-4 flex items-start gap-2 p-3 bg-gray-50 border border-gray-200 rounded-md">
                <FileSpreadsheet className="h-5 w-5 text-brand-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-gray-600">
                  Upload an order export from Shopify, Etsy, or any store — columns are
                  detected automatically. No API keys needed.
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Store name
                </label>
                <div className="relative">
                  <Store className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="e.g. My Etsy Shop"
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CSV file
                </label>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-300 rounded-md p-6 text-center hover:border-brand-400 hover:bg-brand-50/40 transition-colors"
                >
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  {fileName ? (
                    <p className="text-sm font-medium text-brand-700">{fileName}</p>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-gray-700">
                        Click to choose a file
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        .csv up to {MAX_FILE_MB} MB · one row per product line
                      </p>
                    </>
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                    e.target.value = '';
                  }}
                />
              </div>

              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="text-sm text-brand-600 hover:text-brand-700 font-medium inline-flex items-center gap-1 mb-4"
              >
                <Download className="h-4 w-4" />
                Download sample template
              </button>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <button
                type="button"
                onClick={handleUpload}
                disabled={!storeName.trim() || !fileContent || uploading}
                className="w-full btn-primary py-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? 'Importing…' : 'Import Orders'}
              </button>
            </>
          ) : (
            <div>
              <div className="p-4 bg-green-50 border border-green-200 rounded-md mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <p className="font-semibold text-green-800">
                    Import complete — {result.storeName}
                  </p>
                </div>
                <p className="text-sm text-green-700 mt-1">
                  {result.ordersCreated} new orders, {result.ordersUpdated} updated,{' '}
                  {result.productsImported} products
                  {result.ordersSkipped > 0
                    ? ` · ${result.ordersSkipped} row${result.ordersSkipped === 1 ? '' : 's'} skipped`
                    : ''}
                  .
                </p>
                {result.skippedSamples && result.skippedSamples.length > 0 && (
                  <ul className="text-xs text-green-700 mt-2 space-y-0.5">
                    {result.skippedSamples.map((s, i) => (
                      <li key={i}>
                        Row {s.rowNumber}: {s.reason}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => router.push('/dashboard')}
                  className="btn-primary flex-1 justify-center"
                >
                  View Dashboard
                  <ArrowRight className="h-4 w-4 ml-2" />
                </button>
                <button onClick={handleClose} className="btn-secondary">
                  Import Another
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}