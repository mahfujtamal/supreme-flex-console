'use client';

import { useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { phpApi } from '@/lib/api';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { BulkActionBar } from '@/components/ui/BulkActionBar';
import { BulkImportModal } from '@/components/ui/BulkImportModal';
import { useDebounce } from '@/hooks/useDebounce';

function ResourceTab({
  endpoint,
  columns,
  templateHeaders,
  queryKey,
}: {
  endpoint: string;
  columns: Column<Record<string, string>>[];
  templateHeaders: string[];
  queryKey: string;
}) {
  const qc = useQueryClient();
  const [page, setPage]            = useState(0);
  const [search, setSearch]        = useState('');
  const [selectedIds, setSelected] = useState<Set<string>>(new Set());
  const [importOpen, setImport]    = useState(false);
  const dSearch = useDebounce(search, 400);

  const { data, isLoading } = useQuery({
    queryKey: [queryKey, page, dSearch],
    queryFn: () =>
      phpApi.get(endpoint, { params: { page, per_page: 20, search: dSearch } }).then(r => r.data),
  });

  const bulkInsert = useMutation({
    mutationFn: (rows: Record<string, string>[]) => phpApi.post(`${endpoint}/bulk`, rows),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [queryKey] }); setImport(false); },
  });

  const rows: Record<string, string>[] = Array.isArray(data) ? data : (data?.data ?? []);
  const totalPages: number | undefined = data?.last_page;

  return (
    <div className="space-y-3 pt-4">
      <div className="flex items-center gap-3">
        <input
          className="border rounded px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary/30"
          placeholder="Search…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
        />
        <button
          onClick={() => setImport(true)}
          className="ml-auto px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm hover:opacity-90"
        >
          + Bulk Insert
        </button>
      </div>

      <BulkActionBar
        selectedCount={selectedIds.size}
        onBulkInsert={() => setImport(true)}
        onClearSelection={() => setSelected(new Set())}
      />

      <DataTable
        columns={columns}
        data={rows}
        rowKey={r => r.id ?? ''}
        isLoading={isLoading}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        selectedIds={selectedIds}
        onSelectionChange={setSelected}
      />

      <BulkImportModal
        open={importOpen}
        onOpenChange={setImport}
        templateHeaders={templateHeaders}
        onImport={rows => bulkInsert.mutate(rows)}
      />
    </div>
  );
}

const ZONE_COLS: Column<Record<string, string>>[] = [
  { key: 'name',       header: 'Name',    cell: r => r.name },
  { key: 'status',     header: 'Status',  cell: r => <StatusBadge status={r.status} /> },
  { key: 'created_at', header: 'Created', cell: r => r.created_at?.slice(0, 10) },
];
const DISTRICT_COLS: Column<Record<string, string>>[] = [
  { key: 'name',   header: 'Name',   cell: r => r.name },
  { key: 'status', header: 'Status', cell: r => <StatusBadge status={r.status} /> },
];
const AREA_COLS: Column<Record<string, string>>[] = [
  { key: 'name',        header: 'Name',     cell: r => r.name },
  { key: 'district_id', header: 'District', cell: r => r.district_id },
  { key: 'status',      header: 'Status',   cell: r => <StatusBadge status={r.status} /> },
];
const CHANNEL_COLS: Column<Record<string, string>>[] = [
  { key: 'name',                  header: 'Name',      cell: r => r.name },
  { key: 'default_delivery_mode', header: 'Delivery',  cell: r => r.default_delivery_mode ?? '—' },
  { key: 'inventory_pull_mode',   header: 'Pull Mode', cell: r => r.inventory_pull_mode ?? '—' },
  { key: 'status',                header: 'Status',    cell: r => <StatusBadge status={r.status} /> },
];
const SUBCHAN_COLS: Column<Record<string, string>>[] = [
  { key: 'name',               header: 'Name',     cell: r => r.name },
  { key: 'channel_id',         header: 'Channel',  cell: r => r.channel_id },
  { key: 'delivery_ownership', header: 'Delivery', cell: r => r.delivery_ownership ?? '—' },
  { key: 'status',             header: 'Status',   cell: r => <StatusBadge status={r.status} /> },
];
const DH_COLS: Column<Record<string, string>>[] = [
  { key: 'name',             header: 'Name',    cell: r => r.name },
  { key: 'manager_admin_id', header: 'Manager', cell: r => r.manager_admin_id ?? '—' },
  { key: 'status',           header: 'Status',  cell: r => <StatusBadge status={r.status} /> },
];
const AGENT_COLS: Column<Record<string, string>>[] = [
  { key: 'name',   header: 'Name',   cell: r => r.name },
  { key: 'dh_id',  header: 'DH',     cell: r => r.dh_id ?? '—' },
  { key: 'status', header: 'Status', cell: r => <StatusBadge status={r.status} /> },
];
const KAM_COLS: Column<Record<string, string>>[] = [
  { key: 'name',   header: 'Name',   cell: r => r.name },
  { key: 'region', header: 'Region', cell: r => r.region ?? '—' },
  { key: 'status', header: 'Status', cell: r => <StatusBadge status={r.status} /> },
];

const TABS = [
  { value: 'zones',        label: 'Network Zones',       endpoint: '/network-zones',       cols: ZONE_COLS,     headers: ['name', 'status'] },
  { value: 'districts',    label: 'Districts',           endpoint: '/districts',           cols: DISTRICT_COLS, headers: ['name', 'status'] },
  { value: 'areas',        label: 'Areas',               endpoint: '/areas',               cols: AREA_COLS,     headers: ['name', 'district_id', 'status'] },
  { value: 'channels',     label: 'Channels',            endpoint: '/channels',            cols: CHANNEL_COLS,  headers: ['name', 'default_delivery_mode', 'inventory_pull_mode', 'status'] },
  { value: 'subchannels',  label: 'Sub-Channels',        endpoint: '/sub-channels',        cols: SUBCHAN_COLS,  headers: ['name', 'channel_id', 'delivery_ownership', 'status'] },
  { value: 'dhs',          label: 'Distribution Houses', endpoint: '/distribution-houses', cols: DH_COLS,       headers: ['name', 'manager_admin_id', 'status'] },
  { value: 'agents',       label: 'Field Agents',        endpoint: '/field-agents',        cols: AGENT_COLS,    headers: ['name', 'dh_id', 'status'] },
  { value: 'kams',         label: 'KAMs',                endpoint: '/kams',                cols: KAM_COLS,      headers: ['name', 'region', 'status'] },
];

export default function MasterDataPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Master Data</h1>
      <Tabs.Root defaultValue="zones">
        <Tabs.List className="flex gap-1 border-b overflow-x-auto">
          {TABS.map(t => (
            <Tabs.Trigger
              key={t.value}
              value={t.value}
              className="px-3 py-2 text-sm whitespace-nowrap text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-primary -mb-px"
            >
              {t.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        {TABS.map(t => (
          <Tabs.Content key={t.value} value={t.value}>
            <ResourceTab
              endpoint={t.endpoint}
              columns={t.cols as Column<Record<string, string>>[]}
              templateHeaders={t.headers}
              queryKey={t.value}
            />
          </Tabs.Content>
        ))}
      </Tabs.Root>
    </div>
  );
}
