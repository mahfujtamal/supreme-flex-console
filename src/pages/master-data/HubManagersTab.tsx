import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Plus, Search, Pencil, Download, Upload } from "lucide-react";
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

type AssignmentType = "dh" | "sub_channel" | "b2b";

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else current += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { result.push(current); current = ""; }
      else current += ch;
    }
  }
  result.push(current);
  return result;
}

export default function HubManagersTab() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [msisdn, setMsisdn] = useState("");
  const [assignmentType, setAssignmentType] = useState<AssignmentType>("dh");
  const [channelId, setChannelId] = useState("");
  const [subChannelId, setSubChannelId] = useState("");
  const [dhId, setDhId] = useState("");
  const [bulkUploading, setBulkUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: channels } = useQuery({
    queryKey: ["channels_lookup_hm"],
    queryFn: async () => {
      const { data } = await supabase.from("channels").select("channel_id, channel_name").eq("status", true).order("channel_name");
      return data ?? [];
    },
  });

  const { data: subChannels } = useQuery({
    queryKey: ["sub_channels_direct_delivery"],
    queryFn: async () => {
      const { data } = await supabase.from("sub_channels").select("sub_channel_id, sub_channel_name, channel_id, channels(channel_name), is_direct_delivery").eq("status", true).eq("is_direct_delivery", true);
      return data ?? [];
    },
  });

  const { data: distributionHouses } = useQuery({
    queryKey: ["dhs_lookup_hm"],
    queryFn: async () => {
      const { data } = await supabase.from("distribution_houses").select("dh_id, name, dh_code").eq("status", "ACTIVE" as any).order("name");
      return data ?? [];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["hub_managers", page, search],
    queryFn: async () => {
      let q = supabase.from("hub_managers").select("*, channels(channel_name), sub_channels(sub_channel_name), distribution_houses(name, dh_code)", { count: "exact" }).order("created_at", { ascending: false });
      if (search) q = q.or(`name.ilike.%${search}%,email.ilike.%${search}%,msisdn.ilike.%${search}%`);
      const { data, error, count } = await q.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      return { items: data, count: count ?? 0 };
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: name.trim(),
        email: email.trim(),
        msisdn: msisdn.trim(),
        channel_id: null,
        sub_channel_id: assignmentType === "sub_channel" ? subChannelId : null,
        dh_id: assignmentType === "dh" ? dhId : null,
      };
      if (editId) {
        const { error } = await supabase.from("hub_managers").update(payload).eq("hub_manager_id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("hub_managers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hub_managers"] }); closeDialog(); toast({ title: editId ? "Hub Manager updated" : "Hub Manager created" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("hub_managers").update({ status: status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }).eq("hub_manager_id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hub_managers"] }),
  });

  const downloadTemplate = () => {
    const csv = "name,email,msisdn,assignment_type,assignment_name\nRafiq Ahmed,rafiq@gpfi.com,01712345678,dh,DH-001\nKarim Ali,karim@gpfi.com,01798765432,sub_channel,Robi Direct\nSaleha Begum,saleha@gpfi.com,01611223344,b2b,\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "hub_manager_bulk_template.csv"; a.click();
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
      const nameIdx = header.indexOf("name");
      const emailIdx = header.indexOf("email");
      const msisdnIdx = header.indexOf("msisdn");
      const typeIdx = header.indexOf("assignment_type");
      const assignIdx = header.indexOf("assignment_name");
      if (nameIdx < 0 || emailIdx < 0 || msisdnIdx < 0 || typeIdx < 0) {
        throw new Error("CSV must have columns: name, email, msisdn, assignment_type");
      }

      // Build lookup maps
      const { data: allDHs } = await supabase.from("distribution_houses").select("dh_id, name, dh_code").eq("status", "ACTIVE" as any);
      const dhMap = new Map<string, string>();
      for (const dh of allDHs ?? []) {
        dhMap.set(dh.name.toLowerCase(), dh.dh_id);
        dhMap.set(dh.dh_code.toLowerCase(), dh.dh_id);
      }

      const { data: allSC } = await supabase.from("sub_channels").select("sub_channel_id, sub_channel_name").eq("status", true).eq("is_direct_delivery", true);
      const scMap = new Map<string, string>();
      for (const sc of allSC ?? []) {
        scMap.set(sc.sub_channel_name.toLowerCase(), sc.sub_channel_id);
      }

      const rows: any[] = [];
      const errors: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        const rName = cols[nameIdx]?.trim();
        const rEmail = cols[emailIdx]?.trim();
        const rMsisdn = cols[msisdnIdx]?.trim();
        const rType = cols[typeIdx]?.trim().toLowerCase();
        const rAssign = assignIdx >= 0 ? cols[assignIdx]?.trim() : "";

        if (!rName || !rEmail || !rMsisdn) { errors.push(`Row ${i + 1}: missing name, email, or msisdn`); continue; }
        if (!["dh", "sub_channel", "b2b"].includes(rType)) { errors.push(`Row ${i + 1}: invalid assignment_type "${rType}" (use dh, sub_channel, or b2b)`); continue; }

        const payload: any = { name: rName, email: rEmail, msisdn: rMsisdn, channel_id: null, sub_channel_id: null, dh_id: null };

        if (rType === "dh") {
          const dhIdFound = dhMap.get(rAssign.toLowerCase());
          if (!dhIdFound) { errors.push(`Row ${i + 1}: DH "${rAssign}" not found (use DH name or code)`); continue; }
          payload.dh_id = dhIdFound;
        } else if (rType === "sub_channel") {
          const scIdFound = scMap.get(rAssign.toLowerCase());
          if (!scIdFound) { errors.push(`Row ${i + 1}: direct-delivery sub-channel "${rAssign}" not found`); continue; }
          payload.sub_channel_id = scIdFound;
        }
        // b2b: no assignment needed

        rows.push(payload);
      }

      if (rows.length === 0) throw new Error("No valid rows found.\n" + errors.slice(0, 10).join("\n"));

      const BATCH = 500;
      for (let i = 0; i < rows.length; i += BATCH) {
        const { error } = await supabase.from("hub_managers").insert(rows.slice(i, i + BATCH));
        if (error) throw error;
      }

      qc.invalidateQueries({ queryKey: ["hub_managers"] });
      toast({ title: `${rows.length} Hub Managers uploaded`, description: errors.length ? `${errors.length} warnings` : undefined });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setBulkUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const closeDialog = () => { setOpen(false); setEditId(null); setName(""); setEmail(""); setMsisdn(""); setChannelId(""); setSubChannelId(""); setDhId(""); setAssignmentType("dh"); };
  const openEdit = (item: any) => {
    setEditId(item.hub_manager_id); setName(item.name); setEmail(item.email); setMsisdn(item.msisdn);
    if (item.dh_id) { setAssignmentType("dh"); setDhId(item.dh_id); setChannelId(""); setSubChannelId(""); }
    else if (item.sub_channel_id) { setAssignmentType("sub_channel"); setSubChannelId(item.sub_channel_id); setChannelId(""); setDhId(""); }
    else { setAssignmentType("b2b"); setChannelId(""); setSubChannelId(""); setDhId(""); }
    setOpen(true);
  };
  const totalPages = Math.ceil((data?.count ?? 0) / PAGE_SIZE);

  const canSave = name.trim() && email.trim() && msisdn.trim() && (
    assignmentType === "dh" ? dhId :
    assignmentType === "sub_channel" ? subChannelId :
    true
  );

  const getAssignmentLabel = (hm: any) => {
    if (hm.distribution_houses?.name) {
      return <Badge variant="outline" className="text-xs">DH: {hm.distribution_houses.name} ({hm.distribution_houses.dh_code})</Badge>;
    }
    if (hm.sub_channels?.sub_channel_name) {
      return <Badge variant="default" className="text-xs">Sub-Ch: {hm.sub_channels.sub_channel_name}</Badge>;
    }
    if (!hm.dh_id && !hm.sub_channel_id) {
      return <Badge variant="secondary" className="text-xs">B2B Central</Badge>;
    }
    return <span className="text-muted-foreground text-sm">—</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search hub managers..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9 h-9" />
        </div>
        <div className="flex gap-2">
          <input type="file" accept=".csv" ref={fileInputRef} className="hidden" onChange={handleBulkUpload} />
          <Button variant="outline" size="sm" onClick={downloadTemplate}><Download className="h-4 w-4 mr-1" />Template</Button>
          <Button variant="outline" size="sm" disabled={bulkUploading} onClick={() => fileInputRef.current?.click()}><Upload className="h-4 w-4 mr-1.5" />{bulkUploading ? "Uploading..." : "Bulk Upload"}</Button>
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1.5" />Add Hub Manager</Button>
        </div>
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>MSISDN</TableHead>
              <TableHead>Assignment</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[140px]">Created</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
            ) : !data?.items?.length ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No hub managers found.</TableCell></TableRow>
            ) : data.items.map((hm: any) => (
              <TableRow key={hm.hub_manager_id}>
                <TableCell className="font-medium">{hm.name}</TableCell>
                <TableCell className="text-sm">{hm.email}</TableCell>
                <TableCell className="text-sm">{hm.msisdn}</TableCell>
                <TableCell>{getAssignmentLabel(hm)}</TableCell>
                <TableCell>
                  <Badge variant={hm.status === "ACTIVE" ? "default" : "secondary"} className="cursor-pointer" onClick={() => toggleStatus.mutate({ id: hm.hub_manager_id, status: hm.status })}>
                    {hm.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{format(new Date(hm.created_at), "dd MMM yyyy")}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(hm)}><Pencil className="h-3.5 w-3.5" /></Button>
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
          <DialogHeader><DialogTitle>{editId ? "Edit Hub Manager" : "Create Hub Manager"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rafiq Ahmed" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. rafiq@gpfi.com" />
            </div>
            <div className="space-y-2">
              <Label>MSISDN</Label>
              <Input value={msisdn} onChange={(e) => setMsisdn(e.target.value)} placeholder="e.g. 01712345678" />
            </div>
            <div className="space-y-2">
              <Label>Assignment Level</Label>
              <Select value={assignmentType} onValueChange={(v: AssignmentType) => { setAssignmentType(v); setChannelId(""); setSubChannelId(""); setDhId(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dh">Distribution House</SelectItem>
                  <SelectItem value="sub_channel">Sub-Channel (Direct Delivery)</SelectItem>
                  <SelectItem value="b2b">B2B Central (assigns to KAMs)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {assignmentType === "dh" && (
              <div className="space-y-2">
                <Label>Distribution House</Label>
                <Select value={dhId} onValueChange={setDhId}>
                  <SelectTrigger><SelectValue placeholder="Select DH" /></SelectTrigger>
                  <SelectContent>
                    {!distributionHouses?.length ? (
                      <SelectItem value="__none" disabled>No active DHs</SelectItem>
                    ) : distributionHouses.map((dh: any) => (
                      <SelectItem key={dh.dh_id} value={dh.dh_id}>{dh.name} ({dh.dh_code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {assignmentType === "b2b" && (
              <p className="text-sm text-muted-foreground">This hub manager will directly assign assets to KAMs.</p>
            )}
            {assignmentType === "sub_channel" && (
              <div className="space-y-2">
                <Label>Direct-Delivery Sub-Channel</Label>
                <Select value={subChannelId} onValueChange={setSubChannelId}>
                  <SelectTrigger><SelectValue placeholder="Select sub-channel" /></SelectTrigger>
                  <SelectContent>
                    {!subChannels?.length ? (
                      <SelectItem value="__none" disabled>No direct-delivery sub-channels</SelectItem>
                    ) : subChannels.map((sc: any) => (
                      <SelectItem key={sc.sub_channel_id} value={sc.sub_channel_id}>{sc.sub_channel_name} ({(sc as any).channels?.channel_name})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
