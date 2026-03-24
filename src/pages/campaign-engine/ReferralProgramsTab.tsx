import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  Plus, Search, Pencil, Trash2, Lock, AlertTriangle, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatBDT } from "@/lib/currency";

const PAGE_SIZE = 10;

/* ── Types ── */
interface RefereeItem {
  product_id: string;
  product_name: string;
  product_category: string;
  addon_type: string | null;
  discount_type: "FLAT" | "PERCENT";
  discount_value: number;
  applicable_components: string[];
}

interface ProgramForm {
  campaign_id: string;
  start_date: Date | undefined;
  end_date: Date | undefined;
  max_referrals: number;
  referrer_product_id: string;
  referrer_reward_type: "CYCLES" | "PURCHASES";
  referrer_reward_value: number;
  referrer_reward_unit: string;
  referee_matrix: RefereeItem[];
  referral_code_prefix: string;
  status: boolean;
}

const emptyForm: ProgramForm = {
  campaign_id: "",
  start_date: undefined,
  end_date: undefined,
  max_referrals: 1,
  referrer_product_id: "",
  referrer_reward_type: "CYCLES",
  referrer_reward_value: 1,
  referrer_reward_unit: "",
  referee_matrix: [],
  referral_code_prefix: "",
  status: true,
};

/* ── Helpers ── */
function isCycleBased(cat: string, addonType: string | null) {
  return cat === "WIFI_PLAN" || (cat === "ADDON" && addonType === "DIGITAL");
}

export default function ReferralProgramsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ProgramForm>({ ...emptyForm });
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  /* ── Data queries ── */
  // Referral-based campaigns
  const { data: campaigns } = useQuery({
    queryKey: ["referral-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_master")
        .select("campaign_id, campaign_name, start_date, end_date")
        .eq("campaign_trigger_type", "REFERRAL_BASED")
        .eq("status", true)
        .order("campaign_name");
      if (error) throw error;
      return data;
    },
  });

  // All active products
  const { data: products } = useQuery({
    queryKey: ["products-all-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("product_id, product_name, product_category, addon_type, billing_frequency")
        .eq("status", true)
        .order("product_name");
      if (error) throw error;
      return data;
    },
  });

  // Programs list
  const { data: programsData, isLoading } = useQuery({
    queryKey: ["referral-programs", page, search],
    queryFn: async () => {
      let q = supabase
        .from("referral_programs")
        .select("*, campaign_master!inner(campaign_name), referrer_prod:products!referral_programs_referrer_product_id_fkey(product_name, product_category, addon_type)", { count: "exact" })
        .order("created_at", { ascending: false });
      if (search) q = q.or(`referral_code_prefix.ilike.%${search}%`);
      const { data, error, count } = await q.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      return { items: data ?? [], count: count ?? 0 };
    },
  });

  // Redemption counts per program (for lock logic)
  const programIds = useMemo(() => programsData?.items?.map((p: any) => p.program_id) ?? [], [programsData]);
  const { data: redemptionCounts } = useQuery({
    queryKey: ["redemption-counts", programIds],
    enabled: programIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referral_redemptions")
        .select("program_id")
        .in("program_id", programIds);
      if (error) throw error;
      const counts: Record<string, number> = {};
      data?.forEach((r: any) => { counts[r.program_id] = (counts[r.program_id] || 0) + 1; });
      return counts;
    },
  });

  /* ── Filtered product lists ── */
  const wifiPlans = useMemo(() => products?.filter(p => p.product_category === "WIFI_PLAN") ?? [], [products]);
  const cpeProducts = useMemo(() => products?.filter(p => p.product_category === "CPE") ?? [], [products]);
  const physicalAddons = useMemo(() => products?.filter(p => p.product_category === "ADDON" && p.addon_type === "PHYSICAL") ?? [], [products]);
  const digitalAddons = useMemo(() => products?.filter(p => p.product_category === "ADDON" && p.addon_type === "DIGITAL") ?? [], [products]);

  /* ── Selected campaign date range ── */
  const selectedCampaign = useMemo(
    () => campaigns?.find(c => c.campaign_id === form.campaign_id),
    [campaigns, form.campaign_id],
  );

  /* ── Price components fetcher (for dynamic checkboxes) ── */
  const refereeProductIds = useMemo(() => form.referee_matrix.map(r => r.product_id), [form.referee_matrix]);
  const { data: priceComps } = useQuery({
    queryKey: ["price-components-for-referee", refereeProductIds],
    enabled: refereeProductIds.length > 0,
    queryFn: async () => {
      // Get active price versions for these products, then their components
      const { data: versions, error: vErr } = await supabase
        .from("product_price_versions")
        .select("price_version_id, product_id")
        .in("product_id", refereeProductIds)
        .eq("status", true);
      if (vErr) throw vErr;
      if (!versions?.length) return {} as Record<string, string[]>;

      const versionIds = versions.map(v => v.price_version_id);
      const { data: comps, error: cErr } = await supabase
        .from("price_components")
        .select("price_version_id, component_name")
        .in("price_version_id", versionIds);
      if (cErr) throw cErr;

      // Map product_id -> component names
      const result: Record<string, string[]> = {};
      for (const v of versions) {
        const names = comps?.filter(c => c.price_version_id === v.price_version_id).map(c => c.component_name) ?? [];
        result[v.product_id] = [...new Set([...(result[v.product_id] ?? []), ...names])];
      }
      return result;
    },
  });

  /* ── Referrer product change ── */
  useEffect(() => {
    if (!form.referrer_product_id || !products) return;
    const p = products.find(pr => pr.product_id === form.referrer_product_id);
    if (!p) return;
    const cycle = isCycleBased(p.product_category, p.addon_type);
    setForm(f => ({
      ...f,
      referrer_reward_type: cycle ? "CYCLES" : "PURCHASES",
      referrer_reward_unit: cycle
        ? (p.billing_frequency === "MONTHLY" ? "Months" : p.billing_frequency === "WEEKLY" ? "Weeks" : p.billing_frequency === "YEARLY" ? "Years" : "Cycles")
        : "Purchases",
    }));
  }, [form.referrer_product_id, products]);

  /* ── Add referee products ── */
  function addRefereeProducts(productIds: string[]) {
    if (!products) return;
    const existing = new Set(form.referee_matrix.map(r => r.product_id));
    const newItems: RefereeItem[] = productIds
      .filter(id => !existing.has(id))
      .map(id => {
        const p = products.find(pr => pr.product_id === id)!;
        return {
          product_id: id,
          product_name: p.product_name,
          product_category: p.product_category,
          addon_type: p.addon_type,
          discount_type: "FLAT" as const,
          discount_value: 0,
          applicable_components: [],
        };
      });
    if (newItems.length)
      setForm(f => ({ ...f, referee_matrix: [...f.referee_matrix, ...newItems] }));
  }

  function removeRefereeProduct(productId: string) {
    setForm(f => ({ ...f, referee_matrix: f.referee_matrix.filter(r => r.product_id !== productId) }));
  }

  function updateRefereeItem(productId: string, patch: Partial<RefereeItem>) {
    setForm(f => ({
      ...f,
      referee_matrix: f.referee_matrix.map(r => r.product_id === productId ? { ...r, ...patch } : r),
    }));
  }

  function toggleComponent(productId: string, compName: string) {
    const item = form.referee_matrix.find(r => r.product_id === productId);
    if (!item) return;
    const has = item.applicable_components.includes(compName);
    updateRefereeItem(productId, {
      applicable_components: has
        ? item.applicable_components.filter(c => c !== compName)
        : [...item.applicable_components, compName],
    });
  }

  /* ── Save mutation ── */
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.campaign_id || !form.start_date || !form.referrer_product_id) throw new Error("Fill all required fields.");

      const payload = {
        campaign_id: form.campaign_id,
        start_date: form.start_date.toISOString(),
        end_date: form.end_date ? form.end_date.toISOString() : null,
        max_referrals_per_customer: form.max_referrals,
        referrer_product_id: form.referrer_product_id,
        referrer_reward_type: form.referrer_reward_type,
        referrer_reward_value: form.referrer_reward_value,
        referrer_reward_unit: form.referrer_reward_unit,
        referee_config_matrix: form.referee_matrix,
        referral_code_prefix: form.referral_code_prefix || null,
        status: form.status,
      };

      if (editId) {
        const { error } = await supabase.from("referral_programs").update(payload).eq("program_id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("referral_programs").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["referral-programs"] });
      toast({ title: editId ? "Program updated" : "Program created" });
      closeDialog();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("referral_programs").delete().eq("program_id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["referral-programs"] });
      toast({ title: "Program deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function closeDialog() {
    setDialogOpen(false);
    setEditId(null);
    setForm({ ...emptyForm });
  }

  function openEdit(row: any) {
    setEditId(row.program_id);
    setForm({
      campaign_id: row.campaign_id,
      start_date: new Date(row.start_date),
      end_date: row.end_date ? new Date(row.end_date) : undefined,
      max_referrals: row.max_referrals_per_customer,
      referrer_product_id: row.referrer_product_id ?? "",
      referrer_reward_type: row.referrer_reward_type ?? "CYCLES",
      referrer_reward_value: row.referrer_reward_value ?? 1,
      referrer_reward_unit: row.referrer_reward_unit ?? "",
      referee_matrix: Array.isArray(row.referee_config_matrix) ? row.referee_config_matrix : [],
      referral_code_prefix: row.referral_code_prefix ?? "",
      status: row.status,
    });
    setDialogOpen(true);
  }

  const totalPages = Math.ceil((programsData?.count ?? 0) / PAGE_SIZE);

  /* ── Summary counts for referee matrix ── */
  const matrixSummary = useMemo(() => {
    const w = form.referee_matrix.filter(r => r.product_category === "WIFI_PLAN").length;
    const c = form.referee_matrix.filter(r => r.product_category === "CPE").length;
    const pa = form.referee_matrix.filter(r => r.product_category === "ADDON" && r.addon_type === "PHYSICAL").length;
    const da = form.referee_matrix.filter(r => r.product_category === "ADDON" && r.addon_type === "DIGITAL").length;
    const parts: string[] = [];
    if (w) parts.push(`${w} WiFi Plan${w > 1 ? "s" : ""}`);
    if (c) parts.push(`${c} CPE`);
    if (pa) parts.push(`${pa} Physical Addon${pa > 1 ? "s" : ""}`);
    if (da) parts.push(`${da} Digital Addon${da > 1 ? "s" : ""}`);
    return parts.join(", ") || "None selected";
  }, [form.referee_matrix]);

  /* ── Category multi-select helper ── */
  function CategoryPicker({ label, items, category }: { label: string; items: any[]; category: string }) {
    const selected = form.referee_matrix.filter(r =>
      category === "CPE" ? r.product_category === "CPE" :
      category === "PHYSICAL" ? (r.product_category === "ADDON" && r.addon_type === "PHYSICAL") :
      category === "DIGITAL" ? (r.product_category === "ADDON" && r.addon_type === "DIGITAL") :
      r.product_category === "WIFI_PLAN"
    );
    const selectedIds = new Set(selected.map(s => s.product_id));

    return (
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">{label}</Label>
        <div className="border rounded-md p-2 max-h-32 overflow-y-auto space-y-1">
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground">No products available</p>
          ) : items.map(p => (
            <label key={p.product_id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
              <Checkbox
                checked={selectedIds.has(p.product_id)}
                onCheckedChange={(checked) => {
                  if (checked) addRefereeProducts([p.product_id]);
                  else removeRefereeProduct(p.product_id);
                }}
              />
              <span className="truncate">{p.product_name}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  /* ── Check if program is locked ── */
  function isLocked(programId: string) {
    return (redemptionCounts?.[programId] ?? 0) > 0;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by code prefix..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9 h-9" />
        </div>
        <Button size="sm" onClick={() => { setForm({ ...emptyForm }); setEditId(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1.5" />New Referral Program
        </Button>
      </div>

      {/* ── Programs Table ── */}
      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Campaign</TableHead>
              <TableHead>Referrer Product</TableHead>
              <TableHead className="w-[100px]">Start</TableHead>
              <TableHead className="w-[100px]">End</TableHead>
              <TableHead className="w-[60px]">Max Ref</TableHead>
              <TableHead className="w-[80px]">Referee Items</TableHead>
              <TableHead className="w-[80px]">Status</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : !programsData?.items?.length ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No referral programs found.</TableCell></TableRow>
            ) : programsData.items.map((row: any) => {
              const locked = isLocked(row.program_id);
              const matrix: RefereeItem[] = Array.isArray(row.referee_config_matrix) ? row.referee_config_matrix : [];
              const isExpanded = expandedRow === row.program_id;
              return (
                <>
                  <TableRow key={row.program_id} className={locked ? "bg-amber-50/50 dark:bg-amber-950/20" : ""}>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExpandedRow(isExpanded ? null : row.program_id)}>
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </Button>
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      {(row as any).campaign_master?.campaign_name ?? "—"}
                      {locked && <Lock className="inline ml-1.5 h-3.5 w-3.5 text-amber-600" />}
                    </TableCell>
                    <TableCell className="text-sm">{(row as any).referrer_prod?.product_name ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{format(new Date(row.start_date), "dd MMM yy")}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.end_date ? format(new Date(row.end_date), "dd MMM yy") : "—"}</TableCell>
                    <TableCell className="text-sm font-mono">{row.max_referrals_per_customer}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{matrix.length}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={row.status ? "default" : "secondary"} className="text-xs">{row.status ? "Active" : "Inactive"}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(row)} disabled={locked}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(row.program_id)} disabled={locked}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow key={`${row.program_id}-exp`}>
                      <TableCell colSpan={9} className="bg-muted/30 p-4">
                        {locked && (
                          <Alert variant="default" className="mb-3 border-amber-300 bg-amber-50 dark:bg-amber-950/30">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
                              <strong>Active Contract:</strong> Financial fields locked. Only End Date is editable.
                            </AlertDescription>
                          </Alert>
                        )}
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">
                            Referrer: <strong>{row.referrer_reward_value} {row.referrer_reward_unit}</strong> ({row.referrer_reward_type})
                            {row.referral_code_prefix && <> · Prefix: <code className="text-xs">{row.referral_code_prefix}</code></>}
                          </p>
                          {matrix.length > 0 && (
                            <div>
                              <p className="text-xs font-medium mb-1">Referee Reward Matrix:</p>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-xs">Product</TableHead>
                                    <TableHead className="text-xs w-20">Discount</TableHead>
                                    <TableHead className="text-xs">Applied To</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {matrix.map((item, idx) => (
                                    <TableRow key={idx}>
                                      <TableCell className="text-xs py-1">{item.product_name}</TableCell>
                                      <TableCell className="text-xs py-1 font-mono">
                                        {item.discount_type === "FLAT" ? formatBDT(item.discount_value) : `${item.discount_value}%`}
                                      </TableCell>
                                      <TableCell className="text-xs py-1">
                                        {item.applicable_components?.length ? item.applicable_components.join(", ") : <span className="text-muted-foreground">All</span>}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </div>
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

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Referral Program" : "New Referral Program"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* Campaign & Scheduling */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Parent Campaign <span className="text-destructive">*</span></Label>
                <Select value={form.campaign_id} onValueChange={(v) => setForm(f => ({ ...f, campaign_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select campaign..." /></SelectTrigger>
                  <SelectContent>
                    {campaigns?.map(c => (
                      <SelectItem key={c.campaign_id} value={c.campaign_id}>{c.campaign_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedCampaign && (
                  <p className="text-[10px] text-muted-foreground">
                    Campaign range: {format(new Date(selectedCampaign.start_date), "dd MMM yy")}
                    {selectedCampaign.end_date ? ` – ${format(new Date(selectedCampaign.end_date), "dd MMM yy")}` : " – Open"}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Max Referrals per Customer</Label>
                <Input
                  type="number" min={1} value={form.max_referrals}
                  onChange={(e) => setForm(f => ({ ...f, max_referrals: parseInt(e.target.value) || 1 }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Start Date <span className="text-destructive">*</span></Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.start_date && "text-muted-foreground")}>
                      {form.start_date ? format(form.start_date, "dd MMM yyyy") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={form.start_date} onSelect={(d) => setForm(f => ({ ...f, start_date: d }))} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.end_date && "text-muted-foreground")}>
                      {form.end_date ? format(form.end_date, "dd MMM yyyy") : "Optional"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={form.end_date} onSelect={(d) => setForm(f => ({ ...f, end_date: d }))} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Code Prefix</Label>
                <Input
                  value={form.referral_code_prefix} maxLength={8} placeholder="e.g. REF"
                  onChange={(e) => setForm(f => ({ ...f, referral_code_prefix: e.target.value.toUpperCase() }))}
                />
              </div>
            </div>

            {/* ── Accordion: Referrer + Referee ── */}
            <Accordion type="multiple" defaultValue={["referrer", "referee"]} className="space-y-2">
              {/* Referrer Reward */}
              <AccordionItem value="referrer" className="border rounded-lg px-4">
                <AccordionTrigger className="text-sm font-semibold">Referrer Reward</AccordionTrigger>
                <AccordionContent className="space-y-3 pb-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Reward Product <span className="text-destructive">*</span></Label>
                      <Select value={form.referrer_product_id} onValueChange={(v) => setForm(f => ({ ...f, referrer_product_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select product..." /></SelectTrigger>
                        <SelectContent>
                          {products?.map(p => (
                            <SelectItem key={p.product_id} value={p.product_id}>{p.product_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">
                        {form.referrer_reward_type === "CYCLES" ? "Number of Cycles" : "Number of Purchases"}
                      </Label>
                      <Input
                        type="number" min={1} value={form.referrer_reward_value}
                        onChange={(e) => setForm(f => ({ ...f, referrer_reward_value: parseInt(e.target.value) || 1 }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Unit</Label>
                      <Input value={form.referrer_reward_unit} readOnly className="bg-muted" />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Referee 4-Tier Matrix */}
              <AccordionItem value="referee" className="border rounded-lg px-4">
                <AccordionTrigger className="text-sm font-semibold">
                  <span className="flex items-center gap-2">
                    Referee Reward — 4-Tier Matrix
                    <Badge variant="outline" className="text-[10px] font-normal">{matrixSummary}</Badge>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pb-4">
                  <p className="text-xs text-muted-foreground italic">
                    Referee can choose any, all, or none of these items during sign-up.
                  </p>

                  {/* Category pickers */}
                  <div className="grid grid-cols-2 gap-3">
                    <CategoryPicker label="WiFi Plans" items={wifiPlans} category="WIFI_PLAN" />
                    <CategoryPicker label="CPE (Hardware)" items={cpeProducts} category="CPE" />
                    <CategoryPicker label="Physical Addons" items={physicalAddons} category="PHYSICAL" />
                    <CategoryPicker label="Digital Addons" items={digitalAddons} category="DIGITAL" />
                  </div>

                  {/* Discount config table */}
                  {form.referee_matrix.length > 0 && (
                    <div className="border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Product</TableHead>
                            <TableHead className="text-xs w-24">Type</TableHead>
                            <TableHead className="text-xs w-28">Value</TableHead>
                            <TableHead className="text-xs">Components</TableHead>
                            <TableHead className="text-xs w-10" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {form.referee_matrix.map((item) => {
                            const compOptions = priceComps?.[item.product_id] ?? [];
                            return (
                              <TableRow key={item.product_id}>
                                <TableCell className="text-xs py-1.5">
                                  <div>
                                    <span className="font-medium">{item.product_name}</span>
                                    <Badge variant="outline" className="ml-1.5 text-[9px]">
                                      {item.product_category === "ADDON" ? (item.addon_type === "PHYSICAL" ? "Phys Add-on" : "Digital Add-on") : item.product_category.replace("_", " ")}
                                    </Badge>
                                  </div>
                                </TableCell>
                                <TableCell className="py-1.5">
                                  <Select
                                    value={item.discount_type}
                                    onValueChange={(v) => updateRefereeItem(item.product_id, { discount_type: v as "FLAT" | "PERCENT" })}
                                  >
                                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="FLAT">Flat (BDT)</SelectItem>
                                      <SelectItem value="PERCENT">Percent (%)</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell className="py-1.5">
                                  <Input
                                    type="number" min={0}
                                    className="h-7 text-xs"
                                    value={item.discount_value}
                                    onChange={(e) => updateRefereeItem(item.product_id, { discount_value: parseFloat(e.target.value) || 0 })}
                                  />
                                </TableCell>
                                <TableCell className="py-1.5">
                                  {compOptions.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5">
                                      {compOptions.map(comp => (
                                        <label key={comp} className="flex items-center gap-1 text-[10px] cursor-pointer">
                                          <Checkbox
                                            className="h-3 w-3"
                                            checked={item.applicable_components.includes(comp)}
                                            onCheckedChange={() => toggleComponent(item.product_id, comp)}
                                          />
                                          {comp}
                                        </label>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-muted-foreground">No price components</span>
                                  )}
                                </TableCell>
                                <TableCell className="py-1.5">
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeRefereeProduct(item.product_id)}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* Status */}
            <div className="flex items-center gap-3">
              <Switch checked={form.status} onCheckedChange={(v) => setForm(f => ({ ...f, status: v }))} />
              <Label className="text-sm">{form.status ? "Active" : "Inactive"}</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : editId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
