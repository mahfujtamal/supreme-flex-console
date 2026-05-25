'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { phpApi } from '@/lib/api';
import { BulkImportModal } from '@/components/ui/BulkImportModal';
import { CheckCircle } from 'lucide-react';

const HEADERS = ['serial_number', 'product_id', 'stock_type', 'zone_id'];

export default function BulkInwardingPage() {
  const qc = useQueryClient();
  const [open, setOpen]           = useState(false);
  const [lastCount, setLastCount] = useState<number | null>(null);

  const inward = useMutation({
    mutationFn: (rows: Record<string, string>[]) => phpApi.post('/inventory/bulk-inward', rows),
    onSuccess: (_, rows) => { setLastCount(rows.length); qc.invalidateQueries({ queryKey: ['inventory'] }); },
  });

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-2xl font-bold">Bulk Inwarding</h1>
      <p className="text-sm text-muted-foreground">Upload a CSV to inward multiple inventory items at once.</p>

      {lastCount !== null && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800">
          <CheckCircle className="w-4 h-4" />
          {lastCount} items inwarded successfully.
        </div>
      )}

      <button onClick={() => setOpen(true)} className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm hover:opacity-90">
        Upload Inventory CSV
      </button>

      <BulkImportModal open={open} onOpenChange={setOpen} title="Bulk Inward Inventory" templateHeaders={HEADERS} onImport={rows => inward.mutate(rows)} />
    </div>
  );
}
