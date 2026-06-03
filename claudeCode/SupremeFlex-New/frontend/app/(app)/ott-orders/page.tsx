'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { phpApi } from '@/lib/api';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Tv2 } from 'lucide-react';
import { PageHero } from '@/components/ui/PageHero';
import { SkeletonRows } from '@/components/ui/SkeletonRows';
import { EmptyState } from '@/components/ui/EmptyState';
import { useDebounce } from '@/hooks/useDebounce';

interface OttOrder {
  id: string;
  customer_id: string;
  ott_product_id: string;
  status: string;
  activated_at: string | null;
  notes: string | null;
  created_at: string;
}

const COLS: Column<OttOrder>[] = [
  { key: 'customer_id',    header: 'Customer', cell: r => <code className="text-xs">{r.customer_id?.slice(0, 8)}…</code> },
  { key: 'ott_product_id', header: 'Product',  cell: r => <code className="text-xs">{r.ott_product_id?.slice(0, 8)}…</code> },
  { key: 'status',         header: 'Status',   cell: r => <StatusBadge status={r.status} /> },
  { key: 'activated_at',  header: 'Activated', cell: r => r.activated_at?.slice(0, 10) ?? '—' },
  { key: 'notes',         header: 'Notes',     cell: r => r.notes ?? '—' },
  { key: 'created_at',    header: 'Created',   cell: r => r.created_at?.slice(0, 10) },
];

export default function OttOrdersPage() {
  const [page, setPage]     = useState(0);
  const [search, setSearch] = useState('');
  const dSearch = useDebounce(search, 400);

  const { data, isLoading } = useQuery({
    queryKey: ['ott-orders', page, dSearch],
    queryFn: () => phpApi.get('/ott-orders', { params: { page, per_page: 20, search: dSearch } }).then(r => r.data),
  });
  const rows: OttOrder[] = Array.isArray(data) ? data : (data?.items ?? []);

  return (
    <div className="space-y-4">
      <PageHero title="OTT Orders" subtitle="OTT activation and subscription history" />
      <input
        className="border rounded px-3 py-1.5 text-sm w-64"
        placeholder="Search…"
        value={search}
        onChange={e => { setSearch(e.target.value); setPage(0); }}
      />
      {isLoading ? (
        <SkeletonRows />
      ) : rows.length === 0 ? (
        <EmptyState icon={Tv2} heading="No OTT orders found" subtext="Try a different search term." />
      ) : (
        <DataTable
          columns={COLS}
          data={rows}
          rowKey={r => r.id}
          isLoading={false}
          page={page}
          totalPages={data?.last_page}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
