'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { phpApi } from '@/lib/api';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';

interface PriceVersion {
  id: string;
  product_id: string;
  price: string;
  status: string;
  effective_from: string;
  notes: string;
}

const COLS: Column<PriceVersion>[] = [
  { key: 'product_id',     header: 'Product',        cell: r => r.product_id },
  { key: 'price',          header: 'Price (BDT)',    cell: r => r.price },
  { key: 'effective_from', header: 'Effective From', cell: r => r.effective_from?.slice(0, 10) },
  { key: 'status',         header: 'Status',         cell: r => <StatusBadge status={r.status} /> },
  { key: 'notes',          header: 'Notes',          cell: r => r.notes ?? '—' },
];

export default function PricingEnginePage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const [form, setForm] = useState({ product_id: '', price: '', effective_from: '', notes: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['pricing', page],
    queryFn: () => phpApi.get('/pricing', { params: { page, per_page: 20 } }).then(r => r.data),
  });

  const addVersion = useMutation({
    mutationFn: () => phpApi.post('/price-versions', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pricing'] });
      setForm({ product_id: '', price: '', effective_from: '', notes: '' });
    },
  });

  const rows: PriceVersion[] = Array.isArray(data) ? data : (data?.data ?? []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Pricing Engine</h1>

      <section className="border rounded-lg p-4 space-y-3">
        <h2 className="font-semibold text-sm">Add Price Version</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <input className="border rounded px-3 py-1.5 text-sm" placeholder="Product ID" value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))} />
          <input className="border rounded px-3 py-1.5 text-sm" placeholder="Price (BDT)" type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
          <input className="border rounded px-3 py-1.5 text-sm" type="date" value={form.effective_from} onChange={e => setForm(f => ({ ...f, effective_from: e.target.value }))} />
          <input className="border rounded px-3 py-1.5 text-sm" placeholder="Notes (optional)" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
        <button
          onClick={() => addVersion.mutate()}
          disabled={!form.product_id || !form.price || !form.effective_from || addVersion.isPending}
          className="px-4 py-1.5 bg-primary text-primary-foreground rounded text-sm hover:opacity-90 disabled:opacity-40"
        >
          {addVersion.isPending ? 'Adding…' : 'Add Version'}
        </button>
      </section>

      <DataTable columns={COLS} data={rows} rowKey={r => r.id} isLoading={isLoading} page={page} totalPages={data?.last_page} onPageChange={setPage} />
    </div>
  );
}
