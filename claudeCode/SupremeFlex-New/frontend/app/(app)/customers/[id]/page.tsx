'use client';

import { use } from 'react';
import Link from 'next/link';
import * as Tabs from '@radix-ui/react-tabs';
import { useQuery } from '@tanstack/react-query';
import { phpApi } from '@/lib/api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DevPanel } from '@/components/ui/DevPanel';
import { ArrowLeft } from 'lucide-react';

interface Customer {
  customer_id: string;
  customer_name: string;
  contact_number: string;
  account_status: string;
  customer_type: string;
  created_at: string;
}
interface Service { service_id: string; service_type: string; status: string; subscription_date: string }
interface Anchor  { anchor_id: string; active_service_id: string; anchor_status: string; location: string; created_at: string }
interface Asset   { id: string; serial_number: string; status: string }
interface Invoice { id: string; total_amount: string; status: string; created_at: string }

interface Customer360 {
  customer: Customer;
  services: Service[];
  anchors: Anchor[];
  assets: Asset[];
  invoices: Invoice[];
}

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data, isLoading } = useQuery({
    queryKey: ['customer-360', id],
    queryFn: () => phpApi.get(`/customers/${id}/360`).then(r => r.data as Customer360),
  });

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading customer…</div>;
  if (!data)     return <div className="p-8 text-sm text-destructive">Customer not found.</div>;

  const { customer, services, anchors, assets, invoices } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/customers" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{customer.customer_name}</h1>
          <p className="text-sm text-muted-foreground">{customer.contact_number}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={customer.customer_type} />
          <StatusBadge status={customer.account_status} />
        </div>
      </div>

      {/* Per-connection tabs */}
      {anchors.length === 0 ? (
        <p className="text-sm text-muted-foreground">No connections found.</p>
      ) : (
        <Tabs.Root defaultValue={anchors[0].anchor_id}>
          <Tabs.List className="flex gap-1 border-b overflow-x-auto">
            {anchors.map((a, i) => (
              <Tabs.Trigger
                key={a.anchor_id}
                value={a.anchor_id}
                className="px-3 py-2 text-sm whitespace-nowrap text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-primary -mb-px"
              >
                Connection {i + 1}
              </Tabs.Trigger>
            ))}
          </Tabs.List>

          {anchors.map(a => {
            const linkedService = services.find(s => s.service_id === a.active_service_id);
            return (
              <Tabs.Content key={a.anchor_id} value={a.anchor_id} className="pt-4 space-y-5">
                {/* Connection details */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm border rounded-lg p-4 bg-muted/30">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Anchor ID</p>
                    <code className="text-xs">{a.anchor_id?.slice(0, 8)}…</code>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Service ID</p>
                    <code className="text-xs">{a.active_service_id?.slice(0, 8) ?? '—'}…</code>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Location</p>
                    <span>{a.location ?? '—'}</span>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Status</p>
                    <StatusBadge status={a.anchor_status} />
                  </div>
                </div>

                {/* Active service */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Active Service</p>
                  {linkedService ? (
                    <div className="flex items-center gap-3 text-sm p-3 border rounded-lg">
                      <span className="flex-1 font-medium">{linkedService.service_type}</span>
                      <StatusBadge status={linkedService.status} />
                      <span className="text-xs text-muted-foreground">{linkedService.subscription_date?.slice(0, 10)}</span>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No active service linked.</p>
                  )}
                </div>

                {/* Invoices for this connection */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Recent Invoices</p>
                  {invoices.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No invoices.</p>
                  ) : (
                    <div className="space-y-1">
                      {invoices.slice(0, 5).map(inv => (
                        <div key={inv.id} className="flex items-center gap-3 text-sm p-3 border rounded-lg">
                          <span className="flex-1 font-medium">৳{inv.total_amount}</span>
                          <StatusBadge status={inv.status ?? 'PENDING'} />
                          <span className="text-xs text-muted-foreground">{inv.created_at?.slice(0, 10)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Tabs.Content>
            );
          })}
        </Tabs.Root>
      )}

      {/* Assets */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Assets</p>
        {assets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No assets.</p>
        ) : (
          <div className="space-y-1">
            {assets.map(a => (
              <div key={a.id} className="flex items-center gap-3 text-sm p-3 border rounded-lg">
                <code className="flex-1 text-xs">{a.serial_number}</code>
                <StatusBadge status={a.status} />
              </div>
            ))}
          </div>
        )}
      </div>

      <DevPanel />
    </div>
  );
}
