import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Package, ScanLine, CheckCircle2, AlertCircle, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { formatBDT } from "@/lib/currency";
import ScanToFulfillDialog from "./ScanToFulfillDialog";

export default function FieldExecutionDashboard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [fulfillOrderId, setFulfillOrderId] = useState<string | null>(null);

  // Assigned orders awaiting fulfillment
  const { data: assignedOrders } = useQuery({
    queryKey: ["field_assigned_orders"],
    queryFn: async () => {
      const { data } = await supabase.from("orders")
        .select("*, order_items(item_id, products(product_name, product_category))")
        .in("order_status", ["ASSIGNED", "CONTACTED", "OUT_FOR_DELIVERY", "NETWORK_TEST"] as any[])
        .order("created_at", { ascending: false }).limit(50);
      return data ?? [];
    },
  });

  // Sales stock assigned to field staff
  const { data: salesStock } = useQuery({
    queryKey: ["field_sales_stock"],
    queryFn: async () => {
      const { data } = await supabase.from("inventory_master")
        .select("*, products(product_name, product_category)")
        .eq("status", "WITH_FIELD_STAFF" as any)
        .order("created_at", { ascending: false }).limit(50);
      return data ?? [];
    },
  });

  // Pending incoming transfers
  const { data: pendingIncoming } = useQuery({
    queryKey: ["field_pending_incoming"],
    queryFn: async () => {
      const { data } = await supabase.from("stock_transfers")
        .select("*, inventory_master(serial_number, products(product_name))")
        .in("to_entity_type", ["KAM", "AGENT"])
        .eq("transfer_status", "PENDING" as any)
        .order("requested_at", { ascending: false });
      return data ?? [];
    },
  });

  const acceptTransfer = useMutation({
    mutationFn: async (transferId: string) => {
      const transfer = pendingIncoming?.find((t: any) => t.transfer_id === transferId);
      if (!transfer) throw new Error("Transfer not found");
      const { error } = await supabase.from("stock_transfers")
        .update({ transfer_status: "ACCEPTED" as any, responded_at: new Date().toISOString() })
        .eq("transfer_id", transferId);
      if (error) throw error;
      await supabase.from("inventory_master")
        .update({ status: "WITH_FIELD_STAFF" as any, stock_type: "SALES_STOCK" as any } as any)
        .eq("inventory_id", transfer.inventory_id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["field_pending_incoming"] });
      qc.invalidateQueries({ queryKey: ["field_sales_stock"] });
      toast({ title: "Transfer accepted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Field Execution Dashboard</h1>
          <p className="text-sm text-muted-foreground">Your orders, sales stock, and scan-to-fulfill tool</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Orders</CardTitle>
            <ClipboardList className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{assignedOrders?.length ?? 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sales Stock</CardTitle>
            <Package className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{salesStock?.length ?? 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Accepts</CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{pendingIncoming?.length ?? 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Installed Today</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">—</p></CardContent>
        </Card>
      </div>

      {/* Pending incoming transfers */}
      {(pendingIncoming?.length ?? 0) > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><AlertCircle className="h-4 w-4 text-amber-500" /> Incoming Transfers — Accept Required</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Serial</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead className="w-[100px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingIncoming?.map((t: any) => (
                  <TableRow key={t.transfer_id}>
                    <TableCell className="font-medium text-sm">{(t as any).inventory_master?.products?.product_name ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{(t as any).inventory_master?.serial_number ?? "—"}</TableCell>
                    <TableCell className="text-sm">{t.from_entity_type}</TableCell>
                    <TableCell>
                      <Button size="sm" onClick={() => acceptTransfer.mutate(t.transfer_id)}>Accept</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Assigned Orders — Scan to Fulfill */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><ScanLine className="h-4 w-4" /> Assigned Orders — Scan to Fulfill</CardTitle>
          <CardDescription>Open an order to assign assets, change products, and submit fulfillment</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Total</TableHead>
                <TableHead className="w-[120px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!assignedOrders?.length ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No pending orders assigned to you.</TableCell></TableRow>
              ) : assignedOrders.map((o: any) => (
                <TableRow key={o.order_id}>
                  <TableCell className="font-medium">{o.customer_name}</TableCell>
                  <TableCell className="font-mono text-xs">{o.contact_msisdn}</TableCell>
                  <TableCell><Badge variant="outline">{o.customer_type}</Badge></TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs">{o.order_status}</Badge></TableCell>
                  <TableCell className="font-semibold">{formatBDT(Number(o.final_total_bdt))}</TableCell>
                  <TableCell>
                    <Button size="sm" onClick={() => setFulfillOrderId(o.order_id)} className="gap-1">
                      <ScanLine className="h-3.5 w-3.5" /> Fulfill
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Sales stock */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your Sales Stock</CardTitle>
          <CardDescription>Items assigned to you for customer fulfillment</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Serial</TableHead>
                <TableHead>MAC</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!salesStock?.length ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No sales stock assigned.</TableCell></TableRow>
              ) : salesStock.map((item: any) => (
                <TableRow key={item.inventory_id}>
                  <TableCell className="font-medium">{(item as any).products?.product_name ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{item.item_type}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{item.serial_number ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{item.mac_address ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Scan-to-Fulfill Dialog */}
      {fulfillOrderId && (
        <ScanToFulfillDialog
          orderId={fulfillOrderId}
          open={!!fulfillOrderId}
          onOpenChange={(open) => { if (!open) setFulfillOrderId(null); }}
        />
      )}
    </div>
  );
}
