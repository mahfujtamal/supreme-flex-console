import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, isBefore } from "date-fns";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User, Wifi, MapPin, Anchor, CheckCircle, XCircle, Clock,
  HardDrive, ShieldCheck, ShieldX, History, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

interface Customer360DialogProps {
  customerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function calculateExpiryDate(activationDate: string, validityDays: number, productCategory: string): Date {
  const activation = new Date(activationDate);
  const extraDays = productCategory === "WIFI_PLAN" ? validityDays + 1 : validityDays;
  return addDays(activation, extraDays);
}

const WARRANTY_DAYS: Record<string, number> = { CPE: 365, PHYSICAL_ADDON: 180, SIM: 180 };

const testStatusConfig: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
  SUCCESS: { icon: CheckCircle, color: "text-green-600", label: "Success" },
  FAIL: { icon: XCircle, color: "text-red-600", label: "Failed" },
  PENDING: { icon: Clock, color: "text-amber-600", label: "Pending" },
};

export function Customer360Dialog({ customerId, open, onOpenChange }: Customer360DialogProps) {
  const queryClient = useQueryClient();
  const [historyAssetId, setHistoryAssetId] = useState<string | null>(null);
  const [replaceAssetId, setReplaceAssetId] = useState<string | null>(null);
  const [replaceNewInvId, setReplaceNewInvId] = useState("");
  const [replaceReason, setReplaceReason] = useState<"WARRANTY" | "PAID" | "UPGRADE">("WARRANTY");

  const { data: customer } = useQuery({
    queryKey: ["customer", customerId],
    queryFn: async () => {
      if (!customerId) return null;
      const { data, error } = await supabase.from("customers").select("*").eq("customer_id", customerId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!customerId,
  });

  const { data: anchors } = useQuery({
    queryKey: ["customer_anchors", customerId],
    queryFn: async () => {
      if (!customerId) return [];
      const { data, error } = await supabase.from("anchors").select("*").eq("customer_id", customerId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!customerId,
  });

  const { data: services } = useQuery({
    queryKey: ["active_services", customerId],
    queryFn: async () => {
      if (!customerId) return [];
      const { data, error } = await supabase.from("active_services").select("*").eq("customer_id", customerId).order("activation_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!customerId,
  });

  const { data: assets } = useQuery({
    queryKey: ["customer_assets", customerId],
    queryFn: async () => {
      if (!customerId) return [];
      const { data, error } = await supabase
        .from("customer_assets")
        .select("*, products(product_name, warranty_value, warranty_unit)")
        .eq("customer_id", customerId)
        .order("installation_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!customerId,
  });

  // Replacement history for a specific asset
  const { data: replacementHistory } = useQuery({
    queryKey: ["asset_replacement_history", historyAssetId],
    queryFn: async () => {
      if (!historyAssetId) return [];
      const { data, error } = await supabase
        .from("asset_replacement_history")
        .select("*")
        .or(`old_asset_id.eq.${historyAssetId},new_asset_id.eq.${historyAssetId}`)
        .order("replaced_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!historyAssetId,
  });

  // Available CPE inventory for replacement
  const { data: availableCpeInventory } = useQuery({
    queryKey: ["available_cpe_inventory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_master")
        .select("*, products(product_name)")
        .eq("item_type", "CPE")
        .in("status", ["WITH_AGENT", "ALLOCATED_TO_DH", "IN_WAREHOUSE"]);
      if (error) throw error;
      return data;
    },
    enabled: !!replaceAssetId,
  });

  // Replace mutation
  const replaceMutation = useMutation({
    mutationFn: async () => {
      if (!replaceAssetId || !replaceNewInvId || !customerId) throw new Error("Missing fields");

      const oldAsset = assets?.find((a: any) => a.asset_id === replaceAssetId) as any;
      if (!oldAsset) throw new Error("Asset not found");

      // Mark old asset as REPLACED
      const { error: oldErr } = await supabase
        .from("customer_assets")
        .update({ asset_status: "REPLACED" as any })
        .eq("asset_id", replaceAssetId);
      if (oldErr) throw oldErr;

      // Get new inventory
      const { data: newInv, error: invErr } = await supabase
        .from("inventory_master")
        .select("*")
        .eq("inventory_id", replaceNewInvId)
        .single();
      if (invErr) throw invErr;

      const installDate = new Date();
      const warrantyDays = WARRANTY_DAYS[oldAsset.asset_type] || 365;
      const warrantyEnd = addDays(installDate, warrantyDays);

      // Create new asset
      const { data: newAsset, error: createErr } = await supabase
        .from("customer_assets")
        .insert({
          anchor_id: oldAsset.anchor_id,
          customer_id: customerId,
          product_id: newInv.product_id,
          serial_number: newInv.serial_number || `RPL-${Date.now()}`,
          mac_address: newInv.mac_address || null,
          asset_type: oldAsset.asset_type,
          installation_date: installDate.toISOString(),
          warranty_start_date: installDate.toISOString(),
          warranty_end_date: warrantyEnd.toISOString(),
          asset_status: "ACTIVE" as any,
        })
        .select()
        .single();
      if (createErr) throw createErr;

      // Log replacement history
      const { error: histErr } = await supabase.from("asset_replacement_history").insert({
        old_asset_id: replaceAssetId,
        new_asset_id: newAsset.asset_id,
        anchor_id: oldAsset.anchor_id,
        reason: replaceReason as any,
        charge_amount_bdt: replaceReason === "WARRANTY" ? 0 : 0,
      });
      if (histErr) throw histErr;

      // Mark inventory as DELIVERED
      await supabase.from("inventory_master").update({ status: "DELIVERED" as any }).eq("inventory_id", replaceNewInvId);

      // Create CPE_CHANGE invoice
      await supabase.from("onetime_invoices").insert({
        customer_id: customerId,
        trigger_type: "CPE_CHANGE" as any,
        charged_amount_bdt: replaceReason === "WARRANTY" ? 0 : 0,
        payment_status: replaceReason === "WARRANTY" ? ("PAID" as any) : ("PENDING" as any),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer_assets", customerId] });
      queryClient.invalidateQueries({ queryKey: ["all_customer_assets"] });
      queryClient.invalidateQueries({ queryKey: ["onetime_invoices"] });
      setReplaceAssetId(null);
      setReplaceNewInvId("");
      toast.success("Asset replaced successfully!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const statusColor: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-800",
    EXPIRED: "bg-amber-100 text-amber-800",
    CHURNED: "bg-red-100 text-red-800",
    SUSPENDED: "bg-orange-100 text-orange-800",
    REPLACED: "bg-slate-100 text-slate-800",
    RETURNED: "bg-blue-100 text-blue-800",
    DEFECTIVE: "bg-red-100 text-red-800",
  };

  const servicesByAnchor: Record<string, any[]> = {};
  (services || []).forEach((s) => {
    if (s.anchor_id) {
      if (!servicesByAnchor[s.anchor_id]) servicesByAnchor[s.anchor_id] = [];
      servicesByAnchor[s.anchor_id].push(s);
    }
  });

  const assetsByAnchor: Record<string, any[]> = {};
  (assets || []).forEach((a: any) => {
    if (a.anchor_id) {
      if (!assetsByAnchor[a.anchor_id]) assetsByAnchor[a.anchor_id] = [];
      assetsByAnchor[a.anchor_id].push(a);
    }
  });

  const now = new Date();
  const historyAsset = assets?.find((a: any) => a.asset_id === historyAssetId) as any;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" /> Customer 360 — Lifecycle View
            </DialogTitle>
          </DialogHeader>

          {customer && (
            <div className="space-y-6">
              {/* Profile Summary */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4" /> Profile Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Full Name</p>
                      <p className="font-medium">{customer.full_name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Primary Contact</p>
                      <p className="font-mono font-medium">{customer.primary_contact_number}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Type</p>
                      <Badge variant="outline">{customer.customer_type}</Badge>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Account Status</p>
                      <Badge className={statusColor[customer.account_status] || ""} variant="secondary">
                        {customer.account_status}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Tabs defaultValue="anchors" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="anchors" className="flex items-center gap-1">
                    <Anchor className="h-3.5 w-3.5" /> Anchors/Orders
                  </TabsTrigger>
                  <TabsTrigger value="services" className="flex items-center gap-1">
                    <Wifi className="h-3.5 w-3.5" /> Service Details
                  </TabsTrigger>
                  <TabsTrigger value="assets" className="flex items-center gap-1">
                    <HardDrive className="h-3.5 w-3.5" /> Physical Assets
                  </TabsTrigger>
                  <TabsTrigger value="network" className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> Network Info
                  </TabsTrigger>
                </TabsList>

                {/* Tab A: Anchors */}
                <TabsContent value="anchors" className="mt-4">
                  <Card>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Anchor ID</TableHead>
                            <TableHead>Order ID</TableHead>
                            <TableHead>Test Status</TableHead>
                            <TableHead>Service</TableHead>
                            <TableHead>Assets</TableHead>
                            <TableHead>Created</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {!anchors?.length ? (
                            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-4">No anchors found</TableCell></TableRow>
                          ) : anchors.map((a) => {
                            const cfg = testStatusConfig[a.test_status] || testStatusConfig.PENDING;
                            const Icon = cfg.icon;
                            const hasService = (servicesByAnchor[a.anchor_id]?.length || 0) > 0;
                            const assetCount = assetsByAnchor[a.anchor_id]?.length || 0;
                            return (
                              <TableRow key={a.anchor_id}>
                                <TableCell className="font-mono text-xs">{a.anchor_id.slice(0, 8)}…</TableCell>
                                <TableCell className="font-mono text-xs">{a.order_id ? `${a.order_id.slice(0, 8)}…` : "—"}</TableCell>
                                <TableCell>
                                  <span className={`flex items-center gap-1 text-sm ${cfg.color}`}><Icon className="h-4 w-4" /> {cfg.label}</span>
                                </TableCell>
                                <TableCell>
                                  {a.test_status === "SUCCESS" && hasService ? (
                                    <Badge className="bg-green-100 text-green-800" variant="secondary">View Service</Badge>
                                  ) : a.test_status === "SUCCESS" ? (
                                    <span className="text-xs text-muted-foreground">Awaiting activation</span>
                                  ) : <span className="text-xs text-muted-foreground">—</span>}
                                </TableCell>
                                <TableCell>
                                  {assetCount > 0 ? <Badge variant="outline">{assetCount} asset{assetCount > 1 ? "s" : ""}</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">{format(new Date(a.created_at), "dd MMM yyyy")}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tab B: Services */}
                <TabsContent value="services" className="mt-4">
                  <Card>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>GPFI MSISDN</TableHead>
                            <TableHead>Plan ID</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Activation</TableHead>
                            <TableHead>Expiry (Calc.)</TableHead>
                            <TableHead>CPE Model</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {!services?.length ? (
                            <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-4">No active services</TableCell></TableRow>
                          ) : services.map((s) => {
                            const calcExpiry = calculateExpiryDate(s.activation_date, s.validity_days, s.product_category);
                            return (
                              <TableRow key={s.service_id}>
                                <TableCell className="font-mono text-sm font-medium">{s.gpfi_msisdn || "—"}</TableCell>
                                <TableCell className="font-mono text-xs">{s.product_id}</TableCell>
                                <TableCell><Badge variant="outline" className="text-xs">{s.product_category}</Badge></TableCell>
                                <TableCell className="text-sm">{format(new Date(s.activation_date), "dd MMM yyyy")}</TableCell>
                                <TableCell className="text-sm">
                                  {format(calcExpiry, "dd MMM yyyy")}
                                  {s.product_category === "WIFI_PLAN" && <span className="text-xs text-muted-foreground ml-1">(+1d)</span>}
                                </TableCell>
                                <TableCell className="text-sm">{s.cpe_model || "—"}</TableCell>
                                <TableCell><Badge className={statusColor[s.service_status] || ""} variant="secondary">{s.service_status}</Badge></TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tab C: Physical Assets */}
                <TabsContent value="assets" className="mt-4">
                  <Card>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Serial Number</TableHead>
                            <TableHead>MAC Address</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Product</TableHead>
                            <TableHead>Installation</TableHead>
                            <TableHead>Warranty</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {!assets?.length ? (
                            <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-4">No physical assets found</TableCell></TableRow>
                          ) : assets.map((a: any) => {
                            const warrantyEnd = a.warranty_end_date ? new Date(a.warranty_end_date) : null;
                            const inWarranty = warrantyEnd ? isBefore(now, warrantyEnd) : false;
                            return (
                              <TableRow key={a.asset_id}>
                                <TableCell className="font-mono text-sm font-medium">{a.serial_number}</TableCell>
                                <TableCell className="font-mono text-xs">{a.mac_address || "—"}</TableCell>
                                <TableCell><Badge variant="outline" className="text-xs">{a.asset_type}</Badge></TableCell>
                                <TableCell className="text-sm">{a.products?.product_name || "—"}</TableCell>
                                <TableCell className="text-sm">{format(new Date(a.installation_date), "dd MMM yyyy")}</TableCell>
                                <TableCell>
                                  {warrantyEnd ? (
                                    inWarranty ? (
                                      <Badge className="bg-green-100 text-green-800" variant="secondary"><ShieldCheck className="h-3 w-3 mr-1" /> IN WARRANTY</Badge>
                                    ) : (
                                      <Badge className="bg-red-100 text-red-800" variant="secondary"><ShieldX className="h-3 w-3 mr-1" /> EXPIRED</Badge>
                                    )
                                  ) : <span className="text-xs text-muted-foreground">N/A</span>}
                                </TableCell>
                                <TableCell><Badge className={statusColor[a.asset_status] || ""} variant="secondary">{a.asset_status}</Badge></TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setHistoryAssetId(a.asset_id)}>
                                      <History className="h-3.5 w-3.5 mr-1" /> History
                                    </Button>
                                    {a.asset_status === "ACTIVE" && a.asset_type === "CPE" && (
                                      <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setReplaceAssetId(a.asset_id)}>
                                        <RefreshCw className="h-3.5 w-3.5 mr-1" /> Replace
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tab D: Network Info */}
                <TabsContent value="network" className="mt-4">
                  <Card>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Anchor ID</TableHead>
                            <TableHead>Network Zone</TableHead>
                            <TableHead>District</TableHead>
                            <TableHead>Area</TableHead>
                            <TableHead>Location TAC</TableHead>
                            <TableHead>Coordinates</TableHead>
                            <TableHead>Test Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {!anchors?.length ? (
                            <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-4">No network info available</TableCell></TableRow>
                          ) : anchors.map((a) => {
                            const cfg = testStatusConfig[a.test_status] || testStatusConfig.PENDING;
                            const Icon = cfg.icon;
                            return (
                              <TableRow key={a.anchor_id}>
                                <TableCell className="font-mono text-xs">{a.anchor_id.slice(0, 8)}…</TableCell>
                                <TableCell>{a.network_zone || "—"}</TableCell>
                                <TableCell>{a.district || "—"}</TableCell>
                                <TableCell>{a.area || "—"}</TableCell>
                                <TableCell className="font-mono text-sm">{a.location_tac || "—"}</TableCell>
                                <TableCell className="font-mono text-xs">{a.coordinates || "—"}</TableCell>
                                <TableCell>
                                  <span className={`flex items-center gap-1 text-sm ${cfg.color}`}><Icon className="h-4 w-4" /> {cfg.label}</span>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Asset History Dialog */}
      <Dialog open={!!historyAssetId} onOpenChange={(o) => { if (!o) setHistoryAssetId(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" /> Asset Timeline
            </DialogTitle>
            <DialogDescription>
              Serial: {historyAsset?.serial_number || "—"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {historyAsset && (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Original Installation</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(historyAsset.installation_date), "dd MMM yyyy, HH:mm")}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Warranty Period</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(historyAsset.warranty_start_date), "dd MMM yyyy")} → {historyAsset.warranty_end_date ? format(new Date(historyAsset.warranty_end_date), "dd MMM yyyy") : "N/A"}
                    </p>
                  </div>
                </div>
                <Separator />
                <p className="text-sm font-semibold">Replacement History</p>
                {!replacementHistory?.length ? (
                  <p className="text-xs text-muted-foreground">No replacements recorded</p>
                ) : replacementHistory.map((r: any) => (
                  <div key={r.replacement_id} className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-amber-500 mt-2 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">
                        {r.old_asset_id === historyAssetId ? "Replaced by new asset" : "Replaced old asset"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Reason: <Badge variant="outline" className="text-xs ml-1">{r.reason}</Badge>
                        {" · "}Charge: BDT {r.charge_amount_bdt}
                        {" · "}{format(new Date(r.replaced_at), "dd MMM yyyy, HH:mm")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Replace Asset Dialog */}
      <Dialog open={!!replaceAssetId} onOpenChange={(o) => { if (!o) { setReplaceAssetId(null); setReplaceNewInvId(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" /> Replace CPE Asset
            </DialogTitle>
            <DialogDescription>
              Old serial: {assets?.find((a: any) => a.asset_id === replaceAssetId)?.serial_number || "—"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Replacement Reason</Label>
              <Select value={replaceReason} onValueChange={(v) => setReplaceReason(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="WARRANTY">WARRANTY (BDT 0)</SelectItem>
                  <SelectItem value="PAID">PAID</SelectItem>
                  <SelectItem value="UPGRADE">UPGRADE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>New CPE from Inventory</Label>
              <Select value={replaceNewInvId} onValueChange={setReplaceNewInvId}>
                <SelectTrigger><SelectValue placeholder="Select new CPE…" /></SelectTrigger>
                <SelectContent>
                  {!availableCpeInventory?.length ? (
                    <SelectItem value="__none" disabled>No CPE available</SelectItem>
                  ) : availableCpeInventory.map((inv: any) => (
                    <SelectItem key={inv.inventory_id} value={inv.inventory_id}>
                      {inv.serial_number ?? inv.mac_address ?? "N/A"} — {inv.products?.product_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => replaceMutation.mutate()}
              disabled={replaceMutation.isPending || !replaceNewInvId}
              className="w-full"
            >
              {replaceMutation.isPending ? "Processing…" : "Execute Replacement"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
