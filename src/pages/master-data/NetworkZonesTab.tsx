import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Plus, Search, Upload, Pencil, History, Signal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { logAuditChange } from "@/hooks/useAuditLog";
import AuditTrailDialog from "@/components/AuditTrailDialog";

const PAGE_SIZE = 10;

const RF_FIELDS = [
  { key: "4g_rsrp", label: "4G RSRP", unit: "dBm", threshold: -115 },
  { key: "4g_rsrq", label: "4G RSRQ", unit: "dB", threshold: -15 },
  { key: "4g_snr", label: "4G SNR", unit: "dB", threshold: 3 },
  { key: "5g_rsrp", label: "5G RSRP", unit: "dBm", threshold: -110 },
  { key: "5g_rsrq", label: "5G RSRQ", unit: "dB", threshold: -13 },
  { key: "5g_snr", label: "5G SNR", unit: "dB", threshold: 5 },
] as const;

function SignalMetric({ label, value, unit, threshold }: { label: string; value: number | null; unit: string; threshold: number }) {
  const isBelowThreshold = value !== null && value < threshold;
  return (
    <div className={`rounded-lg border p-3 ${isBelowThreshold ? "border-destructive bg-destructive/10" : "bg-muted/30"}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold font-mono ${isBelowThreshold ? "text-destructive" : "text-foreground"}`}>
        {value !== null ? `${value} ${unit}` : "—"}
      </p>
      {isBelowThreshold && <p className="text-[10px] text-destructive mt-0.5">Below threshold ({threshold})</p>}
    </div>
  );
}

function SignalQualityCard({ zone }: { zone: any }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Signal className="h-4 w-4" /> Signal Quality — {zone.network_zone_name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">4G Metrics</p>
            <div className="space-y-2">
              {RF_FIELDS.filter(f => f.key.startsWith("4g")).map(f => (
                <SignalMetric key={f.key} label={f.label} value={zone[f.key] ?? null} unit={f.unit} threshold={f.threshold} />
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">5G Metrics</p>
            <div className="space-y-2">
              {RF_FIELDS.filter(f => f.key.startsWith("5g")).map(f => (
                <SignalMetric key={f.key} label={f.label} value={zone[f.key] ?? null} unit={f.unit} threshold={f.threshold} />
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function NetworkZonesTab() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editSnapshot, setEditSnapshot] = useState<any>(null);
  const [name, setName] = useState("");
  const [rfValues, setRfValues] = useState<Record<string, string>>({});
  const [signalZone, setSignalZone] = useState<any>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditRecordId, setAuditRecordId] = useState("");
  const [auditTitle, setAuditTitle] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["network_zones", page, search],
    queryFn: async () => {
      let q = supabase
        .from("network_zones")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });
      if (search) q = q.ilike("network_zone_name", `%${search}%`);
      const { data, error, count } = await q.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      return { items: data, count: count ?? 0 };
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const rfPayload: Record<string, number | null> = {};
      for (const f of RF_FIELDS) {
        const val = rfValues[f.key]?.trim();
        rfPayload[f.key] = val !== undefined && val !== "" ? parseFloat(val) : null;
        if (val !== undefined && val !== "" && isNaN(parseFloat(val))) {
          throw new Error(`Invalid value for ${f.label}: must be a number`);
        }
      }
      const payload: any = { network_zone_name: name.trim(), ...rfPayload };

      if (editId) {
        const { error } = await supabase.from("network_zones").update(payload).eq("network_zone_id", editId);
        if (error) throw error;
        await logAuditChange("network_zones", editId, editSnapshot, payload);
      } else {
        const { error } = await supabase.from("network_zones").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["network_zones"] });
      closeDialog();
      toast({ title: editId ? "Zone updated" : "Zone created" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: boolean }) => {
      const { error } = await supabase.from("network_zones").update({ status: !status }).eq("network_zone_id", id);
      if (error) throw error;
      await logAuditChange("network_zones", id, { status }, { status: !status });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["network_zones"] }),
  });

  const closeDialog = () => {
    setOpen(false); setEditId(null); setEditSnapshot(null); setName(""); setRfValues({});
  };

  const openEdit = (item: any) => {
    setEditId(item.network_zone_id);
    setName(item.network_zone_name);
    const snapshot: any = { network_zone_name: item.network_zone_name };
    const vals: Record<string, string> = {};
    for (const f of RF_FIELDS) {
      const v = item[f.key];
      vals[f.key] = v !== null && v !== undefined ? String(v) : "";
      snapshot[f.key] = v;
    }
    setRfValues(vals);
    setEditSnapshot(snapshot);
    setOpen(true);
  };

  const totalPages = Math.ceil((data?.count ?? 0) / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Signal Quality Card when viewing a zone */}
      {signalZone && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium">Zone 360° View</h3>
            <Button variant="ghost" size="sm" onClick={() => setSignalZone(null)}>Close</Button>
          </div>
          <SignalQualityCard zone={signalZone} />
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search zones..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9 h-9" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled><Upload className="h-4 w-4 mr-1.5" />Bulk Upload</Button>
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1.5" />Add Zone</Button>
        </div>
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Zone Name</TableHead>
              <TableHead className="text-center">4G RSRP</TableHead>
              <TableHead className="text-center">5G RSRP</TableHead>
              <TableHead className="w-[80px]">Status</TableHead>
              <TableHead className="w-[130px]">Created</TableHead>
              <TableHead className="w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
            ) : !data?.items?.length ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No zones found.</TableCell></TableRow>
            ) : data.items.map((z: any) => {
              const rsrp4g = z["4g_rsrp"];
              const rsrp5g = z["5g_rsrp"];
              return (
                <TableRow key={z.network_zone_id}>
                  <TableCell className="font-medium">{z.network_zone_name}</TableCell>
                  <TableCell className="text-center">
                    {rsrp4g !== null && rsrp4g !== undefined ? (
                      <span className={`font-mono text-sm ${rsrp4g < -115 ? "text-destructive font-semibold" : ""}`}>{rsrp4g} dBm</span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {rsrp5g !== null && rsrp5g !== undefined ? (
                      <span className={`font-mono text-sm ${rsrp5g < -110 ? "text-destructive font-semibold" : ""}`}>{rsrp5g} dBm</span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={z.status ? "default" : "secondary"} className="cursor-pointer" onClick={() => toggleStatus.mutate({ id: z.network_zone_id, status: z.status })}>
                      {z.status ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{format(new Date(z.created_at), "dd MMM yyyy")}</TableCell>
                  <TableCell>
                    <div className="flex gap-0.5">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(z)} title="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSignalZone(z)} title="Signal View"><Signal className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setAuditRecordId(z.network_zone_id); setAuditTitle(z.network_zone_name); setAuditOpen(true); }} title="Audit Trail"><History className="h-3.5 w-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <span className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={open} onOpenChange={(v) => { if (!v) closeDialog(); else setOpen(true); }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Edit Network Zone" : "Create Network Zone"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Zone Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Central Zone" />
            </div>
            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-3">RF Signal Metrics</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground">4G</p>
                  {RF_FIELDS.filter(f => f.key.startsWith("4g")).map(f => (
                    <div key={f.key} className="space-y-1">
                      <Label className="text-xs">{f.label} ({f.unit})</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={rfValues[f.key] ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "" || v === "-" || /^-?\d*\.?\d*$/.test(v)) {
                            setRfValues(prev => ({ ...prev, [f.key]: v }));
                          }
                        }}
                        placeholder={`e.g. ${f.threshold}`}
                        className="h-9 font-mono"
                      />
                    </div>
                  ))}
                </div>
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground">5G</p>
                  {RF_FIELDS.filter(f => f.key.startsWith("5g")).map(f => (
                    <div key={f.key} className="space-y-1">
                      <Label className="text-xs">{f.label} ({f.unit})</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={rfValues[f.key] ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "" || v === "-" || /^-?\d*\.?\d*$/.test(v)) {
                            setRfValues(prev => ({ ...prev, [f.key]: v }));
                          }
                        }}
                        placeholder={`e.g. ${f.threshold}`}
                        className="h-9 font-mono"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={!name.trim() || save.isPending}>{save.isPending ? "Saving..." : editId ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Audit Trail Dialog */}
      <AuditTrailDialog open={auditOpen} onOpenChange={setAuditOpen} tableName="network_zones" recordId={auditRecordId} title={auditTitle} />
    </div>
  );
}
