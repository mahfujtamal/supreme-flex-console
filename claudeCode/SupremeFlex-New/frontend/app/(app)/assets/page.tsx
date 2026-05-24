'use client';

import { useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { phpApi } from '@/lib/api';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { BulkActionBar } from '@/components/ui/BulkActionBar';
import { useDebounce } from '@/hooks/useDebounce';

interface Asset { id: string; serial_number: string; product_id: string; status: string; customer_id: string; created_at: string }
interface CpeOrder {
  id: string;
  customer_id: string;
  old_cpe_serial: string | null;
  new_cpe_serial: string | null;
  status: string;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
}

// ── Asset Lifecycle tab ───────────────────────────────────────────────────────

function AssetLifecycleTab() {
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
    <div className="space-y-3 pt-4">
      <input className="border rounded px-3 py-1.5 text-sm w-64" placeholder="Search by serial…" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
      <BulkActionBar selectedCount={sel.size} onClearSelection={() => setSel(new Set())} />
      <DataTable columns={COLS} data={rows} rowKey={r => r.id} isLoading={isLoading} page={page} totalPages={data?.last_page} onPageChange={setPage} selectedIds={sel} onSelectionChange={setSel} />
      <ConfirmDialog open={!!replaceId} onOpenChange={open => { if (!open) setReplaceId(null); }} title="Replace Asset" description="This will mark the asset as replaced and issue a new one." confirmLabel="Replace" onConfirm={() => replaceId && replace.mutate(replaceId)} />
    </div>
  );
}

// ── CPE History tab ───────────────────────────────────────────────────────────

function CpeHistoryTab() {
  const [page, setPage]     = useState(0);
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<CpeOrder | null>(null);
  const dSearch = useDebounce(search, 400);

  const { data, isLoading } = useQuery({
    queryKey: ['cpe-orders', page, dSearch],
    queryFn: () => phpApi.get('/cpe-orders', { params: { page, per_page: 20, search: dSearch } }).then(r => r.data),
  });
  const rows: CpeOrder[] = Array.isArray(data) ? data : (data?.data ?? []);

  const COLS: Column<CpeOrder>[] = [
    { key: 'customer_id',    header: 'Customer',   cell: r => <code className="text-xs">{r.customer_id?.slice(0, 8)}…</code> },
    { key: 'old_cpe_serial', header: 'Old Serial', cell: r => r.old_cpe_serial ?? '—' },
    { key: 'new_cpe_serial', header: 'New Serial', cell: r => r.new_cpe_serial ?? '—' },
    { key: 'status',         header: 'Status',     cell: r => <StatusBadge status={r.status} /> },
    { key: 'completed_at',   header: 'Completed',  cell: r => r.completed_at?.slice(0, 10) ?? '—' },
    { key: 'created_at',     header: 'Created',    cell: r => r.created_at?.slice(0, 10) },
    { key: 'actions', header: '', cell: r => <button onClick={() => setDetail(r)} className="text-xs text-primary hover:underline">Details</button> },
  ];

  return (
    <div className="space-y-3 pt-4">
      <input className="border rounded px-3 py-1.5 text-sm w-64" placeholder="Search…" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
      <DataTable columns={COLS} data={rows} rowKey={r => r.id} isLoading={isLoading} page={page} totalPages={data?.last_page} onPageChange={setPage} />

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDetail(null)}>
          <div className="bg-background rounded-lg shadow-lg p-6 w-full max-w-md space-y-3" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">CPE Swap Detail</h2>
            {([ ['Customer', detail.customer_id], ['Old Serial', detail.old_cpe_serial ?? '—'], ['New Serial', detail.new_cpe_serial ?? '—'], ['Status', detail.status], ['Completed', detail.completed_at?.slice(0, 10) ?? '—'], ['Notes', detail.notes ?? '—'], ['Created', detail.created_at?.slice(0, 10)]] as [string, string][]).map(([label, value]) => (
              <div key={label} className="flex gap-2 text-sm">
                <span className="w-24 text-muted-foreground shrink-0">{label}</span>
                <span className="font-mono break-all">{value}</span>
              </div>
            ))}
            <button onClick={() => setDetail(null)} className="mt-2 px-4 py-1.5 border rounded text-sm hover:bg-muted">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AssetLifecyclePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Asset Lifecycle</h1>
      <Tabs.Root defaultValue="assets">
        <Tabs.List className="flex gap-1 border-b">
          {[['assets', 'Assets'], ['cpe', 'CPE History']].map(([val, label]) => (
            <Tabs.Trigger key={val} value={val} className="px-3 py-2 text-sm text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-primary -mb-px">
              {label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="assets"><AssetLifecycleTab /></Tabs.Content>
        <Tabs.Content value="cpe"><CpeHistoryTab /></Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
