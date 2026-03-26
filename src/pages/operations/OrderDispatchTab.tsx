import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Truck, Settings2, CheckCircle2, Package, Wallet, Zap } from "lucide-react";
import { formatBDT } from "@/lib/currency";
import ManageOrderDialog from "./ManageOrderDialog";

const orderStatusColors: Record<string, string> = {
  PENDING_DISPATCH: "bg-amber-100 text-amber-800",
  ASSIGNED: "bg-blue-100 text-blue-800",
  CONTACTED: "bg-indigo-100 text-indigo-800",
  OUT_FOR_DELIVERY: "bg-purple-100 text-purple-800",
  NETWORK_TEST: "bg-cyan-100 text-cyan-800",
  INSTALLED: "bg-green-100 text-green-800",
  ACTIVE: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
};

const paymentStatusColors: Record<string, string> = {
  PENDING_COD: "bg-amber-100 text-amber-800",
  PAID_COD: "bg-green-100 text-green-800",
  ONLINE_PAID: "bg-blue-100 text-blue-800",
};

const fulfillmentStatusConfig: Record<string, { label: string; color: string; icon: any }> = {
  PAID_AWAITING_INSTALLATION: { label: "Paid ✅ → Install Pending", color: "bg-amber-100 text-amber-800", icon: Package },
  PROVISIONAL: { label: "Provisional", color: "bg-blue-100 text-blue-800", icon: Wallet },
  EARNED: { label: "Service Activated 💰", color: "bg-emerald-100 text-emerald-800", icon: Zap },
  CANCELLED: { label: "Cancelled", color: "bg-red-100 text-red-800", icon: Package },
  REFUNDED: { label: "Refunded", color: "bg-red-100 text-red-800", icon: Wallet },
};

const FulfillmentStatusBar = ({ status, paymentStatus }: { status: string | null; paymentStatus: string }) => {
  const steps = [
    { key: "paid", label: "Order Placed / Hardware Paid", icon: CheckCircle2, done: true },
    { key: "install", label: "Install Pending", icon: Package, done: status === "EARNED" },
    { key: "activated", label: "Service Activated / Plan Price Set", icon: Zap, done: status === "EARNED" },
  ];
  const isPaid = paymentStatus === "ONLINE_PAID" || paymentStatus === "PAID_COD";

  return (
    <div className="flex items-center gap-1 text-xs">
      {steps.map((step, i) => {
        const done = step.key === "paid" ? isPaid : step.done;
        return (
          <div key={step.key} className="flex items-center gap-1">
            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded ${done ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
              <step.icon className="h-3 w-3" />
              {done ? "✅" : "📦"}
            </span>
            {i < steps.length - 1 && <span className="text-muted-foreground">→</span>}
          </div>
        );
      })}
    </div>
  );
};

const OrderDispatchTab = () => {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, channels(channel_name), sub_channels(sub_channel_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Lookup staff users for display
  const { data: staffLookup } = useQuery({
    queryKey: ["staff_lookup_for_orders"],
    queryFn: async () => {
      const { data } = await supabase.from("sub_channel_users").select("id, user_name, employee_id");
      return data ?? [];
    },
  });

  // KAM lookup
  const { data: kamLookup } = useQuery({
    queryKey: ["kam_lookup_for_orders"],
    queryFn: async () => {
      const { data } = await supabase.from("kams").select("kam_id, name");
      return data ?? [];
    },
  });

  const getAttribution = (order: any) => {
    const channelName = order.channels?.channel_name;
    const subChannelName = order.sub_channels?.sub_channel_name;
    const staffUser = order.staff_user_id ? staffLookup?.find((s: any) => s.id === order.staff_user_id) : null;

    if (order.customer_type === "B2B") {
      const kam = kamLookup?.find((k: any) => k.kam_id === order.assigned_dh_kam_id);
      return {
        channel: channelName ?? "B2B",
        store: kam ? `${kam.kam_id} — ${kam.name}` : subChannelName ?? "—",
        staff: kam ? kam.name : "—",
      };
    }
    return {
      channel: channelName ?? "—",
      store: subChannelName ?? "—",
      staff: staffUser ? `${staffUser.employee_id} — ${staffUser.user_name}` : "—",
    };
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Order Status</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Fulfillment</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Store / KAM</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : !orders?.length ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                <Truck className="h-8 w-8 mx-auto mb-2 opacity-50" />No orders found
              </TableCell></TableRow>
            ) : orders.map((order: any) => {
              const attr = getAttribution(order);
              const fStatus = (order as any).fulfillment_status;
              const fConfig = fulfillmentStatusConfig[fStatus] ?? null;
              return (
                <TableRow key={order.order_id}>
                  <TableCell className="font-medium">{order.customer_name}</TableCell>
                  <TableCell className="font-mono text-xs">{order.contact_msisdn}</TableCell>
                  <TableCell><Badge variant="outline">{order.customer_type}</Badge></TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${orderStatusColors[order.order_status] ?? ""}`}>
                      {order.order_status.replace(/_/g, " ")}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${paymentStatusColors[order.payment_status] ?? ""}`}>
                      {order.payment_status.replace(/_/g, " ")}
                    </span>
                  </TableCell>
                  <TableCell>
                    {fConfig ? (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${fConfig.color}`}>
                        <fConfig.icon className="h-3 w-3" />{fConfig.label}
                      </span>
                    ) : (
                      <FulfillmentStatusBar status={fStatus} paymentStatus={order.payment_status} />
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{attr.channel}</TableCell>
                  <TableCell className="text-xs">{attr.store}</TableCell>
                  <TableCell className="text-right font-medium">{formatBDT(Number(order.final_total_bdt))}</TableCell>
                  <TableCell className="text-center">
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => setSelectedOrderId(order.order_id)}>
                      <Settings2 className="h-3.5 w-3.5" /> Manage
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {selectedOrderId && (
        <ManageOrderDialog
          orderId={selectedOrderId}
          open={!!selectedOrderId}
          onOpenChange={(open) => { if (!open) setSelectedOrderId(null); }}
        />
      )}
    </div>
  );
};

export default OrderDispatchTab;
