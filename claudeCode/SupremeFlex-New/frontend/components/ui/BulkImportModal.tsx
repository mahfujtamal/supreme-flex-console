'use client';

import { useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Upload, Download, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BulkImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateHeaders: string[];
  onImport: (rows: Record<string, string>[]) => void;
  title?: string;
}

function parseCsv(text: string): Record<string, string>[] {
  const [headerLine, ...lines] = text.trim().split('\n');
  if (!headerLine) return [];
  const headers = headerLine.split(',').map(h => h.trim());
  return lines
    .filter(l => l.trim())
    .map(line => {
      const values = line.split(',');
      return Object.fromEntries(headers.map((h, i) => [h, (values[i] ?? '').trim()]));
    });
}

export function BulkImportModal({
  open,
  onOpenChange,
  templateHeaders,
  onImport,
  title = 'Bulk Import',
}: BulkImportModalProps) {
  const [rows, setRows]         = useState<Record<string, string>[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleClose() {
    setRows([]);
    onOpenChange(false);
  }

  function handleFile(file: File) {
    file.text().then(text => setRows(parseCsv(text)));
  }

  function downloadTemplate() {
    const blob = new Blob([templateHeaders.join(',') + '\n'], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = 'template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport() {
    onImport(rows);
    handleClose();
  }

  const previewHeaders = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <Dialog.Root open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl max-h-[80vh] flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold">{title}</Dialog.Title>
            <button onClick={handleClose} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={downloadTemplate}
            className="self-start flex items-center gap-1.5 px-3 py-1.5 border rounded text-sm hover:bg-gray-50"
          >
            <Download className="w-3.5 h-3.5" />
            Download template
          </button>

          <div
            className={cn(
              'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
              dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300',
            )}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files[0];
              if (file) handleFile(file);
            }}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Drop a CSV here or click to browse</p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </div>

          {rows.length > 0 && (
            <div className="flex-1 overflow-auto border rounded min-h-0">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    {previewHeaders.map(h => (
                      <th key={h} className="px-2 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 20).map((row, i) => (
                    <tr key={i} className="border-t">
                      {previewHeaders.map(h => (
                        <td key={h} className="px-2 py-1.5 whitespace-nowrap">{row[h]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 20 && (
                <p className="text-xs text-muted-foreground px-2 py-1.5 border-t">
                  Showing 20 of {rows.length} rows
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button onClick={handleClose} className="px-3 py-1.5 border rounded text-sm hover:bg-gray-50">
              Cancel
            </button>
            <button
              disabled={rows.length === 0}
              onClick={handleImport}
              className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-40"
            >
              Import{rows.length > 0 ? ` (${rows.length} rows)` : ''}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
