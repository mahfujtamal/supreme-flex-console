import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Plus, Search, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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

export default function HubManagersTab() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [msisdn, setMsisdn] = useState("");
  const [assignmentType, setAssignmentType] = useState<"channel" | "sub_channel">("channel");
  const [channelId, setChannelId] = useState("");
  const [subChannelId, setSubChannelId] = useState("");
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

  const { data, isLoading } = useQuery({
    queryKey: ["hub_managers", page, search],
    queryFn: async () => {
      let q = supabase.from("hub_managers").select("*, channels(channel_name), sub_channels(sub_channel_name)", { count: "exact" }).order("created_at", { ascending: false });
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
        channel_id: assignmentType === "channel" ? channelId : null,
        sub_channel_id: assignmentType === "sub_channel" ? subChannelId : null,
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

  const closeDialog = () => { setOpen(false); setEditId(null); setName(""); setEmail(""); setMsisdn(""); setChannelId(""); setSubChannelId(""); setAssignmentType("channel"); };
  const openEdit = (item: any) => {
    setEditId(item.hub_manager_id); setName(item.name); setEmail(item.email); setMsisdn(item.msisdn);
    if (item.sub_channel_id) { setAssignmentType("sub_channel"); setSubChannelId(item.sub_channel_id); setChannelId(""); }
    else { setAssignmentType("channel"); setChannelId(item.channel_id ?? ""); setSubChannelId(""); }
    setOpen(true);
  };
  const totalPages = Math.ceil((data?.count ?? 0) / PAGE_SIZE);
  const canSave = name.trim() && email.trim() && msisdn.trim() && (assignmentType === "channel" ? channelId : subChannelId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search hub managers..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9 h-9" />
        </div>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1.5" />Add Hub Manager</Button>
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
                <TableCell>
                  {hm.channels?.channel_name ? (
                    <Badge variant="outline" className="text-xs">Channel: {hm.channels.channel_name}</Badge>
                  ) : hm.sub_channels?.sub_channel_name ? (
                    <Badge variant="default" className="text-xs">Sub: {hm.sub_channels.sub_channel_name}</Badge>
                  ) : <span className="text-muted-foreground text-sm">—</span>}
                </TableCell>
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
              <Select value={assignmentType} onValueChange={(v: "channel" | "sub_channel") => { setAssignmentType(v); setChannelId(""); setSubChannelId(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="channel">Channel Level (B2B / DH)</SelectItem>
                  <SelectItem value="sub_channel">Sub-Channel Level (Direct Delivery)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {assignmentType === "channel" ? (
              <div className="space-y-2">
                <Label>Channel</Label>
                <Select value={channelId} onValueChange={setChannelId}>
                  <SelectTrigger><SelectValue placeholder="Select channel" /></SelectTrigger>
                  <SelectContent>
                    {channels?.map((c: any) => <SelectItem key={c.channel_id} value={c.channel_id}>{c.channel_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : (
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
