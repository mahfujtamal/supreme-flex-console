'use client';

import { useState, useRef, useEffect, Fragment } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { phpApi } from '@/lib/api';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { BulkActionBar } from '@/components/ui/BulkActionBar';
import { BulkImportModal } from '@/components/ui/BulkImportModal';
import { Layers } from 'lucide-react';
import { PageHero } from '@/components/ui/PageHero';
import { SkeletonRows } from '@/components/ui/SkeletonRows';
import { EmptyState } from '@/components/ui/EmptyState';
import { useDebounce } from '@/hooks/useDebounce';

interface Product      { id: string; product_name: string; product_category: string; billing_type: string; network_capability: string; status: string }
interface PriceComponent { name: string; type: string; amount: number }
interface AddonCompat  { id: string; addon_name: string; cpe_name: string; status: number | string | boolean; created_at: string }
interface PriceVersion { price_version_id: string; product_name: string; base_price_bdt: string; start_date: string; end_date: string | null; status: string; components?: PriceComponent[] }

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
      {isLoading ? (
        <SkeletonRows />
      ) : rows.length === 0 ? (
        <EmptyState icon={Layers} heading="No records found" />
      ) : (
        <DataTable columns={columns} data={rows} rowKey={r => String(r.id)} isLoading={false} page={page} totalPages={data?.last_page} onPageChange={setPage} selectedIds={sel} onSelectionChange={setSel} />
      )}
      <BulkImportModal open={importOpen} onOpenChange={setImport} templateHeaders={templateHeaders} onImport={() => {}} />
    </div>
  );
}

const PRODUCT_COLS: Column<Product>[] = [
  { key: 'product_name',        header: 'Name',     cell: r => r.product_name },
  { key: 'product_category',   header: 'Category', cell: r => <StatusBadge status={r.product_category} /> },
  { key: 'billing_type',       header: 'Billing',  cell: r => r.billing_type },
  { key: 'network_capability', header: 'Network',  cell: r => r.network_capability === 'ANY' ? 'BOTH' : r.network_capability },
  { key: 'status',             header: 'Status',   cell: r => <StatusBadge status={r.status} /> },
];
const COMPAT_COLS: Column<AddonCompat>[] = [
  { key: 'addon_name', header: 'Addon',          cell: r => r.addon_name },
  { key: 'cpe_name',   header: 'Compatible CPE', cell: r => r.cpe_name },
  { key: 'status',     header: 'Status',         cell: r => <StatusBadge status={r.status} /> },
  { key: 'created_at', header: 'Added',          cell: r => r.created_at?.slice(0, 10) },
];

// ── Product combobox ──────────────────────────────────────────────────────────

function ProductCombobox({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [query, setQuery]   = useState('');
  const [open, setOpen]     = useState(false);
  const containerRef        = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ['products-all'],
    queryFn: () => phpApi.get('/products', { params: { per_page: 100 } }).then(r => r.data),
  });
  const products: Product[] = data?.items ?? [];
  const selected = products.find(p => p.id === value);

  const filtered = query
    ? products.filter(p => p.product_name.toLowerCase().includes(query.toLowerCase()))
    : products;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <input
        className="border rounded px-2 py-1.5 text-sm w-48 bg-background"
        placeholder="Search product…"
        value={open ? query : (selected?.product_name ?? '')}
        onFocus={() => setOpen(true)}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded border bg-background shadow-md text-sm">
          {filtered.map(p => (
            <li
              key={p.id}
              className="px-3 py-1.5 cursor-pointer hover:bg-muted"
              onMouseDown={() => { onChange(p.id); setQuery(''); setOpen(false); }}
            >
              {p.product_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Add price version form ────────────────────────────────────────────────────

interface ComponentRow { name: string; type: 'MANDATORY' | 'CUSTOM'; amount: string; isNew?: boolean }

function AddPriceVersionForm({ onAdded, onCancel }: { onAdded: () => void; onCancel: () => void }) {
  const qc = useQueryClient();
  const [productId, setProductId]   = useState('');
  const [startDate, setStartDate]   = useState('');
  const [dateError, setDateError]   = useState('');
  const [components, setComponents] = useState<ComponentRow[]>([]);

  // Load global component templates once
  const { data: templates } = useQuery({
    queryKey: ['component-templates'],
    queryFn: () => phpApi.get('/price-components/templates').then(r => r.data as { name: string; type: string }[]),
  });

  // Initialise rows from templates when they arrive
  useEffect(() => {
    if (templates && components.length === 0) {
      setComponents(templates.map(t => ({ name: t.name, type: t.type as ComponentRow['type'], amount: '' })));
    }
  }, [templates, components.length]);

  const total = components.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);

  const setAmount = (i: number, amount: string) =>
    setComponents(prev => prev.map((c, idx) => idx === i ? { ...c, amount } : c));
  const removeComp = (i: number) =>
    setComponents(prev => prev.filter((_, idx) => idx !== i));
  const addCustom = () =>
    setComponents(prev => [...prev, { name: '', type: 'CUSTOM', amount: '', isNew: true }]);
  const setNewName = (i: number, name: string) =>
    setComponents(prev => prev.map((c, idx) => idx === i ? { ...c, name } : c));

  const add = useMutation({
    mutationFn: (payload: object) => phpApi.post('/price-versions', payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['price-versions'] }); onAdded(); },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => {
      if (err?.response?.data?.field === 'start_date') setDateError(err.response.data.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDateError('');
    if (!productId || !startDate) return;
    add.mutate({
      product_id: productId,
      start_date: startDate,
      base_price_bdt: total,
      components: components
        .filter(c => c.name.trim() && parseFloat(c.amount) > 0)
        .map(c => ({ name: c.name.trim(), type: c.type, amount: parseFloat(c.amount) })),
    });
  };

  const mandatory = components.map((c, i) => ({ ...c, i })).filter(c => c.type === 'MANDATORY');
  const custom    = components.map((c, i) => ({ ...c, i })).filter(c => c.type === 'CUSTOM');

  return (
    <form onSubmit={handleSubmit} className="p-4 border rounded-lg bg-muted/30 mt-3 space-y-4">
      {/* Product + Date */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Product</label>
          <ProductCombobox value={productId} onChange={setProductId} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Start Date</label>
          <Tooltip.Provider>
            <Tooltip.Root open={!!dateError}>
              <Tooltip.Trigger asChild>
                <input required type="date" value={startDate}
                  onChange={e => { setDateError(''); setStartDate(e.target.value); }}
                  className={`border rounded px-2 py-1.5 text-sm w-40 ${dateError ? 'border-red-500' : ''}`}
                />
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content side="top" className="bg-red-600 text-white text-xs rounded px-2 py-1 max-w-xs shadow-md" sideOffset={4}>
                  {dateError}<Tooltip.Arrow className="fill-red-600" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>
        </div>
      </div>

      {/* Mandatory components */}
      {mandatory.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Mandatory Components</div>
          {mandatory.map(c => (
            <div key={c.i} className="flex items-center gap-3">
              <span className="text-sm w-32 text-foreground">{c.name}</span>
              <input
                type="number" min="0" step="0.01" placeholder="Amount (BDT)"
                value={c.amount}
                onChange={e => setAmount(c.i, e.target.value)}
                className="border rounded px-2 py-1.5 text-sm w-36 tabular-nums"
              />
            </div>
          ))}
        </div>
      )}

      {/* Custom components */}
      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Custom Components
          <span className="ml-1 text-muted-foreground font-normal normal-case">(optional)</span>
        </div>
        {custom.map(c => (
          <div key={c.i} className="flex items-center gap-3">
            {c.isNew ? (
              <input
                placeholder="Component name"
                value={c.name}
                onChange={e => setNewName(c.i, e.target.value)}
                className="border rounded px-2 py-1.5 text-sm w-32"
              />
            ) : (
              <span className="text-sm w-32 text-foreground">{c.name}</span>
            )}
            <input
              type="number" min="0" step="0.01" placeholder="Amount (BDT)"
              value={c.amount}
              onChange={e => setAmount(c.i, e.target.value)}
              className="border rounded px-2 py-1.5 text-sm w-36 tabular-nums"
            />
            <button type="button" onClick={() => removeComp(c.i)}
              className="text-muted-foreground hover:text-destructive text-sm">✕</button>
          </div>
        ))}
        <button type="button" onClick={addCustom}
          className="text-xs text-primary hover:underline">
          + Add custom component
        </button>
      </div>

      {/* Total + actions */}
      <div className="flex items-center justify-between pt-2 border-t">
        <div className="text-sm font-semibold">
          Total: <span className="tabular-nums">{total.toLocaleString()} BDT</span>
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={add.isPending || !productId || !startDate || total === 0}
            className="px-4 py-1.5 bg-primary text-primary-foreground rounded text-sm hover:opacity-90 disabled:opacity-40">
            {add.isPending ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onClick={onCancel}
            className="px-4 py-1.5 border rounded text-sm hover:bg-muted">
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}

// ── Price versions table with expandable rows ─────────────────────────────────

function PriceVersionTable() {
  const [page, setPage]         = useState(0);
  const [search, setSearch]     = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const dSearch = useDebounce(search, 400);

  const { data, isLoading } = useQuery({
    queryKey: ['price-versions', page, dSearch],
    queryFn: () => phpApi.get('/price-versions', { params: { page, per_page: 20, search: dSearch } }).then(r => r.data),
  });
  const rows: PriceVersion[] = data?.items ?? [];

  const toggle = (id: string) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const totalPages = data?.total ? Math.ceil(data.total / 20) : undefined;

  return (
    <div className="space-y-3 pt-3">
      <input
        className="border rounded px-3 py-1.5 text-sm w-64"
        placeholder="Search…"
        value={search}
        onChange={e => { setSearch(e.target.value); setPage(0); }}
      />
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="w-8 px-3 py-2" />
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Product</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Total (BDT)</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Effective From</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">End Date</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground text-xs">Loading…</td></tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground text-xs">No records found.</td></tr>
            )}
            {rows.map(r => {
              const isOpen = expanded.has(r.price_version_id);
              const hasComponents = r.components && r.components.length > 0;
              return (
                <Fragment key={r.price_version_id}>
                  <tr
                    onClick={() => hasComponents && toggle(r.price_version_id)}
                    className={`border-t transition-colors ${hasComponents ? 'cursor-pointer hover:bg-muted/40' : ''}`}
                  >
                    <td className="px-3 py-2 text-muted-foreground">
                      {hasComponents && (
                        <span className="text-xs">{isOpen ? '▾' : '▸'}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-medium">{r.product_name}</td>
                    <td className="px-3 py-2">{Number(r.base_price_bdt).toLocaleString()}</td>
                    <td className="px-3 py-2">{r.start_date?.slice(0, 10)}</td>
                    <td className="px-3 py-2">{r.end_date?.slice(0, 10) ?? '—'}</td>
                    <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                  </tr>
                  {isOpen && hasComponents && (
                    <tr key={`${r.price_version_id}-breakdown`} className="bg-muted/20 border-t">
                      <td />
                      <td colSpan={5} className="px-6 py-3">
                        <div className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wide">Price Breakdown</div>
                        <div className="space-y-1 max-w-xs">
                          {r.components!.map((c, i) => (
                            <div key={i} className="flex justify-between gap-6">
                              <span className="text-sm">{c.name} <span className="text-xs text-muted-foreground">({c.type})</span></span>
                              <span className="text-sm tabular-nums">{Number(c.amount).toLocaleString()}</span>
                            </div>
                          ))}
                          <div className="flex justify-between gap-6 border-t pt-1 mt-1 font-semibold">
                            <span className="text-sm">Total</span>
                            <span className="text-sm tabular-nums">{Number(r.base_price_bdt).toLocaleString()}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {totalPages !== undefined && totalPages > 1 && (
        <div className="flex justify-end gap-2 text-sm">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded disabled:opacity-40">Prev</button>
          <span className="px-3 py-1 text-muted-foreground">Page {page + 1} of {totalPages}</span>
          <button disabled={page + 1 >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}

// ── Price versions tab ────────────────────────────────────────────────────────

function PriceVersionsTab() {
  const [showForm, setShowForm] = useState(false);
  const qc = useQueryClient();

  return (
    <div className="pt-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(f => !f)}
          className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm hover:opacity-90"
        >
          {showForm ? 'Cancel' : '+ Add Price Version'}
        </button>
      </div>
      {showForm && (
        <AddPriceVersionForm
          onAdded={() => { qc.invalidateQueries({ queryKey: ['price-versions'] }); setShowForm(false); }}
          onCancel={() => setShowForm(false)}
        />
      )}
      <PriceVersionTable />
    </div>
  );
}

// ── Display config tab ────────────────────────────────────────────────────────

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

  if (isLoading) return <div className="pt-4"><SkeletonRows count={2} /></div>;
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
              <button onClick={() => save.mutate({ key: row.config_key, value: draft })} disabled={save.isPending}
                className="mt-5 px-3 py-1 bg-primary text-primary-foreground rounded text-xs hover:opacity-90 disabled:opacity-40 shrink-0">
                Save
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TAB_LABELS = ['Products', 'Addon Compatibility', 'Price Versions', 'Display Config'];
const TAB_VALUES = ['products', 'compat', 'versions', 'display-config'];

export default function ProductEnginePage() {
  return (
    <div className="space-y-4">
      <PageHero title="Product Engine" subtitle="Products, pricing versions and addon compatibility" />
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
          <PriceVersionsTab />
        </Tabs.Content>
        <Tabs.Content value="display-config">
          <DisplayConfigTab />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
