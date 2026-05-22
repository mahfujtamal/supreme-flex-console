'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { phpApi } from '@/lib/api';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { BulkActionBar } from '@/components/ui/BulkActionBar';
import { useDebounce } from '@/hooks/useDebounce';

interface Asset { id: string; serial_number: string; product_id: string; status: string; customer_id: string; created_at: string }

export default function AssetLifecyclePage() {
  const qc = useQueryClient();
  const [page, setPage]           = useState(0);
  const [search, setSearch]       = useState('');
  const [sel, setSel]             = useState<Set<string>>(new Set());
  const [replaceId, setReplaceId] = useState<string | null>(null);
  const dSearch = useDebounce(search, 400);

  const { data, isLoading } = useQuery({
    queryKey: ['assets', page, dSearch],
    queryFn: () => phpApi.get('/assets', { params: { page, per_page: 20, search: dSearch } }).then(r => r.data),
  });
  const replace = useMutation({
    mutationFn: (id: string) => phpApi.post(`/assets/${id}/replace`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assets'] }); setReplaceId(null); },
  });
  const rows: Asset[] = Array.isArray(data) ? data : (data?.data ?? []);

  const COLS: Column<Asset>[] = [
    { key: 'serial_number', header: 'Serial',   cell: r => <code className="text-xs">{r.serial_number}</code> },
    { key: 'product_id',    header: 'Product',  cell: r => r.product_id },
    { key: 'customer_id',   header: 'Customer', cell: r => r.customer_id ?? '—' },
    { key: 'status',        header: 'Status',   cell: r => <StatusBadge status={r.status} /> },
    { key: 'created_at',    header: 'Created',  cell: r => r.created_at?.slice(0, 10) },
    { key: 'actions', header: '', cell: r => <button onClick={() => setReplaceId(r.id)} className="text-xs text-orange-600 hover:underline">Replace</button> },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Asset Lifecycle</h1>
      <input className="border rounded px-3 py-1.5 text-sm w-64" placeholder="Search by serial…" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
      <BulkActionBar selectedCount={sel.size} onClearSelection={() => setSel(new Set())} />
      <DataTable columns={COLS} data={rows} rowKey={r => r.id} isLoading={isLoading} page={page} totalPages={data?.last_page} onPageChange={setPage} selectedIds={sel} onSelectionChange={setSel} />
      <ConfirmDialog open={!!replaceId} onOpenChange={open => { if (!open) setReplaceId(null); }} title="Replace Asset" description="This will mark the asset as replaced and issue a new one." confirmLabel="Replace" onConfirm={() => replaceId && replace.mutate(replaceId)} />
    </div>
  );
}
