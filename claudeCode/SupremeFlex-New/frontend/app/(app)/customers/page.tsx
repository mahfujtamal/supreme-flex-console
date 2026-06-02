'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { phpApi } from '@/lib/api';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { BulkActionBar } from '@/components/ui/BulkActionBar';
import { useDebounce } from '@/hooks/useDebounce';

interface Customer {
  id: string;
  name: string;
  contact_number: string;
  account_status: string;
  customer_type: string;
  created_at: string;
}

const COLS: Column<Customer>[] = [
  { key: 'name',           header: 'Name',   cell: r => <Link href={`/customers/${r.id}`} className="text-blue-600 hover:underline">{r.name}</Link> },
  { key: 'contact_number', header: 'Mobile', cell: r => r.contact_number },
  { key: 'customer_type',  header: 'Type',   cell: r => <StatusBadge status={r.customer_type} /> },
  { key: 'account_status', header: 'Status', cell: r => <StatusBadge status={r.account_status} /> },
  { key: 'created_at',     header: 'Joined', cell: r => r.created_at?.slice(0, 10) },
];

export default function CustomersPage() {
  const [page, setPage]     = useState(0);
  const [search, setSearch] = useState('');
  const [sel, setSel]       = useState<Set<string>>(new Set());
  const dSearch = useDebounce(search, 400);

  const { data, isLoading } = useQuery({
    queryKey: ['customers', page, dSearch],
    queryFn: () => phpApi.get('/customers', { params: { page, per_page: 20, search: dSearch } }).then(r => r.data),
  });
  const rows: Customer[] = Array.isArray(data) ? data : (data?.items ?? []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Customers</h1>
      <input className="border rounded px-3 py-1.5 text-sm w-64" placeholder="Search by name or mobile…" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
      <BulkActionBar selectedCount={sel.size} onClearSelection={() => setSel(new Set())} />
      <DataTable columns={COLS} data={rows} rowKey={r => r.id} isLoading={isLoading} page={page} totalPages={data?.last_page} onPageChange={setPage} selectedIds={sel} onSelectionChange={setSel} />
    </div>
  );
}
