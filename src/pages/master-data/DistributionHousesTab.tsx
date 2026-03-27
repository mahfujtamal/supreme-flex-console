import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Plus, Search, Upload, Download, Pencil, History } from "lucide-react";
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
import { MultiSelectDropdown } from "@/components/ui/multi-select-dropdown";

const PAGE_SIZE = 10;

export default function DistributionHousesTab() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editSnapshot, setEditSnapshot] = useState<any>(null);
  const [dhCode, setDhCode] = useState("");
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedAreaIds, setSelectedAreaIds] = useState<string[]>([]);
  // Geography cascading
  const [circleId, setCircleId] = useState("");
  const [regionId, setRegionId] = useState("");
  const [clusterId, setClusterId] = useState("");
  const [territoryId, setTerritoryId] = useState("");
  // Audit
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditRecordId, setAuditRecordId] = useState("");
  const [auditTitle, setAuditTitle] = useState("");
  // Bulk upload
  const [bulkUploading, setBulkUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();
  const qc = useQueryClient();

  // Lookups
  const { data: allAreas } = useQuery({ queryKey: ["all_areas_lookup"], queryFn: async () => { const all: any[] = []; let from = 0; const PAGE = 1000; while (true) { const { data } = await supabase.from("areas").select("area_id, area_name").eq("status", true).order("area_name").range(from, from + PAGE - 1); if (!data || data.length === 0) break; all.push(...data); if (data.length < PAGE) break; from += PAGE; } return all; } });
  const { data: circles } = useQuery({ queryKey: ["circles_lookup"], queryFn: async () => { const { data } = await (supabase as any).from("circles").select("circle_id, circle_name").eq("status", true); return (data ?? []) as any[]; } });
  const { data: regions } = useQuery({ queryKey: ["regions_lookup", circleId], queryFn: async () => { let q = (supabase as any).from("regions").select("region_id, region_name").eq("status", true); if (circleId) q = q.eq("circle_id", circleId); const { data } = await q; return (data ?? []) as any[]; } });
  const { data: clusters } = useQuery({ queryKey: ["clusters_lookup", regionId], queryFn: async () => { let q = (supabase as any).from("clusters").select("cluster_id, cluster_name").eq("status", true); if (regionId) q = q.eq("region_id", regionId); const { data } = await q; return (data ?? []) as any[]; } });
  const { data: territories } = useQuery({ queryKey: ["territories_lookup", clusterId], queryFn: async () => { let q = (supabase as any).from("territories").select("territory_id, territory_name").eq("status", true); if (clusterId) q = q.eq("cluster_id", clusterId); const { data } = await q; return (data ?? []) as any[]; } });

  const { data, isLoading } = useQuery({
    queryKey: ["distribution_houses", page, search],
    queryFn: async () => {
      let q = supabase.from("distribution_houses").select("*, territories!distribution_houses_territory_id_fkey(territory_name)", { count: "exact" }).order("created_at", { ascending: false });
      if (search) q = q.or(`dh_code.ilike.%${search}%,name.ilike.%${search}%`);
      const { data, error, count } = await q.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      // Fetch area assignments for these DHs
      const dhIds = (data ?? []).map((d: any) => d.dh_id);
      let areaAssignments: any[] = [];
      if (dhIds.length) {
        const { data: aa } = await (supabase as any).from("dh_area_assignments").select("dh_id, area_id, areas(area_name)").in("dh_id", dhIds);
        areaAssignments = aa ?? [];
      }
      const items = (data ?? []).map((d: any) => ({
        ...d,
        assigned_areas: areaAssignments.filter((a: any) => a.dh_id === d.dh_id).map((a: any) => a.areas?.area_name).filter(Boolean),
      }));
      return { items, count: count ?? 0 };
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = { dh_code: dhCode.trim(), name: name.trim(), phone_number: phoneNumber.trim() || null, territory_id: territoryId };
      let dhId = editId;
      if (editId) {
        const { error } = await supabase.from("distribution_houses").update(payload).eq("dh_id", editId);
        if (error) throw error;
        await logAuditChange("distribution_houses", editId, editSnapshot, payload);
      } else {
        const { data, error } = await supabase.from("distribution_houses").insert(payload).select("dh_id").single();
        if (error) throw error;
        dhId = data.dh_id;
      }
      // Sync area assignments
      await (supabase as any).from("dh_area_assignments").delete().eq("dh_id", dhId);
      if (selectedAreaIds.length > 0) {
        const rows = selectedAreaIds.map(aId => ({ dh_id: dhId, area_id: aId }));
        const { error } = await (supabase as any).from("dh_area_assignments").insert(rows);
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

  const downloadTemplate = () => {
    const csv = "dh_code,name,phone_number,territory_name,area_names\nDH-001,My Hub,01XXXXXXXXX,TERRITORY A,\"AREA 1|AREA 2\"\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "dh_bulk_template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkUploading(true);
    try {
      const text = await file.text();
      const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) throw new Error("CSV must have a header and at least one data row.");
      const header = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/"/g, ""));
      const codeIdx = header.indexOf("dh_code");
      const nameIdx = header.indexOf("name");
      const phoneIdx = header.indexOf("phone_number");
      const terrIdx = header.indexOf("territory_name");
      const areasIdx = header.indexOf("area_names");
      if (codeIdx < 0 || nameIdx < 0 || terrIdx < 0) throw new Error("CSV must have columns: dh_code, name, territory_name");

      // Build lookup maps
      const { data: allTerr } = await (supabase as any).from("territories").select("territory_id, territory_name");
      const terrMap = new Map((allTerr ?? []).map((t: any) => [t.territory_name.toLowerCase(), t.territory_id]));
      const allAreasData: any[] = []; let aFrom = 0; while (true) { const { data: pg } = await supabase.from("areas").select("area_id, area_name").range(aFrom, aFrom + 999); if (!pg || pg.length === 0) break; allAreasData.push(...pg); if (pg.length < 1000) break; aFrom += 1000; }
      const areaMap = new Map(allAreasData.map((a: any) => [a.area_name.toLowerCase(), a.area_id]));

      const dhRows: any[] = [];
      const areaLinks: { dhCode: string; areaIds: string[] }[] = [];
      const errors: string[] = [];

      // Parse CSV with proper quote handling
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        const code = cols[codeIdx]?.trim();
        const dName = cols[nameIdx]?.trim();
        const phone = phoneIdx >= 0 ? cols[phoneIdx]?.trim() : null;
        const terrName = cols[terrIdx]?.trim();
        const areasStr = areasIdx >= 0 ? cols[areasIdx]?.trim() : "";

        if (!code || !dName) { errors.push(`Row ${i + 1}: missing dh_code or name`); continue; }
        const tId = terrMap.get(terrName?.toLowerCase());
        if (!tId) { errors.push(`Row ${i + 1}: territory "${terrName}" not found`); continue; }

        dhRows.push({ dh_code: code, name: dName, phone_number: phone || null, territory_id: tId });

        // Parse area names (pipe-separated)
        if (areasStr) {
          const aNames = areasStr.split("|").map(a => a.trim()).filter(Boolean);
          const aIds: string[] = [];
          for (const an of aNames) {
            const aId = areaMap.get(an.toLowerCase());
            if (aId) aIds.push(aId);
            else errors.push(`Row ${i + 1}: area "${an}" not found`);
          }
          if (aIds.length) areaLinks.push({ dhCode: code, areaIds: aIds });
        }
      }

      if (dhRows.length === 0) throw new Error("No valid rows found.\n" + errors.slice(0, 10).join("\n"));

      // Insert DHs in batches
      const BATCH = 500;
      for (let i = 0; i < dhRows.length; i += BATCH) {
        const { error } = await supabase.from("distribution_houses").insert(dhRows.slice(i, i + BATCH));
        if (error) throw error;
      }

      // Now fetch inserted DH IDs by code
      if (areaLinks.length > 0) {
        const codes = areaLinks.map(a => a.dhCode);
        const { data: insertedDHs } = await supabase.from("distribution_houses").select("dh_id, dh_code").in("dh_code", codes);
        const codeToId = new Map((insertedDHs ?? []).map((d: any) => [d.dh_code, d.dh_id]));
        const assignRows: any[] = [];
        for (const link of areaLinks) {
          const dhId = codeToId.get(link.dhCode);
          if (dhId) {
            for (const aId of link.areaIds) {
              assignRows.push({ dh_id: dhId, area_id: aId });
            }
          }
        }
        if (assignRows.length) {
          for (let i = 0; i < assignRows.length; i += BATCH) {
            const { error } = await (supabase as any).from("dh_area_assignments").insert(assignRows.slice(i, i + BATCH));
            if (error) throw error;
          }
        }
      }

      qc.invalidateQueries({ queryKey: ["distribution_houses"] });
      toast({ title: `${dhRows.length} DHs uploaded`, description: errors.length ? `${errors.length} warnings` : undefined });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setBulkUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const closeDialog = () => { setOpen(false); setEditId(null); setEditSnapshot(null); setDhCode(""); setName(""); setPhoneNumber(""); setSelectedAreaIds([]); setCircleId(""); setRegionId(""); setClusterId(""); setTerritoryId(""); };

  const openEdit = async (item: any) => {
    setEditId(item.dh_id);
    setEditSnapshot({ dh_code: item.dh_code, name: item.name, phone_number: item.phone_number, territory_id: item.territory_id });
    setDhCode(item.dh_code);
    setName(item.name);
    setPhoneNumber(item.phone_number ?? "");
    const tId = item.territory_id ?? "";
    setTerritoryId(tId);
    // Resolve geography hierarchy: territory → cluster → region → circle
    if (tId) {
      const { data: terr } = await (supabase as any).from("territories").select("cluster_id").eq("territory_id", tId).single();
      if (terr?.cluster_id) {
        setClusterId(terr.cluster_id);
        const { data: cl } = await (supabase as any).from("clusters").select("region_id").eq("cluster_id", terr.cluster_id).single();
        if (cl?.region_id) {
          setRegionId(cl.region_id);
          const { data: rg } = await (supabase as any).from("regions").select("circle_id").eq("region_id", cl.region_id).single();
          if (rg?.circle_id) setCircleId(rg.circle_id);
        }
      }
    }
    // Load area assignments
    const { data: aa } = await (supabase as any).from("dh_area_assignments").select("area_id").eq("dh_id", item.dh_id);
    setSelectedAreaIds((aa ?? []).map((a: any) => a.area_id));
    setOpen(true);
  };

  const totalPages = Math.ceil((data?.count ?? 0) / PAGE_SIZE);
  const canSave = dhCode.trim() && name.trim() && territoryId;

  const areaOptions = (allAreas ?? []).map(a => ({ value: a.area_id, label: a.area_name }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by code or name..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9 h-9" />
        </div>
        <div className="flex gap-2">
          <input type="file" accept=".csv" ref={fileInputRef} className="hidden" onChange={handleBulkUpload} />
          <Button variant="outline" size="sm" onClick={downloadTemplate}><Download className="h-4 w-4 mr-1" />Template</Button>
          <Button variant="outline" size="sm" disabled={bulkUploading} onClick={() => fileInputRef.current?.click()}><Upload className="h-4 w-4 mr-1.5" />{bulkUploading ? "Uploading..." : "Bulk Upload"}</Button>
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1.5" />Add DH</Button>
        </div>
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>DH Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Territory</TableHead>
              <TableHead>Areas</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[130px]">Created</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
            ) : !data?.items?.length ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No distribution houses found.</TableCell></TableRow>
            ) : data.items.map((d: any) => (
              <TableRow key={d.dh_id}>
                <TableCell className="font-mono text-sm">{d.dh_code}</TableCell>
                <TableCell className="font-medium">{d.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{d.phone_number ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{d.territories?.territory_name ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {d.assigned_areas?.length ? (
                    <div className="flex flex-wrap gap-1">
                      {d.assigned_areas.map((a: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-xs">{a}</Badge>
                      ))}
                    </div>
                  ) : "—"}
                </TableCell>
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
            <div className="space-y-2"><Label>DH Code *</Label><Input value={dhCode} onChange={(e) => setDhCode(e.target.value)} placeholder="e.g. DH-CTG-001" /></div>
            <div className="space-y-2"><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chittagong Hub" /></div>
            <div className="space-y-2"><Label>Phone Number</Label><Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="e.g. 01XXXXXXXXX" /></div>

            <div className="border-t pt-4 mt-4">
              <p className="text-sm font-medium mb-3">Territory Assignment * (Cascading)</p>
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

            <div className="border-t pt-4 mt-4">
              <p className="text-sm font-medium mb-3">Area Assignments (Multiple)</p>
              <MultiSelectDropdown
                options={areaOptions}
                selected={selectedAreaIds}
                onChange={setSelectedAreaIds}
                placeholder="Select areas..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={!canSave || save.isPending}>{save.isPending ? "Saving..." : editId ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Audit Trail Dialog */}
      <AuditTrailDialog open={auditOpen} onOpenChange={setAuditOpen} tableName="distribution_houses" recordId={auditRecordId} title={auditTitle} />
    </div>
  );
}

/** Simple CSV line parser that handles quoted fields */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ""; }
    else { current += ch; }
  }
  result.push(current.trim());
  return result;
}
