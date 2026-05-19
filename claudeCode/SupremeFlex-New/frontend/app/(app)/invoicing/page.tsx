'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { phpApi } from '@/lib/api';

export default function InvoicingPage() {
  const [page, setPage]     = useState(0);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', page, search],
    queryFn: () =>
      phpApi.get('/invoices', { params: { page, per_page: 20, search } })
        .then(r => r.data),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Invoicing</h1>
      <input
        className="border rounded px-3 py-1.5 text-sm w-64"
        placeholder="Search..."
        value={search}
        onChange={e => { setSearch(e.target.value); setPage(0); }}
      />
      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading...</p>
      ) : (
        <pre className="text-xs bg-muted p-4 rounded overflow-auto max-h-96">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
      <div className="flex gap-2">
        <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
        <span className="text-sm py-1">Page {page + 1}</span>
        <button onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm">Next</button>
      </div>
    </div>
  );
}
