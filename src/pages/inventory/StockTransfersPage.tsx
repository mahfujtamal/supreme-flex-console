import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ArrowRight, Check, X, Send, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export default function StockTransfersPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [transferOpen, setTransferOpen] = useState(false);
  const [toEntityType, setToEntityType] = useState("");
  const [toEntityId, setToEntityId] = useState("");
  const [selectedInventoryIds, setSelectedInventoryIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  // Fetch available stock in GPFI staging
  const { data: stagingStock } = useQuery({
    queryKey: ["gpfi_staging_stock"],
    queryFn: async () => {
      const { data } = await supabase.from("inventory_master").select("*, products(product_name, product_category)")
        .eq("status", "IN_GPFI_STAGING" as any).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // Fetch pending transfers
  const { data: pendingTransfers } = useQuery({
    queryKey: ["pending_transfers"],
    queryFn: async () => {
      const { data } = await supabase.from("stock_transfers").select("*, inventory_master(serial_number, products(product_name))")
        .eq("transfer_status", "PENDING" as any).order("requested_at", { ascending: false });
      return data ?? [];
    },
  });

  // Fetch all transfers
  const { data: allTransfers } = useQuery({
    queryKey: ["all_transfers"],
    queryFn: async () => {
      const { data } = await supabase.from("stock_transfers").select("*, inventory_master(serial_number, products(product_name))")
        .order("created_at", { ascending: false }).limit(50);
      return data ?? [];
    },
  });

  // Hub managers for transfer targets
  const { data: hubManagers } = useQuery({
    queryKey: ["hub_managers_lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("hub_managers").select("hub_manager_id, name, channel_id, sub_channel_id").eq("status", "ACTIVE");
      return data ?? [];
    },
  });

  // Field agents
  const { data: agents } = useQuery({
    queryKey: ["field_agents_lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("field_agents").select("agent_id, agent_name").eq("status", "ACTIVE");
      return data ?? [];
    },
  });

  // KAMs
  const { data: kams } = useQuery({
    queryKey: ["kams_lookup_transfers"],
    queryFn: async () => {
      const { data } = await supabase.from("kams").select("kam_id, name").eq("status", "ACTIVE");
      return data ?? [];
    },
  });

  // Sub-Channel Users (DD Riders) — only from direct-delivery sub-channels
  const { data: ddRiders } = useQuery({
    queryKey: ["dd_riders_lookup"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sub_channel_users")
        .select("id, user_name, employee_id, msisdn, sub_channels(sub_channel_name, is_direct_delivery)")
        .eq("status", "ACTIVE");
      // Filter to only those belonging to direct-delivery sub-channels
      return (data ?? []).filter((u: any) => u.sub_channels?.is_direct_delivery === true);
    },
  });

  const initiateTransfer = useMutation({
    mutationFn: async () => {
      const transfers = selectedInventoryIds.map(invId => ({
        inventory_id: invId,
        from_entity_type: "GPFI_MANAGER",
        from_entity_id: "GPFI_SYSTEM",
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
      setTransferOpen(false);
      setSelectedInventoryIds([]);
      setToEntityType("");
      setToEntityId("");
      setNotes("");
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
          const newStatus = transfer.to_entity_type === "HUB_MANAGER" ? "WITH_HUB_MANAGER" 
            : transfer.to_entity_type === "DD_RIDER" ? "WITH_FIELD_STAFF" 
            : "WITH_FIELD_STAFF";
          const newStockType = transfer.to_entity_type === "HUB_MANAGER" ? "SWAP_BUFFER_STOCK" 
            : transfer.to_entity_type === "DD_RIDER" ? "SALES_STOCK"
            : "SALES_STOCK";
          await supabase.from("inventory_master")
            .update({ status: newStatus as any, stock_type: newStockType as any, allocated_agent_id: transfer.to_entity_id } as any)
            .eq("inventory_id", transfer.inventory_id);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending_transfers"] });
      qc.invalidateQueries({ queryKey: ["all_transfers"] });
      qc.invalidateQueries({ queryKey: ["gpfi_staging_stock"] });
      toast({ title: "Transfer response recorded" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleInventorySelection = (id: string) => {
    setSelectedInventoryIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const statusColor = (s: string) => s === "ACCEPTED" ? "default" : s === "REJECTED" ? "destructive" : "secondary";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Stock Transfers — Custody Flow</h1>
          <p className="text-sm text-muted-foreground">GPFI → Hub Manager → Field Staff with digital handshake</p>
        </div>
        <Button onClick={() => setTransferOpen(true)} disabled={!selectedInventoryIds.length}>
          <Send className="h-4 w-4 mr-1.5" />
          Transfer {selectedInventoryIds.length > 0 ? `(${selectedInventoryIds.length})` : ""}
        </Button>
      </div>

      <Tabs defaultValue="staging" className="space-y-4">
        <TabsList>
          <TabsTrigger value="staging">GPFI Staging ({stagingStock?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="pending">Pending Handshake ({pendingTransfers?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="history">Transfer History</TabsTrigger>
        </TabsList>

        <TabsContent value="staging">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Select Items to Transfer</CardTitle>
              <CardDescription>Select inventory items from GPFI staging to send to a Hub Manager or Field Staff</CardDescription>
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
                  {!stagingStock?.length ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No stock in GPFI staging.</TableCell></TableRow>
                  ) : stagingStock.map((item: any) => (
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
            <CardHeader>
              <CardTitle className="text-base">Pending Verify & Accept</CardTitle>
            </CardHeader>
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
                      <TableCell className="text-sm">{t.from_entity_type}</TableCell>
                      <TableCell className="text-sm">{t.to_entity_type}: {t.to_entity_id}</TableCell>
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
                      <TableCell className="text-sm">{t.from_entity_type}</TableCell>
                      <TableCell className="text-sm">{t.to_entity_type}</TableCell>
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

      {/* Initiate Transfer Dialog */}
      <Dialog open={transferOpen} onOpenChange={v => { if (!v) setTransferOpen(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Initiate Stock Transfer</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">{selectedInventoryIds.length} item(s) selected</p>
            <div className="space-y-2">
              <Label>Transfer To</Label>
              <Select value={toEntityType} onValueChange={(v) => { setToEntityType(v); setToEntityId(""); }}>
                <SelectTrigger><SelectValue placeholder="Select receiver type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="HUB_MANAGER">Hub Manager</SelectItem>
                  <SelectItem value="KAM">KAM</SelectItem>
                  <SelectItem value="AGENT">Field Agent</SelectItem>
                  <SelectItem value="DD_RIDER">DD Rider (Sub-Channel)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {toEntityType === "HUB_MANAGER" && (
              <div className="space-y-2">
                <Label>Hub Manager</Label>
                <Select value={toEntityId} onValueChange={setToEntityId}>
                  <SelectTrigger><SelectValue placeholder="Select hub manager" /></SelectTrigger>
                  <SelectContent>
                    {hubManagers?.map((hm: any) => <SelectItem key={hm.hub_manager_id} value={hm.hub_manager_id}>{hm.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {toEntityType === "KAM" && (
              <div className="space-y-2">
                <Label>KAM</Label>
                <Select value={toEntityId} onValueChange={setToEntityId}>
                  <SelectTrigger><SelectValue placeholder="Select KAM" /></SelectTrigger>
                  <SelectContent>
                    {kams?.map((k: any) => <SelectItem key={k.kam_id} value={k.kam_id}>{k.name} ({k.kam_id})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {toEntityType === "AGENT" && (
              <div className="space-y-2">
                <Label>Field Agent</Label>
                <Select value={toEntityId} onValueChange={setToEntityId}>
                  <SelectTrigger><SelectValue placeholder="Select agent" /></SelectTrigger>
                  <SelectContent>
                    {agents?.map((a: any) => <SelectItem key={a.agent_id} value={a.agent_id}>{a.agent_name} ({a.agent_id})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {toEntityType === "DD_RIDER" && (
              <div className="space-y-2">
                <Label>DD Rider (Sub-Channel User)</Label>
                <Select value={toEntityId} onValueChange={setToEntityId}>
                  <SelectTrigger><SelectValue placeholder="Select DD Rider" /></SelectTrigger>
                  <SelectContent>
                    {ddRiders?.map((r: any) => (
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
            <Button variant="outline" onClick={() => setTransferOpen(false)}>Cancel</Button>
            <Button onClick={() => initiateTransfer.mutate()} disabled={!toEntityType || !toEntityId || initiateTransfer.isPending}>
              {initiateTransfer.isPending ? "Sending..." : "Send Transfer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
