import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatBDT } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";
import { addDays } from "date-fns";
import { Package, RefreshCw, ScanLine, AlertTriangle } from "lucide-react";

interface Props {
  orderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const WARRANTY_DAYS: Record<string, number> = { CPE: 365, PHYSICAL_ADDON: 180, SIM: 180 };

export default function ScanToFulfillDialog({ orderId, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();

  // ── Overrides for product changes ──
  const [cpeOverride, setCpeOverride] = useState("");
  const [addonOverride, setAddonOverride] = useState("");
  const [wifiOverride, setWifiOverride] = useState("");

  // ── Asset assignment (inventory_id selections) ──
  const [selectedSim, setSelectedSim] = useState("");
  const [selectedCpe, setSelectedCpe] = useState("");
  const [selectedAddon, setSelectedAddon] = useState("");

  // ── Pricing ──
  const [priceSummary, setPriceSummary] = useState<{ hardware: number; service: number; total: number }>({ hardware: 0, service: 0, total: 0 });

  // ── Queries ──
  const { data: order } = useQuery({
    queryKey: ["fulfill_order", orderId],
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("*").eq("order_id", orderId).single();
      return data;
    },
    enabled: open,
  });

  const { data: orderItems } = useQuery({
    queryKey: ["fulfill_order_items", orderId],
    queryFn: async () => {
      const { data } = await supabase.from("order_items").select("*, products(product_id, product_name, product_category)").eq("order_id", orderId);
      return data ?? [];
    },
    enabled: open,
  });

  // All available products for dropdowns
  const { data: allProducts } = useQuery({
    queryKey: ["fulfill_products"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("product_id, product_name, product_category, addon_type").eq("status", true).order("product_name");
      return data ?? [];
    },
    enabled: open,
  });

  // Agent's sales stock
  const { data: myStock } = useQuery({
    queryKey: ["fulfill_my_stock"],
    queryFn: async () => {
      const { data } = await supabase.from("inventory_master")
        .select("*, products(product_id, product_name, product_category)")
        .eq("status", "WITH_FIELD_STAFF" as any)
        .eq("stock_type", "SALES_STOCK" as any);
      return data ?? [];
    },
    enabled: open,
  });

  // Derive original items by category
  const originalCpe = orderItems?.find((i: any) => i.products?.product_category === "CPE");
  const originalAddon = orderItems?.find((i: any) => i.products?.product_category === "ADDON" && (i.products as any)?.addon_type !== "DIGITAL");
  const originalWifi = orderItems?.find((i: any) => i.products?.product_category === "WIFI_PLAN");
  const originalDigital = orderItems?.find((i: any) => i.products?.product_category === "ADDON" && (i.products as any)?.addon_type === "DIGITAL");
  const simItem = orderItems?.find((i: any) => i.products?.product_category === "SIM");

  // Effective product IDs (original or overridden)
  const effectiveCpeId = cpeOverride || originalCpe?.product_id || "";
  const effectiveAddonId = addonOverride || originalAddon?.product_id || "";
  const effectiveWifiId = wifiOverride || originalWifi?.product_id || "";

  // Filtered stock for asset assignment
  const filteredCpeStock = useMemo(() =>
    myStock?.filter((s: any) => s.products?.product_category === "CPE" && s.product_id === effectiveCpeId) ?? [],
    [myStock, effectiveCpeId]
  );
  const filteredSimStock = useMemo(() =>
    myStock?.filter((s: any) => s.products?.product_category === "SIM") ?? [],
    [myStock]
  );
  const filteredAddonStock = useMemo(() =>
    myStock?.filter((s: any) => s.products?.product_category === "ADDON" && s.product_id === effectiveAddonId) ?? [],
    [myStock, effectiveAddonId]
  );

  // Product lists for dropdowns
  const cpeProducts = allProducts?.filter(p => p.product_category === "CPE") ?? [];
  const addonProducts = allProducts?.filter(p => p.product_category === "ADDON" && p.addon_type === "PHYSICAL") ?? [];
  const wifiProducts = allProducts?.filter(p => p.product_category === "WIFI_PLAN") ?? [];

  // ── Price resolution ──
  const resolvePrice = async (productId: string, anchorDate: Date) => {
    const dateStr = anchorDate.toISOString();
    const { data: pv } = await supabase.from("product_price_versions")
      .select("price_version_id, base_price_bdt")
      .eq("product_id", productId).eq("status", true)
      .lte("start_date", dateStr)
      .or(`end_date.is.null,end_date.gte.${dateStr}`)
      .order("start_date", { ascending: false }).limit(1);
    if (!pv?.length) return 0;
    const { data: comps } = await supabase.from("price_components")
      .select("amount_bdt").eq("price_version_id", pv[0].price_version_id);
    return (comps ?? []).reduce((s, c) => s + Number(c.amount_bdt), 0) || Number(pv[0].base_price_bdt);
  };

  // Recalculate prices when products change
  useEffect(() => {
    if (!open || !order) return;
    const calc = async () => {
      const now = new Date();
      const orderDate = new Date(order.created_at);
      let hw = 0, svc = 0;
      if (effectiveCpeId) hw += await resolvePrice(effectiveCpeId, orderDate);
      if (effectiveAddonId) hw += await resolvePrice(effectiveAddonId, orderDate);
      if (simItem?.product_id) hw += await resolvePrice(simItem.product_id, orderDate);
      if (effectiveWifiId) svc += await resolvePrice(effectiveWifiId, now);
      setPriceSummary({ hardware: hw, service: svc, total: hw + svc });
    };
    calc();
  }, [effectiveCpeId, effectiveAddonId, effectiveWifiId, open, order?.order_id]);

  // Reset selections when products change
  useEffect(() => { setSelectedCpe(""); }, [effectiveCpeId]);
  useEffect(() => { setSelectedAddon(""); }, [effectiveAddonId]);

  // ── Submit Fulfillment ──
  const submitFulfillment = useMutation({
    mutationFn: async () => {
      if (!order) throw new Error("No order data");
      if (!selectedSim && simItem) throw new Error("Select a SIM (MSISDN)");
      if (!selectedCpe && originalCpe) throw new Error("Select a CPE (IMEI)");

      const now = new Date();
      const orderDate = new Date(order.created_at);

      // Get SIM details
      let gpfiMsisdn = "";
      if (selectedSim) {
        const { data: sim } = await supabase.from("inventory_master").select("msisdn, serial_number").eq("inventory_id", selectedSim).single();
        gpfiMsisdn = sim?.msisdn || sim?.serial_number || `SIM-${Date.now()}`;
      }

      // Find/create anchor
      let anchor: any;
      const { data: existingAnchors } = await supabase.from("anchors").select("*").eq("order_id", orderId);
      if (existingAnchors?.length) {
        anchor = existingAnchors[0];
      } else {
        const { data: customers } = await supabase.from("customers").select("customer_id").eq("full_name", order.customer_name).limit(1);
        const customerId = customers?.[0]?.customer_id;
        if (!customerId) throw new Error("Customer not found");
        const { data: newAnchor, error } = await supabase.from("anchors").insert({
          customer_id: customerId, order_id: orderId, test_status: "SUCCESS" as any,
        }).select().single();
        if (error) throw error;
        anchor = newAnchor;
      }

      // ── Mark previous primary CPE as inactive (replacement/upgrade cleanup) ──
      const { data: existingCpeAssets } = await supabase.from("customer_assets")
        .select("asset_id")
        .eq("customer_id", anchor.customer_id)
        .eq("asset_type", "CPE")
        .eq("asset_status", "ACTIVE");
      if (existingCpeAssets?.length) {
        for (const old of existingCpeAssets) {
          await supabase.from("customer_assets")
            .update({ asset_status: "REPLACED" as any })
            .eq("asset_id", old.asset_id);
        }
      }

      // Helper to install an inventory item
      const installAsset = async (inventoryId: string, productId: string, assetType: string) => {
        const { data: inv } = await supabase.from("inventory_master").select("*").eq("inventory_id", inventoryId).single();
        if (!inv) return;
        // Mark as DELIVERED/INSTALLED
        await supabase.from("inventory_master").update({ status: "DELIVERED" as any }).eq("inventory_id", inventoryId);

        const warrantyDays = WARRANTY_DAYS[assetType] ?? 365;
        await supabase.from("customer_assets").insert({
          anchor_id: anchor.anchor_id,
          customer_id: anchor.customer_id,
          product_id: productId,
          serial_number: inv.serial_number || `INST-${Date.now()}`,
          mac_address: inv.mac_address || null,
          asset_type: assetType as any,
          installation_date: now.toISOString(),
          warranty_start_date: now.toISOString(),
          warranty_end_date: addDays(now, warrantyDays).toISOString(),
          asset_status: "ACTIVE" as any,
        });
      };

      // Install CPE
      if (selectedCpe && effectiveCpeId) {
        await installAsset(selectedCpe, effectiveCpeId, "CPE");
      }

      // Install SIM
      if (selectedSim && simItem) {
        await installAsset(selectedSim, simItem.product_id, "SIM");
      }

      // Install Physical Addon
      if (selectedAddon && effectiveAddonId) {
        await installAsset(selectedAddon, effectiveAddonId, "PHYSICAL_ADDON");
      }

      // Activate WiFi service
      if (effectiveWifiId) {
        const validityDays = 30;
        const expiryDate = addDays(now, validityDays + 1);
        expiryDate.setHours(23, 59, 59, 999);
        await supabase.from("active_services").insert({
          customer_id: anchor.customer_id,
          anchor_id: anchor.anchor_id,
          product_id: effectiveWifiId,
          product_category: "WIFI_PLAN",
          gpfi_msisdn: gpfiMsisdn,
          activation_date: now.toISOString(),
          validity_days: validityDays,
          expiry_date: expiryDate.toISOString(),
          service_status: "ACTIVE" as any,
        });
      }

      // Update order items with overridden products + price locks + EARNED status
      for (const item of (orderItems ?? [])) {
        const cat = item.products?.product_category ?? "";
        const isDigital = cat === "WIFI_PLAN";
        let newProductId = item.product_id;
        if (cat === "CPE" && cpeOverride) newProductId = cpeOverride;
        if (cat === "ADDON" && addonOverride) newProductId = addonOverride;
        if (cat === "WIFI_PLAN" && wifiOverride) newProductId = wifiOverride;

        const priceDate = isDigital ? now : orderDate;
        const lockedPrice = await resolvePrice(newProductId, priceDate);

        let invId: string | null = null;
        if (cat === "CPE") invId = selectedCpe || null;
        if (cat === "SIM") invId = selectedSim || null;
        if (cat === "ADDON") invId = selectedAddon || null;

        await supabase.from("order_items").update({
          product_id: newProductId,
          inventory_id: invId,
          price_anchor_type: isDigital ? "FULFILLMENT_DATE" : "REQUEST_DATE",
          price_locked_at: priceDate.toISOString(),
          locked_unit_price_bdt: lockedPrice,
          fulfillment_date: now.toISOString(),
          item_fulfillment_status: "EARNED" as any,
        } as any).eq("item_id", item.item_id);
      }

      // ── Campaign Reward Flip: PROVISIONAL → EARNED ──
      // Find any transaction_ledger entries for this order that are tied to campaigns
      const { data: ledgerEntries } = await supabase.from("transaction_ledger")
        .select("ledger_id, campaign_id").eq("order_id", orderId).not("campaign_id", "is", null);
      // For referral rewards linked to this customer
      if (anchor.customer_id) {
        await supabase.from("referral_reward_ledger")
          .update({ reward_status: "EARNED" as any, earned_at: now.toISOString() } as any)
          .eq("referee_customer_id", anchor.customer_id)
          .eq("reward_status", "PENDING");
      }

      // Update order
      await supabase.from("orders").update({
        order_status: "INSTALLED" as any,
        fulfillment_status: "EARNED" as any,
        final_total_bdt: priceSummary.total,
        price_snapshot_date: now.toISOString(),
      } as any).eq("order_id", orderId);

      // Create invoice
      await supabase.from("onetime_invoices").insert({
        customer_id: anchor.customer_id,
        trigger_type: "ACQUISITION" as any,
        charged_amount_bdt: priceSummary.total,
        payment_status: order.payment_status === "ONLINE_PAID" ? ("PAID" as any) : ("PENDING" as any),
      });

      // Link CPE to active service
      if (selectedCpe && effectiveWifiId) {
        const { data: svc } = await supabase.from("active_services")
          .select("service_id").eq("anchor_id", anchor.anchor_id).eq("service_status", "ACTIVE").limit(1);
        if (svc?.[0]) {
          await supabase.from("active_services").update({ current_cpe_inventory_id: selectedCpe }).eq("service_id", svc[0].service_id);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["field_assigned_orders"] });
      qc.invalidateQueries({ queryKey: ["field_sales_stock"] });
      toast({ title: "Fulfillment complete!", description: "Order installed, rewards earned, assets linked." });
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: "Fulfillment failed", description: e.message, variant: "destructive" }),
  });

  const productName = (id: string) => allProducts?.find(p => p.product_id === id)?.product_name ?? "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ScanLine className="h-5 w-5" /> Scan-to-Fulfill — Order</DialogTitle>
        </DialogHeader>

        {order && orderItems && (
          <div className="space-y-4">
            {/* Customer info */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted-foreground">Customer:</span> <span className="font-medium">{order.customer_name}</span></div>
              <div><span className="text-muted-foreground">Contact:</span> <span className="font-mono">{order.contact_msisdn}</span></div>
              <div><span className="text-muted-foreground">Type:</span> <Badge variant="outline">{order.customer_type}</Badge></div>
              <div><span className="text-muted-foreground">Original Total:</span> <span className="font-semibold">{formatBDT(Number(order.final_total_bdt))}</span></div>
            </div>

            <Separator />

            {/* ── Section 1: Product Selection (with override) ── */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">1. Products — Review & Override</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* CPE */}
                {originalCpe && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">CPE Model</Label>
                    <Select value={effectiveCpeId} onValueChange={setCpeOverride}>
                      <SelectTrigger><SelectValue>{productName(effectiveCpeId)}</SelectValue></SelectTrigger>
                      <SelectContent>
                        {cpeProducts.map(p => (
                          <SelectItem key={p.product_id} value={p.product_id}>{p.product_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {cpeOverride && cpeOverride !== originalCpe.product_id && (
                      <p className="text-xs text-amber-600 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Changed from {originalCpe.products?.product_name}</p>
                    )}
                  </div>
                )}

                {/* Physical Addon */}
                {originalAddon && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Physical Add-on</Label>
                    <Select value={effectiveAddonId} onValueChange={setAddonOverride}>
                      <SelectTrigger><SelectValue>{productName(effectiveAddonId)}</SelectValue></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {addonProducts.map(p => (
                          <SelectItem key={p.product_id} value={p.product_id}>{p.product_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* WiFi Plan */}
                {originalWifi && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">WiFi Plan</Label>
                    <Select value={effectiveWifiId} onValueChange={setWifiOverride}>
                      <SelectTrigger><SelectValue>{productName(effectiveWifiId)}</SelectValue></SelectTrigger>
                      <SelectContent>
                        {wifiProducts.map(p => (
                          <SelectItem key={p.product_id} value={p.product_id}>{p.product_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Digital Addon (read-only) */}
                {originalDigital && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Digital Add-on</Label>
                    <Input readOnly value={originalDigital.products?.product_name ?? "—"} className="bg-muted" />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Section 2: Asset Assignment ── */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">2. Assign Assets — From Your Sales Stock</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* SIM / MSISDN */}
                {simItem && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">SIM (MSISDN)</Label>
                    <Select value={selectedSim} onValueChange={setSelectedSim}>
                      <SelectTrigger><SelectValue placeholder="Select SIM..." /></SelectTrigger>
                      <SelectContent>
                        {filteredSimStock.length === 0 && <SelectItem value="__empty__" disabled>No SIMs in your stock</SelectItem>}
                        {filteredSimStock.map((s: any) => (
                          <SelectItem key={s.inventory_id} value={s.inventory_id}>
                            {s.msisdn || s.serial_number || "N/A"} — {s.products?.product_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* CPE / IMEI */}
                {originalCpe && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">CPE (IMEI / Serial)</Label>
                    {filteredCpeStock.length === 0 ? (
                      <p className="text-xs text-destructive">No matching CPE in your stock for {productName(effectiveCpeId)}</p>
                    ) : (
                      <Select value={selectedCpe} onValueChange={setSelectedCpe}>
                        <SelectTrigger><SelectValue placeholder="Select CPE..." /></SelectTrigger>
                        <SelectContent>
                          {filteredCpeStock.map((s: any) => (
                            <SelectItem key={s.inventory_id} value={s.inventory_id}>
                              {s.serial_number || s.mac_address || "N/A"} — {s.products?.product_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}

                {/* Physical Addon Serial */}
                {originalAddon && effectiveAddonId && effectiveAddonId !== "__none__" && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Add-on (Serial)</Label>
                    {filteredAddonStock.length === 0 ? (
                      <p className="text-xs text-destructive">No matching add-on in your stock for {productName(effectiveAddonId)}</p>
                    ) : (
                      <Select value={selectedAddon} onValueChange={setSelectedAddon}>
                        <SelectTrigger><SelectValue placeholder="Select add-on..." /></SelectTrigger>
                        <SelectContent>
                          {filteredAddonStock.map((s: any) => (
                            <SelectItem key={s.inventory_id} value={s.inventory_id}>
                              {s.serial_number || "N/A"} — {s.products?.product_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Section 3: Price Summary ── */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">3. Price Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Hardware (Request Date)</p>
                    <p className="font-semibold">{formatBDT(priceSummary.hardware)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Service (Fulfillment Date)</p>
                    <p className="font-semibold">{formatBDT(priceSummary.service)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Total Payable</p>
                    <p className="font-bold text-lg">{formatBDT(priceSummary.total)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => submitFulfillment.mutate()}
            disabled={submitFulfillment.isPending}
            className="gap-1.5"
          >
            {submitFulfillment.isPending ? <><RefreshCw className="h-4 w-4 animate-spin" /> Processing...</> : <><Package className="h-4 w-4" /> Submit Fulfillment</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
