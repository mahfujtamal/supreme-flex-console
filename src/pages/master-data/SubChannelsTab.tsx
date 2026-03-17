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

export default function SubChannelsTab() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [filterChannel, setFilterChannel] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [channelId, setChannelId] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: channels } = useQuery({
    queryKey: ["channels_lookup"],
    queryFn: async () => {
      const { data, error } = await supabase.from("channels").select("channel_id, channel_name").eq("status", true).order("channel_name");
      if (error) throw error;
      return data;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["sub_channels", page, search, filterChannel],
    queryFn: async () => {
      let q = supabase.from("sub_channels").select("*, channels(channel_name)", { count: "exact" }).order("created_at", { ascending: false });
      if (search) q = q.ilike("sub_channel_name", `%${search}%`);
      if (filterChannel !== "all") q = q.eq("channel_id", filterChannel);
      const { data, error, count } = await q.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      return { items: data, count: count ?? 0 };
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = { sub_channel_name: name, channel_id: channelId };
      if (editId) {
        const { error } = await supabase.from("sub_channels").update(payload).eq("sub_channel_id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("sub_channels").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sub_channels"] }); closeDialog(); toast({ title: editId ? "Sub-channel updated" : "Sub-channel created" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: boolean }) => {
      const { error } = await supabase.from("sub_channels").update({ status: !status }).eq("sub_channel_id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sub_channels"] }),
  });

  const closeDialog = () => { setOpen(false); setEditId(null); setName(""); setChannelId(""); };
  const openEdit = (item: any) => { setEditId(item.sub_channel_id); setName(item.sub_channel_name); setChannelId(item.channel_id); setOpen(true); };
  const totalPages = Math.ceil((data?.count ?? 0) / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative max-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search sub-channels..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9 h-9" />
          </div>
          <Select value={filterChannel} onValueChange={(v) => { setFilterChannel(v); setPage(0); }}>
            <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Channel" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Channels</SelectItem>
              {channels?.map((c) => <SelectItem key={c.channel_id} value={c.channel_id}>{c.channel_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled><Upload className="h-4 w-4 mr-1.5" />Bulk Upload</Button>
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1.5" />Add Sub-Channel</Button>
        </div>
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sub-Channel Name</TableHead>
              <TableHead>Parent Channel</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[160px]">Created</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
            ) : !data?.items?.length ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No sub-channels found.</TableCell></TableRow>
            ) : data.items.map((sc: any) => (
              <TableRow key={sc.sub_channel_id}>
                <TableCell className="font-medium">{sc.sub_channel_name}</TableCell>
                <TableCell className="text-sm">{sc.channels?.channel_name}</TableCell>
                <TableCell>
                  <Badge variant={sc.status ? "default" : "secondary"} className="cursor-pointer" onClick={() => toggleStatus.mutate({ id: sc.sub_channel_id, status: sc.status })}>
                    {sc.status ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{format(new Date(sc.created_at), "dd MMM yyyy")}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(sc)}><Pencil className="h-3.5 w-3.5" /></Button>
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
          <DialogHeader><DialogTitle>{editId ? "Edit Sub-Channel" : "Create Sub-Channel"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Sub-Channel Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Online Store" />
            </div>
            <div className="space-y-2">
              <Label>Parent Channel</Label>
              <Select value={channelId} onValueChange={setChannelId}>
                <SelectTrigger><SelectValue placeholder="Select channel" /></SelectTrigger>
                <SelectContent>
                  {channels?.map((c) => <SelectItem key={c.channel_id} value={c.channel_id}>{c.channel_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={!name.trim() || !channelId || save.isPending}>{save.isPending ? "Saving..." : editId ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
