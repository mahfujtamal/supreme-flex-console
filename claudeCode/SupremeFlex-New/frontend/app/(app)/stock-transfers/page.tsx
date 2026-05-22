'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { nodeApi, phpApi } from '@/lib/api';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { BulkActionBar } from '@/components/ui/BulkActionBar';
import { useDebounce } from '@/hooks/useDebounce';

interface StockTransfer {
  id: string;
  from_entity: string;
  to_entity: string;
  product_id: string;
  quantity: number;
  transfer_status: string;
  created_at: string;
}

type Action = 'accept' | 'reject';

export default function StockTransfersPage() {
  const qc = useQueryClient();
  const [page, setPage]       = useState(0);
  const [search, setSearch]   = useState('');
  const [sel, setSel]         = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<{ id: string; action: Action } | null>(null);
  const dSearch = useDebounce(search, 400);

  const { data, isLoading } = useQuery({
    queryKey: ['stock-transfers', page, dSearch],
    queryFn: () => nodeApi.get('/stock-transfers', { params: { page, per_page: 20, search: dSearch } }).then(r => r.data),
  });

  const respond = useMutation({
    mutationFn: ({ id, action }: { id: string; action: Action }) =>
      phpApi.patch(`/stock-transfers/${id}/respond`, { action }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['stock-transfers'] }); setPending(null); },
  });

  const rows: StockTransfer[] = Array.isArray(data) ? data : (data?.data ?? []);

  const COLS: Column<StockTransfer>[] = [
    { key: 'from_entity',     header: 'From',     cell: r => r.from_entity },
    { key: 'to_entity',       header: 'To',       cell: r => r.to_entity },
    { key: 'product_id',      header: 'Product',  cell: r => r.product_id },
    { key: 'quantity',        header: 'Qty',      cell: r => r.quantity },
    { key: 'transfer_status', header: 'Status',   cell: r => <StatusBadge status={r.transfer_status} /> },
    { key: 'created_at',      header: 'Date',     cell: r => r.created_at?.slice(0, 10) },
    {
      key: 'actions', header: '',
      cell: r => r.transfer_status === 'PENDING' ? (
        <div className="flex gap-2">
          <button onClick={() => setPending({ id: r.id, action: 'accept' })} className="text-xs text-green-700 hover:underline">Accept</button>
          <button onClick={() => setPending({ id: r.id, action: 'reject' })} className="text-xs text-red-600 hover:underline">Reject</button>
        </div>
      ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Stock Transfers</h1>
      <input className="border rounded px-3 py-1.5 text-sm w-64" placeholder="Search…" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
      <BulkActionBar selectedCount={sel.size} onClearSelection={() => setSel(new Set())} />
      <DataTable columns={COLS} data={rows} rowKey={r => r.id} isLoading={isLoading} page={page} totalPages={data?.last_page} onPageChange={setPage} selectedIds={sel} onSelectionChange={setSel} />
      <ConfirmDialog
        open={!!pending}
        onOpenChange={open => { if (!open) setPending(null); }}
        title={pending?.action === 'reject' ? 'Reject Transfer' : 'Accept Transfer'}
        description={pending?.action === 'reject' ? 'This will reject the stock transfer request. This cannot be undone.' : 'This will approve the stock transfer and move inventory.'}
        confirmLabel={pending?.action === 'reject' ? 'Reject' : 'Accept'}
        destructive={pending?.action === 'reject'}
        onConfirm={() => pending && respond.mutate(pending)}
      />
    </div>
  );
}
