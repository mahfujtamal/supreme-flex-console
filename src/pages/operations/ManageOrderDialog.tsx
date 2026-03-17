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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBDT } from "@/lib/currency";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { addDays } from "date-fns";
import { RefreshCw } from "lucide-react";

interface Props {
  orderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const WARRANTY_DAYS: Record<string, number> = {
  CPE: 365,
  PHYSICAL_ADDON: 180,
  SIM: 180,
};

const ManageOrderDialog = ({ orderId, open, onOpenChange }: Props) => {
  const queryClient = useQueryClient();
  const [dhKamId, setDhKamId] = useState("");
  const [agentId, setAgentId] = useState("");

  // Replacement state
  const [replacementAnchorId, setReplacementAnchorId] = useState("");
  const [replacementNewInventoryId, setReplacementNewInventoryId] = useState("");
  const [replacementType, setReplacementType] = useState<"WARRANTY" | "PAID">("WARRANTY");

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

  const { data: availableInventory } = useQuery({
    queryKey: ["available_inventory_for_order"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_master")
        .select("*, products(product_name, product_category)")
        .in("status", ["WITH_AGENT", "ALLOCATED_TO_DH"]);
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch active CPE assets for this order's anchors (for replacement)
  const { data: activeAssets } = useQuery({
    queryKey: ["active_cpe_assets_for_order", orderId],
    queryFn: async () => {
      // Get anchors linked to this order
      const { data: anchors, error: aErr } = await supabase
        .from("anchors")
        .select("anchor_id")
        .eq("order_id", orderId);
      if (aErr) throw aErr;
      if (!anchors?.length) return [];
      const anchorIds = anchors.map((a) => a.anchor_id);
      const { data, error } = await supabase
        .from("customer_assets")
        .select("*, products(product_name)")
        .in("anchor_id", anchorIds)
        .eq("asset_status", "ACTIVE")
        .eq("asset_type", "CPE");
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
      const { error: itemErr } = await supabase
        .from("order_items")
        .update({ inventory_id: inventoryId })
        .eq("item_id", itemId);
      if (itemErr) throw itemErr;
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

  // Asset Replacement mutation
  const replacementMutation = useMutation({
    mutationFn: async () => {
      if (!replacementAnchorId || !replacementNewInventoryId) throw new Error("Select anchor and new inventory");

      // Find the current active CPE for this anchor
      const { data: currentAsset, error: findErr } = await supabase
        .from("customer_assets")
        .select("*")
        .eq("anchor_id", replacementAnchorId)
        .eq("asset_type", "CPE")
        .eq("asset_status", "ACTIVE")
        .single();
      if (findErr) throw new Error("No active CPE found for this anchor");

      // Mark old asset as REPLACED
      const { error: oldErr } = await supabase
        .from("customer_assets")
        .update({ asset_status: "REPLACED" as any })
        .eq("asset_id", currentAsset.asset_id);
      if (oldErr) throw oldErr;

      // Get new inventory details
      const { data: newInv, error: invErr } = await supabase
        .from("inventory_master")
        .select("*, products(product_name)")
        .eq("inventory_id", replacementNewInventoryId)
        .single();
      if (invErr) throw invErr;

      const installDate = new Date();
      const warrantyDays = WARRANTY_DAYS["CPE"];
      const warrantyEnd = addDays(installDate, warrantyDays);

      // Create new asset record
      const { error: createErr } = await supabase.from("customer_assets").insert({
        anchor_id: replacementAnchorId,
        customer_id: currentAsset.customer_id,
        product_id: newInv.product_id,
        serial_number: newInv.serial_number || `RPL-${Date.now()}`,
        mac_address: newInv.mac_address || null,
        asset_type: "CPE" as any,
        installation_date: installDate.toISOString(),
        warranty_start_date: installDate.toISOString(),
        warranty_end_date: warrantyEnd.toISOString(),
        asset_status: "ACTIVE" as any,
      });
      if (createErr) throw createErr;

      // Mark inventory as delivered
      const { error: invUpErr } = await supabase
        .from("inventory_master")
        .update({ status: "DELIVERED" as any })
        .eq("inventory_id", replacementNewInventoryId);
      if (invUpErr) throw invUpErr;

      // Create invoice: WARRANTY = 0 charge, PAID = needs amount
      const chargeAmount = replacementType === "WARRANTY" ? 0 : 0; // Paid amount could be set via input; for now 0
      const { error: invoiceErr } = await supabase.from("onetime_invoices").insert({
        customer_id: currentAsset.customer_id,
        trigger_type: "CPE_CHANGE" as any,
        charged_amount_bdt: chargeAmount,
        payment_status: replacementType === "WARRANTY" ? ("PAID" as any) : ("PENDING" as any),
      });
      if (invoiceErr) throw invoiceErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active_cpe_assets_for_order"] });
      queryClient.invalidateQueries({ queryKey: ["customer_assets"] });
      queryClient.invalidateQueries({ queryKey: ["available_inventory_for_order"] });
      queryClient.invalidateQueries({ queryKey: ["onetime_invoices"] });
      setReplacementAnchorId("");
      setReplacementNewInventoryId("");
      toast.success("Asset replacement completed!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const isPhysical = (category: string) => ["CPE", "SIM"].includes(category);

  const cpeInventory = availableInventory?.filter((inv: any) =>
    inv.products?.product_category === "CPE"
  ) ?? [];

  const anchorIds = activeAssets?.map((a: any) => a.anchor_id) ?? [];
  const uniqueAnchors = [...new Set(anchorIds)];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Order</DialogTitle>
          <DialogDescription>Assign dispatch agents, link inventory, and manage asset replacements</DialogDescription>
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

            <Separator />

            {/* Asset Replacement */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" /> CPE Asset Replacement
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!activeAssets?.length ? (
                  <p className="text-sm text-muted-foreground">No active CPE assets linked to this order's anchors.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <Label>Current CPE (by Anchor)</Label>
                        <Select value={replacementAnchorId} onValueChange={setReplacementAnchorId}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Select anchor…" />
                          </SelectTrigger>
                          <SelectContent>
                            {uniqueAnchors.map((ancId) => {
                              const asset = activeAssets?.find((a: any) => a.anchor_id === ancId);
                              return (
                                <SelectItem key={ancId} value={ancId}>
                                  {(asset as any)?.serial_number || ancId.slice(0, 8)} — {(asset as any)?.products?.product_name || "CPE"}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Replacement Type</Label>
                        <Select value={replacementType} onValueChange={(v) => setReplacementType(v as "WARRANTY" | "PAID")}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="WARRANTY">WARRANTY (BDT 0)</SelectItem>
                            <SelectItem value="PAID">PAID</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>New CPE Inventory</Label>
                        <Select value={replacementNewInventoryId} onValueChange={setReplacementNewInventoryId}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Select new CPE…" />
                          </SelectTrigger>
                          <SelectContent>
                            {!cpeInventory.length ? (
                              <SelectItem value="__none" disabled>No CPE available</SelectItem>
                            ) : cpeInventory.map((inv: any) => (
                              <SelectItem key={inv.inventory_id} value={inv.inventory_id}>
                                {inv.serial_number ?? inv.mac_address ?? "N/A"} — {inv.products?.product_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => replacementMutation.mutate()}
                      disabled={replacementMutation.isPending || !replacementAnchorId || !replacementNewInventoryId}
                    >
                      {replacementMutation.isPending ? "Processing…" : "Execute Replacement"}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ManageOrderDialog;
