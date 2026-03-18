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

export default function ChannelsTab() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [isAssisted, setIsAssisted] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["channels", page, search],
    queryFn: async () => {
      let q = supabase.from("channels").select("*", { count: "exact" }).order("created_at", { ascending: false });
      if (search) q = q.ilike("channel_name", `%${search}%`);
      const { data, error, count } = await q.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      return { items: data, count: count ?? 0 };
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = { channel_name: name, is_assisted: isAssisted };
      if (editId) {
        const { error } = await supabase.from("channels").update(payload).eq("channel_id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("channels").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["channels"] }); closeDialog(); toast({ title: editId ? "Channel updated" : "Channel created" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: boolean }) => {
      const { error } = await supabase.from("channels").update({ status: !status }).eq("channel_id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["channels"] }),
  });

  const closeDialog = () => { setOpen(false); setEditId(null); setName(""); setIsAssisted(false); };
  const openEdit = (item: any) => { setEditId(item.channel_id); setName(item.channel_name); setIsAssisted(item.is_assisted ?? false); setOpen(true); };
  const totalPages = Math.ceil((data?.count ?? 0) / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search channels..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9 h-9" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled><Upload className="h-4 w-4 mr-1.5" />Bulk Upload</Button>
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1.5" />Add Channel</Button>
        </div>
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Channel Name</TableHead>
              <TableHead className="w-[100px]">Assisted</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[160px]">Created</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
            ) : !data?.items?.length ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No channels found.</TableCell></TableRow>
            ) : data.items.map((c) => (
              <TableRow key={c.channel_id}>
                <TableCell className="font-medium">{c.channel_name}</TableCell>
                <TableCell>
                  <Badge variant={c.status ? "default" : "secondary"} className="cursor-pointer" onClick={() => toggleStatus.mutate({ id: c.channel_id, status: c.status })}>
                    {c.status ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{format(new Date(c.created_at), "dd MMM yyyy")}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
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
          <DialogHeader><DialogTitle>{editId ? "Edit Channel" : "Create Channel"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Channel Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Retail" />
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
