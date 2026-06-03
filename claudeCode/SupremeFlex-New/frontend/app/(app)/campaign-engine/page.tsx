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

interface Campaign { id: string; campaign_name: string; scope: string; campaign_trigger_type: string; status: string; start_date: string; end_date: string }
interface Coupon   { id: string; coupon_code: string; campaign_id: string; global_usage_limit: number | null; current_global_uses: number; max_uses_per_customer: number | null; status: string }
interface Referral { id: string; referral_code_prefix: string | null; referrer_reward_type: string | null; referrer_reward_value: string | null; referrer_reward_unit: string | null; status: string }
interface TargetingRule { id: string; network_type: string; min_network_age_days: number | null; max_network_age_days: number | null; block_id: string | null }
interface ProductRule  { id: string; rule_type: string; discount_type: string | null; discount_value: string | null }

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
    { key: 'campaign_name',         header: 'Name',    cell: r => r.campaign_name },
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
  { key: 'coupon_code',          header: 'Code',            cell: r => <code className="font-mono text-xs">{r.coupon_code}</code> },
  { key: 'global_usage_limit',   header: 'Global Limit',   cell: r => r.global_usage_limit ?? '∞' },
  { key: 'current_global_uses',  header: 'Used',            cell: r => r.current_global_uses },
  { key: 'max_uses_per_customer',header: 'Per Customer',   cell: r => r.max_uses_per_customer ?? '∞' },
  { key: 'status',               header: 'Status',          cell: r => <StatusBadge status={r.status} /> },
];
const REFERRAL_COLS: Column<Referral>[] = [
  { key: 'referral_code_prefix',  header: 'Code Prefix', cell: r => r.referral_code_prefix ?? '—' },
  { key: 'referrer_reward_type',  header: 'Reward Type', cell: r => r.referrer_reward_type ?? '—' },
  { key: 'referrer_reward_value', header: 'Value',       cell: r => r.referrer_reward_value ?? '—' },
  { key: 'referrer_reward_unit',  header: 'Unit',        cell: r => r.referrer_reward_unit ?? '—' },
  { key: 'status',                header: 'Status',      cell: r => <StatusBadge status={r.status} /> },
];
const TARGETING_COLS: Column<TargetingRule>[] = [
  { key: 'network_type',          header: 'Network',     cell: r => r.network_type },
  { key: 'min_network_age_days',  header: 'Min Age (d)', cell: r => r.min_network_age_days ?? '—' },
  { key: 'max_network_age_days',  header: 'Max Age (d)', cell: r => r.max_network_age_days ?? '—' },
  { key: 'block_id',              header: 'Block',       cell: r => r.block_id ?? '—' },
];
const PRODUCT_RULE_COLS: Column<ProductRule>[] = [
  { key: 'rule_type',      header: 'Type',     cell: r => r.rule_type },
  { key: 'discount_type',  header: 'Disc Type', cell: r => r.discount_type ?? '—' },
  { key: 'discount_value', header: 'Value',    cell: r => r.discount_value ?? '—' },
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
        <Tabs.Content value="coupons"><SimpleTab<Coupon> qk="coupons" ep="/coupons" cols={COUPON_COLS} headers={['coupon_code','campaign_id','global_usage_limit','max_uses_per_customer']} /></Tabs.Content>
        <Tabs.Content value="referrals"><SimpleTab<Referral> qk="referrals" ep="/referral-programs" cols={REFERRAL_COLS} headers={['name','reward_amount']} /></Tabs.Content>
        <Tabs.Content value="targeting"><SimpleTab<TargetingRule> qk="targeting-rules" ep="/targeting-rules" cols={TARGETING_COLS} headers={['campaign_id','network_type']} /></Tabs.Content>
        <Tabs.Content value="product-rules"><SimpleTab<ProductRule> qk="product-rules" ep="/product-rules" cols={PRODUCT_RULE_COLS} headers={['campaign_id','product_id','rule_type','discount_type','discount_value']} /></Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
