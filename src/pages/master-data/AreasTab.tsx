import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Plus, Search, Upload, Pencil, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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

const PAGE_SIZE = 10;

export default function AreasTab() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [filterDistrict, setFilterDistrict] = useState<string>("all");
  const [filterZone, setFilterZone] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [is4g, setIs4g] = useState(false);
  const [is5g, setIs5g] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: districts } = useQuery({
    queryKey: ["districts_lookup"],
    queryFn: async () => {
      const { data, error } = await supabase.from("districts").select("district_id, district_name").eq("status", true).order("district_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: zones } = useQuery({
    queryKey: ["zones_lookup"],
    queryFn: async () => {
      const { data, error } = await supabase.from("network_zones").select("network_zone_id, network_zone_name").eq("status", true).order("network_zone_name");
      if (error) throw error;
      return data;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["areas", page, search, filterDistrict, filterZone],
    queryFn: async () => {
      let q = supabase.from("areas").select("*, districts(district_name), network_zones(network_zone_name)", { count: "exact" }).order("created_at", { ascending: false });
      if (search) q = q.ilike("area_name", `%${search}%`);
      if (filterDistrict !== "all") q = q.eq("district_id", filterDistrict);
      if (filterZone !== "all") q = q.eq("network_zone_id", filterZone);
      const { data, error, count } = await q.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      return { items: data, count: count ?? 0 };
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = { area_name: name, district_id: districtId, network_zone_id: zoneId, is_4g_area: is4g, is_5g_area: is5g };
      if (editId) {
        const { error } = await supabase.from("areas").update(payload).eq("area_id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("areas").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["areas"] }); closeDialog(); toast({ title: editId ? "Area updated" : "Area created" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: boolean }) => {
      const { error } = await supabase.from("areas").update({ status: !status }).eq("area_id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["areas"] }),
  });

  const closeDialog = () => { setOpen(false); setEditId(null); setName(""); setDistrictId(""); setZoneId(""); setIs4g(false); setIs5g(false); };
  const openEdit = (item: any) => {
    setEditId(item.area_id); setName(item.area_name); setDistrictId(item.district_id);
    setZoneId(item.network_zone_id); setIs4g(item.is_4g_area); setIs5g(item.is_5g_area); setOpen(true);
  };
  const totalPages = Math.ceil((data?.count ?? 0) / PAGE_SIZE);
  const canSave = name.trim() && districtId && zoneId;

  const downloadTemplate = () => {
    const csv = "area_name,district_name,network_zone_name,is_4g_area,is_5g_area\nGulshan,Dhaka,Zone A,true,false\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "areas_template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkUploading(true);
    try {
      const text = await file.text();
      const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) throw new Error("CSV must have a header row and at least one data row.");
      const header = lines[0].split(",").map(h => h.trim().toLowerCase());
      const nameIdx = header.indexOf("area_name");
      const distIdx = header.indexOf("district_name");
      const zoneIdx = header.indexOf("network_zone_name");
      const g4Idx = header.indexOf("is_4g_area");
      const g5Idx = header.indexOf("is_5g_area");
      if (nameIdx < 0 || distIdx < 0 || zoneIdx < 0) throw new Error("CSV must have columns: area_name, district_name, network_zone_name");

      // Build lookup maps
      const distMap = new Map((districts ?? []).map(d => [d.district_name.toLowerCase(), d.district_id]));
      const zoneMap = new Map((zones ?? []).map(z => [z.network_zone_name.toLowerCase(), z.network_zone_id]));

      const rows: any[] = [];
      const errors: string[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map(c => c.trim());
        const areaName = cols[nameIdx];
        const dName = cols[distIdx];
        const zName = cols[zoneIdx];
        if (!areaName) { errors.push(`Row ${i + 1}: missing area_name`); continue; }
        const dId = distMap.get(dName?.toLowerCase());
        if (!dId) { errors.push(`Row ${i + 1}: district "${dName}" not found`); continue; }
        const zId = zoneMap.get(zName?.toLowerCase());
        if (!zId) { errors.push(`Row ${i + 1}: zone "${zName}" not found`); continue; }
        const is4 = g4Idx >= 0 ? cols[g4Idx]?.toLowerCase() === "true" : false;
        const is5 = g5Idx >= 0 ? cols[g5Idx]?.toLowerCase() === "true" : false;
        rows.push({ area_name: areaName, district_id: dId, network_zone_id: zId, is_4g_area: is4, is_5g_area: is5 });
      }

      if (rows.length === 0) throw new Error("No valid rows found.\n" + errors.join("\n"));

      const { error } = await supabase.from("areas").insert(rows);
      if (error) throw error;

      qc.invalidateQueries({ queryKey: ["areas"] });
      toast({ title: `${rows.length} areas uploaded`, description: errors.length ? `${errors.length} rows skipped` : undefined });
      if (errors.length) console.warn("Bulk upload warnings:", errors);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setBulkUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative max-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search areas..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9 h-9" />
          </div>
          <Select value={filterDistrict} onValueChange={(v) => { setFilterDistrict(v); setPage(0); }}>
            <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="District" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Districts</SelectItem>
              {districts?.map((d) => <SelectItem key={d.district_id} value={d.district_id}>{d.district_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterZone} onValueChange={(v) => { setFilterZone(v); setPage(0); }}>
            <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Zone" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Zones</SelectItem>
              {zones?.map((z) => <SelectItem key={z.network_zone_id} value={z.network_zone_id}>{z.network_zone_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <input type="file" accept=".csv" ref={fileInputRef} className="hidden" onChange={handleBulkUpload} />
          <Button variant="outline" size="sm" onClick={downloadTemplate}><Download className="h-4 w-4 mr-1.5" />Template</Button>
          <Button variant="outline" size="sm" disabled={bulkUploading} onClick={() => fileInputRef.current?.click()}><Upload className="h-4 w-4 mr-1.5" />{bulkUploading ? "Uploading..." : "Bulk Upload"}</Button>
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1.5" />Add Area</Button>
        </div>
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Area Name</TableHead>
              <TableHead>District</TableHead>
              <TableHead>Zone</TableHead>
              <TableHead className="w-[60px]">4G</TableHead>
              <TableHead className="w-[60px]">5G</TableHead>
              <TableHead className="w-[90px]">Status</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
            ) : !data?.items?.length ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No areas found.</TableCell></TableRow>
            ) : data.items.map((a: any) => (
              <TableRow key={a.area_id}>
                <TableCell className="font-medium">{a.area_name}</TableCell>
                <TableCell className="text-sm">{a.districts?.district_name}</TableCell>
                <TableCell className="text-sm">{a.network_zones?.network_zone_name}</TableCell>
                <TableCell><Badge variant={a.is_4g_area ? "default" : "outline"} className="text-xs">{a.is_4g_area ? "Yes" : "No"}</Badge></TableCell>
                <TableCell><Badge variant={a.is_5g_area ? "default" : "outline"} className="text-xs">{a.is_5g_area ? "Yes" : "No"}</Badge></TableCell>
                <TableCell>
                  <Badge variant={a.status ? "default" : "secondary"} className="cursor-pointer" onClick={() => toggleStatus.mutate({ id: a.area_id, status: a.status })}>
                    {a.status ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(a)}><Pencil className="h-3.5 w-3.5" /></Button>
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

      <Dialog open={open} onOpenChange={(v) => { if (!v) closeDialog(); else setOpen(true); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editId ? "Edit Area" : "Create Area"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Area Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Gulshan" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>District</Label>
                <Select value={districtId} onValueChange={setDistrictId}>
                  <SelectTrigger><SelectValue placeholder="Select district" /></SelectTrigger>
                  <SelectContent>
                    {districts?.map((d) => <SelectItem key={d.district_id} value={d.district_id}>{d.district_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Network Zone</Label>
                <Select value={zoneId} onValueChange={setZoneId}>
                  <SelectTrigger><SelectValue placeholder="Select zone" /></SelectTrigger>
                  <SelectContent>
                    {zones?.map((z) => <SelectItem key={z.network_zone_id} value={z.network_zone_id}>{z.network_zone_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Checkbox id="is4g" checked={is4g} onCheckedChange={(v) => setIs4g(!!v)} />
                <Label htmlFor="is4g">4G Area</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="is5g" checked={is5g} onCheckedChange={(v) => setIs5g(!!v)} />
                <Label htmlFor="is5g">5G Area</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={!canSave || save.isPending}>{save.isPending ? "Saving..." : editId ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
