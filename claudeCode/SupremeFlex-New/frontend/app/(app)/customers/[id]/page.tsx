'use client';

import { use } from 'react';
import Link from 'next/link';
import * as Tabs from '@radix-ui/react-tabs';
import { useQuery } from '@tanstack/react-query';
import { phpApi } from '@/lib/api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DevPanel } from '@/components/ui/DevPanel';
import { ArrowLeft } from 'lucide-react';

interface Customer { customer_id: string; full_name: string; primary_contact_number: string; account_status: string; customer_type: string; created_at: string }
interface Service  { service_id: string; service_type: string; status: string; subscription_date: string }
interface Anchor   { anchor_id: string; active_service_id: string; anchor_status: string; location: string; created_at: string }
interface Asset    { id: string; serial_number: string; status: string; product_name: string }
interface Invoice  { id: string; total_amount: string; status: string; created_at: string; anchor_id: string | null }
interface AddonOrder     { id: string; addon_product_id: string; status: string; activated_at: string | null; anchor_id: string }
interface OttOrder       { id: string; ott_product_id: string; status: string; activated_at: string | null; anchor_id: string }
interface CpeOrder       { id: string; old_cpe_serial: string | null; new_cpe_serial: string | null; status: string; completed_at: string | null; anchor_id: string }
interface LocationChange  { id: string; new_area_id: string; status: string; completed_at: string | null; created_at: string; anchor_id: string }
interface RealIp          { id: string; ip_address: string; status: string; assigned_at: string; anchor_id: string }

interface Customer360 {
  customer: Customer;
  services: Service[];
  anchors: Anchor[];
  assets: Asset[];
  invoices: Invoice[];
  addonOrders: AddonOrder[];
  ottOrders: OttOrder[];
  cpeOrders: CpeOrder[];
  locationChanges: LocationChange[];
  realIps: RealIp[];
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{title}</p>
      {children}
    </div>
  );
}

function EmptyRow({ label }: { label: string }) {
  return <p className="text-sm text-muted-foreground">No {label}.</p>;
}

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data, isLoading } = useQuery({
    queryKey: ['customer-360', id],
    queryFn: () => phpApi.get(`/customers/${id}/360`).then(r => r.data as Customer360),
  });

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading customer…</div>;
  if (!data)     return <div className="p-8 text-sm text-destructive">Customer not found.</div>;

  const { customer, services, anchors, assets, invoices, addonOrders, ottOrders, cpeOrders, locationChanges, realIps } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/customers" className="text-muted-foreground hover:text-foreground"><ArrowLeft size={16} /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{customer.full_name}</h1>
          <p className="text-sm text-muted-foreground">{customer.primary_contact_number}</p>
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
              <Tabs.Trigger key={a.anchor_id} value={a.anchor_id} className="px-3 py-2 text-sm whitespace-nowrap text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-primary -mb-px">
                Connection {i + 1}
              </Tabs.Trigger>
            ))}
          </Tabs.List>

          {anchors.map(a => {
            const linkedService    = services.find(s => s.service_id === a.active_service_id);
            const anchorInvoices   = invoices.filter(x => x.anchor_id === a.anchor_id);
            const anchorAddons     = addonOrders.filter(x => x.anchor_id === a.anchor_id);
            const anchorOtt        = ottOrders.filter(x => x.anchor_id === a.anchor_id);
            const anchorCpe        = cpeOrders.filter(x => x.anchor_id === a.anchor_id);
            const anchorLocChanges = locationChanges.filter(x => x.anchor_id === a.anchor_id);
            const anchorRealIps    = realIps.filter(x => x.anchor_id === a.anchor_id);

            return (
              <Tabs.Content key={a.anchor_id} value={a.anchor_id} className="pt-4 space-y-5">
                {/* Connection details grid */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm border rounded-lg p-4 bg-muted/30">
                  <div><p className="text-xs text-muted-foreground mb-0.5">Anchor ID</p><code className="text-xs">{a.anchor_id?.slice(0, 8)}…</code></div>
                  <div><p className="text-xs text-muted-foreground mb-0.5">Service ID</p><code className="text-xs">{a.active_service_id?.slice(0, 8) ?? '—'}…</code></div>
                  <div><p className="text-xs text-muted-foreground mb-0.5">Location</p><span>{a.location ?? '—'}</span></div>
                  <div><p className="text-xs text-muted-foreground mb-0.5">Status</p><StatusBadge status={a.anchor_status} /></div>
                </div>

                <Section title="Active Service">
                  {linkedService ? (
                    <div className="flex items-center gap-3 text-sm p-3 border rounded-lg">
                      <span className="flex-1 font-medium">{linkedService.service_type}</span>
                      <StatusBadge status={linkedService.status} />
                      <span className="text-xs text-muted-foreground">{linkedService.subscription_date?.slice(0, 10)}</span>
                    </div>
                  ) : <EmptyRow label="active service" />}
                </Section>

                <Section title="Recent Invoices">
                  {anchorInvoices.length === 0 ? <EmptyRow label="invoices" /> : (
                    <div className="space-y-1">
                      {anchorInvoices.slice(0, 5).map(inv => (
                        <div key={inv.id} className="flex items-center gap-3 text-sm p-3 border rounded-lg">
                          <span className="flex-1 font-medium">৳{inv.total_amount}</span>
                          <StatusBadge status={inv.status ?? 'PENDING'} />
                          <span className="text-xs text-muted-foreground">{inv.created_at?.slice(0, 10)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Section>

                <Section title="Addon Orders">
                  {anchorAddons.length === 0 ? <EmptyRow label="addon orders" /> : (
                    <div className="space-y-1">
                      {anchorAddons.map(o => (
                        <div key={o.id} className="flex items-center gap-3 text-sm p-3 border rounded-lg">
                          <code className="flex-1 text-xs">{o.addon_product_id?.slice(0, 8)}…</code>
                          <StatusBadge status={o.status} />
                          <span className="text-xs text-muted-foreground">{o.activated_at?.slice(0, 10) ?? '—'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Section>

                <Section title="OTT Orders">
                  {anchorOtt.length === 0 ? <EmptyRow label="OTT orders" /> : (
                    <div className="space-y-1">
                      {anchorOtt.map(o => (
                        <div key={o.id} className="flex items-center gap-3 text-sm p-3 border rounded-lg">
                          <code className="flex-1 text-xs">{o.ott_product_id?.slice(0, 8)}…</code>
                          <StatusBadge status={o.status} />
                          <span className="text-xs text-muted-foreground">{o.activated_at?.slice(0, 10) ?? '—'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Section>

                <Section title="CPE History">
                  {anchorCpe.length === 0 ? <EmptyRow label="CPE swaps" /> : (
                    <div className="space-y-1">
                      {anchorCpe.map(c => (
                        <div key={c.id} className="flex items-center gap-3 text-sm p-3 border rounded-lg">
                          <span className="flex-1 font-mono text-xs">{c.old_cpe_serial ?? '—'} → {c.new_cpe_serial ?? '—'}</span>
                          <StatusBadge status={c.status} />
                          <span className="text-xs text-muted-foreground">{c.completed_at?.slice(0, 10) ?? '—'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Section>

                <Section title="Location Changes">
                  {anchorLocChanges.length === 0 ? <EmptyRow label="location changes" /> : (
                    <div className="space-y-1">
                      {anchorLocChanges.map(l => (
                        <div key={l.id} className="flex items-center gap-3 text-sm p-3 border rounded-lg">
                          <code className="flex-1 text-xs">→ Area {l.new_area_id?.slice(0, 8)}…</code>
                          <StatusBadge status={l.status} />
                          <span className="text-xs text-muted-foreground">{l.created_at?.slice(0, 10)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Section>

                <Section title="Real IP">
                  {anchorRealIps.length === 0 ? <EmptyRow label="Real IP assignments" /> : (
                    <div className="space-y-1">
                      {anchorRealIps.map(ip => (
                        <div key={ip.id} className="flex items-center gap-3 text-sm p-3 border rounded-lg">
                          <code className="flex-1 font-mono">{ip.ip_address}</code>
                          <StatusBadge status={ip.status} />
                          <span className="text-xs text-muted-foreground">{ip.assigned_at?.slice(0, 10)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Section>
              </Tabs.Content>
            );
          })}
        </Tabs.Root>
      )}

      {/* Assets (cross-connection) */}
      <Section title="Assets">
        {assets.length === 0 ? <EmptyRow label="assets" /> : (
          <div className="space-y-1">
            {assets.map(a => (
              <div key={a.id} className="flex items-center gap-3 text-sm p-3 border rounded-lg">
                <code className="flex-1 text-xs">{a.serial_number}</code>
                <span className="text-xs text-muted-foreground">{a.product_name}</span>
                <StatusBadge status={a.status} />
              </div>
            ))}
          </div>
        )}
      </Section>

      <DevPanel />
    </div>
  );
}
