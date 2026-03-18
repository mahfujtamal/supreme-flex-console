import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Truck, Settings2 } from "lucide-react";
import { formatBDT } from "@/lib/currency";
import { toast } from "sonner";
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

const OrderDispatchTab = () => {
  const queryClient = useQueryClient();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
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
              <TableHead>DH/KAM</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead>Sales Agent</TableHead>
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
            ) : orders.map((order: any) => (
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
                <TableCell>{order.assigned_dh_kam_id ?? "—"}</TableCell>
                <TableCell>{order.assigned_agent_id ?? "—"}</TableCell>
                <TableCell className="text-right font-medium">{formatBDT(Number(order.final_total_bdt))}</TableCell>
                <TableCell className="text-center">
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => setSelectedOrderId(order.order_id)}>
                    <Settings2 className="h-3.5 w-3.5" /> Manage
                  </Button>
                </TableCell>
              </TableRow>
            ))}
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
