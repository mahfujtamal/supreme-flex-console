'use client';

import { useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { phpApi } from '@/lib/api';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { BulkActionBar } from '@/components/ui/BulkActionBar';
import { BulkImportModal } from '@/components/ui/BulkImportModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useDebounce } from '@/hooks/useDebounce';
import { Copy, Megaphone, type LucideIcon } from 'lucide-react';
import { PageHero } from '@/components/ui/PageHero';
import { SkeletonRows } from '@/components/ui/SkeletonRows';
import { EmptyState } from '@/components/ui/EmptyState';

interface Campaign { id: string; name: string; scope: string; campaign_trigger_type: string; status: string; start_date: string; end_date: string }
interface Coupon   { id: string; code: string; discount_type: string; discount_value: string; status: string }
interface Referral { id: string; name: string; reward_amount: string; status: string }
interface Rule     { id: string; rule_type: string; description: string; status: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SimpleTab<T extends Record<string, any>>({ qk, ep, cols, headers }: { qk: string; ep: string; cols: Column<T>[]; headers: string[] }) {
  const [page, setPage]         = useState(0);
  const [search, setSearch]     = useState('');
  const [sel, setSel]           = useState<Set<string>>(new Set());
  const [importOpen, setImport] = useState(false);
  const dSearch = useDebounce(search, 400);
  const { data, isLoading } = useQuery({
    queryKey: [qk, page, dSearch],
    queryFn: () => phpApi.get(ep, { params: { page, per_page: 20, search: dSearch } }).then(r => r.data),
  });
  const rows: T[] = Array.isArray(data) ? data : (data?.items ?? []);
  return (
    <div className="space-y-3 pt-4">
      <div className="flex gap-3">
        <input className="border rounded px-3 py-1.5 text-sm w-64" placeholder="Search…" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
        <button onClick={() => setImport(true)} className="ml-auto px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm hover:opacity-90">+ Bulk Insert</button>
      </div>
      <BulkActionBar selectedCount={sel.size} onBulkInsert={() => setImport(true)} onClearSelection={() => setSel(new Set())} />
      {isLoading ? (
        <SkeletonRows />
      ) : rows.length === 0 ? (
        <EmptyState icon={Megaphone} heading="No records found" />
      ) : (
        <DataTable columns={cols} data={rows} rowKey={r => String(r.id)} isLoading={false} page={page} totalPages={data?.last_page} onPageChange={setPage} selectedIds={sel} onSelectionChange={setSel} />
      )}
      <BulkImportModal open={importOpen} onOpenChange={setImport} templateHeaders={headers} onImport={() => {}} />
    </div>
  );
}

function CampaignsTab() {
  const qc = useQueryClient();
  const [page, setPage]         = useState(0);
  const [search, setSearch]     = useState('');
  const [sel, setSel]           = useState<Set<string>>(new Set());
  const [cloneId, setCloneId]   = useState<string | null>(null);
  const [importOpen, setImport] = useState(false);
  const dSearch = useDebounce(search, 400);

  const { data, isLoading } = useQuery({
    queryKey: ['campaigns', page, dSearch],
    queryFn: () => phpApi.get('/campaigns', { params: { page, per_page: 20, search: dSearch } }).then(r => r.data),
  });
  const clone = useMutation({
    mutationFn: (id: string) => phpApi.post(`/campaigns/${id}/clone`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['campaigns'] }); setCloneId(null); },
  });
  const rows: Campaign[] = Array.isArray(data) ? data : (data?.items ?? []);

  const cols: Column<Campaign>[] = [
    { key: 'name',                  header: 'Name',    cell: r => r.name },
    { key: 'scope',                 header: 'Scope',   cell: r => r.scope },
    { key: 'campaign_trigger_type', header: 'Trigger', cell: r => r.campaign_trigger_type },
    { key: 'start_date',            header: 'Start',   cell: r => r.start_date?.slice(0, 10) },
    { key: 'end_date',              header: 'End',     cell: r => r.end_date?.slice(0, 10) },
    { key: 'status',                header: 'Status',  cell: r => <StatusBadge status={r.status} /> },
    { key: 'actions', header: '', cell: r => (
      <button onClick={() => setCloneId(r.id)} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
        <Copy className="w-3 h-3" /> Clone
      </button>
    )},
  ];

  return (
    <div className="space-y-3 pt-4">
      <div className="flex gap-3">
        <input className="border rounded px-3 py-1.5 text-sm w-64" placeholder="Search…" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
        <button onClick={() => setImport(true)} className="ml-auto px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm hover:opacity-90">+ Bulk Insert</button>
      </div>
      <BulkActionBar selectedCount={sel.size} onBulkInsert={() => setImport(true)} onClearSelection={() => setSel(new Set())} />
      {isLoading ? (
        <SkeletonRows />
      ) : rows.length === 0 ? (
        <EmptyState icon={Megaphone} heading="No campaigns found" subtext="Use Bulk Insert to add campaigns." />
      ) : (
        <DataTable columns={cols} data={rows} rowKey={r => r.id} isLoading={false} page={page} totalPages={data?.last_page} onPageChange={setPage} selectedIds={sel} onSelectionChange={setSel} />
      )}
      <BulkImportModal open={importOpen} onOpenChange={setImport} templateHeaders={['name','scope','campaign_trigger_type','start_date','end_date']} onImport={() => {}} />
      <ConfirmDialog open={!!cloneId} onOpenChange={open => { if (!open) setCloneId(null); }} title="Clone Campaign" description="A copy will be created in INACTIVE status." confirmLabel="Clone" onConfirm={() => cloneId && clone.mutate(cloneId)} />
    </div>
  );
}

const COUPON_COLS: Column<Coupon>[] = [
  { key: 'code',           header: 'Code',    cell: r => <code className="font-mono text-xs">{r.code}</code> },
  { key: 'discount_type',  header: 'Type',    cell: r => r.discount_type },
  { key: 'discount_value', header: 'Value',   cell: r => r.discount_value },
  { key: 'status',         header: 'Status',  cell: r => <StatusBadge status={r.status} /> },
];
const REFERRAL_COLS: Column<Referral>[] = [
  { key: 'name',          header: 'Name',         cell: r => r.name },
  { key: 'reward_amount', header: 'Reward (BDT)', cell: r => r.reward_amount },
  { key: 'status',        header: 'Status',       cell: r => <StatusBadge status={r.status} /> },
];
const RULE_COLS: Column<Rule>[] = [
  { key: 'rule_type',   header: 'Type',        cell: r => r.rule_type },
  { key: 'description', header: 'Description', cell: r => r.description },
  { key: 'status',      header: 'Status',      cell: r => <StatusBadge status={r.status} /> },
];

export default function CampaignEnginePage() {
  return (
    <div className="space-y-4">
      <PageHero title="Campaign Engine" subtitle="Campaigns, coupons, referrals and targeting rules" />
      <Tabs.Root defaultValue="campaigns">
        <Tabs.List className="flex gap-1 border-b overflow-x-auto">
          {['Campaigns','Coupons','Referral Programs','Targeting Rules','Product Rules'].map((label, i) => (
            <Tabs.Trigger key={i} value={['campaigns','coupons','referrals','targeting','product-rules'][i]} className="px-3 py-2 text-sm whitespace-nowrap text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-primary -mb-px">
              {label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="campaigns"><CampaignsTab /></Tabs.Content>
        <Tabs.Content value="coupons"><SimpleTab<Coupon> qk="coupons" ep="/coupons" cols={COUPON_COLS} headers={['code','discount_type','discount_value']} /></Tabs.Content>
        <Tabs.Content value="referrals"><SimpleTab<Referral> qk="referrals" ep="/referral-programs" cols={REFERRAL_COLS} headers={['name','reward_amount']} /></Tabs.Content>
        <Tabs.Content value="targeting"><SimpleTab<Rule> qk="targeting-rules" ep="/targeting-rules" cols={RULE_COLS} headers={['rule_type','description']} /></Tabs.Content>
        <Tabs.Content value="product-rules"><SimpleTab<Rule> qk="product-rules" ep="/product-rules" cols={RULE_COLS} headers={['rule_type','description']} /></Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
