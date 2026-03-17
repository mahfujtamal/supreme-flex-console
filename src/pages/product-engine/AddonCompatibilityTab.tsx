import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export default function AddonCompatibilityTab() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [addonId, setAddonId] = useState("");
  const [cpeId, setCpeId] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  // Fetch physical addons
  const { data: addons } = useQuery({
    queryKey: ["products_physical_addons"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products")
        .select("product_id, product_name")
        .eq("product_category", "ADDON")
        .eq("addon_type", "PHYSICAL")
        .eq("status", true);
      if (error) throw error;
      return data;
    },
  });

  // Fetch CPEs
  const { data: cpes } = useQuery({
    queryKey: ["products_cpes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products")
        .select("product_id, product_name")
        .eq("product_category", "CPE")
        .eq("status", true);
      if (error) throw error;
      return data;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["physical_addon_compatibility", page, search],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from("physical_addon_compatibility")
        .select(`
          compatibility_id,
          created_at,
          addon:products!physical_addon_compatibility_addon_product_id_fkey(product_id, product_name),
          cpe:products!physical_addon_compatibility_cpe_product_id_fkey(product_id, product_name)
        `, { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      return { items: data, count: count ?? 0 };
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("physical_addon_compatibility").insert({
        addon_product_id: addonId,
        cpe_product_id: cpeId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["physical_addon_compatibility"] });
      closeDialog();
      toast({ title: "Compatibility mapping created" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message.includes("duplicate") ? "This mapping already exists" : e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("physical_addon_compatibility").delete().eq("compatibility_id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["physical_addon_compatibility"] });
      toast({ title: "Mapping removed" });
    },
  });

  const closeDialog = () => { setOpen(false); setAddonId(""); setCpeId(""); };
  const totalPages = Math.ceil((data?.count ?? 0) / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search mappings..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9 h-9" />
        </div>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1.5" />Add Mapping</Button>
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Physical Addon</TableHead>
              <TableHead>Compatible CPE</TableHead>
              <TableHead className="w-[160px]">Created</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
            ) : !data?.items?.length ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No mappings found.</TableCell></TableRow>
            ) : data.items.map((m: any) => (
              <TableRow key={m.compatibility_id}>
                <TableCell className="font-medium">{m.addon?.product_name ?? "—"}</TableCell>
                <TableCell>{m.cpe?.product_name ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{format(new Date(m.created_at), "dd MMM yyyy")}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove.mutate(m.compatibility_id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
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
          <DialogHeader><DialogTitle>Add Compatibility Mapping</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Physical Addon</Label>
              <Select value={addonId} onValueChange={setAddonId}>
                <SelectTrigger><SelectValue placeholder="Select addon" /></SelectTrigger>
                <SelectContent>
                  {addons?.map((a) => <SelectItem key={a.product_id} value={a.product_id}>{a.product_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Compatible CPE</Label>
              <Select value={cpeId} onValueChange={setCpeId}>
                <SelectTrigger><SelectValue placeholder="Select CPE" /></SelectTrigger>
                <SelectContent>
                  {cpes?.map((c) => <SelectItem key={c.product_id} value={c.product_id}>{c.product_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={!addonId || !cpeId || save.isPending}>
              {save.isPending ? "Saving..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
