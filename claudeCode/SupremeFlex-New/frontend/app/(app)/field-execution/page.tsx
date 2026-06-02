'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { nodeApi } from '@/lib/api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface Lead {
  order_id: string;
  customer_id: string;
  order_status: string;
  fulfillment_status: string;
  assigned_agent_id: string;
  created_at: string;
  accessories: { product_id: string; quantity: number }[];
}

const NEXT_STATUSES: Record<string, string[]> = {
  PENDING:          ['OUT_FOR_DELIVERY'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED'],
};

const STATUS_FILTERS = ['', 'PENDING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED'];

export default function FieldExecutionPage() {
  const qc = useQueryClient();
  const [statusFilter, setFilter] = useState('PENDING');
  const [pending, setPending]     = useState<{ id: string; next: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['field-execution/leads', statusFilter],
    queryFn: () =>
      nodeApi.get('/field-execution/leads', {
        params: { ...(statusFilter && { status: statusFilter }), per_page: 50 },
      }).then(r => r.data),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, order_status }: { id: string; order_status: string }) =>
      nodeApi.patch(`/field-execution/leads/${id}/status`, { order_status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['field-execution/leads'] });
      setPending(null);
    },
  });

  const leads: Lead[] = Array.isArray(data) ? data : (data?.items ?? []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Field Execution</h1>

      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={[
              'px-3 py-1 rounded-full text-sm border transition-colors',
              statusFilter === s
                ? 'bg-primary text-primary-foreground border-primary'
                : 'text-muted-foreground hover:bg-muted border-border',
            ].join(' ')}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading leads…</p>
      ) : leads.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No leads found.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {leads.map(lead => {
            const nextStatuses = NEXT_STATUSES[lead.order_status] ?? [];
            const accCount = lead.accessories?.filter(Boolean).length ?? 0;
            return (
              <div key={lead.order_id} className="border rounded-lg p-4 space-y-2 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-2">
                  <code className="text-xs text-muted-foreground">{lead.order_id?.slice(0, 8)}…</code>
                  <StatusBadge status={lead.order_status} />
                </div>
                <p className="text-sm font-medium">
                  Customer: <span className="font-mono">{lead.customer_id?.slice(0, 8) ?? '—'}</span>
                </p>
                {accCount > 0 && (
                  <p className="text-xs text-muted-foreground">{accCount} accessory item{accCount > 1 ? 's' : ''}</p>
                )}
                <p className="text-xs text-muted-foreground">{lead.created_at?.slice(0, 10)}</p>
                {nextStatuses.length > 0 && (
                  <div className="flex gap-2 pt-1 border-t">
                    {nextStatuses.map(next => (
                      <button
                        key={next}
                        onClick={() => setPending({ id: lead.order_id, next })}
                        className="px-2 py-1 text-xs rounded border hover:bg-muted transition-colors"
                      >
                        → {next.replace(/_/g, ' ')}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!pending}
        onOpenChange={open => { if (!open) setPending(null); }}
        title="Update Status"
        description={`Move order to ${pending?.next?.replace(/_/g, ' ')}?`}
        confirmLabel="Confirm"
        onConfirm={() => pending && updateStatus.mutate({ id: pending.id, order_status: pending.next })}
      />
    </div>
  );
}
