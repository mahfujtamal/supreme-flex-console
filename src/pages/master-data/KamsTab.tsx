import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Plus, Search, Upload, Pencil } from "lucide-react";
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

export default function KamsTab() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [kamId, setKamId] = useState("");
  const [name, setName] = useState("");
  const [msisdn, setMsisdn] = useState("");
  const [segments, setSegments] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const [csvRows, setCsvRows] = useState<any[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["kams", page, search],
    queryFn: async () => {
      let q = supabase.from("kams").select("*", { count: "exact" }).order("created_at", { ascending: false });
      if (search) q = q.or(`kam_id.ilike.%${search}%,name.ilike.%${search}%,msisdn.ilike.%${search}%`);
      const { data, error, count } = await q.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      return { items: data, count: count ?? 0 };
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const segArr = segments.split(",").map(s => s.trim()).filter(Boolean);
      const payload = { kam_id: kamId.trim(), name: name.trim(), msisdn: msisdn.trim(), assigned_segments: segArr };
      if (editId) {
        const { error } = await supabase.from("kams").update({ name: name.trim(), msisdn: msisdn.trim(), assigned_segments: segArr } as any).eq("kam_id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("kams").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["kams"] }); closeDialog(); toast({ title: editId ? "KAM updated" : "KAM created" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const newStatus = status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      const { error } = await supabase.from("kams").update({ status: newStatus } as any).eq("kam_id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kams"] }),
  });

  const bulkImport = useMutation({
    mutationFn: async (rows: any[]) => {
      const { error } = await supabase.from("kams").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["kams"] }); setBulkOpen(false); setCsvRows([]); setCsvErrors([]); toast({ title: `${csvRows.length} KAMs imported` }); },
    onError: (e: Error) => toast({ title: "Import failed", description: e.message, variant: "destructive" }),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) { setCsvErrors(["File must have a header and data rows"]); return; }

    const header = lines[0].split(",").map(h => h.trim().toLowerCase());
    const reqCols = ["kam_id", "name", "msisdn"];
    const missing = reqCols.filter(c => !header.includes(c));
    if (missing.length) { setCsvErrors([`Missing columns: ${missing.join(", ")}`]); return; }

    const errors: string[] = [];
    const rows: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map(c => c.trim());
      const row: any = {};
      header.forEach((h, idx) => row[h] = cols[idx] ?? "");
      if (!row.kam_id || !row.name || !row.msisdn) { errors.push(`Row ${i + 1}: missing required fields`); continue; }
      const segArr = (row.segments || "").split("|").map((s: string) => s.trim()).filter(Boolean);
      rows.push({ kam_id: row.kam_id, name: row.name, msisdn: row.msisdn, assigned_segments: segArr });
    }
    setCsvErrors(errors);
    setCsvRows(rows);
  };

  const closeDialog = () => { setOpen(false); setEditId(null); setKamId(""); setName(""); setMsisdn(""); setSegments(""); };
  const openEdit = (item: any) => { setEditId(item.kam_id); setKamId(item.kam_id); setName(item.name); setMsisdn(item.msisdn); setSegments((item.assigned_segments ?? []).join(", ")); setOpen(true); };
  const totalPages = Math.ceil((data?.count ?? 0) / PAGE_SIZE);
  const canSave = kamId.trim() && name.trim() && msisdn.trim();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by ID, name, or MSISDN..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9 h-9" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)}><Upload className="h-4 w-4 mr-1.5" />Bulk Upload</Button>
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1.5" />Add KAM</Button>
        </div>
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>KAM ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>MSISDN</TableHead>
              <TableHead>Segments</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[160px]">Created</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
            ) : !data?.items?.length ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No KAMs found.</TableCell></TableRow>
            ) : data.items.map((k: any) => (
              <TableRow key={k.kam_id}>
                <TableCell className="font-mono text-sm">{k.kam_id}</TableCell>
                <TableCell className="font-medium">{k.name}</TableCell>
                <TableCell className="text-sm">{k.msisdn}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(k.assigned_segments ?? []).map((s: string) => (
                      <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                    ))}
                    {!(k.assigned_segments ?? []).length && <span className="text-sm text-muted-foreground">—</span>}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={k.status === "ACTIVE" ? "default" : "secondary"} className="cursor-pointer" onClick={() => toggleStatus.mutate({ id: k.kam_id, status: k.status })}>
                    {k.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{format(new Date(k.created_at), "dd MMM yyyy")}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(k)}><Pencil className="h-3.5 w-3.5" /></Button>
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editId ? "Edit KAM" : "Create KAM"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>KAM ID (Employee ID)</Label>
              <Input value={kamId} onChange={(e) => setKamId(e.target.value)} placeholder="e.g. EMP-B2B-001" disabled={!!editId} />
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Karim Ahmed" />
            </div>
            <div className="space-y-2">
              <Label>MSISDN</Label>
              <Input value={msisdn} onChange={(e) => setMsisdn(e.target.value)} placeholder="e.g. 01798765432" />
            </div>
            <div className="space-y-2">
              <Label>Assigned Segments (comma-separated)</Label>
              <Input value={segments} onChange={(e) => setSegments(e.target.value)} placeholder="e.g. Enterprise, SME, Government" />
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
          <DialogHeader><DialogTitle>Bulk Upload KAMs</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">CSV columns: <code>kam_id, name, msisdn, segments</code> (segments pipe-delimited: <code>Enterprise|SME</code>)</p>
            <Input type="file" accept=".csv" onChange={handleFileUpload} />
            {csvErrors.length > 0 && (
              <div className="bg-destructive/10 text-destructive text-xs p-3 rounded-md space-y-1">
                {csvErrors.map((e, i) => <p key={i}>{e}</p>)}
              </div>
            )}
            {csvRows.length > 0 && <p className="text-sm text-muted-foreground">{csvRows.length} rows ready to import</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBulkOpen(false); setCsvRows([]); setCsvErrors([]); }}>Cancel</Button>
            <Button onClick={() => bulkImport.mutate(csvRows)} disabled={!csvRows.length || bulkImport.isPending}>
              {bulkImport.isPending ? "Importing..." : `Import ${csvRows.length} rows`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
