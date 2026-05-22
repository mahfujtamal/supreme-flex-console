'use client';

import { useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { useQuery } from '@tanstack/react-query';
import { phpApi } from '@/lib/api';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { BulkActionBar } from '@/components/ui/BulkActionBar';
import { BulkImportModal } from '@/components/ui/BulkImportModal';
import { useDebounce } from '@/hooks/useDebounce';

interface AdminUser { id: string; user_name: string; email: string; role_id: string; status: string; created_at: string }
interface AdminRole { id: string; role_name: string; description: string; status: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BulkTab<T extends Record<string, any>>({
  qk, ep, cols, headers,
}: { qk: string; ep: string; cols: Column<T>[]; headers: string[] }) {
  const [page, setPage]         = useState(0);
  const [search, setSearch]     = useState('');
  const [sel, setSel]           = useState<Set<string>>(new Set());
  const [importOpen, setImport] = useState(false);
  const dSearch = useDebounce(search, 400);

  const { data, isLoading } = useQuery({
    queryKey: [qk, page, dSearch],
    queryFn: () => phpApi.get(ep, { params: { page, per_page: 20, search: dSearch } }).then(r => r.data),
  });
  const rows: T[] = Array.isArray(data) ? data : (data?.data ?? []);

  return (
    <div className="space-y-3 pt-4">
      <div className="flex gap-3">
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
        selectedCount={sel.size}
        onBulkInsert={() => setImport(true)}
        onClearSelection={() => setSel(new Set())}
      />
      <DataTable
        columns={cols}
        data={rows}
        rowKey={r => String(r.id)}
        isLoading={isLoading}
        page={page}
        totalPages={data?.last_page}
        onPageChange={setPage}
        selectedIds={sel}
        onSelectionChange={setSel}
      />
      <BulkImportModal
        open={importOpen}
        onOpenChange={setImport}
        templateHeaders={headers}
        onImport={() => {}}
      />
    </div>
  );
}

const USER_COLS: Column<AdminUser>[] = [
  { key: 'user_name',  header: 'Name',    cell: r => r.user_name },
  { key: 'email',      header: 'Email',   cell: r => r.email ?? '—' },
  { key: 'role_id',    header: 'Role',    cell: r => r.role_id ?? '—' },
  { key: 'status',     header: 'Status',  cell: r => <StatusBadge status={r.status} /> },
  { key: 'created_at', header: 'Created', cell: r => r.created_at?.slice(0, 10) },
];

const ROLE_COLS: Column<AdminRole>[] = [
  { key: 'role_name',   header: 'Role Name',   cell: r => r.role_name },
  { key: 'description', header: 'Description', cell: r => r.description ?? '—' },
  { key: 'status',      header: 'Status',      cell: r => <StatusBadge status={r.status} /> },
];

export default function GovernancePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Governance</h1>
      <Tabs.Root defaultValue="users">
        <Tabs.List className="flex gap-1 border-b">
          {['Admin Users', 'Roles'].map((label, i) => (
            <Tabs.Trigger
              key={i}
              value={['users', 'roles'][i]}
              className="px-3 py-2 text-sm text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-primary -mb-px"
            >
              {label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="users">
          <BulkTab<AdminUser>
            qk="admin-users"
            ep="/admin-users"
            cols={USER_COLS}
            headers={['user_name', 'email', 'role_id', 'status']}
          />
        </Tabs.Content>
        <Tabs.Content value="roles">
          <BulkTab<AdminRole>
            qk="admin-roles"
            ep="/admin-roles"
            cols={ROLE_COLS}
            headers={['role_name', 'description']}
          />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
