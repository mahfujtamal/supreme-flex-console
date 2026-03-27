import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Package, ScanLine, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

export default function FieldExecutionDashboard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [scanOpen, setScanOpen] = useState(false);
  const [serialInput, setSerialInput] = useState("");

  // Sales stock assigned to field staff
  const { data: salesStock } = useQuery({
    queryKey: ["field_sales_stock"],
    queryFn: async () => {
      const { data } = await supabase.from("inventory_master").select("*, products(product_name, product_category)")
        .eq("status", "WITH_FIELD_STAFF" as any).order("created_at", { ascending: false }).limit(50);
      return data ?? [];
    },
  });

  // Pending incoming transfers for field staff
  const { data: pendingIncoming } = useQuery({
    queryKey: ["field_pending_incoming"],
    queryFn: async () => {
      const { data } = await supabase.from("stock_transfers").select("*, inventory_master(serial_number, products(product_name))")
        .in("to_entity_type", ["KAM", "AGENT"])
        .eq("transfer_status", "PENDING" as any).order("requested_at", { ascending: false });
      return data ?? [];
    },
  });

  // Scan to fulfill - look up inventory by serial and mark as DELIVERED + EARNED
  const scanFulfill = useMutation({
    mutationFn: async () => {
      const { data: inv, error: findErr } = await supabase.from("inventory_master")
        .select("inventory_id, status")
        .eq("serial_number", serialInput.trim())
        .eq("status", "WITH_FIELD_STAFF" as any)
        .maybeSingle();
      if (findErr) throw findErr;
      if (!inv) throw new Error(`No item found with serial "${serialInput}" in your sales stock`);

      const { error } = await supabase.from("inventory_master")
        .update({ status: "DELIVERED" } as any)
        .eq("inventory_id", inv.inventory_id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["field_sales_stock"] });
      toast({ title: "Fulfillment confirmed!", description: `Serial ${serialInput} marked as DELIVERED` });
      setSerialInput("");
      setScanOpen(false);
    },
    onError: (e: Error) => toast({ title: "Scan Failed", description: e.message, variant: "destructive" }),
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
          <p className="text-sm text-muted-foreground">Your sales stock and scan-to-fulfill tool</p>
        </div>
        <Button onClick={() => setScanOpen(true)}>
          <ScanLine className="h-4 w-4 mr-1.5" /> Scan to Fulfill
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sales Stock</CardTitle>
            <Package className="h-4 w-4 text-blue-500" />
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

      {/* Scan to Fulfill Dialog */}
      <Dialog open={scanOpen} onOpenChange={setScanOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ScanLine className="h-5 w-5" /> Scan to Fulfill</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Enter the serial number or IMEI of the device being installed at the customer site.</p>
            <div className="space-y-2">
              <Label>Serial / IMEI</Label>
              <Input value={serialInput} onChange={(e) => setSerialInput(e.target.value)} placeholder="Scan or type serial number..." autoFocus />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScanOpen(false)}>Cancel</Button>
            <Button onClick={() => scanFulfill.mutate()} disabled={!serialInput.trim() || scanFulfill.isPending}>
              {scanFulfill.isPending ? "Processing..." : "Confirm Fulfillment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
