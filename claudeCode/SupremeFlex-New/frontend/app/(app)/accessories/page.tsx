'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { phpApi } from '@/lib/api';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useDebounce } from '@/hooks/useDebounce';

interface AddonOrder {
  id: string;
  customer_id: string;
  addon_product_id: string;
  gpshop_order_id: string | null;
  status: string;
  auto_cancel_at: string | null;
  activated_at: string | null;
  created_at: string;
}

const COLS: Column<AddonOrder>[] = [
  { key: 'customer_id',    header: 'Customer',    cell: r => <code className="text-xs">{r.customer_id?.slice(0, 8)}…</code> },
  { key: 'addon_product_id', header: 'Product',   cell: r => <code className="text-xs">{r.addon_product_id?.slice(0, 8)}…</code> },
  { key: 'gpshop_order_id', header: 'GPShop Ref', cell: r => r.gpshop_order_id ?? '—' },
  { key: 'status',         header: 'Status',      cell: r => <StatusBadge status={r.status} /> },
  { key: 'activated_at',  header: 'Activated',    cell: r => r.activated_at?.slice(0, 10) ?? '—' },
  { key: 'auto_cancel_at', header: 'Auto-Cancel', cell: r => r.auto_cancel_at?.slice(0, 10) ?? '—' },
  { key: 'created_at',    header: 'Created',      cell: r => r.created_at?.slice(0, 10) },
];

export default function AccessoriesPage() {
  const [page, setPage]     = useState(0);
  const [search, setSearch] = useState('');
  const dSearch = useDebounce(search, 400);

  const { data, isLoading } = useQuery({
    queryKey: ['addon-orders', page, dSearch],
    queryFn: () => phpApi.get('/addon-orders', { params: { page, per_page: 20, search: dSearch } }).then(r => r.data),
  });
  const rows: AddonOrder[] = Array.isArray(data) ? data : (data?.data ?? []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Accessories History</h1>
      <input
        className="border rounded px-3 py-1.5 text-sm w-64"
        placeholder="Search…"
        value={search}
        onChange={e => { setSearch(e.target.value); setPage(0); }}
      />
      <DataTable
        columns={COLS}
        data={rows}
        rowKey={r => r.id}
        isLoading={isLoading}
        page={page}
        totalPages={data?.last_page}
        onPageChange={setPage}
      />
    </div>
  );
}
