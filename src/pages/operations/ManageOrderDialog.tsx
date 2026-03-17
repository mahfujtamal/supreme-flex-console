import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatBDT } from "@/lib/currency";
import { toast } from "sonner";
import { useState, useEffect } from "react";

interface Props {
  orderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ManageOrderDialog = ({ orderId, open, onOpenChange }: Props) => {
  const queryClient = useQueryClient();
  const [dhKamId, setDhKamId] = useState("");
  const [agentId, setAgentId] = useState("");

  const { data: order } = useQuery({
    queryKey: ["order", orderId],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*").eq("order_id", orderId).single();
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: orderItems } = useQuery({
    queryKey: ["order_items", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("*, products(product_name, product_category)")
        .eq("order_id", orderId);
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch available inventory for physical items (WITH_AGENT or ALLOCATED_TO_DH)
  const { data: availableInventory } = useQuery({
    queryKey: ["available_inventory_for_order"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_master")
        .select("*, products(product_name)")
        .in("status", ["WITH_AGENT", "ALLOCATED_TO_DH"]);
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  useEffect(() => {
    if (order) {
      setDhKamId(order.assigned_dh_kam_id ?? "");
      setAgentId(order.assigned_agent_id ?? "");
    }
  }, [order]);

  const assignMutation = useMutation({
    mutationFn: async () => {
      const updates: any = {
        assigned_dh_kam_id: dhKamId || null,
        assigned_agent_id: agentId || null,
      };
      if (dhKamId || agentId) {
        updates.order_status = "OUT_FOR_DELIVERY";
      }
      const { error } = await supabase.from("orders").update(updates).eq("order_id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      toast.success("Order assignment updated!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const linkInventoryMutation = useMutation({
    mutationFn: async ({ itemId, inventoryId }: { itemId: string; inventoryId: string }) => {
      // Link inventory to order item
      const { error: itemErr } = await supabase
        .from("order_items")
        .update({ inventory_id: inventoryId })
        .eq("item_id", itemId);
      if (itemErr) throw itemErr;
      // Update inventory status to DELIVERED
      const { error: invErr } = await supabase
        .from("inventory_master")
        .update({ status: "DELIVERED" as any })
        .eq("inventory_id", inventoryId);
      if (invErr) throw invErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order_items", orderId] });
      queryClient.invalidateQueries({ queryKey: ["available_inventory_for_order"] });
      toast.success("Inventory item linked to order!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const isPhysical = (category: string) => ["CPE", "SIM"].includes(category);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Order</DialogTitle>
          <DialogDescription>Assign dispatch agents and link inventory items</DialogDescription>
        </DialogHeader>

        {order && (
          <div className="space-y-5">
            {/* Customer Details */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Customer:</span> <span className="font-medium">{order.customer_name}</span></div>
              <div><span className="text-muted-foreground">Contact:</span> <span className="font-mono">{order.contact_msisdn}</span></div>
              <div><span className="text-muted-foreground">Type:</span> <Badge variant="outline">{order.customer_type}</Badge></div>
              <div><span className="text-muted-foreground">Total:</span> <span className="font-semibold">{formatBDT(Number(order.final_total_bdt))}</span></div>
            </div>

            <Separator />

            {/* Assignment */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Dispatch Assignment</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>DH/KAM ID</Label>
                  <Input value={dhKamId} onChange={(e) => setDhKamId(e.target.value)} placeholder="Enter DH or KAM ID" />
                </div>
                <div className="space-y-1.5">
                  <Label>Field Agent ID</Label>
                  <Input value={agentId} onChange={(e) => setAgentId(e.target.value)} placeholder="Enter Agent ID" />
                </div>
              </div>
              <Button size="sm" onClick={() => assignMutation.mutate()} disabled={assignMutation.isPending}>
                {assignMutation.isPending ? "Saving…" : "Save Assignment & Dispatch"}
              </Button>
            </div>

            <Separator />

            {/* Order Items + Field Delivery */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Order Line Items — Field Delivery</h4>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead>Assign Inventory</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!orderItems?.length ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">No line items</TableCell></TableRow>
                    ) : orderItems.map((item: any) => {
                      const cat = item.products?.product_category ?? "";
                      const needsPhysical = isPhysical(cat);
                      const matchingInventory = availableInventory?.filter((inv: any) => inv.product_id === item.product_id) ?? [];

                      return (
                        <TableRow key={item.item_id}>
                          <TableCell className="font-medium">{item.products?.product_name ?? "—"}</TableCell>
                          <TableCell><Badge variant="outline">{cat}</Badge></TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell className="text-right">{formatBDT(Number(item.unit_price_bdt))}</TableCell>
                          <TableCell>
                            {item.inventory_id ? (
                              <Badge className="bg-green-100 text-green-800">Linked</Badge>
                            ) : needsPhysical ? (
                              <Select onValueChange={(invId) => linkInventoryMutation.mutate({ itemId: item.item_id, inventoryId: invId })}>
                                <SelectTrigger className="w-[200px] h-8 text-xs">
                                  <SelectValue placeholder="Select item…" />
                                </SelectTrigger>
                                <SelectContent>
                                  {!matchingInventory.length ? (
                                    <SelectItem value="__none" disabled>No available items</SelectItem>
                                  ) : matchingInventory.map((inv: any) => (
                                    <SelectItem key={inv.inventory_id} value={inv.inventory_id}>
                                      {inv.serial_number ?? inv.mac_address ?? inv.msisdn ?? "N/A"} — {inv.status.replace(/_/g, " ")}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-xs text-muted-foreground">N/A (Digital)</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ManageOrderDialog;
