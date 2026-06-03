'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { phpApi } from '@/lib/api';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Globe } from 'lucide-react';
import { PageHero } from '@/components/ui/PageHero';
import { SkeletonRows } from '@/components/ui/SkeletonRows';
import { EmptyState } from '@/components/ui/EmptyState';
import { useDebounce } from '@/hooks/useDebounce';

interface RealIp {
  id: string;
  customer_id: string;
  anchor_id: string;
  ip_address: string;
  status: string;
  assigned_at: string;
  released_at: string | null;
  created_at: string;
}

export default function RealIpPage() {
  const qc = useQueryClient();
  const [page, setPage]         = useState(0);
  const [search, setSearch]     = useState('');
  const [releaseId, setRelease] = useState<string | null>(null);
  const dSearch = useDebounce(search, 400);

  const { data, isLoading } = useQuery({
    queryKey: ['real-ip', page, dSearch],
    queryFn: () => phpApi.get('/real-ip', { params: { page, per_page: 20, search: dSearch } }).then(r => r.data),
  });

  const release = useMutation({
    mutationFn: (id: string) => phpApi.patch(`/real-ip/${id}`, { status: 'RELEASED' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['real-ip'] }); setRelease(null); },
  });

  const rows: RealIp[] = Array.isArray(data) ? data : (data?.items ?? []);

  const COLS: Column<RealIp>[] = [
    { key: 'customer_id', header: 'Customer',   cell: r => <code className="text-xs">{r.customer_id?.slice(0, 8)}…</code> },
    { key: 'anchor_id',   header: 'Anchor',     cell: r => <code className="text-xs">{r.anchor_id?.slice(0, 8)}…</code> },
    { key: 'ip_address',  header: 'IP Address', cell: r => <code className="font-mono text-sm">{r.ip_address}</code> },
    { key: 'status',      header: 'Status',     cell: r => <StatusBadge status={r.status} /> },
    { key: 'assigned_at', header: 'Assigned',   cell: r => r.assigned_at?.slice(0, 10) },
    { key: 'released_at', header: 'Released',   cell: r => r.released_at?.slice(0, 10) ?? '—' },
    {
      key: 'actions', header: '',
      cell: r => r.status === 'ACTIVE'
        ? <button onClick={() => setRelease(r.id)} className="text-xs text-orange-600 hover:underline">Release</button>
        : null,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHero title="Real IP Assignments" subtitle="Static IP allocation and release management" />
      <input
        className="border rounded px-3 py-1.5 text-sm w-64"
        placeholder="Search by IP or customer…"
        value={search}
        onChange={e => { setSearch(e.target.value); setPage(0); }}
      />
      {isLoading ? (
        <SkeletonRows />
      ) : rows.length === 0 ? (
        <EmptyState icon={Globe} heading="No IP assignments found" subtext="Try a different search term." />
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
      <ConfirmDialog
        open={!!releaseId}
        onOpenChange={open => { if (!open) setRelease(null); }}
        title="Release IP"
        description="This will mark the IP assignment as RELEASED. The address becomes available for reuse."
        confirmLabel="Release"
        onConfirm={() => releaseId && release.mutate(releaseId)}
      />
    </div>
  );
}
