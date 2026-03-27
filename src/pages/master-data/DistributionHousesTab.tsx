import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Plus, Search, Upload, Pencil, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { logAuditChange } from "@/hooks/useAuditLog";
import AuditTrailDialog from "@/components/AuditTrailDialog";

const PAGE_SIZE = 10;

export default function DistributionHousesTab() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editSnapshot, setEditSnapshot] = useState<any>(null);
  const [dhCode, setDhCode] = useState("");
  const [name, setName] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [areaId, setAreaId] = useState("");
  // Geography cascading
  const [circleId, setCircleId] = useState("");
  const [regionId, setRegionId] = useState("");
  const [clusterId, setClusterId] = useState("");
  const [territoryId, setTerritoryId] = useState("");
  // Audit
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditRecordId, setAuditRecordId] = useState("");
  const [auditTitle, setAuditTitle] = useState("");

  const { toast } = useToast();
  const qc = useQueryClient();
  const [csvRows, setCsvRows] = useState<any[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);

  const { data: districts } = useQuery({ queryKey: ["districts_lookup"], queryFn: async () => { const { data } = await supabase.from("districts").select("district_id, district_name").eq("status", true); return data ?? []; } });
  const { data: areas } = useQuery({ queryKey: ["areas_lookup", districtId], queryFn: async () => { let q = supabase.from("areas").select("area_id, area_name").eq("status", true); if (districtId) q = q.eq("district_id", districtId); const { data } = await q; return data ?? []; } });

  // Geography lookups
  const { data: circles } = useQuery({ queryKey: ["circles_lookup"], queryFn: async () => { const { data } = await (supabase as any).from("circles").select("circle_id, circle_name").eq("status", true); return (data ?? []) as any[]; } });
  const { data: regions } = useQuery({ queryKey: ["regions_lookup", circleId], queryFn: async () => { let q = (supabase as any).from("regions").select("region_id, region_name").eq("status", true); if (circleId) q = q.eq("circle_id", circleId); const { data } = await q; return (data ?? []) as any[]; } });
  const { data: clusters } = useQuery({ queryKey: ["clusters_lookup", regionId], queryFn: async () => { let q = (supabase as any).from("clusters").select("cluster_id, cluster_name").eq("status", true); if (regionId) q = q.eq("region_id", regionId); const { data } = await q; return (data ?? []) as any[]; } });
  const { data: territories } = useQuery({ queryKey: ["territories_lookup", clusterId], queryFn: async () => { let q = (supabase as any).from("territories").select("territory_id, territory_name").eq("status", true); if (clusterId) q = q.eq("cluster_id", clusterId); const { data } = await q; return (data ?? []) as any[]; } });

  const { data, isLoading } = useQuery({
    queryKey: ["distribution_houses", page, search],
    queryFn: async () => {
      let q = supabase.from("distribution_houses").select("*, districts(district_name), areas(area_name)", { count: "exact" }).order("created_at", { ascending: false });
      if (search) q = q.or(`dh_code.ilike.%${search}%,name.ilike.%${search}%`);
      const { data, error, count } = await q.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      return { items: data, count: count ?? 0 };
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = { dh_code: dhCode.trim(), name: name.trim(), district_id: districtId || null, area_id: areaId || null, territory_id: territoryId || null };
      if (editId) {
        const { error } = await supabase.from("distribution_houses").update(payload).eq("dh_id", editId);
        if (error) throw error;
        await logAuditChange("distribution_houses", editId, editSnapshot, payload);
      } else {
        const { error } = await supabase.from("distribution_houses").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["distribution_houses"] }); closeDialog(); toast({ title: editId ? "DH updated" : "DH created" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const newStatus = status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      const { error } = await supabase.from("distribution_houses").update({ status: newStatus } as any).eq("dh_id", id);
      if (error) throw error;
      await logAuditChange("distribution_houses", id, { status }, { status: newStatus });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["distribution_houses"] }),
  });

  const bulkImport = useMutation({
    mutationFn: async (rows: any[]) => { const { error } = await supabase.from("distribution_houses").insert(rows); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["distribution_houses"] }); setBulkOpen(false); setCsvRows([]); setCsvErrors([]); toast({ title: `${csvRows.length} DHs imported` }); },
    onError: (e: Error) => toast({ title: "Import failed", description: e.message, variant: "destructive" }),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const text = await file.text();
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) { setCsvErrors(["File must have a header row and at least one data row"]); return; }
    const header = lines[0].split(",").map(h => h.trim().toLowerCase());
    const reqCols = ["dh_code", "name"];
    const missing = reqCols.filter(c => !header.includes(c));
    if (missing.length) { setCsvErrors([`Missing columns: ${missing.join(", ")}`]); return; }
    const errors: string[] = []; const rows: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map(c => c.trim());
      const row: any = {}; header.forEach((h, idx) => row[h] = cols[idx] ?? "");
      if (!row.dh_code || !row.name) { errors.push(`Row ${i + 1}: missing dh_code or name`); continue; }
      rows.push({ dh_code: row.dh_code, name: row.name });
    }
    setCsvErrors(errors); setCsvRows(rows);
  };

  const closeDialog = () => { setOpen(false); setEditId(null); setEditSnapshot(null); setDhCode(""); setName(""); setDistrictId(""); setAreaId(""); setCircleId(""); setRegionId(""); setClusterId(""); setTerritoryId(""); };
  const openEdit = (item: any) => { setEditId(item.dh_id); setEditSnapshot({ dh_code: item.dh_code, name: item.name, district_id: item.district_id, area_id: item.area_id, territory_id: item.territory_id }); setDhCode(item.dh_code); setName(item.name); setDistrictId(item.district_id ?? ""); setAreaId(item.area_id ?? ""); setTerritoryId(item.territory_id ?? ""); setOpen(true); };
  const totalPages = Math.ceil((data?.count ?? 0) / PAGE_SIZE);
  const canSave = dhCode.trim() && name.trim();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by code or name..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9 h-9" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)}><Upload className="h-4 w-4 mr-1.5" />Bulk Upload</Button>
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1.5" />Add DH</Button>
        </div>
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>DH Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>District</TableHead>
              <TableHead>Area</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[130px]">Created</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
            ) : !data?.items?.length ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No distribution houses found.</TableCell></TableRow>
            ) : data.items.map((d: any) => (
              <TableRow key={d.dh_id}>
                <TableCell className="font-mono text-sm">{d.dh_code}</TableCell>
                <TableCell className="font-medium">{d.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{d.districts?.district_name ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{d.areas?.area_name ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={d.status === "ACTIVE" ? "default" : "secondary"} className="cursor-pointer" onClick={() => toggleStatus.mutate({ id: d.dh_id, status: d.status })}>
                    {d.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{format(new Date(d.created_at), "dd MMM yyyy")}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(d)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setAuditRecordId(d.dh_id); setAuditTitle(d.name); setAuditOpen(true); }}><History className="h-3.5 w-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
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
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Edit Distribution House" : "Create Distribution House"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>DH Code</Label><Input value={dhCode} onChange={(e) => setDhCode(e.target.value)} placeholder="e.g. DH-CTG-001" /></div>
            <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chittagong Hub" /></div>
            <div className="space-y-2"><Label>District</Label>
              <Select value={districtId} onValueChange={v => { setDistrictId(v); setAreaId(""); }}>
                <SelectTrigger><SelectValue placeholder="Select district" /></SelectTrigger>
                <SelectContent>{districts?.map(d => <SelectItem key={d.district_id} value={d.district_id}>{d.district_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Area</Label>
              <Select value={areaId} onValueChange={setAreaId}>
                <SelectTrigger><SelectValue placeholder="Select area" /></SelectTrigger>
                <SelectContent>{areas?.map(a => <SelectItem key={a.area_id} value={a.area_id}>{a.area_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="border-t pt-4 mt-4">
              <p className="text-sm font-medium mb-3">Geography Assignment (Cascading)</p>
              <div className="space-y-3">
                <div className="space-y-1"><Label className="text-xs">Circle</Label>
                  <Select value={circleId} onValueChange={v => { setCircleId(v); setRegionId(""); setClusterId(""); setTerritoryId(""); }}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select circle" /></SelectTrigger>
                    <SelectContent>{circles?.map((c: any) => <SelectItem key={c.circle_id} value={c.circle_id}>{c.circle_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label className="text-xs">Region</Label>
                  <Select value={regionId} onValueChange={v => { setRegionId(v); setClusterId(""); setTerritoryId(""); }} disabled={!circleId}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select region" /></SelectTrigger>
                    <SelectContent>{regions?.map((r: any) => <SelectItem key={r.region_id} value={r.region_id}>{r.region_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label className="text-xs">Cluster</Label>
                  <Select value={clusterId} onValueChange={v => { setClusterId(v); setTerritoryId(""); }} disabled={!regionId}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select cluster" /></SelectTrigger>
                    <SelectContent>{clusters?.map((c: any) => <SelectItem key={c.cluster_id} value={c.cluster_id}>{c.cluster_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label className="text-xs">Territory</Label>
                  <Select value={territoryId} onValueChange={setTerritoryId} disabled={!clusterId}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select territory" /></SelectTrigger>
                    <SelectContent>{territories?.map((t: any) => <SelectItem key={t.territory_id} value={t.territory_id}>{t.territory_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={!canSave || save.isPending}>{save.isPending ? "Saving..." : editId ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Upload Dialog */}
      <Dialog open={bulkOpen} onOpenChange={v => { if (!v) { setBulkOpen(false); setCsvRows([]); setCsvErrors([]); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Bulk Upload Distribution Houses</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">CSV columns: <code>dh_code, name</code></p>
            <Input type="file" accept=".csv" onChange={handleFileUpload} />
            {csvErrors.length > 0 && <div className="bg-destructive/10 text-destructive text-xs p-3 rounded-md space-y-1">{csvErrors.map((e, i) => <p key={i}>{e}</p>)}</div>}
            {csvRows.length > 0 && <p className="text-sm text-muted-foreground">{csvRows.length} rows ready to import</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBulkOpen(false); setCsvRows([]); setCsvErrors([]); }}>Cancel</Button>
            <Button onClick={() => bulkImport.mutate(csvRows)} disabled={!csvRows.length || bulkImport.isPending}>{bulkImport.isPending ? "Importing..." : `Import ${csvRows.length} rows`}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Audit Trail Dialog */}
      <AuditTrailDialog open={auditOpen} onOpenChange={setAuditOpen} tableName="distribution_houses" recordId={auditRecordId} title={auditTitle} />
    </div>
  );
}
