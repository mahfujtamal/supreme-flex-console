import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Plus, Search, Upload, Pencil, Download } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";

const PAGE_SIZE = 10;

export default function DistrictsTab() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [bulkUploading, setBulkUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["districts", page, search],
    queryFn: async () => {
      let q = supabase.from("districts").select("*", { count: "exact" }).order("created_at", { ascending: false });
      if (search) q = q.ilike("district_name", `%${search}%`);
      const { data, error, count } = await q.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      return { items: data, count: count ?? 0 };
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (editId) {
        const { error } = await supabase.from("districts").update({ district_name: name }).eq("district_id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("districts").insert({ district_name: name });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["districts"] }); closeDialog(); toast({ title: editId ? "District updated" : "District created" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: boolean }) => {
      const { error } = await supabase.from("districts").update({ status: !status }).eq("district_id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["districts"] }),
  });

  const closeDialog = () => { setOpen(false); setEditId(null); setName(""); };
  const openEdit = (item: any) => { setEditId(item.district_id); setName(item.district_name); setOpen(true); };
  const totalPages = Math.ceil((data?.count ?? 0) / PAGE_SIZE);

  const downloadTemplate = () => {
    const csv = "district_name\nDhaka\nChittagong\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "districts_template.csv"; a.click();
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
      const nameIdx = header.indexOf("district_name");
      if (nameIdx < 0) throw new Error("CSV must have a 'district_name' column.");

      const rows: { district_name: string }[] = [];
      const errors: string[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map(c => c.trim());
        const districtName = cols[nameIdx];
        if (!districtName) { errors.push(`Row ${i + 1}: missing district_name`); continue; }
        rows.push({ district_name: districtName });
      }

      if (rows.length === 0) throw new Error("No valid rows found.\n" + errors.join("\n"));

      const BATCH = 500;
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        const { error } = await supabase.from("districts").insert(batch);
        if (error) throw new Error(`Batch ${Math.floor(i / BATCH) + 1} failed: ${error.message}`);
      }

      qc.invalidateQueries({ queryKey: ["districts"] });
      toast({ title: `${rows.length} districts uploaded`, description: errors.length ? `${errors.length} rows skipped` : undefined });
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
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search districts..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9 h-9" />
        </div>
        <div className="flex gap-2">
          <input type="file" accept=".csv" ref={fileInputRef} className="hidden" onChange={handleBulkUpload} />
          <Button variant="outline" size="sm" onClick={downloadTemplate}><Download className="h-4 w-4 mr-1.5" />Template</Button>
          <Button variant="outline" size="sm" disabled={bulkUploading} onClick={() => fileInputRef.current?.click()}><Upload className="h-4 w-4 mr-1.5" />{bulkUploading ? "Uploading..." : "Bulk Upload"}</Button>
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1.5" />Add District</Button>
        </div>
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>District Name</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[160px]">Created</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
            ) : !data?.items?.length ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No districts found.</TableCell></TableRow>
            ) : data.items.map((d) => (
              <TableRow key={d.district_id}>
                <TableCell className="font-medium">{d.district_name}</TableCell>
                <TableCell>
                  <Badge variant={d.status ? "default" : "secondary"} className="cursor-pointer" onClick={() => toggleStatus.mutate({ id: d.district_id, status: d.status })}>
                    {d.status ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{format(new Date(d.created_at), "dd MMM yyyy")}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(d)}><Pencil className="h-3.5 w-3.5" /></Button>
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editId ? "Edit District" : "Create District"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>District Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dhaka" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={!name.trim() || save.isPending}>{save.isPending ? "Saving..." : editId ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
