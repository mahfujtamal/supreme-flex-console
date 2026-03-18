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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const PAGE_SIZE = 10;

export default function FieldAgentsTab() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [agentId, setAgentId] = useState("");
  const [agentName, setAgentName] = useState("");
  const [msisdn, setMsisdn] = useState("");
  const [dhId, setDhId] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const [csvRows, setCsvRows] = useState<any[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);

  const { data: dhList } = useQuery({
    queryKey: ["dh_lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("distribution_houses").select("dh_id, dh_code, name, status");
      return data ?? [];
    },
  });

  const { data: subChannelList } = useQuery({
    queryKey: ["sub_channel_lookup_agents"],
    queryFn: async () => {
      const { data } = await supabase.from("sub_channels").select("sub_channel_id, sub_channel_name, channel_id, channels(channel_name, is_self_delivered), override_delivery_ownership").eq("status", true);
      return (data ?? []).filter((sc: any) => sc.channels?.is_self_delivered || sc.override_delivery_ownership);
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["field_agents", page, search],
    queryFn: async () => {
      let q = supabase.from("field_agents").select("*, distribution_houses(dh_code, name, status)", { count: "exact" }).order("created_at", { ascending: false });
      if (search) q = q.or(`agent_id.ilike.%${search}%,agent_name.ilike.%${search}%,msisdn.ilike.%${search}%`);
      const { data, error, count } = await q.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      return { items: data, count: count ?? 0 };
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = { agent_id: agentId.trim(), agent_name: agentName.trim(), msisdn: msisdn.trim(), dh_id: dhId };
      if (editId) {
        const { error } = await supabase.from("field_agents").update({ agent_name: agentName.trim(), msisdn: msisdn.trim(), dh_id: dhId } as any).eq("agent_id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("field_agents").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["field_agents"] }); closeDialog(); toast({ title: editId ? "Agent updated" : "Agent created" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const newStatus = status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      const { error } = await supabase.from("field_agents").update({ status: newStatus } as any).eq("agent_id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["field_agents"] }),
  });

  const bulkImport = useMutation({
    mutationFn: async (rows: any[]) => {
      const { error } = await supabase.from("field_agents").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["field_agents"] }); setBulkOpen(false); setCsvRows([]); setCsvErrors([]); toast({ title: `${csvRows.length} agents imported` }); },
    onError: (e: Error) => toast({ title: "Import failed", description: e.message, variant: "destructive" }),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) { setCsvErrors(["File must have a header and data rows"]); return; }

    const header = lines[0].split(",").map(h => h.trim().toLowerCase());
    const reqCols = ["agent_id", "agent_name", "msisdn", "dh_code"];
    const missing = reqCols.filter(c => !header.includes(c));
    if (missing.length) { setCsvErrors([`Missing columns: ${missing.join(", ")}`]); return; }

    const { data: allDhs } = await supabase.from("distribution_houses").select("dh_id, dh_code");
    const dhMap = new Map((allDhs ?? []).map(d => [d.dh_code.toLowerCase(), d.dh_id]));

    const errors: string[] = [];
    const rows: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map(c => c.trim());
      const row: any = {};
      header.forEach((h, idx) => row[h] = cols[idx] ?? "");
      if (!row.agent_id || !row.agent_name || !row.msisdn) { errors.push(`Row ${i + 1}: missing required fields`); continue; }
      const did = dhMap.get(row.dh_code?.toLowerCase());
      if (!did) { errors.push(`Row ${i + 1}: DH code "${row.dh_code}" not found`); continue; }
      rows.push({ agent_id: row.agent_id, agent_name: row.agent_name, msisdn: row.msisdn, dh_id: did });
    }
    setCsvErrors(errors);
    setCsvRows(rows);
  };

  const closeDialog = () => { setOpen(false); setEditId(null); setAgentId(""); setAgentName(""); setMsisdn(""); setDhId(""); };
  const openEdit = (item: any) => { setEditId(item.agent_id); setAgentId(item.agent_id); setAgentName(item.agent_name); setMsisdn(item.msisdn); setDhId(item.dh_id); setOpen(true); };
  const totalPages = Math.ceil((data?.count ?? 0) / PAGE_SIZE);
  const canSave = agentId.trim() && agentName.trim() && msisdn.trim() && dhId;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by ID, name, or MSISDN..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9 h-9" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)}><Upload className="h-4 w-4 mr-1.5" />Bulk Upload</Button>
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1.5" />Add Agent</Button>
        </div>
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>MSISDN</TableHead>
              <TableHead>DH Code</TableHead>
              <TableHead>DH Status</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
            ) : !data?.items?.length ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No field agents found.</TableCell></TableRow>
            ) : data.items.map((a: any) => {
              const dhInactive = a.distribution_houses?.status === "INACTIVE";
              return (
                <TableRow key={a.agent_id} className={dhInactive ? "opacity-60" : ""}>
                  <TableCell className="font-mono text-sm">{a.agent_id}</TableCell>
                  <TableCell className="font-medium">{a.agent_name}</TableCell>
                  <TableCell className="text-sm">{a.msisdn}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.distribution_houses?.dh_code ?? "—"}</TableCell>
                  <TableCell>
                    {dhInactive ? (
                      <Badge variant="destructive" className="text-xs">DH Inactive</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">DH Active</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={a.status === "ACTIVE" ? "default" : "secondary"} className="cursor-pointer" onClick={() => toggleStatus.mutate({ id: a.agent_id, status: a.status })}>
                      {a.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(a)}><Pencil className="h-3.5 w-3.5" /></Button>
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editId ? "Edit Field Agent" : "Create Field Agent"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Agent ID</Label>
              <Input value={agentId} onChange={(e) => setAgentId(e.target.value)} placeholder="e.g. FA-001" disabled={!!editId} />
            </div>
            <div className="space-y-2">
              <Label>Agent Name</Label>
              <Input value={agentName} onChange={(e) => setAgentName(e.target.value)} placeholder="e.g. Rahim Uddin" />
            </div>
            <div className="space-y-2">
              <Label>MSISDN</Label>
              <Input value={msisdn} onChange={(e) => setMsisdn(e.target.value)} placeholder="e.g. 01712345678" />
            </div>
            <div className="space-y-2">
              <Label>Distribution House</Label>
              <Select value={dhId} onValueChange={setDhId}>
                <SelectTrigger><SelectValue placeholder="Select DH" /></SelectTrigger>
                <SelectContent>
                  {dhList?.filter(d => d.status === "ACTIVE").map(d => (
                    <SelectItem key={d.dh_id} value={d.dh_id}>{d.dh_code} — {d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          <DialogHeader><DialogTitle>Bulk Upload Field Agents</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">CSV columns: <code>agent_id, agent_name, msisdn, dh_code</code></p>
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
