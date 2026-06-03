'use client';

import { useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { phpApi } from '@/lib/api';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { MapPin, type LucideIcon } from 'lucide-react';
import { PageHero } from '@/components/ui/PageHero';
import { SkeletonRows } from '@/components/ui/SkeletonRows';
import { EmptyState } from '@/components/ui/EmptyState';
import { useDebounce } from '@/hooks/useDebounce';

interface LocationChange {
  id: string;
  customer_id: string;
  anchor_id: string;
  new_area_id: string;
  status: string;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
}

const COLS: Column<LocationChange>[] = [
  { key: 'customer_id',  header: 'Customer',  cell: r => <code className="text-xs">{r.customer_id?.slice(0, 8)}…</code> },
  { key: 'anchor_id',   header: 'Anchor',    cell: r => <code className="text-xs">{r.anchor_id?.slice(0, 8)}…</code> },
  { key: 'new_area_id', header: 'New Area',  cell: r => <code className="text-xs">{r.new_area_id?.slice(0, 8)}…</code> },
  { key: 'status',      header: 'Status',    cell: r => <StatusBadge status={r.status} /> },
  { key: 'completed_at', header: 'Completed', cell: r => r.completed_at?.slice(0, 10) ?? '—' },
  { key: 'created_at',  header: 'Requested', cell: r => r.created_at?.slice(0, 10) },
];

function HistoryTab() {
  const [page, setPage]     = useState(0);
  const [search, setSearch] = useState('');
  const dSearch = useDebounce(search, 400);

  const { data, isLoading } = useQuery({
    queryKey: ['location-changes', page, dSearch],
    queryFn: () => phpApi.get('/location-changes', { params: { page, per_page: 20, search: dSearch } }).then(r => r.data),
  });
  const rows: LocationChange[] = Array.isArray(data) ? data : (data?.items ?? []);

  return (
    <div className="space-y-3 pt-4">
      <input
        className="border rounded px-3 py-1.5 text-sm w-64"
        placeholder="Search…"
        value={search}
        onChange={e => { setSearch(e.target.value); setPage(0); }}
      />
      {isLoading ? (
        <SkeletonRows />
      ) : rows.length === 0 ? (
        <EmptyState icon={MapPin} heading="No location changes found" subtext="Try a different search term." />
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

const EMPTY_FORM = { customer_id: '', anchor_id: '', active_service_id: '', new_area_id: '', notes: '' };

function NewRequestTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [done, setDone] = useState(false);

  const submit = useMutation({
    mutationFn: () => phpApi.post('/location-changes', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['location-changes'] });
      setForm(EMPTY_FORM);
      setDone(true);
    },
  });

  const field = (key: keyof typeof EMPTY_FORM, label: string, placeholder: string) => (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input
        className="border rounded px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary/30"
        placeholder={placeholder}
        value={form[key]}
        onChange={e => { setForm(f => ({ ...f, [key]: e.target.value })); setDone(false); }}
      />
    </div>
  );

  const required = ['customer_id', 'anchor_id', 'active_service_id', 'new_area_id'] as const;
  const canSubmit = required.every(k => form[k].trim()) && !submit.isPending;

  return (
    <div className="pt-4 max-w-lg space-y-4">
      {done && (
        <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800">
          Location change request submitted successfully.
        </div>
      )}
      {submit.isError && (
        <div className="p-3 bg-destructive/10 border border-destructive/30 rounded text-sm text-destructive">
          Failed to submit. Please check IDs and try again.
        </div>
      )}
      {field('customer_id',       'Customer ID *',        'UUID')}
      {field('anchor_id',         'Anchor ID *',          'UUID')}
      {field('active_service_id', 'Active Service ID *',  'UUID')}
      {field('new_area_id',       'New Area ID *',        'UUID')}
      {field('notes',             'Notes',                'Optional reason…')}
      <button
        onClick={() => submit.mutate()}
        disabled={!canSubmit}
        className="px-4 py-1.5 bg-primary text-primary-foreground rounded text-sm hover:opacity-90 disabled:opacity-40"
      >
        {submit.isPending ? 'Submitting…' : 'Submit Request'}
      </button>
    </div>
  );
}

export default function LocationChangePage() {
  return (
    <div className="space-y-4">
      <PageHero title="Location Change" subtitle="Customer location transfer requests and history" />
      <Tabs.Root defaultValue="history">
        <Tabs.List className="flex gap-1 border-b">
          {[['history', 'History'], ['new', 'New Request']].map(([val, label]) => (
            <Tabs.Trigger
              key={val}
              value={val}
              className="px-3 py-2 text-sm text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-primary -mb-px"
            >
              {label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="history"><HistoryTab /></Tabs.Content>
        <Tabs.Content value="new"><NewRequestTab /></Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
