import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Plus, Search, Upload, Pencil } from "lucide-react";
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
const CATEGORIES = ["WIFI_PLAN", "CPE", "SIM", "ADDON"] as const;
const ADDON_TYPES = ["PHYSICAL", "DIGITAL"] as const;
const BILLING_TYPES = ["ONE_TIME", "RECURRING"] as const;
const NETWORK_CAPS = ["4G", "5G", "BOTH", "ANY"] as const;
const WARRANTY_UNITS = ["DAYS", "MONTHS", "YEARS"] as const;

type Category = typeof CATEGORIES[number];
type AddonType = typeof ADDON_TYPES[number];

function needsOneTime(cat: Category, addonType?: AddonType | null) {
  return cat === "CPE" || cat === "SIM" || (cat === "ADDON" && addonType === "PHYSICAL");
}

function needsRecurring(cat: Category) {
  return cat === "WIFI_PLAN";
}

function needsSerial(cat: Category, addonType?: AddonType | null) {
  return cat === "CPE" || (cat === "ADDON" && addonType === "PHYSICAL");
}

function showWarranty(cat: Category, addonType?: AddonType | null) {
  return cat === "CPE" || (cat === "ADDON" && addonType === "PHYSICAL");
}

export default function ProductCatalogTab() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  // Form state
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState<Category>("WIFI_PLAN");
  const [addonType, setAddonType] = useState<AddonType | "">("");
  const [billingType, setBillingType] = useState<string>("RECURRING");
  const [networkCap, setNetworkCap] = useState<string>("ANY");
  const [isExclusive, setIsExclusive] = useState(false);
  const [serialRequired, setSerialRequired] = useState(false);
  const [warrantyValue, setWarrantyValue] = useState("");
  const [warrantyUnit, setWarrantyUnit] = useState<string>("");

  // Auto-apply business rules when category/addonType change
  useEffect(() => {
    if (needsRecurring(category)) {
      setBillingType("RECURRING");
    } else if (needsOneTime(category, addonType as AddonType || undefined)) {
      setBillingType("ONE_TIME");
    }
    if (needsSerial(category, addonType as AddonType || undefined)) {
      setSerialRequired(true);
    }
  }, [category, addonType]);

  const { data, isLoading } = useQuery({
    queryKey: ["products", page, search],
    queryFn: async () => {
      let q = supabase.from("products").select("*", { count: "exact" }).order("created_at", { ascending: false });
      if (search) q = q.ilike("product_name", `%${search}%`);
      const { data, error, count } = await q.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      return { items: data, count: count ?? 0 };
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        product_name: productName,
        product_category: category,
        addon_type: category === "ADDON" ? addonType || null : null,
        billing_type: billingType,
        network_capability: networkCap,
        is_exclusive: isExclusive,
        serial_required: serialRequired,
        warranty_value: showWarranty(category, addonType as AddonType) && warrantyValue ? parseInt(warrantyValue) : null,
        warranty_unit: showWarranty(category, addonType as AddonType) && warrantyUnit ? warrantyUnit : null,
      };
      if (editId) {
        const { error } = await supabase.from("products").update(payload).eq("product_id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      closeDialog();
      toast({ title: editId ? "Product updated" : "Product created" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: boolean }) => {
      const { error } = await supabase.from("products").update({ status: !status }).eq("product_id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });

  const closeDialog = () => {
    setOpen(false);
    setEditId(null);
    setProductName("");
    setCategory("WIFI_PLAN");
    setAddonType("");
    setBillingType("RECURRING");
    setNetworkCap("ANY");
    setIsExclusive(false);
    setSerialRequired(false);
    setWarrantyValue("");
    setWarrantyUnit("");
  };

  const openEdit = (p: any) => {
    setEditId(p.product_id);
    setProductName(p.product_name);
    setCategory(p.product_category);
    setAddonType(p.addon_type || "");
    setBillingType(p.billing_type);
    setNetworkCap(p.network_capability);
    setIsExclusive(p.is_exclusive);
    setSerialRequired(p.serial_required);
    setWarrantyValue(p.warranty_value?.toString() || "");
    setWarrantyUnit(p.warranty_unit || "");
    setOpen(true);
  };

  const totalPages = Math.ceil((data?.count ?? 0) / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search products..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9 h-9" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled><Upload className="h-4 w-4 mr-1.5" />Bulk Upload</Button>
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1.5" />Add Product</Button>
        </div>
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Billing</TableHead>
              <TableHead>Network</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[140px]">Created</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
            ) : !data?.items?.length ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No products found.</TableCell></TableRow>
            ) : data.items.map((p) => (
              <TableRow key={p.product_id}>
                <TableCell className="font-medium">{p.product_name}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {p.product_category}{p.addon_type ? ` / ${p.addon_type}` : ""}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{p.billing_type}</TableCell>
                <TableCell className="text-sm">{p.network_capability}</TableCell>
                <TableCell>
                  <Badge variant={p.status ? "default" : "secondary"} className="cursor-pointer" onClick={() => toggleStatus.mutate({ id: p.product_id, status: p.status })}>
                    {p.status ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{format(new Date(p.created_at), "dd MMM yyyy")}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editId ? "Edit Product" : "Create Product"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Product Name</Label>
              <Input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="e.g. FWA Home 50Mbps" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.replace("_", " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {category === "ADDON" && (
                <div className="space-y-2">
                  <Label>Addon Type</Label>
                  <Select value={addonType} onValueChange={(v) => setAddonType(v as AddonType)}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      {ADDON_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Billing Type</Label>
                <Select value={billingType} onValueChange={setBillingType} disabled={needsRecurring(category) || needsOneTime(category, addonType as AddonType || undefined)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BILLING_TYPES.map((b) => <SelectItem key={b} value={b}>{b.replace("_", " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Network Capability</Label>
                <Select value={networkCap} onValueChange={setNetworkCap}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NETWORK_CAPS.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={isExclusive} onCheckedChange={setIsExclusive} />
                <Label className="text-sm">Exclusive</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={serialRequired} onCheckedChange={setSerialRequired} disabled={needsSerial(category, addonType as AddonType || undefined)} />
                <Label className="text-sm">Serial Required</Label>
              </div>
            </div>

            {showWarranty(category, addonType as AddonType) && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Warranty Value</Label>
                  <Input type="number" value={warrantyValue} onChange={(e) => setWarrantyValue(e.target.value)} placeholder="e.g. 12" />
                </div>
                <div className="space-y-2">
                  <Label>Warranty Unit</Label>
                  <Select value={warrantyUnit} onValueChange={setWarrantyUnit}>
                    <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                    <SelectContent>
                      {WARRANTY_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={!productName.trim() || save.isPending}>
              {save.isPending ? "Saving..." : editId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
