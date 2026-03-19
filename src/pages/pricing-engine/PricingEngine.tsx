import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, isAfter, isBefore, startOfDay } from "date-fns";
import { Plus, Search, CalendarClock, Trash2, ChevronDown, ChevronRight } from "lucide-react";
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
const MANDATORY_COMPONENTS = ["BASE", "VAT", "SD"] as const;

type PriceTimeline = "CURRENT" | "UPCOMING" | "EXPIRED";

function getPriceTimeline(startDate: string, endDate: string | null): PriceTimeline {
  const today = startOfDay(new Date());
  const start = startOfDay(new Date(startDate));
  if (isAfter(start, today)) return "UPCOMING";
  if (endDate && isBefore(startOfDay(new Date(endDate)), today)) return "EXPIRED";
  return "CURRENT";
}

function TimelineBadge({ timeline }: { timeline: PriceTimeline }) {
  switch (timeline) {
    case "CURRENT":
      return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-200 hover:bg-emerald-500/20">Active</Badge>;
    case "UPCOMING":
      return <Badge className="bg-amber-500/15 text-amber-700 border-amber-200 hover:bg-amber-500/20"><CalendarClock className="h-3 w-3 mr-1" />Upcoming</Badge>;
    case "EXPIRED":
      return <Badge variant="secondary" className="opacity-60">Expired</Badge>;
  }
}

interface ComponentRow {
  component_name: string;
  component_type: "MANDATORY" | "CUSTOM";
  amount_bdt: string;
}

export default function PricingEngine() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  // Form state
  const [selectedProduct, setSelectedProduct] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [components, setComponents] = useState<ComponentRow[]>([
    { component_name: "BASE", component_type: "MANDATORY", amount_bdt: "" },
    { component_name: "VAT", component_type: "MANDATORY", amount_bdt: "" },
    { component_name: "SD", component_type: "MANDATORY", amount_bdt: "" },
  ]);
  const [customName, setCustomName] = useState("");

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
        .select(`*, product:products!product_price_versions_product_id_fkey(product_id, product_name, product_category)`, { count: "exact" })
        .order("start_date", { ascending: false });
      if (productFilter && productFilter !== "all") q = q.eq("product_id", productFilter);
      const { data, error, count } = await q.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      return { items: data, count: count ?? 0 };
    },
  });

  // Fetch components for expanded row
  const { data: expandedComponents } = useQuery({
    queryKey: ["price_components", expandedRow],
    enabled: !!expandedRow,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_components")
        .select("*")
        .eq("price_version_id", expandedRow!)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const totalFromComponents = components.reduce((s, c) => s + (parseFloat(c.amount_bdt) || 0), 0);

  const save = useMutation({
    mutationFn: async () => {
      // Create the price version first
      const { data: pv, error } = await supabase.from("product_price_versions").insert({
        product_id: selectedProduct,
        base_price_bdt: totalFromComponents,
        start_date: new Date(startDate).toISOString(),
        end_date: endDate ? new Date(endDate).toISOString() : null,
      }).select("price_version_id").single();
      if (error) throw error;

      // Insert component rows
      const compPayload = components.filter(c => parseFloat(c.amount_bdt) >= 0).map((c, i) => ({
        price_version_id: pv.price_version_id,
        component_name: c.component_name,
        component_type: c.component_type,
        amount_bdt: parseFloat(c.amount_bdt) || 0,
        sort_order: i,
      }));
      if (compPayload.length) {
        const { error: cErr } = await supabase.from("price_components").insert(compPayload);
        if (cErr) throw cErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product_price_versions"] });
      closeDialog();
      toast({ title: "Price version scheduled", description: `Total: ${formatBDT(totalFromComponents)}` });
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
    setStartDate("");
    setEndDate("");
    setComponents([
      { component_name: "BASE", component_type: "MANDATORY", amount_bdt: "" },
      { component_name: "VAT", component_type: "MANDATORY", amount_bdt: "" },
      { component_name: "SD", component_type: "MANDATORY", amount_bdt: "" },
    ]);
    setCustomName("");
  };

  const updateComponentAmount = (idx: number, val: string) => {
    setComponents(prev => prev.map((c, i) => i === idx ? { ...c, amount_bdt: val } : c));
  };

  const addCustomComponent = () => {
    if (!customName.trim()) return;
    setComponents(prev => [...prev, { component_name: customName.trim().toUpperCase(), component_type: "CUSTOM", amount_bdt: "" }]);
    setCustomName("");
  };

  const removeCustomComponent = (idx: number) => {
    setComponents(prev => prev.filter((_, i) => i !== idx));
  };

  const totalPages = Math.ceil((data?.count ?? 0) / PAGE_SIZE);
  const canSave = selectedProduct && startDate && totalFromComponents > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Pricing Engine</h1>
        <p className="text-sm text-muted-foreground">Component-based pricing with VAT, SD, and custom levies. Click a row to see the breakdown.</p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9 h-9" />
          </div>
          <Select value={productFilter} onValueChange={(v) => { setProductFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[220px] h-9"><SelectValue placeholder="Filter by product" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Products</SelectItem>
              {products?.map((p) => <SelectItem key={p.product_id} value={p.product_id}>{p.product_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1.5" />Schedule Price</Button>
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Total Price (BDT)</TableHead>
              <TableHead>Effective From</TableHead>
              <TableHead>Effective Until</TableHead>
              <TableHead className="w-[120px]">Timeline</TableHead>
              <TableHead className="w-[100px]">Enabled</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
            ) : !data?.items?.length ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No price versions found.</TableCell></TableRow>
            ) : data.items.map((pv: any) => {
              const timeline = getPriceTimeline(pv.start_date, pv.end_date);
              const isExpanded = expandedRow === pv.price_version_id;
              return (
                <>
                  <TableRow
                    key={pv.price_version_id}
                    className={`cursor-pointer ${timeline === "UPCOMING" ? "bg-amber-500/5" : timeline === "EXPIRED" ? "opacity-60" : ""}`}
                    onClick={() => setExpandedRow(isExpanded ? null : pv.price_version_id)}
                  >
                    <TableCell className="px-2">
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </TableCell>
                    <TableCell className="font-medium">{pv.product?.product_name ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{pv.product?.product_category ?? "—"}</Badge></TableCell>
                    <TableCell className="font-mono font-semibold">{formatBDT(Number(pv.base_price_bdt))}</TableCell>
                    <TableCell className="text-sm">{format(new Date(pv.start_date), "dd MMM yyyy")}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{pv.end_date ? format(new Date(pv.end_date), "dd MMM yyyy") : "—"}</TableCell>
                    <TableCell><TimelineBadge timeline={timeline} /></TableCell>
                    <TableCell>
                      <Badge
                        variant={pv.status ? "default" : "secondary"}
                        className="cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); toggleStatus.mutate({ id: pv.price_version_id, status: pv.status }); }}
                      >
                        {pv.status ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow key={`${pv.price_version_id}-exp`}>
                      <TableCell colSpan={8} className="bg-muted/30 px-8 py-3">
                        <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Price Component Breakdown</div>
                        {!expandedComponents?.length ? (
                          <p className="text-sm text-muted-foreground italic">No component breakdown recorded (legacy single-price record).</p>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {expandedComponents.map((c: any) => (
                              <div key={c.component_id} className="flex items-center justify-between border rounded-md px-3 py-2 bg-background">
                                <span className="text-xs font-medium">{c.component_name}</span>
                                <span className="font-mono text-sm font-semibold">{formatBDT(Number(c.amount_bdt))}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </>
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

      {/* Schedule New Price Dialog */}
      <Dialog open={open} onOpenChange={(v) => { if (!v) closeDialog(); else setOpen(true); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Schedule New Component-Based Price</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2">Define individual BDT amounts for each pricing component. Total = sum of all components.</p>
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

            {/* Mandatory Components */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Mandatory Components (BDT)</Label>
              <div className="space-y-2">
                {components.filter(c => c.component_type === "MANDATORY").map((c, idx) => (
                  <div key={c.component_name} className="flex items-center gap-3">
                    <span className="w-16 text-sm font-medium">{c.component_name}</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={c.amount_bdt}
                      onChange={(e) => updateComponentAmount(idx, e.target.value)}
                      className="flex-1"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Custom levies */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Custom Levies (Optional)</Label>
              {components.filter(c => c.component_type === "CUSTOM").map((c) => {
                const realIdx = components.indexOf(c);
                return (
                  <div key={realIdx} className="flex items-center gap-3">
                    <span className="w-24 text-sm font-medium truncate">{c.component_name}</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={c.amount_bdt}
                      onChange={(e) => updateComponentAmount(realIdx, e.target.value)}
                      className="flex-1"
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeCustomComponent(realIdx)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
              <div className="flex items-center gap-2">
                <Input placeholder="e.g. Surcharge, SC" value={customName} onChange={(e) => setCustomName(e.target.value)} className="flex-1" />
                <Button variant="outline" size="sm" onClick={addCustomComponent} disabled={!customName.trim()}>Add Levy</Button>
              </div>
            </div>

            {/* Total */}
            <div className="flex items-center justify-between border-t pt-3">
              <span className="font-semibold text-sm">Total Customer Price</span>
              <span className="font-mono text-lg font-bold text-primary">{formatBDT(totalFromComponents)}</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Effective Date</Label>
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
            <Button onClick={() => save.mutate()} disabled={!canSave || save.isPending}>
              {save.isPending ? "Saving..." : "Schedule Price"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
