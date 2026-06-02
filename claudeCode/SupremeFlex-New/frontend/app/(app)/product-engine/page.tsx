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

interface Product      { id: string; product_name: string; product_category: string; billing_type: string; network_capability: string; status: string }
interface AddonCompat  { id: string; addon_name: string; cpe_name: string; status: number | string | boolean; created_at: string }
interface PriceVersion { id: string; product_id: string; price: string; status: string; effective_from: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SearchTable<T extends Record<string, any>>({
  queryKey, endpoint, columns, templateHeaders,
}: { queryKey: string; endpoint: string; columns: Column<T>[]; templateHeaders: string[] }) {
  const [page, setPage]         = useState(0);
  const [search, setSearch]     = useState('');
  const [sel, setSel]           = useState<Set<string>>(new Set());
  const [importOpen, setImport] = useState(false);
  const dSearch = useDebounce(search, 400);

  const { data, isLoading } = useQuery({
    queryKey: [queryKey, page, dSearch],
    queryFn: () => phpApi.get(endpoint, { params: { page, per_page: 20, search: dSearch } }).then(r => r.data),
  });
  const rows: T[] = Array.isArray(data) ? data : (data?.items ?? []);

  return (
    <div className="space-y-3 pt-4">
      <div className="flex items-center gap-3">
        <input className="border rounded px-3 py-1.5 text-sm w-64" placeholder="Search…" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
        <button onClick={() => setImport(true)} className="ml-auto px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm hover:opacity-90">+ Bulk Insert</button>
      </div>
      <BulkActionBar selectedCount={sel.size} onBulkInsert={() => setImport(true)} onClearSelection={() => setSel(new Set())} />
      <DataTable columns={columns} data={rows} rowKey={r => String(r.id)} isLoading={isLoading} page={page} totalPages={data?.last_page} onPageChange={setPage} selectedIds={sel} onSelectionChange={setSel} />
      <BulkImportModal open={importOpen} onOpenChange={setImport} templateHeaders={templateHeaders} onImport={() => {}} />
    </div>
  );
}

const PRODUCT_COLS: Column<Product>[] = [
  { key: 'product_name',        header: 'Name',     cell: r => r.product_name },
  { key: 'product_category',   header: 'Category', cell: r => <StatusBadge status={r.product_category} /> },
  { key: 'billing_type',       header: 'Billing',  cell: r => r.billing_type },
  { key: 'network_capability', header: 'Network',  cell: r => r.network_capability },
  { key: 'status',             header: 'Status',   cell: r => <StatusBadge status={r.status} /> },
];
const COMPAT_COLS: Column<AddonCompat>[] = [
  { key: 'addon_name', header: 'Addon',          cell: r => r.addon_name },
  { key: 'cpe_name',   header: 'Compatible CPE', cell: r => r.cpe_name },
  { key: 'status',     header: 'Status',         cell: r => <StatusBadge status={r.status} /> },
  { key: 'created_at', header: 'Added',          cell: r => r.created_at?.slice(0, 10) },
];
const VERSION_COLS: Column<PriceVersion>[] = [
  { key: 'product_id',     header: 'Product',        cell: r => r.product_id },
  { key: 'price',          header: 'Price',          cell: r => r.price },
  { key: 'effective_from', header: 'Effective From', cell: r => r.effective_from?.slice(0, 10) },
  { key: 'status',         header: 'Status',         cell: r => <StatusBadge status={r.status} /> },
];

interface SysConfig { config_key: string; config_value: string; description: string | null; updated_at: string }

function DisplayConfigTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['system-config'],
    queryFn: () => phpApi.get('/system-config').then(r => r.data as SysConfig[]),
  });

  const save = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      phpApi.put(`/system-config/${key}`, { config_value: value }),
    onSuccess: (_, { key }) => {
      qc.invalidateQueries({ queryKey: ['system-config'] });
      setEditing(e => { const n = { ...e }; delete n[key]; return n; });
    },
  });

  if (isLoading) return <p className="pt-4 text-sm text-muted-foreground">Loading…</p>;
  const rows: SysConfig[] = Array.isArray(data) ? data : [];

  return (
    <div className="pt-4 space-y-2">
      {rows.length === 0 && <p className="text-sm text-muted-foreground">No config entries.</p>}
      {rows.map(row => {
        const draft = editing[row.config_key] ?? row.config_value;
        const dirty = editing[row.config_key] !== undefined;
        return (
          <div key={row.config_key} className="flex items-start gap-3 p-3 border rounded-lg">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium font-mono">{row.config_key}</p>
              {row.description && <p className="text-xs text-muted-foreground mt-0.5">{row.description}</p>}
              <input
                className="mt-1 border rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={draft}
                onChange={e => setEditing(ed => ({ ...ed, [row.config_key]: e.target.value }))}
              />
            </div>
            {dirty && (
              <button
                onClick={() => save.mutate({ key: row.config_key, value: draft })}
                disabled={save.isPending}
                className="mt-5 px-3 py-1 bg-primary text-primary-foreground rounded text-xs hover:opacity-90 disabled:opacity-40 shrink-0"
              >
                Save
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

const TAB_LABELS = ['Products', 'Addon Compatibility', 'Price Versions', 'Display Config'];
const TAB_VALUES = ['products', 'compat', 'versions', 'display-config'];

export default function ProductEnginePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Product Engine</h1>
      <Tabs.Root defaultValue="products">
        <Tabs.List className="flex gap-1 border-b">
          {TAB_LABELS.map((label, i) => (
            <Tabs.Trigger key={i} value={TAB_VALUES[i]} className="px-3 py-2 text-sm text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-primary -mb-px">
              {label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="products">
          <SearchTable<Product> queryKey="products" endpoint="/products" columns={PRODUCT_COLS} templateHeaders={['name','product_category','billing_type','network_capability','status']} />
        </Tabs.Content>
        <Tabs.Content value="compat">
          <SearchTable<AddonCompat> queryKey="addon-compat" endpoint="/addon-compatibility" columns={COMPAT_COLS} templateHeaders={['product_id','compatible_with','status']} />
        </Tabs.Content>
        <Tabs.Content value="versions">
          <SearchTable<PriceVersion> queryKey="price-versions" endpoint="/price-versions" columns={VERSION_COLS} templateHeaders={['product_id','price','effective_from']} />
        </Tabs.Content>
        <Tabs.Content value="display-config">
          <DisplayConfigTab />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
