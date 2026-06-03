'use client';

import { useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Database } from 'lucide-react';
import { phpApi } from '@/lib/api';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { BulkActionBar } from '@/components/ui/BulkActionBar';
import { BulkImportModal } from '@/components/ui/BulkImportModal';
import { PageHero } from '@/components/ui/PageHero';
import { SkeletonRows } from '@/components/ui/SkeletonRows';
import { EmptyState } from '@/components/ui/EmptyState';
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

  const rows: Record<string, string>[] = Array.isArray(data) ? data : (data?.items ?? []);
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

      {isLoading ? (
        <SkeletonRows />
      ) : rows.length === 0 ? (
        <EmptyState icon={Database} heading="No records found" subtext="Use Bulk Insert to add entries." />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          rowKey={r => r.id ?? ''}
          isLoading={false}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          selectedIds={selectedIds}
          onSelectionChange={setSelected}
        />
      )}

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
  { key: 'network_zone_name', header: 'Name',    cell: r => r.network_zone_name },
  { key: '4g_rsrp',          header: '4G RSRP', cell: r => r['4g_rsrp'] ?? '—' },
  { key: '4g_rsrq',          header: '4G RSRQ', cell: r => r['4g_rsrq'] ?? '—' },
  { key: '4g_snr',           header: '4G SNR',  cell: r => r['4g_snr'] ?? '—' },
  { key: '5g_rsrp',          header: '5G RSRP', cell: r => r['5g_rsrp'] ?? '—' },
  { key: '5g_rsrq',          header: '5G RSRQ', cell: r => r['5g_rsrq'] ?? '—' },
  { key: '5g_snr',           header: '5G SNR',  cell: r => r['5g_snr'] ?? '—' },
  { key: 'status',           header: 'Status',  cell: r => <StatusBadge status={r.status} /> },
  { key: 'created_at',       header: 'Created', cell: r => r.created_at?.slice(0, 10) },
];
const DISTRICT_COLS: Column<Record<string, string>>[] = [
  { key: 'district_name', header: 'Name',   cell: r => r.district_name },
  { key: 'status',        header: 'Status', cell: r => <StatusBadge status={r.status} /> },
];
const AREA_COLS: Column<Record<string, string>>[] = [
  { key: 'area_name',        header: 'Area',          cell: r => r.area_name },
  { key: 'district_name',    header: 'District',      cell: r => r.district_name ?? '—' },
  { key: 'network_zone_name',header: 'Network Zone',  cell: r => r.network_zone_name ?? '—' },
  { key: 'is_4g_area',       header: '4G',            cell: r => r.is_4g_area ? 'Yes' : 'No' },
  { key: 'is_5g_area',       header: '5G',            cell: r => r.is_5g_area ? 'Yes' : 'No' },
];
const CHANNEL_COLS: Column<Record<string, string>>[] = [
  { key: 'channel_name',   header: 'Name',         cell: r => r.channel_name },
  { key: 'is_assisted',    header: 'Assisted',     cell: r => r.is_assisted ? 'Yes' : 'No' },
  { key: 'is_self_delivered', header: 'Self-Delivered', cell: r => r.is_self_delivered ? 'Yes' : 'No' },
  { key: 'status',         header: 'Status',       cell: r => <StatusBadge status={r.status} /> },
];
const SUBCHAN_COLS: Column<Record<string, string>>[] = [
  { key: 'sub_channel_name',  header: 'Name',         cell: r => r.sub_channel_name },
  { key: 'channel_name',      header: 'Channel',      cell: r => r.channel_name ?? '—' },
  { key: 'delivery_ownership',header: 'Delivery',     cell: r => r.delivery_ownership ?? '—' },
  { key: 'inventory_pull_mode',header: 'Pull Mode',   cell: r => r.inventory_pull_mode ?? '—' },
  { key: 'status',            header: 'Status',       cell: r => <StatusBadge status={r.status} /> },
];
const DH_COLS: Column<Record<string, string>>[] = [
  { key: 'dh_code',        header: 'Code',      cell: r => r.dh_code },
  { key: 'name',           header: 'Name',      cell: r => r.name },
  { key: 'territory_name', header: 'Territory', cell: r => r.territory_name ?? '—' },
  { key: 'cluster_name',   header: 'Cluster',   cell: r => r.cluster_name ?? '—' },
  { key: 'region_name',    header: 'Region',    cell: r => r.region_name ?? '—' },
  { key: 'circle_name',    header: 'Circle',    cell: r => r.circle_name ?? '—' },
  { key: 'phone_number',   header: 'Phone',     cell: r => r.phone_number ? `+880${r.phone_number}` : '—' },
  { key: 'status',         header: 'Status',    cell: r => <StatusBadge status={r.status} /> },
];
const AGENT_COLS: Column<Record<string, string>>[] = [
  { key: 'agent_name',  header: 'Name',        cell: r => r.agent_name },
  { key: 'parent_type', header: 'Parent Type',  cell: r => r.parent_type ?? '—' },
  { key: 'parent_name', header: 'Parent',       cell: r => r.parent_name ?? '—' },
  { key: 'msisdn',      header: 'Phone',        cell: r => r.msisdn ? `+880${r.msisdn}` : '—' },
  { key: 'status',      header: 'Status',       cell: r => <StatusBadge status={r.status} /> },
];
const KAM_COLS: Column<Record<string, string>>[] = [
  { key: 'name',               header: 'Name',     cell: r => r.name },
  { key: 'msisdn',             header: 'Phone',    cell: r => r.msisdn ? `+88${r.msisdn}` : '—' },
  { key: 'segments',           header: 'Segments', cell: r => r.segments ?? '—' },
  { key: 'status',             header: 'Status',   cell: r => <StatusBadge status={r.status} /> },
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
      <PageHero
        title="Master Data"
        subtitle="Reference tables — geography, channels, distribution, field agents"
      />
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
