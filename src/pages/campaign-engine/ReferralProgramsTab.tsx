import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { CalendarDays, Info, Plus, Search, Trash2, Eye, AlertTriangle, Package } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MultiSelectDropdown, ALL_VALUE } from "@/components/ui/multi-select-dropdown";
import { useToast } from "@/hooks/use-toast";
import { formatBDT } from "@/lib/currency";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PAGE_SIZE = 10;
const PRODUCT_CATEGORY_OPTIONS = ["WIFI_PLAN", "CPE", "PHYSICAL_ADDON", "DIGITAL_ADDON", "ANY"] as const;
const COMPONENT_OPTIONS = ["Base Price", "VAT", "Service Charge"];

// ── Types ──
interface RefereeRewardItem {
  product_id: string;
  product_name: string;
  product_category: string;
  addon_type?: string | null;
  discount_type: "FLAT" | "PERCENT";
  discount_value: number;
  applicable_components: string[];
  selection_mode: "OPTIONAL" | "MANDATORY" | "AUTO_BUNDLE";
  require_wifi_for_cpe: boolean;
}

export default function ReferralProgramsTab() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRewards, setPreviewRewards] = useState<RefereeRewardItem[]>([]);
  const [previewSelected, setPreviewSelected] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const qc = useQueryClient();

  // Form state – Referrer
  const [campaignId, setCampaignId] = useState("");
  const [maxReferrals, setMaxReferrals] = useState("-1");
  const [globalLimit, setGlobalLimit] = useState("-1");
  const [discountType, setDiscountType] = useState<string>("FLAT");
  const [discountValue, setDiscountValue] = useState("");
  const [billingCycles, setBillingCycles] = useState("1");
  const [productCategory, setProductCategory] = useState<string>("WIFI_PLAN");

  // Form state – Referee rewards
  const [refereeRewards, setRefereeRewards] = useState<RefereeRewardItem[]>([]);
  const [selectedWifiPlans, setSelectedWifiPlans] = useState<string[]>([]);
  const [selectedPhysicalAddons, setSelectedPhysicalAddons] = useState<string[]>([]);
  const [selectedDigitalAddons, setSelectedDigitalAddons] = useState<string[]>([]);

  // ── Queries ──
  const { data: campaigns } = useQuery({
    queryKey: ["campaigns-referral-eligible"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_master")
        .select("campaign_id, campaign_name, campaign_trigger_type")
        .in("campaign_trigger_type", ["REFERRAL_BASED", "HYBRID"])
        .eq("status", true)
        .order("campaign_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: allProducts } = useQuery({
    queryKey: ["all-products-for-referee"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("product_id, product_name, product_category, addon_type")
        .eq("status", true)
        .order("product_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch active price versions for simulation
  const { data: priceVersions } = useQuery({
    queryKey: ["price-versions-for-referee"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_price_versions")
        .select("product_id, base_price_bdt, price_components(component_name, amount_bdt, component_type)")
        .eq("status", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const productsByCategory = useMemo(() => {
    if (!allProducts) return { wifi: [], physical: [], digital: [] };
    return {
      wifi: allProducts.filter((p) => p.product_category === "WIFI_PLAN"),
      physical: allProducts.filter((p) => p.product_category === "ADDON" && p.addon_type === "PHYSICAL"),
      digital: allProducts.filter((p) => p.product_category === "ADDON" && p.addon_type === "DIGITAL"),
    };
  }, [allProducts]);

  const { data, isLoading } = useQuery({
    queryKey: ["referral-programs", page, search],
    queryFn: async () => {
      let q = supabase
        .from("referral_programs")
        .select("*, campaign_master(campaign_name, start_date, end_date)", { count: "exact" })
        .order("created_at", { ascending: false });
      if (search) q = q.ilike("campaign_master.campaign_name", `%${search}%`);
      const { data, error, count } = await q.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      return { items: data, count: count ?? 0 };
    },
  });

  // ── Price lookup helper ──
  function getProductPrice(productId: string) {
    const pv = priceVersions?.find((v: any) => v.product_id === productId);
    if (!pv) return { base: 0, vat: 0, sc: 0, total: 0 };
    const comps = (pv as any).price_components ?? [];
    const base = pv.base_price_bdt ?? 0;
    const vat = comps.find((c: any) => c.component_name?.toLowerCase().includes("vat"))?.amount_bdt ?? 0;
    const sc = comps.find((c: any) => c.component_name?.toLowerCase().includes("service"))?.amount_bdt ?? 0;
    return { base: Number(base), vat: Number(vat), sc: Number(sc), total: Number(base) + Number(vat) + Number(sc) };
  }

  function calcDiscount(reward: RefereeRewardItem) {
    const price = getProductPrice(reward.product_id);
    let discountTotal = 0;
    const appliedOn = reward.applicable_components;
    if (reward.discount_type === "FLAT") {
      discountTotal = reward.discount_value;
    } else {
      let appliedBase = 0;
      if (appliedOn.includes("Base Price")) appliedBase += price.base;
      if (appliedOn.includes("VAT")) appliedBase += price.vat;
      if (appliedOn.includes("Service Charge")) appliedBase += price.sc;
      if (appliedBase === 0) appliedBase = price.total;
      discountTotal = (appliedBase * reward.discount_value) / 100;
    }
    return { original: price.total, discount: Math.min(discountTotal, price.total), final: Math.max(0, price.total - discountTotal) };
  }

  // ── Sync multi-selects → refereeRewards list ──
  function syncRewardsFromSelections(
    wifiIds: string[], physicalIds: string[], digitalIds: string[],
    existingRewards: RefereeRewardItem[]
  ): RefereeRewardItem[] {
    const allSelectedIds = new Set([...wifiIds, ...physicalIds, ...digitalIds]);
    const existingMap = new Map(existingRewards.map((r) => [r.product_id, r]));
    const result: RefereeRewardItem[] = [];
    for (const id of allSelectedIds) {
      if (existingMap.has(id)) {
        result.push(existingMap.get(id)!);
      } else {
        const prod = allProducts?.find((p) => p.product_id === id);
        if (prod) {
          const isPhysical = prod.product_category === "ADDON" && prod.addon_type === "PHYSICAL";
          result.push({
            product_id: prod.product_id,
            product_name: prod.product_name,
            product_category: prod.product_category,
            addon_type: prod.addon_type,
            discount_type: "FLAT",
            discount_value: 0,
            applicable_components: [],
            selection_mode: "OPTIONAL",
            require_wifi_for_cpe: isPhysical,
          });
        }
      }
    }
    return result;
  }

  function handleWifiChange(ids: string[]) {
    setSelectedWifiPlans(ids);
    setRefereeRewards((prev) => syncRewardsFromSelections(ids, selectedPhysicalAddons, selectedDigitalAddons, prev));
  }
  function handlePhysicalChange(ids: string[]) {
    setSelectedPhysicalAddons(ids);
    setRefereeRewards((prev) => syncRewardsFromSelections(selectedWifiPlans, ids, selectedDigitalAddons, prev));
  }
  function handleDigitalChange(ids: string[]) {
    setSelectedDigitalAddons(ids);
    setRefereeRewards((prev) => syncRewardsFromSelections(selectedWifiPlans, selectedPhysicalAddons, ids, prev));
  }

  function updateRewardField(productId: string, field: keyof RefereeRewardItem, value: any) {
    setRefereeRewards((prev) => prev.map((r) => (r.product_id === productId ? { ...r, [field]: value } : r)));
  }

  function toggleRewardComponent(productId: string, component: string) {
    setRefereeRewards((prev) =>
      prev.map((r) => {
        if (r.product_id !== productId) return r;
        const comps = r.applicable_components.includes(component)
          ? r.applicable_components.filter((c) => c !== component)
          : [...r.applicable_components, component];
        return { ...r, applicable_components: comps };
      })
    );
  }

  function removeRewardProduct(productId: string) {
    setRefereeRewards((prev) => prev.filter((r) => r.product_id !== productId));
    setSelectedWifiPlans((prev) => prev.filter((id) => id !== productId));
    setSelectedPhysicalAddons((prev) => prev.filter((id) => id !== productId));
    setSelectedDigitalAddons((prev) => prev.filter((id) => id !== productId));
  }

  // ── Preview simulation ──
  function openPreview() {
    setPreviewRewards(refereeRewards);
    const initial = new Set<string>();
    refereeRewards.forEach((r) => { if (r.selection_mode === "MANDATORY" || r.selection_mode === "AUTO_BUNDLE") initial.add(r.product_id); });
    setPreviewSelected(initial);
    setPreviewOpen(true);
  }

  function togglePreviewItem(productId: string) {
    const reward = previewRewards.find((r) => r.product_id === productId);
    if (!reward || reward.selection_mode === "MANDATORY") return;

    setPreviewSelected((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
        // Dependency: if physical addon requires wifi, auto-add a wifi plan
        if (reward.require_wifi_for_cpe) {
          const wifiReward = previewRewards.find((r) => r.product_category === "WIFI_PLAN");
          if (wifiReward && !next.has(wifiReward.product_id)) {
            next.add(wifiReward.product_id);
          }
        }
      }
      return next;
    });
  }

  const previewSummary = useMemo(() => {
    let totalOriginal = 0;
    let totalDiscount = 0;
    previewRewards.forEach((r) => {
      if (previewSelected.has(r.product_id)) {
        const calc = calcDiscount(r);
        totalOriginal += calc.original;
        totalDiscount += calc.discount;
      }
    });
    return { totalOriginal, totalDiscount, grandTotal: totalOriginal - totalDiscount };
  }, [previewRewards, previewSelected, priceVersions]);

  // ── Mutations ──
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        campaign_id: campaignId,
        max_referrals_per_customer: parseInt(maxReferrals),
        global_referral_limit: parseInt(globalLimit),
        referrer_discount_type: discountType,
        referrer_discount_value: parseFloat(discountValue),
        referrer_reward_billing_cycles: parseInt(billingCycles),
        referrer_applicable_product_category: productCategory,
        referee_rewards: refereeRewards.map((r) => ({
          product_id: r.product_id,
          product_name: r.product_name,
          product_category: r.product_category,
          addon_type: r.addon_type ?? null,
          discount_type: r.discount_type,
          discount_value: r.discount_value,
          applicable_components: r.applicable_components ?? [],
          selection_mode: r.selection_mode ?? "OPTIONAL",
          require_wifi_for_cpe: r.require_wifi_for_cpe ?? false,
        })),
      };
      if (editItem) {
        const { error } = await supabase.from("referral_programs").update(payload).eq("referral_program_id", editItem.referral_program_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("referral_programs").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editItem ? "Program updated" : "Program created" });
      qc.invalidateQueries({ queryKey: ["referral-programs"] });
      closeDialog();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: boolean }) => {
      const { error } = await supabase.from("referral_programs").update({ status: !status }).eq("referral_program_id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["referral-programs"] }),
  });

  function openCreate() {
    setEditItem(null);
    setCampaignId(""); setMaxReferrals("-1"); setGlobalLimit("-1");
    setDiscountType("FLAT"); setDiscountValue(""); setBillingCycles("1");
    setProductCategory("WIFI_PLAN");
    setRefereeRewards([]); setSelectedWifiPlans([]); setSelectedPhysicalAddons([]); setSelectedDigitalAddons([]);
    setDialogOpen(true);
  }

  function openEdit(r: any) {
    setEditItem(r);
    setCampaignId(r.campaign_id);
    setMaxReferrals(String(r.max_referrals_per_customer));
    setGlobalLimit(String(r.global_referral_limit));
    setDiscountType(r.referrer_discount_type);
    setDiscountValue(String(r.referrer_discount_value));
    setBillingCycles(String(r.referrer_reward_billing_cycles));
    setProductCategory(r.referrer_applicable_product_category);

    const rewards: RefereeRewardItem[] = (Array.isArray(r.referee_rewards) ? r.referee_rewards : []).map((rr: any) => ({
      ...rr,
      selection_mode: rr.selection_mode ?? "OPTIONAL",
      require_wifi_for_cpe: rr.require_wifi_for_cpe ?? false,
    }));
    setRefereeRewards(rewards);

    const wifiIds = rewards.filter((rr) => rr.product_category === "WIFI_PLAN").map((rr) => rr.product_id);
    const physIds = rewards
      .filter((rr) => rr.product_category === "ADDON" && (rr.addon_type === "PHYSICAL" || allProducts?.find((p) => p.product_id === rr.product_id)?.addon_type === "PHYSICAL"))
      .map((rr) => rr.product_id);
    const digiIds = rewards
      .filter((rr) => rr.product_category === "ADDON" && (rr.addon_type === "DIGITAL" || allProducts?.find((p) => p.product_id === rr.product_id)?.addon_type === "DIGITAL"))
      .map((rr) => rr.product_id);
    setSelectedWifiPlans(wifiIds); setSelectedPhysicalAddons(physIds); setSelectedDigitalAddons(digiIds);
    setDialogOpen(true);
  }

  function closeDialog() { setDialogOpen(false); setEditItem(null); }

  const totalPages = Math.ceil((data?.count ?? 0) / PAGE_SIZE);

  function renderRefereeSummary(rewards: any[]) {
    if (!Array.isArray(rewards) || rewards.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
    return (
      <div className="space-y-0.5">
        {rewards.map((r: any, i: number) => (
          <div key={i} className="text-xs flex items-center gap-1 flex-wrap">
            <span className="font-medium">{r.product_name}</span>
            <span className="text-muted-foreground">|</span>
            <span>{r.discount_type === "FLAT" ? formatBDT(r.discount_value) : `${r.discount_value}%`}</span>
            {r.applicable_components?.length > 0 && (
              <>
                <span className="text-muted-foreground">|</span>
                <span className="text-muted-foreground">{r.applicable_components.join(", ")}</span>
              </>
            )}
            {r.selection_mode && r.selection_mode !== "OPTIONAL" && (
              <Badge variant="outline" className="text-[9px] px-1 py-0 ml-1">{r.selection_mode}</Badge>
            )}
          </div>
        ))}
      </div>
    );
  }

  // ── Dependency warnings ──
  const dependencyWarnings = useMemo(() => {
    const warnings: string[] = [];
    const hasPhysicalRequiringWifi = refereeRewards.some((r) => r.require_wifi_for_cpe && (r.addon_type === "PHYSICAL" || r.product_category === "CPE"));
    const hasWifiPlan = refereeRewards.some((r) => r.product_category === "WIFI_PLAN");
    if (hasPhysicalRequiringWifi && !hasWifiPlan) {
      warnings.push("Physical addon/CPE requires a WiFi Plan. Add at least one WiFi Plan to the referee rewards or the dependency will be unresolved.");
    }
    return warnings;
  }, [refereeRewards]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search programs..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9 h-9" />
        </div>
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1.5" />Create Referral Program</Button>
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaign</TableHead>
              <TableHead className="w-[140px]">Dates</TableHead>
              <TableHead className="w-[90px]">Referrer</TableHead>
              <TableHead className="w-[60px] text-center">Cycles</TableHead>
              <TableHead className="min-w-[180px]">Referee Rewards</TableHead>
              <TableHead className="w-[60px] text-center">Limit</TableHead>
              <TableHead className="w-[60px] text-center">Used</TableHead>
              <TableHead className="w-[70px]">Status</TableHead>
              <TableHead className="w-[60px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
            ) : !data?.items?.length ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No referral programs found.</TableCell></TableRow>
            ) : data.items.map((r: any) => (
              <TableRow key={r.referral_program_id}>
                <TableCell className="font-medium text-sm">{r.campaign_master?.campaign_name ?? "—"}</TableCell>
                <TableCell>
                  {r.campaign_master?.start_date ? (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        {format(new Date(r.campaign_master.start_date), "dd MMM yy")}
                        {" → "}
                        {r.campaign_master.end_date ? format(new Date(r.campaign_master.end_date), "dd MMM yy") : "∞"}
                      </span>
                    </div>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-sm">
                  {r.referrer_discount_type === "FLAT" ? formatBDT(r.referrer_discount_value) : `${r.referrer_discount_value}%`}
                </TableCell>
                <TableCell className="text-center text-sm">{r.referrer_reward_billing_cycles}</TableCell>
                <TableCell>{renderRefereeSummary(r.referee_rewards)}</TableCell>
                <TableCell className="text-center text-xs">
                  <div>{r.max_referrals_per_customer === -1 ? "∞/u" : `${r.max_referrals_per_customer}/u`}</div>
                  <div className="text-muted-foreground">{r.global_referral_limit === -1 ? "∞ global" : `${r.global_referral_limit} global`}</div>
                </TableCell>
                <TableCell className="text-center text-sm">{r.current_global_referrals}</TableCell>
                <TableCell>
                  <Badge variant={r.status ? "default" : "secondary"} className="cursor-pointer" onClick={() => toggleStatus.mutate({ id: r.referral_program_id, status: r.status })}>
                    {r.status ? "Active" : "Off"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>Edit</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <span className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Prev</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) closeDialog(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit Referral Program" : "Create Referral Program"}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-5 py-2">
              {/* Campaign selector */}
              <div>
                <Label>Campaign *</Label>
                <Select value={campaignId} onValueChange={setCampaignId}>
                  <SelectTrigger><SelectValue placeholder="Select campaign" /></SelectTrigger>
                  <SelectContent>
                    {campaigns?.map((c) => (
                      <SelectItem key={c.campaign_id} value={c.campaign_id}>{c.campaign_name} ({c.campaign_trigger_type})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Accordion type="multiple" defaultValue={["referrer", "referee"]} className="w-full">
                {/* ── Referrer Reward Accordion ── */}
                <AccordionItem value="referrer">
                  <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                    <div className="flex items-center gap-2">
                      <span>Referrer Reward</span>
                      {discountValue && (
                        <Badge variant="secondary" className="text-[10px] font-normal">
                          {discountType === "FLAT" ? formatBDT(parseFloat(discountValue)) : `${discountValue}%`} × {billingCycles} cycle{parseInt(billingCycles) !== 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 pt-1">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Discount Type *</Label>
                          <Select value={discountType} onValueChange={setDiscountType}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="FLAT">Flat (BDT)</SelectItem>
                              <SelectItem value="PERCENT">Percent (%)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Discount Value *</Label>
                          <Input type="number" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder="e.g. 100" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Billing Cycles *</Label>
                          <Input type="number" value={billingCycles} onChange={(e) => setBillingCycles(e.target.value)} min="1" />
                        </div>
                        <div>
                          <Label>Applicable Category *</Label>
                          <Select value={productCategory} onValueChange={setProductCategory}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {PRODUCT_CATEGORY_OPTIONS.map((t) => (
                                <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* ── Referee Reward Accordion ── */}
                <AccordionItem value="referee">
                  <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                    <div className="flex items-center gap-2">
                      <span>Referee Reward — Discount Configuration</span>
                      {refereeRewards.length > 0 && (
                        <Badge variant="secondary" className="text-[10px] font-normal">
                          {(() => {
                            const wc = refereeRewards.filter(r => r.product_category === "WIFI_PLAN").length;
                            const pc = refereeRewards.filter(r => r.addon_type === "PHYSICAL" || r.product_category === "CPE").length;
                            const dc = refereeRewards.filter(r => r.addon_type === "DIGITAL").length;
                            const parts: string[] = [];
                            if (wc) parts.push(`${wc} WiFi Plan${wc > 1 ? "s" : ""}`);
                            if (pc) parts.push(`${pc} CPE`);
                            if (dc) parts.push(`${dc} Digital Addon${dc > 1 ? "s" : ""}`);
                            return parts.join(", ") || "None";
                          })()}
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-1">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Info className="h-3.5 w-3.5 shrink-0" />
                          Referee can choose any, all, or none of these items during sign-up.
                        </p>
                        {refereeRewards.length > 0 && (
                          <Button variant="outline" size="sm" onClick={openPreview}>
                            <Eye className="h-3.5 w-3.5 mr-1.5" />Price Preview
                          </Button>
                        )}
                      </div>

                      {/* Dependency warnings */}
                      {dependencyWarnings.map((w, i) => (
                        <Alert key={i} variant="destructive" className="py-2">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription className="text-xs">{w}</AlertDescription>
                        </Alert>
                      ))}

                      {/* Category pickers */}
                      <div className="space-y-3">
                        <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Product Selection</h5>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label className="text-xs flex items-center gap-1.5">
                              <Package className="h-3 w-3" />WiFi Plans
                            </Label>
                            <MultiSelectDropdown
                              options={productsByCategory.wifi.map((p) => ({ value: p.product_id, label: p.product_name }))}
                              selected={selectedWifiPlans} onChange={handleWifiChange}
                              placeholder="Select WiFi plans..." allLabel="All WiFi Plans"
                            />
                          </div>
                          <div>
                            <Label className="text-xs flex items-center gap-1.5">
                              <Package className="h-3 w-3" />Physical Addons / CPE
                            </Label>
                            <MultiSelectDropdown
                              options={productsByCategory.physical.map((p) => ({ value: p.product_id, label: p.product_name }))}
                              selected={selectedPhysicalAddons} onChange={handlePhysicalChange}
                              placeholder="Select hardware..." allLabel="All Physical"
                            />
                          </div>
                          <div>
                            <Label className="text-xs flex items-center gap-1.5">
                              <Package className="h-3 w-3" />Digital Addons
                            </Label>
                            <MultiSelectDropdown
                              options={productsByCategory.digital.map((p) => ({ value: p.product_id, label: p.product_name }))}
                              selected={selectedDigitalAddons} onChange={handleDigitalChange}
                              placeholder="Select VAS..." allLabel="All Digital"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Referee Discount Configuration Table */}
                      {refereeRewards.length > 0 && (
                        <div className="space-y-2">
                          <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Referee Discount Configuration</h5>
                          <div className="border rounded-lg bg-muted/30">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-xs">Product Name</TableHead>
                                  <TableHead className="text-xs w-[100px]">Discount Type</TableHead>
                                  <TableHead className="text-xs w-[90px]">Discount Value</TableHead>
                                  <TableHead className="text-xs min-w-[200px]">Detail Breakdown</TableHead>
                                  <TableHead className="text-xs w-[36px]"></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {refereeRewards.map((reward) => (
                                  <TableRow key={reward.product_id}>
                                    <TableCell>
                                      <div className="text-xs font-medium">{reward.product_name}</div>
                                      <div className="text-[10px] text-muted-foreground">{reward.product_category}{reward.addon_type ? ` / ${reward.addon_type}` : ""}</div>
                                    </TableCell>
                                    <TableCell>
                                      <Select value={reward.discount_type} onValueChange={(v) => updateRewardField(reward.product_id, "discount_type", v)}>
                                        <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="FLAT">Fixed (BDT)</SelectItem>
                                          <SelectItem value="PERCENT">Percentage (%)</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </TableCell>
                                    <TableCell>
                                      <Input type="number" className="h-7 text-[11px]" value={reward.discount_value || ""} onChange={(e) => updateRewardField(reward.product_id, "discount_value", parseFloat(e.target.value) || 0)} placeholder="0" />
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-3">
                                        {COMPONENT_OPTIONS.map((comp) => (
                                          <label key={comp} className="flex items-center gap-1 text-[11px] cursor-pointer whitespace-nowrap">
                                            <Checkbox className="h-3.5 w-3.5" checked={reward.applicable_components.includes(comp)} onCheckedChange={() => toggleRewardComponent(reward.product_id, comp)} />
                                            {comp === "Service Charge" ? "SC / Installation" : comp}
                                          </label>
                                        ))}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeRewardProduct(reward.product_id)}>
                                        <Trash2 className="h-3 w-3 text-destructive" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              {/* Limits */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Max Referrals / Customer</Label>
                  <Input type="number" value={maxReferrals} onChange={(e) => setMaxReferrals(e.target.value)} />
                  <p className="text-xs text-muted-foreground mt-1">-1 = unlimited</p>
                </div>
                <div>
                  <Label>Global Referral Limit</Label>
                  <Input type="number" value={globalLimit} onChange={(e) => setGlobalLimit(e.target.value)} />
                  <p className="text-xs text-muted-foreground mt-1">-1 = unlimited</p>
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!campaignId || !discountValue || saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : editItem ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Price Preview / Simulation Dialog ── */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Referee Reward — Price Simulation</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">Simulate what a referee would see. Check/uncheck optional items to see real-time pricing.</p>
          <div className="space-y-3 mt-2">
            {previewRewards.map((r) => {
              const calc = calcDiscount(r);
              const isSelected = previewSelected.has(r.product_id);
              const isMandatory = r.selection_mode === "MANDATORY";
              return (
                <div key={r.product_id} className={`flex items-start gap-3 p-3 rounded-lg border ${isSelected ? "bg-primary/5 border-primary/30" : "bg-muted/20 border-border"}`}>
                  <Checkbox
                    className="mt-0.5"
                    checked={isSelected}
                    disabled={isMandatory}
                    onCheckedChange={() => togglePreviewItem(r.product_id)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{r.product_name}</span>
                      {isMandatory && <Badge variant="outline" className="text-[9px] px-1 py-0">Required</Badge>}
                      {r.require_wifi_for_cpe && <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-500/50 text-amber-600">Needs WiFi</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {r.applicable_components.length > 0 ? `Discount on: ${r.applicable_components.join(", ")}` : "Discount on total"}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {isSelected ? (
                      <>
                        <div className="text-xs line-through text-muted-foreground">{formatBDT(calc.original)}</div>
                        <div className="text-sm font-semibold text-primary">{formatBDT(calc.final)}</div>
                        <div className="text-[10px] text-green-600">Save {formatBDT(calc.discount)}</div>
                      </>
                    ) : (
                      <div className="text-sm text-muted-foreground">{formatBDT(calc.original)}</div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Summary sidebar */}
            <Card className="border-primary/20">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">Summary</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Original Total</span>
                  <span>{formatBDT(previewSummary.totalOriginal)}</span>
                </div>
                <div className="flex justify-between text-xs text-green-600">
                  <span>Total Savings</span>
                  <span>− {formatBDT(previewSummary.totalDiscount)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm font-semibold">
                  <span>Grand Total</span>
                  <span className="text-primary">{formatBDT(previewSummary.grandTotal)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
