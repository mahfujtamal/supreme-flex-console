import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Check, X, Send, Package, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

/*
  Custody Chain:
  Level 1: GPFI Manager → Hub Manager (DH / B2B / Sub-Channel DD)
  Level 2: Hub Manager → Last-mile staff
    - DH Hub Manager  → DH Agent (Field Agent)
    - B2B Hub Manager  → KAM
    - Sub-Channel User → DD Rider
*/

type FromType = "GPFI_MANAGER" | "HUB_MANAGER";

const FROM_OPTIONS: { value: FromType; label: string }[] = [
  { value: "GPFI_MANAGER", label: "GPFI Sales Manager" },
  { value: "HUB_MANAGER", label: "Hub Manager" },
];

export default function StockTransfersPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [transferOpen, setTransferOpen] = useState(false);

  // From state
  const [fromEntityType, setFromEntityType] = useState<FromType>("GPFI_MANAGER");
  const [fromEntityId, setFromEntityId] = useState("");

  // To state
  const [toEntityType, setToEntityType] = useState("");
  const [toEntityId, setToEntityId] = useState("");

  const [selectedInventoryIds, setSelectedInventoryIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  // ─── Lookups ───
  const { data: hubManagers } = useQuery({
    queryKey: ["hub_managers_lookup"],
    queryFn: async () => {
      const { data } = await supabase
        .from("hub_managers")
        .select("hub_manager_id, name, channel_id, sub_channel_id, dh_id, channels(channel_name)")
        .eq("status", "ACTIVE");
      return data ?? [];
    },
  });

  const { data: agents } = useQuery({
    queryKey: ["field_agents_lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("field_agents").select("agent_id, agent_name, dh_id").eq("status", "ACTIVE");
      return data ?? [];
    },
  });

  const { data: kams } = useQuery({
    queryKey: ["kams_lookup_transfers"],
    queryFn: async () => {
      const { data } = await supabase.from("kams").select("kam_id, name, hub_manager_id").eq("status", "ACTIVE");
      return data ?? [];
    },
  });

  // Sub-Channel Users with DD flag — used both as "from" (managers) and "to" (riders)
  const { data: subChannelUsers } = useQuery({
    queryKey: ["sub_channel_users_lookup"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sub_channel_users")
        .select("id, user_name, employee_id, msisdn, role, sub_channel_id, sub_channels(sub_channel_name, is_direct_delivery)")
        .eq("status", "ACTIVE");
      return (data ?? []).filter((u: any) => u.sub_channels?.is_direct_delivery === true);
    },
  });

  const ddRiders = useMemo(
    () => subChannelUsers?.filter((u: any) => u.role === "Agent" || u.role === "Rider") ?? [],
    [subChannelUsers]
  );

  // ─── Stock queries based on from-entity ───
  const { data: availableStock, isLoading: stockLoading } = useQuery({
    queryKey: ["transfer_stock", fromEntityType, fromEntityId],
    queryFn: async () => {
      let q = supabase.from("inventory_master").select("*, products(product_name, product_category)").order("created_at", { ascending: false });

      if (fromEntityType === "GPFI_MANAGER") {
        q = q.in("status", ["IN_GPFI_STAGING", "IN_WAREHOUSE"] as any);
      } else if (fromEntityType === "HUB_MANAGER" && fromEntityId) {
        q = q.eq("allocated_entity_id", fromEntityId).eq("status", "WITH_HUB_MANAGER" as any);
      } else {
        return [];
      }

      const { data } = await q;
      return data ?? [];
    },
    enabled: fromEntityType === "GPFI_MANAGER" || !!fromEntityId,
  });

  // Pending & history
  const { data: pendingTransfers } = useQuery({
    queryKey: ["pending_transfers"],
    queryFn: async () => {
      const { data } = await supabase.from("stock_transfers").select("*, inventory_master(serial_number, products(product_name))")
        .eq("transfer_status", "PENDING" as any).order("requested_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: allTransfers } = useQuery({
    queryKey: ["all_transfers"],
    queryFn: async () => {
      const { data } = await supabase.from("stock_transfers").select("*, inventory_master(serial_number, products(product_name))")
        .order("created_at", { ascending: false }).limit(50);
      return data ?? [];
    },
  });

  // ─── Allowed "To" options based on "From" ───
  const toOptions = useMemo(() => {
    if (fromEntityType === "GPFI_MANAGER") {
      return [{ value: "HUB_MANAGER", label: "Hub Manager" }];
    }
    if (fromEntityType === "HUB_MANAGER") {
      const hm = hubManagers?.find((h: any) => h.hub_manager_id === fromEntityId);
      const channelName = (hm as any)?.channels?.channel_name?.toUpperCase() ?? "";
      if (channelName === "B2B") return [{ value: "KAM", label: "KAM" }];
      // DD sub-channel hub managers send to DD Riders
      if (hm?.sub_channel_id) return [{ value: "DD_RIDER", label: "DD Rider" }];
      return [{ value: "AGENT", label: "DH Agent (Field Agent)" }];
    }
    return [];
  }, [fromEntityType, fromEntityId, hubManagers]);

  // ─── Mutations ───
  const initiateTransfer = useMutation({
    mutationFn: async () => {
      const transfers = selectedInventoryIds.map(invId => ({
        inventory_id: invId,
        from_entity_type: fromEntityType,
        from_entity_id: fromEntityType === "GPFI_MANAGER" ? "GPFI_SYSTEM" : fromEntityId,
        to_entity_type: toEntityType,
        to_entity_id: toEntityId,
        notes: notes || null,
      }));
      const { error } = await supabase.from("stock_transfers").insert(transfers as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending_transfers"] });
      qc.invalidateQueries({ queryKey: ["all_transfers"] });
      qc.invalidateQueries({ queryKey: ["transfer_stock"] });
      resetDialog();
      toast({ title: `Transfer initiated for ${selectedInventoryIds.length} items` });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const respondTransfer = useMutation({
    mutationFn: async ({ transferId, action }: { transferId: string; action: "ACCEPTED" | "REJECTED" }) => {
      const { error } = await supabase.from("stock_transfers")
        .update({ transfer_status: action as any, responded_at: new Date().toISOString() })
        .eq("transfer_id", transferId);
      if (error) throw error;

      if (action === "ACCEPTED") {
        const transfer = pendingTransfers?.find((t: any) => t.transfer_id === transferId);
        if (transfer) {
          const isHubTarget = transfer.to_entity_type === "HUB_MANAGER";
          const newStatus = isHubTarget ? "WITH_HUB_MANAGER" : "WITH_FIELD_STAFF";
          const newStockType = isHubTarget ? "SWAP_BUFFER_STOCK" : "SALES_STOCK";
          await supabase.from("inventory_master")
            .update({
              status: newStatus as any,
              stock_type: newStockType as any,
              allocated_entity_id: isHubTarget ? transfer.to_entity_id : undefined,
              allocated_agent_id: isHubTarget ? undefined : transfer.to_entity_id,
            } as any)
            .eq("inventory_id", transfer.inventory_id);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending_transfers"] });
      qc.invalidateQueries({ queryKey: ["all_transfers"] });
      qc.invalidateQueries({ queryKey: ["transfer_stock"] });
      toast({ title: "Transfer response recorded" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resetDialog = () => {
    setTransferOpen(false);
    setSelectedInventoryIds([]);
    setToEntityType("");
    setToEntityId("");
    setNotes("");
  };

  const toggleInventorySelection = (id: string) => {
    setSelectedInventoryIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const statusColor = (s: string) => s === "ACCEPTED" ? "default" : s === "REJECTED" ? "destructive" : "secondary";

  const formatEntityLabel = (type: string, id: string) => {
    if (type === "GPFI_MANAGER") return "GPFI Sales Manager";
    if (type === "HUB_MANAGER") {
      const hm = hubManagers?.find((h: any) => h.hub_manager_id === id);
      return hm ? `Hub: ${hm.name}` : `Hub Manager`;
    }
    if (type === "SUB_CHANNEL_USER") {
      const sc = subChannelUsers?.find((u: any) => u.id === id);
      return sc ? `SC: ${sc.user_name}` : "Sub-Channel User";
    }
    if (type === "KAM") {
      const k = kams?.find((k: any) => k.kam_id === id);
      return k ? `KAM: ${k.name}` : "KAM";
    }
    if (type === "AGENT") {
      const a = agents?.find((a: any) => a.agent_id === id);
      return a ? `Agent: ${a.agent_name}` : "DH Agent";
    }
    if (type === "DD_RIDER") {
      const r = ddRiders?.find((r: any) => r.id === id);
      return r ? `DD: ${r.user_name}` : "DD Rider";
    }
    return `${type}: ${id.slice(0, 8)}`;
  };

  // Filter "to" entities contextually
  const filteredToEntities = useMemo(() => {
    if (toEntityType === "HUB_MANAGER") return hubManagers ?? [];
    if (toEntityType === "AGENT") {
      // If from is a hub manager linked to a DH, filter agents by that DH
      const hm = hubManagers?.find((h: any) => h.hub_manager_id === fromEntityId);
      if (hm?.dh_id) return agents?.filter((a: any) => a.dh_id === hm.dh_id) ?? [];
      return agents ?? [];
    }
    if (toEntityType === "KAM") {
      // Filter KAMs linked to this hub manager
      return kams?.filter((k: any) => k.hub_manager_id === fromEntityId) ?? [];
    }
    if (toEntityType === "DD_RIDER") {
      // Filter riders in same sub-channel as the from user
      const fromUser = subChannelUsers?.find((u: any) => u.id === fromEntityId);
      if (fromUser) return ddRiders?.filter((r: any) => r.sub_channel_id === fromUser.sub_channel_id) ?? [];
      return ddRiders ?? [];
    }
    return [];
  }, [toEntityType, fromEntityId, hubManagers, agents, kams, ddRiders, subChannelUsers]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Stock Transfers — Custody Flow</h1>
          <p className="text-sm text-muted-foreground">
            GPFI → Hub Manager → Last-Mile Staff · Digital handshake at each level
          </p>
        </div>
        <Button onClick={() => setTransferOpen(true)} disabled={!selectedInventoryIds.length}>
          <Send className="h-4 w-4 mr-1.5" />
          Transfer {selectedInventoryIds.length > 0 ? `(${selectedInventoryIds.length})` : ""}
        </Button>
      </div>

      {/* From-entity selector */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Transferring From</Label>
              <Select value={fromEntityType} onValueChange={(v: FromType) => { setFromEntityType(v); setFromEntityId(""); setSelectedInventoryIds([]); setToEntityType(""); setToEntityId(""); }}>
                <SelectTrigger className="w-[240px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FROM_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {fromEntityType === "HUB_MANAGER" && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Select Hub Manager</Label>
                <Select value={fromEntityId} onValueChange={(v) => { setFromEntityId(v); setSelectedInventoryIds([]); setToEntityType(""); setToEntityId(""); }}>
                  <SelectTrigger className="w-[260px] h-9"><SelectValue placeholder="Pick hub manager..." /></SelectTrigger>
                  <SelectContent>
                    {hubManagers?.map((hm: any) => (
                      <SelectItem key={hm.hub_manager_id} value={hm.hub_manager_id}>
                        {hm.name} — {(hm as any).channels?.channel_name ?? "No channel"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {fromEntityType !== "GPFI_MANAGER" && fromEntityId && (
              <div className="flex items-center gap-1.5 ml-auto">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <Badge variant="outline" className="text-xs">
                  Can transfer to: {toOptions.map(o => o.label).join(", ")}
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="stock" className="space-y-4">
        <TabsList>
          <TabsTrigger value="stock">
            Available Stock ({availableStock?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="pending">Pending Handshake ({pendingTransfers?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="history">Transfer History</TabsTrigger>
        </TabsList>

        <TabsContent value="stock">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Select Items to Transfer</CardTitle>
              <CardDescription>
                {fromEntityType === "GPFI_MANAGER"
                  ? "Stock in GPFI staging / warehouse → send to Hub Manager"
                  : fromEntityType === "HUB_MANAGER"
                  ? "Stock held by this Hub Manager → send to last-mile staff"
                  : "Stock held by Sub-Channel Manager → send to DD Rider"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Serial</TableHead>
                    <TableHead>IMEI</TableHead>
                    <TableHead>Added</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
                  ) : !availableStock?.length ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      <Package className="h-6 w-6 mx-auto mb-1 opacity-50" />
                      {fromEntityType !== "GPFI_MANAGER" && !fromEntityId ? "Select a source entity above" : "No stock available"}
                    </TableCell></TableRow>
                  ) : availableStock.map((item: any) => (
                    <TableRow key={item.inventory_id} className={selectedInventoryIds.includes(item.inventory_id) ? "bg-accent/50" : ""}>
                      <TableCell>
                        <input type="checkbox" checked={selectedInventoryIds.includes(item.inventory_id)}
                          onChange={() => toggleInventorySelection(item.inventory_id)} className="rounded" />
                      </TableCell>
                      <TableCell className="font-medium">{(item as any).products?.product_name ?? "—"}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{item.item_type}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{item.serial_number ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{item.imei ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(item.created_at), "dd MMM yyyy")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending">
          <Card>
            <CardHeader><CardTitle className="text-base">Pending Verify & Accept</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product / Serial</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead className="w-[140px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!pendingTransfers?.length ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No pending transfers.</TableCell></TableRow>
                  ) : pendingTransfers.map((t: any) => (
                    <TableRow key={t.transfer_id}>
                      <TableCell>
                        <div className="font-medium text-sm">{(t as any).inventory_master?.products?.product_name ?? "—"}</div>
                        <div className="font-mono text-xs text-muted-foreground">{(t as any).inventory_master?.serial_number ?? ""}</div>
                      </TableCell>
                      <TableCell className="text-sm">{formatEntityLabel(t.from_entity_type, t.from_entity_id)}</TableCell>
                      <TableCell className="text-sm">{formatEntityLabel(t.to_entity_type, t.to_entity_id)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(t.requested_at), "dd MMM HH:mm")}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="default" onClick={() => respondTransfer.mutate({ transferId: t.transfer_id, action: "ACCEPTED" })}>
                            <Check className="h-3.5 w-3.5 mr-1" /> Accept
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => respondTransfer.mutate({ transferId: t.transfer_id, action: "REJECTED" })}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product / Serial</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead>Responded</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!allTransfers?.length ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No transfers yet.</TableCell></TableRow>
                  ) : allTransfers.map((t: any) => (
                    <TableRow key={t.transfer_id}>
                      <TableCell>
                        <div className="font-medium text-sm">{(t as any).inventory_master?.products?.product_name ?? "—"}</div>
                        <div className="font-mono text-xs text-muted-foreground">{(t as any).inventory_master?.serial_number ?? ""}</div>
                      </TableCell>
                      <TableCell className="text-sm">{formatEntityLabel(t.from_entity_type, t.from_entity_id)}</TableCell>
                      <TableCell className="text-sm">{formatEntityLabel(t.to_entity_type, t.to_entity_id)}</TableCell>
                      <TableCell><Badge variant={statusColor(t.transfer_status)} className="text-xs">{t.transfer_status}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(t.requested_at), "dd MMM HH:mm")}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{t.responded_at ? format(new Date(t.responded_at), "dd MMM HH:mm") : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Transfer Dialog */}
      <Dialog open={transferOpen} onOpenChange={v => { if (!v) resetDialog(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Initiate Stock Transfer</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="secondary">{FROM_OPTIONS.find(o => o.value === fromEntityType)?.label}</Badge>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">{selectedInventoryIds.length} item(s)</span>
            </div>

            <div className="space-y-2">
              <Label>Transfer To</Label>
              <Select value={toEntityType} onValueChange={(v) => { setToEntityType(v); setToEntityId(""); }}>
                <SelectTrigger><SelectValue placeholder="Select receiver type" /></SelectTrigger>
                <SelectContent>
                  {toOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {toEntityType && (
              <div className="space-y-2">
                <Label>
                  {toEntityType === "HUB_MANAGER" ? "Hub Manager" : toEntityType === "KAM" ? "KAM" : toEntityType === "AGENT" ? "DH Agent" : "DD Rider"}
                </Label>
                <Select value={toEntityId} onValueChange={setToEntityId}>
                  <SelectTrigger><SelectValue placeholder="Select person..." /></SelectTrigger>
                  <SelectContent>
                    {toEntityType === "HUB_MANAGER" && filteredToEntities.map((hm: any) => (
                      <SelectItem key={hm.hub_manager_id} value={hm.hub_manager_id}>
                        {hm.name} — {(hm as any).channels?.channel_name ?? ""}
                      </SelectItem>
                    ))}
                    {toEntityType === "KAM" && filteredToEntities.map((k: any) => (
                      <SelectItem key={k.kam_id} value={k.kam_id}>{k.name} ({k.kam_id})</SelectItem>
                    ))}
                    {toEntityType === "AGENT" && filteredToEntities.map((a: any) => (
                      <SelectItem key={a.agent_id} value={a.agent_id}>{a.agent_name} ({a.agent_id})</SelectItem>
                    ))}
                    {toEntityType === "DD_RIDER" && filteredToEntities.map((r: any) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.user_name} — {r.sub_channels?.sub_channel_name} ({r.employee_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Transfer notes..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetDialog}>Cancel</Button>
            <Button onClick={() => initiateTransfer.mutate()} disabled={!toEntityType || !toEntityId || initiateTransfer.isPending}>
              {initiateTransfer.isPending ? "Sending..." : "Send Transfer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
