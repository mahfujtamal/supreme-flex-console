import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { CalendarDays, Info, Plus, Search, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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

const PAGE_SIZE = 10;
const PRODUCT_CATEGORY_OPTIONS = ["WIFI_PLAN", "CPE", "PHYSICAL_ADDON", "DIGITAL_ADDON", "ANY"] as const;
const COMPONENT_OPTIONS = ["Base Price", "VAT", "Service Charge"];

// ── Types ──
interface RefereeRewardItem {
  product_id: string;
  product_name: string;
  product_category: string;
  discount_type: "FLAT" | "PERCENT";
  discount_value: number;
  applicable_components: string[];
}

export default function ReferralProgramsTab() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
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

  // Group products by category
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

  // ── Sync multi-selects → refereeRewards list ──
  function syncRewardsFromSelections(
    wifiIds: string[],
    physicalIds: string[],
    digitalIds: string[],
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
          result.push({
            product_id: prod.product_id,
            product_name: prod.product_name,
            product_category: prod.product_category,
            discount_type: "FLAT",
            discount_value: 0,
            applicable_components: [],
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
    setRefereeRewards((prev) =>
      prev.map((r) => (r.product_id === productId ? { ...r, [field]: value } : r))
    );
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
          discount_type: r.discount_type,
          discount_value: r.discount_value,
          applicable_components: r.applicable_components ?? [],
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

  // ── Dialog open/close helpers ──
  function openCreate() {
    setEditItem(null);
    setCampaignId("");
    setMaxReferrals("-1");
    setGlobalLimit("-1");
    setDiscountType("FLAT");
    setDiscountValue("");
    setBillingCycles("1");
    setProductCategory("WIFI_PLAN");
    setRefereeRewards([]);
    setSelectedWifiPlans([]);
    setSelectedPhysicalAddons([]);
    setSelectedDigitalAddons([]);
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

    // Restore referee rewards from JSONB
    const rewards: RefereeRewardItem[] = Array.isArray(r.referee_rewards) ? r.referee_rewards : [];
    setRefereeRewards(rewards);

    const wifiIds = rewards.filter((rr) => rr.product_category === "WIFI_PLAN").map((rr) => rr.product_id);
    const physIds = rewards
      .filter((rr) => rr.product_category === "ADDON" && allProducts?.find((p) => p.product_id === rr.product_id)?.addon_type === "PHYSICAL")
      .map((rr) => rr.product_id);
    const digiIds = rewards
      .filter((rr) => rr.product_category === "ADDON" && allProducts?.find((p) => p.product_id === rr.product_id)?.addon_type === "DIGITAL")
      .map((rr) => rr.product_id);
    setSelectedWifiPlans(wifiIds);
    setSelectedPhysicalAddons(physIds);
    setSelectedDigitalAddons(digiIds);

    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditItem(null);
  }

  const totalPages = Math.ceil((data?.count ?? 0) / PAGE_SIZE);

  // ── Summary helper for referee rewards in table ──
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
                <span className="text-muted-foreground">Applied To: {r.applicable_components.join(", ")}</span>
              </>
            )}
          </div>
        ))}
      </div>
    );
  }

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
              <TableHead className="w-[140px]">Campaign Dates</TableHead>
              <TableHead className="w-[90px]">Referrer Discount</TableHead>
              <TableHead className="w-[80px] text-center">Cycles</TableHead>
              <TableHead className="min-w-[180px]">Referee Rewards</TableHead>
              <TableHead className="w-[80px] text-center">Per User</TableHead>
              <TableHead className="w-[80px] text-center">Global</TableHead>
              <TableHead className="w-[60px] text-center">Used</TableHead>
              <TableHead className="w-[70px]">Status</TableHead>
              <TableHead className="w-[60px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
            ) : !data?.items?.length ? (
              <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No referral programs found.</TableCell></TableRow>
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
                <TableCell className="text-center text-sm">{r.max_referrals_per_customer === -1 ? "∞" : r.max_referrals_per_customer}</TableCell>
                <TableCell className="text-center text-sm">{r.global_referral_limit === -1 ? "∞" : r.global_referral_limit}</TableCell>
                <TableCell className="text-center text-sm">{r.current_global_referrals}</TableCell>
                <TableCell>
                  <Badge variant={r.status ? "default" : "secondary"} className="cursor-pointer" onClick={() => toggleStatus.mutate({ id: r.referral_program_id, status: r.status })}>
                    {r.status ? "Active" : "Inactive"}
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
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) closeDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
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

              {/* ── Referrer Reward Section ── */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground">Referrer Reward</h4>
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

              <Separator />

              {/* ── Referee Reward Section ── */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground">Referee Reward — Product Picker</h4>
                <p className="text-xs text-muted-foreground">Select products from the catalog to include in the referee's reward. Each product can have its own discount settings.</p>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">WiFi Plans</Label>
                    <MultiSelectDropdown
                      options={productsByCategory.wifi.map((p) => ({ value: p.product_id, label: p.product_name }))}
                      selected={selectedWifiPlans}
                      onChange={handleWifiChange}
                      placeholder="Select WiFi plans..."
                      allLabel="All WiFi Plans"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Physical Addons</Label>
                    <MultiSelectDropdown
                      options={productsByCategory.physical.map((p) => ({ value: p.product_id, label: p.product_name }))}
                      selected={selectedPhysicalAddons}
                      onChange={handlePhysicalChange}
                      placeholder="Select physical addons..."
                      allLabel="All Physical"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Digital Addons</Label>
                    <MultiSelectDropdown
                      options={productsByCategory.digital.map((p) => ({ value: p.product_id, label: p.product_name }))}
                      selected={selectedDigitalAddons}
                      onChange={handleDigitalChange}
                      placeholder="Select digital addons..."
                      allLabel="All Digital"
                    />
                  </div>
                </div>

                {/* Referee Discount Table */}
                {refereeRewards.length > 0 && (
                  <div className="border rounded-lg bg-muted/30">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Product</TableHead>
                          <TableHead className="text-xs w-[100px]">Type</TableHead>
                          <TableHead className="text-xs w-[90px]">Value</TableHead>
                          <TableHead className="text-xs w-[200px]">Breakdown</TableHead>
                          <TableHead className="text-xs w-[40px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {refereeRewards.map((reward) => (
                          <TableRow key={reward.product_id}>
                            <TableCell>
                              <div className="text-xs font-medium">{reward.product_name}</div>
                              <div className="text-[10px] text-muted-foreground">{reward.product_category}</div>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={reward.discount_type}
                                onValueChange={(v) => updateRewardField(reward.product_id, "discount_type", v)}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="FLAT">BDT</SelectItem>
                                  <SelectItem value="PERCENT">%</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                className="h-8 text-xs"
                                value={reward.discount_value || ""}
                                onChange={(e) => updateRewardField(reward.product_id, "discount_value", parseFloat(e.target.value) || 0)}
                                placeholder="0"
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                {COMPONENT_OPTIONS.map((comp) => (
                                  <label key={comp} className="flex items-center gap-1 text-[11px] cursor-pointer">
                                    <Checkbox
                                      className="h-3.5 w-3.5"
                                      checked={reward.applicable_components.includes(comp)}
                                      onCheckedChange={() => toggleRewardComponent(reward.product_id, comp)}
                                    />
                                    {comp}
                                  </label>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeRewardProduct(reward.product_id)}>
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              <Separator />

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
    </div>
  );
}
