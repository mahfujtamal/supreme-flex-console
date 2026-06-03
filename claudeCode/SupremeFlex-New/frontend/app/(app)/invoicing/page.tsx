'use client';

import { useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { phpApi } from '@/lib/api';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Receipt, type LucideIcon } from 'lucide-react';
import { PageHero } from '@/components/ui/PageHero';
import { SkeletonRows } from '@/components/ui/SkeletonRows';
import { EmptyState } from '@/components/ui/EmptyState';
import { useDebounce } from '@/hooks/useDebounce';

interface Invoice { id: string; customer_id: string; total_amount: string; status: string; created_at: string; is_summary: string }
interface Ledger  { id: string; customer_id: string; amount: string; transaction_type: string; created_at: string }

const INV_COLS: Column<Invoice>[] = [
  { key: 'customer_id',  header: 'Customer', cell: r => r.customer_id },
  { key: 'total_amount', header: 'Amount',   cell: r => `৳${r.total_amount}` },
  { key: 'is_summary',   header: 'Type',     cell: r => r.is_summary === '1' ? 'Summary' : 'Line' },
  { key: 'status',       header: 'Status',   cell: r => <StatusBadge status={r.status ?? 'PENDING'} /> },
  { key: 'created_at',   header: 'Date',     cell: r => r.created_at?.slice(0, 10) },
];
const LED_COLS: Column<Ledger>[] = [
  { key: 'customer_id',      header: 'Customer', cell: r => r.customer_id },
  { key: 'amount',           header: 'Amount',   cell: r => `৳${r.amount}` },
  { key: 'transaction_type', header: 'Type',     cell: r => r.transaction_type },
  { key: 'created_at',       header: 'Date',     cell: r => r.created_at?.slice(0, 10) },
];

function PagedTab<T extends { id: string }>({ qk, ep, cols }: { qk: string; ep: string; cols: Column<T>[] }) {
  const [page, setPage]     = useState(0);
  const [search, setSearch] = useState('');
  const dSearch = useDebounce(search, 400);
  const { data, isLoading } = useQuery({
    queryKey: [qk, page, dSearch],
    queryFn: () => phpApi.get(ep, { params: { page, per_page: 20, search: dSearch } }).then(r => r.data),
  });
  const rows: T[] = Array.isArray(data) ? data : (data?.items ?? []);
  return (
    <div className="space-y-3 pt-4">
      <input className="border rounded px-3 py-1.5 text-sm w-64" placeholder="Search…" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
      {isLoading ? (
      <SkeletonRows />
    ) : rows.length === 0 ? (
      <EmptyState icon={Receipt} heading="No records found" />
    ) : (
      <DataTable columns={cols} data={rows} rowKey={r => r.id} isLoading={false} page={page} totalPages={data?.last_page} onPageChange={setPage} />
    )}
    </div>
  );
}

function SummaryInvoiceGenerator() {
  const qc = useQueryClient();
  const [customerId, setCustomerId] = useState('');
  const [done, setDone] = useState(false);

  const generate = useMutation({
    mutationFn: () => phpApi.post('/invoices', { customer_id: customerId, is_summary: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      setCustomerId('');
      setDone(true);
    },
  });

  return (
    <div className="pt-4 max-w-md space-y-4">
      <p className="text-sm text-muted-foreground">
        Generates a summary invoice aggregating all line items for the given customer.
        Summary rows leave anchor/service fields null per billing rules.
      </p>
      {done && (
        <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800">
          Summary invoice created successfully.
        </div>
      )}
      <div className="flex gap-2">
        <input
          className="border rounded px-3 py-1.5 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-primary/30"
          placeholder="Customer ID"
          value={customerId}
          onChange={e => { setCustomerId(e.target.value); setDone(false); }}
        />
        <button
          onClick={() => generate.mutate()}
          disabled={!customerId.trim() || generate.isPending}
          className="px-4 py-1.5 bg-primary text-primary-foreground rounded text-sm hover:opacity-90 disabled:opacity-40"
        >
          {generate.isPending ? 'Generating…' : 'Generate'}
        </button>
      </div>
    </div>
  );
}

const TABS = ['Invoices', 'Transaction Ledger', 'Generate Summary'];
const TAB_VALUES = ['invoices', 'ledger', 'generate'];

export default function InvoicingPage() {
  return (
    <div className="space-y-4">
      <PageHero title="Invoicing" subtitle="Invoices, transaction ledger and summary generation" />
      <Tabs.Root defaultValue="invoices">
        <Tabs.List className="flex gap-1 border-b">
          {TABS.map((label, i) => (
            <Tabs.Trigger key={i} value={TAB_VALUES[i]} className="px-3 py-2 text-sm text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-primary -mb-px">{label}</Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="invoices"><PagedTab<Invoice> qk="invoices" ep="/invoices" cols={INV_COLS} /></Tabs.Content>
        <Tabs.Content value="ledger"><PagedTab<Ledger> qk="ledger" ep="/transaction-ledger" cols={LED_COLS} /></Tabs.Content>
        <Tabs.Content value="generate"><SummaryInvoiceGenerator /></Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
