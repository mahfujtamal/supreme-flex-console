import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Plus, Search } from "lucide-react";
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
import { formatBDT } from "@/lib/currency";

const PAGE_SIZE = 10;

export default function PricingEngine() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  // Form state
  const [selectedProduct, setSelectedProduct] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data: products } = useQuery({
    queryKey: ["products_all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("product_id, product_name").eq("status", true).order("product_name");
      if (error) throw error;
      return data;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["product_price_versions", page, search, productFilter],
    queryFn: async () => {
      let q = supabase
        .from("product_price_versions")
        .select(`
          *,
          product:products!product_price_versions_product_id_fkey(product_id, product_name, product_category)
        `, { count: "exact" })
        .order("start_date", { ascending: false });
      if (productFilter && productFilter !== "all") {
        q = q.eq("product_id", productFilter);
      }
      const { data, error, count } = await q.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      return { items: data, count: count ?? 0 };
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("product_price_versions").insert({
        product_id: selectedProduct,
        base_price_bdt: parseFloat(basePrice),
        start_date: new Date(startDate).toISOString(),
        end_date: endDate ? new Date(endDate).toISOString() : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product_price_versions"] });
      closeDialog();
      toast({ title: "Price version created" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: boolean }) => {
      const { error } = await supabase.from("product_price_versions").update({ status: !status }).eq("price_version_id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["product_price_versions"] }),
  });

  const closeDialog = () => {
    setOpen(false);
    setSelectedProduct("");
    setBasePrice("");
    setStartDate("");
    setEndDate("");
  };

  const totalPages = Math.ceil((data?.count ?? 0) / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Pricing Engine</h1>
        <p className="text-sm text-muted-foreground">Manage product price versions and pricing timeline.</p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9 h-9" />
          </div>
          <Select value={productFilter} onValueChange={(v) => { setProductFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[220px] h-9">
              <SelectValue placeholder="Filter by product" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Products</SelectItem>
              {products?.map((p) => <SelectItem key={p.product_id} value={p.product_id}>{p.product_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1.5" />New Price Version</Button>
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Base Price</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>End Date</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
            ) : !data?.items?.length ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No price versions found.</TableCell></TableRow>
            ) : data.items.map((pv: any) => (
              <TableRow key={pv.price_version_id}>
                <TableCell className="font-medium">{pv.product?.product_name ?? "—"}</TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{pv.product?.product_category ?? "—"}</Badge></TableCell>
                <TableCell className="font-mono">{formatBDT(Number(pv.base_price_bdt))}</TableCell>
                <TableCell className="text-sm">{format(new Date(pv.start_date), "dd MMM yyyy")}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{pv.end_date ? format(new Date(pv.end_date), "dd MMM yyyy") : "—"}</TableCell>
                <TableCell>
                  <Badge variant={pv.status ? "default" : "secondary"} className="cursor-pointer" onClick={() => toggleStatus.mutate({ id: pv.price_version_id, status: pv.status })}>
                    {pv.status ? "Active" : "Inactive"}
                  </Badge>
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
          <DialogHeader><DialogTitle>Create New Price Version</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Product</Label>
              <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>
                  {products?.map((p) => <SelectItem key={p.product_id} value={p.product_id}>{p.product_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Base Price (BDT)</Label>
              <Input type="number" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} placeholder="e.g. 999.00" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>End Date (optional)</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={!selectedProduct || !basePrice || !startDate || save.isPending}>
              {save.isPending ? "Saving..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
