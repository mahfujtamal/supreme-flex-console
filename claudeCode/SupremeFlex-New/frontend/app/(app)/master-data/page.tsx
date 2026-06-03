'use client';

import { useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import * as Popover from '@radix-ui/react-popover';
import * as Dialog from '@radix-ui/react-dialog';
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

// ── Types ────────────────────────────────────────────────────────────────────

interface DhRow extends Record<string, string> {
  id: string;
  dh_code: string;
  name: string;
  territory_name?: string;
  cluster_name?: string;
  region_name?: string;
  circle_name?: string;
  phone_number?: string;
  status: string;
}

interface AreaRow {
  id: string;
  area_name: string;
  thana_name?: string;
  district_name?: string;
}

// ── Generic ResourceTab ───────────────────────────────────────────────────────

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

// ── DH Area Reassignment Dialog ───────────────────────────────────────────────

function ReassignDialog({
  area,
  currentDhId,
  onClose,
}: {
  area: AreaRow;
  currentDhId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [newDhId, setNewDhId]       = useState('');
  const [newDhLabel, setNewDhLabel] = useState('');
  const [dhSearch, setDhSearch]     = useState('');
  const [listOpen, setListOpen]     = useState(false);

  const { data: dhList } = useQuery({
    queryKey: ['dh-list-all'],
    queryFn: () =>
      phpApi.get('/distribution-houses', { params: { per_page: 100 } })
            .then(r => (r.data?.items ?? []) as DhRow[]),
  });

  const filtered = (dhList ?? [])
    .filter(d => d.id !== currentDhId)
    .filter(d => {
      if (!dhSearch) return true;
      const q = dhSearch.toLowerCase();
      return d.dh_code.toLowerCase().includes(q) || d.name.toLowerCase().includes(q);
    });

  const reassign = useMutation({
    mutationFn: () =>
      phpApi.patch(`/distribution-houses/areas/${area.id}/reassign`, { new_dh_id: newDhId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dh-areas'] });
      onClose();
    },
  });

  return (
    <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-lg shadow-lg p-6 w-full max-w-sm">
          <Dialog.Title className="text-base font-semibold">
            Reassign Area
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            {area.area_name}
            {area.thana_name ? ` · ${area.thana_name}` : ''}
          </Dialog.Description>

          {/* Searchable DH picker */}
          <div className="mt-4 relative">
            <input
              className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Search by DH Code or Name…"
              value={newDhId ? newDhLabel : dhSearch}
              onChange={e => {
                setDhSearch(e.target.value);
                setNewDhId('');
                setNewDhLabel('');
                setListOpen(true);
              }}
              onFocus={() => setListOpen(true)}
              onBlur={() => setTimeout(() => setListOpen(false), 150)}
            />
            {listOpen && (
              <ul className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto border rounded bg-white shadow-lg text-sm">
                {filtered.length === 0 ? (
                  <li className="px-3 py-2 text-muted-foreground">No results</li>
                ) : (
                  filtered.map(d => (
                    <li
                      key={d.id}
                      onMouseDown={() => {
                        setNewDhId(d.id);
                        setNewDhLabel(`${d.dh_code} — ${d.name}`);
                        setDhSearch('');
                        setListOpen(false);
                      }}
                      className="px-3 py-2 cursor-pointer hover:bg-primary/10"
                    >
                      <span className="font-mono text-xs text-muted-foreground mr-2">{d.dh_code}</span>
                      {d.name}
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded border text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              disabled={!newDhId || reassign.isPending}
              onClick={() => reassign.mutate()}
              className="px-3 py-1.5 rounded text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40"
            >
              {reassign.isPending ? 'Saving…' : 'Reassign'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ── DH Code cell with area popover ───────────────────────────────────────────

function DhCodeCell({ dh }: { dh: DhRow }) {
  const [open, setOpen]                 = useState(false);
  const [reassignArea, setReassignArea] = useState<AreaRow | null>(null);

  const { data: areas, isLoading } = useQuery({
    queryKey: ['dh-areas', dh.id],
    queryFn: () =>
      phpApi.get(`/distribution-houses/${dh.id}/areas`).then(r => r.data as AreaRow[]),
    enabled: open,
  });

  return (
    <>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button className="font-mono text-xs text-primary underline-offset-2 hover:underline focus:outline-none">
            {dh.dh_code}
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className="z-40 w-80 rounded border bg-white shadow-lg p-3"
            sideOffset={6}
            align="start"
          >
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              Assigned Areas ({isLoading ? '…' : (areas?.length ?? 0)})
            </p>
            {isLoading ? (
              <SkeletonRows count={3} />
            ) : !areas?.length ? (
              <p className="text-xs text-muted-foreground py-2">No areas assigned.</p>
            ) : (
              <ul className="max-h-64 overflow-y-auto divide-y text-sm">
                {areas.map(a => (
                  <li key={a.id} className="flex items-center justify-between gap-2 py-1.5">
                    <div className="min-w-0">
                      <span className="block truncate font-medium">{a.area_name}</span>
                      {(a.thana_name || a.district_name) && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {[a.thana_name, a.district_name].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => { setOpen(false); setReassignArea(a); }}
                      className="shrink-0 text-xs text-blue-600 hover:underline"
                    >
                      Change DH
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Popover.Arrow className="fill-white drop-shadow-sm" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {reassignArea && (
        <ReassignDialog
          area={reassignArea}
          currentDhId={dh.id}
          onClose={() => setReassignArea(null)}
        />
      )}
    </>
  );
}

// ── DH Tab (custom — clickable DH Code) ──────────────────────────────────────

function DhTab() {
  const qc = useQueryClient();
  const [page, setPage]            = useState(0);
  const [search, setSearch]        = useState('');
  const [selectedIds, setSelected] = useState<Set<string>>(new Set());
  const [importOpen, setImport]    = useState(false);
  const dSearch = useDebounce(search, 400);

  const { data, isLoading } = useQuery({
    queryKey: ['dhs', page, dSearch],
    queryFn: () =>
      phpApi.get('/distribution-houses', { params: { page, per_page: 20, search: dSearch } })
            .then(r => r.data),
  });

  const bulkInsert = useMutation({
    mutationFn: (rows: Record<string, string>[]) =>
      phpApi.post('/distribution-houses/bulk', rows),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dhs'] }); setImport(false); },
  });

  const rows: DhRow[] = Array.isArray(data) ? data : (data?.items ?? []);
  const totalPages: number | undefined = data?.last_page;

  const cols: Column<DhRow>[] = [
    { key: 'dh_code',        header: 'Code',      cell: r => <DhCodeCell dh={r} /> },
    { key: 'name',           header: 'Name',      cell: r => r.name },
    { key: 'territory_name', header: 'Territory', cell: r => r.territory_name ?? '—' },
    { key: 'cluster_name',   header: 'Cluster',   cell: r => r.cluster_name ?? '—' },
    { key: 'region_name',    header: 'Region',    cell: r => r.region_name ?? '—' },
    { key: 'circle_name',    header: 'Circle',    cell: r => r.circle_name ?? '—' },
    { key: 'phone_number',  header: 'Phone',      cell: r => r.phone_number ? `+880${r.phone_number}` : '—' },
    { key: 'onboarded_at',  header: 'Onboarded', cell: r => r.onboarded_at ?? '—' },
    { key: 'deboarded_at',  header: 'Deboarded', cell: r => r.deboarded_at ?? '—' },
    { key: 'status',        header: 'Status',    cell: r => <StatusBadge status={r.status} /> },
  ];

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
        <EmptyState icon={Database} heading="No distribution houses found" subtext="Use Bulk Insert to add entries." />
      ) : (
        <DataTable
          columns={cols}
          data={rows}
          rowKey={r => r.id}
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
        templateHeaders={['name', 'dh_code', 'phone_number', 'territory_id', 'status']}
        onImport={rows => bulkInsert.mutate(rows)}
      />
    </div>
  );
}

// ── Column definitions ────────────────────────────────────────────────────────

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
const THANA_COLS: Column<Record<string, string>>[] = [
  { key: 'thana_name',   header: 'Thana',    cell: r => r.thana_name },
  { key: 'district_name',header: 'District', cell: r => r.district_name ?? '—' },
  { key: 'status',       header: 'Status',   cell: r => <StatusBadge status={r.status} /> },
];
const AREA_COLS: Column<Record<string, string>>[] = [
  { key: 'area_name',        header: 'Area',         cell: r => r.area_name },
  { key: 'thana_name',       header: 'Thana',        cell: r => r.thana_name ?? '—' },
  { key: 'district_name',    header: 'District',     cell: r => r.district_name ?? '—' },
  { key: 'network_zone_name',header: 'Network Zone', cell: r => r.network_zone_name ?? '—' },
  { key: 'is_4g_area',       header: '4G',           cell: r => r.is_4g_area ? 'Yes' : 'No' },
  { key: 'is_5g_area',       header: '5G',           cell: r => r.is_5g_area ? 'Yes' : 'No' },
];
const CHANNEL_COLS: Column<Record<string, string>>[] = [
  { key: 'channel_name',      header: 'Name',          cell: r => r.channel_name },
  { key: 'is_assisted',       header: 'Assisted',      cell: r => r.is_assisted ? 'Yes' : 'No' },
  { key: 'is_self_delivered', header: 'Self-Delivered', cell: r => r.is_self_delivered ? 'Yes' : 'No' },
  { key: 'status',            header: 'Status',        cell: r => <StatusBadge status={r.status} /> },
];
const SUBCHAN_COLS: Column<Record<string, string>>[] = [
  { key: 'sub_channel_name',   header: 'Name',      cell: r => r.sub_channel_name },
  { key: 'channel_name',       header: 'Channel',   cell: r => r.channel_name ?? '—' },
  { key: 'delivery_ownership', header: 'Delivery',  cell: r => r.delivery_ownership ?? '—' },
  { key: 'inventory_pull_mode',header: 'Pull Mode', cell: r => r.inventory_pull_mode ?? '—' },
  { key: 'status',             header: 'Status',    cell: r => <StatusBadge status={r.status} /> },
];
const AGENT_CATEGORY_LABELS: Record<string, string> = {
  LEAD_GEN_AND_ACTIVATION: 'Lead Gen & Activation',
  LEAD_GEN_ONLY:           'Lead Gen Only',
  ACTIVATION_ONLY:         'Activation Only',
  NO_LEAD_NO_ACTIVATION:   'No Lead / No Activation',
};
const AGENT_COLS: Column<Record<string, string>>[] = [
  { key: 'agent_name',     header: 'Name',        cell: r => r.agent_name },
  { key: 'agent_category', header: 'Category',    cell: r => AGENT_CATEGORY_LABELS[r.agent_category] ?? r.agent_category ?? '—' },
  { key: 'parent_type',    header: 'Parent Type', cell: r => r.parent_type ?? '—' },
  { key: 'parent_name',    header: 'Parent',      cell: r => r.parent_name ?? '—' },
  { key: 'msisdn',         header: 'Phone',       cell: r => r.msisdn ? `+880${r.msisdn}` : '—' },
  { key: 'status',         header: 'Status',      cell: r => <StatusBadge status={r.status} /> },
];
const KAM_COLS: Column<Record<string, string>>[] = [
  { key: 'name',    header: 'Name',     cell: r => r.name },
  { key: 'msisdn',  header: 'Phone',    cell: r => r.msisdn ? `+88${r.msisdn}` : '—' },
  { key: 'segments',header: 'Segments', cell: r => r.segments ?? '—' },
  { key: 'status',  header: 'Status',   cell: r => <StatusBadge status={r.status} /> },
];

// TABS excludes 'dhs' — that tab is rendered separately with DhTab
const TABS = [
  { value: 'zones',       label: 'Network Zones', endpoint: '/network-zones', cols: ZONE_COLS,     headers: ['name', 'status'] },
  { value: 'districts',   label: 'Districts',     endpoint: '/districts',     cols: DISTRICT_COLS, headers: ['name', 'status'] },
  { value: 'thanas',      label: 'Thanas',        endpoint: '/thanas',        cols: THANA_COLS,    headers: ['name', 'district_id', 'status'] },
  { value: 'areas',       label: 'Areas',         endpoint: '/areas',         cols: AREA_COLS,     headers: ['name', 'district_id', 'thana_id', 'status'] },
  { value: 'channels',    label: 'Channels',      endpoint: '/channels',      cols: CHANNEL_COLS,  headers: ['name', 'default_delivery_mode', 'inventory_pull_mode', 'status'] },
  { value: 'subchannels', label: 'Sub-Channels',  endpoint: '/sub-channels',  cols: SUBCHAN_COLS,  headers: ['name', 'channel_id', 'delivery_ownership', 'status'] },
  { value: 'agents',      label: 'Field Agents',  endpoint: '/field-agents',  cols: AGENT_COLS,    headers: ['name', 'dh_id', 'agent_category', 'status'] },
  { value: 'kams',        label: 'KAMs',          endpoint: '/kams',          cols: KAM_COLS,      headers: ['name', 'region', 'status'] },
];

const TRIGGER_CLASS =
  'px-3 py-2 text-sm whitespace-nowrap text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-primary -mb-px';

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MasterDataPage() {
  // Split TABS around where DH sits (after Sub-Channels, before Field Agents)
  const beforeDh = TABS.slice(0, 6);
  const afterDh  = TABS.slice(6);

  return (
    <div className="space-y-4">
      <PageHero
        title="Master Data"
        subtitle="Reference tables — geography, channels, distribution, field agents"
      />
      <Tabs.Root defaultValue="zones">
        <Tabs.List className="flex gap-1 border-b overflow-x-auto">
          {beforeDh.map(t => (
            <Tabs.Trigger key={t.value} value={t.value} className={TRIGGER_CLASS}>
              {t.label}
            </Tabs.Trigger>
          ))}
          <Tabs.Trigger value="dhs" className={TRIGGER_CLASS}>
            Distribution Houses
          </Tabs.Trigger>
          {afterDh.map(t => (
            <Tabs.Trigger key={t.value} value={t.value} className={TRIGGER_CLASS}>
              {t.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        {beforeDh.map(t => (
          <Tabs.Content key={t.value} value={t.value}>
            <ResourceTab
              endpoint={t.endpoint}
              columns={t.cols as Column<Record<string, string>>[]}
              templateHeaders={t.headers}
              queryKey={t.value}
            />
          </Tabs.Content>
        ))}

        <Tabs.Content value="dhs">
          <DhTab />
        </Tabs.Content>

        {afterDh.map(t => (
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
