'use client';

import { useRef, useState } from 'react';
import {
  X,
  Upload,
  Download,
  Megaphone,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface AdSpendModalProps {
  open: boolean;
  shops: Array<{ id: string; shopUrl: string }>;
  onClose: () => void;
  onImported?: () => void;
}

interface ImportResult {
  platform: string;
  daysImported: number;
  ordersUpdated: number;
  rowsSkipped: number;
  skippedSamples?: Array<{ rowNumber: number; reason: string }>;
}

const MAX_FILE_MB = 5;

const TEMPLATE_CSV = [
  'Date,Amount,Platform',
  '2026-09-01,42.50,meta',
  '2026-09-02,38.10,meta',
  '2026-09-03,51.00,google',
].join('\r\n');

export default function AdSpendModal({
  open,
  shops,
  onClose,
  onImported,
}: AdSpendModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [shopId, setShopId] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  if (!open) return null;

  const selectedShop = shops.find((s) => s.id === shopId);

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
    reader.onerror = () => setError('Could not read the file.');
    reader.readAsText(file);
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ad-spend-template.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleUpload = async () => {
    if (!shopId || !fileContent) return;

    try {
      setUploading(true);
      setError(null);
      setResult(null);

      const response = await fetch(`/api/shops/${shopId}/adspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: fileContent, overwrite: true }),
      });
      const data = await response.json();

      if (response.ok) {
        setResult(data);
        onImported?.();
      } else {
        setError(data.error || 'Import failed. Please check the file and try again.');
      }
    } catch (err) {
      console.error('Ad spend import failed:', err);
      setError('Import failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setShopId('');
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
          <h3 className="text-lg font-semibold">Import Ad Spend</h3>
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
                <Megaphone className="h-5 w-5 text-brand-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-gray-600">
                  Upload a daily-spend export from Meta Ads or Google Ads. Each day's
                  spend is split evenly across that day's orders for the selected
                  store.
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Store
                </label>
                <select
                  value={shopId}
                  onChange={(e) => setShopId(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">Choose a store…</option>
                  {shops.map((shop) => (
                    <option key={shop.id} value={shop.id}>
                      {shop.shopUrl}
                    </option>
                  ))}
                </select>
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
                        Meta &quot;Amount spent&quot; or Google Ads &quot;Cost&quot; exports ·
                        up to {MAX_FILE_MB} MB
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
                disabled={!shopId || !fileContent || uploading}
                className="w-full btn-primary py-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                {uploading ? 'Importing…' : 'Import Ad Spend'}
              </button>
            </>
          ) : (
            <div>
              <div className="p-4 bg-green-50 border border-green-200 rounded-md mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <p className="font-semibold text-green-800 capitalize">
                    {result.platform} ad spend imported
                  </p>
                </div>
                <p className="text-sm text-green-700 mt-1">
                  {result.daysImported} day{result.daysImported === 1 ? '' : 's'} of
                  spend · {result.ordersUpdated} order
                  {result.ordersUpdated === 1 ? '' : 's'} updated
                  {result.rowsSkipped > 0
                    ? ` · ${result.rowsSkipped} row${result.rowsSkipped === 1 ? '' : 's'} skipped`
                    : ''}
                  {selectedShop ? ` · ${selectedShop.shopUrl}` : ''}.
                </p>
              </div>
              <button onClick={handleClose} className="btn-primary w-full justify-center">
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
