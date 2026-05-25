'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { phpApi } from '@/lib/api';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { BulkActionBar } from '@/components/ui/BulkActionBar';
import { useDebounce } from '@/hooks/useDebounce';

interface InventoryItem {
  id: string;
  serial_number: string;
  product_id: string;
  zone_id: string;
  stock_type: string;
  status: string;
  created_at: string;
}

const COLS: Column<InventoryItem>[] = [
  { key: 'serial_number', header: 'Serial',   cell: r => <code className="text-xs">{r.serial_number}</code> },
  { key: 'product_id',    header: 'Product',  cell: r => r.product_id },
  { key: 'zone_id',       header: 'Zone',     cell: r => r.zone_id ?? '—' },
  { key: 'stock_type',    header: 'Type',     cell: r => r.stock_type ?? '—' },
  { key: 'status',        header: 'Status',   cell: r => <StatusBadge status={r.status} /> },
  { key: 'created_at',    header: 'Created',  cell: r => r.created_at?.slice(0, 10) },
];

const STATUS_OPTIONS = ['', 'IN_GPFI_STAGING', 'WITH_FIELD_STAFF', 'DELIVERED', 'INACTIVE'];

export default function OperationsPage() {
  const [page, setPage]           = useState(0);
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatus] = useState('');
  const [sel, setSel]             = useState<Set<string>>(new Set());
  const dSearch = useDebounce(search, 400);

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', page, dSearch, statusFilter],
    queryFn: () =>
      phpApi.get('/inventory', {
        params: {
          page, per_page: 20, search: dSearch,
          ...(statusFilter && { status: statusFilter }),
        },
      }).then(r => r.data),
  });
  const rows: InventoryItem[] = Array.isArray(data) ? data : (data?.data ?? []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Operations</h1>
      <div className="flex gap-3 flex-wrap">
        <input
          className="border rounded px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary/30"
          placeholder="Search by serial or product…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
        />
        <select
          className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          value={statusFilter}
          onChange={e => { setStatus(e.target.value); setPage(0); }}
        >
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{s || 'All Statuses'}</option>
          ))}
        </select>
      </div>
      <BulkActionBar selectedCount={sel.size} onClearSelection={() => setSel(new Set())} />
      <DataTable
        columns={COLS}
        data={rows}
        rowKey={r => r.id}
        isLoading={isLoading}
        page={page}
        totalPages={data?.last_page}
        onPageChange={setPage}
        selectedIds={sel}
        onSelectionChange={setSel}
      />
    </div>
  );
}
