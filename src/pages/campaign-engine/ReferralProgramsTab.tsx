import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  Plus, Search, Pencil, Trash2, Lock, AlertTriangle,
  ChevronDown, ChevronUp, CalendarIcon, Clock, Zap, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatBDT } from "@/lib/currency";

const PAGE_SIZE = 10;

/* ── Types ── */
interface PriceComp {
  component_name: string;
  amount_bdt: number;
}

interface RewardRule {
  id: string;
  rule_name: string;
  product_id: string;
  product_name: string;
  product_category: string;
  addon_type: string | null;
  reward_type: "CYCLES" | "PURCHASES";
  reward_value: number;
  reward_unit: string;
  discount_type: "FLAT" | "PERCENT";
  discount_value: number;
  applicable_components: string[];
  start_date: string;
  end_date: string;
}

interface ProgramForm {
  campaign_id: string;
  start_date: Date | undefined;
  end_date: Date | undefined;
  max_referrals: number;
  referral_code_prefix: string;
  status: boolean;
  reward_rules: RewardRule[];
}

const emptyForm: ProgramForm = {
  campaign_id: "",
  start_date: undefined,
  end_date: undefined,
  max_referrals: 1,
  referral_code_prefix: "",
  status: true,
  reward_rules: [],
};

function generateRuleId() {
  return crypto.randomUUID().slice(0, 8);
}

function isCycleBased(cat: string, addonType: string | null) {
  return cat === "WIFI_PLAN" || (cat === "ADDON" && addonType === "DIGITAL");
}

function getUnitLabel(billingFreq: string) {
  if (billingFreq === "MONTHLY") return "Months";
  if (billingFreq === "WEEKLY") return "Weeks";
  if (billingFreq === "YEARLY") return "Years";
  return "Cycles";
}

function isRuleLive(rule: RewardRule) {
  const now = new Date();
  return now >= new Date(rule.start_date) && now <= new Date(rule.end_date);
}

/* ── Net price calculation ── */
function calcNetPrice(
  rule: RewardRule,
  components: PriceComp[],
): { originalTotal: number; discountAmount: number; netPrice: number } {
  if (!components.length) return { originalTotal: 0, discountAmount: 0, netPrice: 0 };
  const originalTotal = components.reduce((s, c) => s + c.amount_bdt, 0);
  const checkedTotal = components
    .filter(c => rule.applicable_components.includes(c.component_name))
    .reduce((s, c) => s + c.amount_bdt, 0);

  let discountAmount = 0;
  if (rule.discount_type === "FLAT") {
    discountAmount = Math.min(rule.discount_value, checkedTotal);
  } else {
    discountAmount = (rule.discount_value / 100) * checkedTotal;
  }
  discountAmount = Math.round(discountAmount * 100) / 100;
  const netPrice = Math.max(0, originalTotal - discountAmount);
  return { originalTotal, discountAmount, netPrice };
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

  /* ── Referee trigger list from parent campaign ── */
  const { data: campaignProductRules } = useQuery({
    queryKey: ["campaign-product-rules-for-referral", form.campaign_id],
    enabled: !!form.campaign_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_product_rules")
        .select("rule_id, product_id, rule_type, products!inner(product_name, product_category, addon_type)")
        .eq("campaign_id", form.campaign_id);
      if (error) throw error;
      return data;
    },
  });

  const { data: programsData, isLoading } = useQuery({
    queryKey: ["referral-programs", page, search],
    queryFn: async () => {
      let q = supabase
        .from("referral_programs")
        .select("*, campaign_master!inner(campaign_name)", { count: "exact" })
        .order("created_at", { ascending: false });
      if (search) q = q.or(`referral_code_prefix.ilike.%${search}%`);
      const { data, error, count } = await q.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      return { items: data ?? [], count: count ?? 0 };
    },
  });

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

  const selectedCampaign = useMemo(
    () => campaigns?.find(c => c.campaign_id === form.campaign_id),
    [campaigns, form.campaign_id],
  );

  /* ── Price components with AMOUNTS for reward rule products ── */
  const ruleProductIds = useMemo(() => [...new Set(form.reward_rules.map(r => r.product_id).filter(Boolean))], [form.reward_rules]);
  const { data: priceCompMap } = useQuery({
    queryKey: ["price-components-with-amounts", ruleProductIds],
    enabled: ruleProductIds.length > 0,
    queryFn: async () => {
      const { data: versions, error: vErr } = await supabase
        .from("product_price_versions")
        .select("price_version_id, product_id, base_price_bdt")
        .in("product_id", ruleProductIds)
        .eq("status", true);
      if (vErr) throw vErr;
      if (!versions?.length) return {} as Record<string, { base_price: number; components: PriceComp[] }>;
      const versionIds = versions.map(v => v.price_version_id);
      const { data: comps, error: cErr } = await supabase
        .from("price_components")
        .select("price_version_id, component_name, amount_bdt")
        .in("price_version_id", versionIds)
        .order("sort_order");
      if (cErr) throw cErr;
      const result: Record<string, { base_price: number; components: PriceComp[] }> = {};
      for (const v of versions) {
        const pComps = comps?.filter(c => c.price_version_id === v.price_version_id)
          .map(c => ({ component_name: c.component_name, amount_bdt: Number(c.amount_bdt) })) ?? [];
        // Keep first active version per product
        if (!result[v.product_id]) {
          result[v.product_id] = { base_price: Number(v.base_price_bdt), components: pComps };
        }
      }
      return result;
    },
  });

  /* ── Referee trigger items grouped ── */
  const refereeTriggers = useMemo(() => {
    if (!campaignProductRules) return { wifi: [], cpe: [], addons: [] };
    const wifi: any[] = [], cpe: any[] = [], addons: any[] = [];
    for (const rule of campaignProductRules) {
      const prod = (rule as any).products;
      if (!prod) continue;
      const item = { product_id: rule.product_id, product_name: prod.product_name, rule_type: rule.rule_type, category: prod.product_category, addon_type: prod.addon_type };
      if (prod.product_category === "WIFI_PLAN") wifi.push(item);
      else if (prod.product_category === "CPE") cpe.push(item);
      else addons.push(item);
    }
    return { wifi, cpe, addons };
  }, [campaignProductRules]);

  const totalTriggerCount = refereeTriggers.wifi.length + refereeTriggers.cpe.length + refereeTriggers.addons.length;

  /* ── Validation & Priority Logic ── */
  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    const rules = form.reward_rules;
    if (rules.length === 0) return errors;

    // Unique start date check
    const startDates = rules.map(r => r.start_date).filter(Boolean);
    const uniqueStarts = new Set(startDates);
    if (uniqueStarts.size < startDates.length) {
      errors.push("Two Reward Rules cannot have the same Start Date. Please adjust the timing.");
    }

    const campStart = selectedCampaign ? new Date(selectedCampaign.start_date) : null;
    const campEnd = selectedCampaign?.end_date ? new Date(selectedCampaign.end_date) : null;
    if (campStart) campStart.setHours(0, 0, 0, 0);
    if (campEnd) campEnd.setHours(23, 59, 59, 999);

    for (const rule of rules) {
      const label = rule.rule_name || "(unnamed)";
      // Date range within campaign
      if (rule.start_date && campStart && new Date(rule.start_date) < campStart) {
        errors.push(`Rule "${label}": Start date is before the campaign start.`);
      }
      if (rule.end_date && campEnd && new Date(rule.end_date) > campEnd) {
        errors.push(`Rule "${label}": End date is after the campaign end.`);
      }
      // Start < End
      if (rule.start_date && rule.end_date && rule.start_date > rule.end_date) {
        errors.push(`Rule "${label}": Start Date must be before End Date.`);
      }
    }
    return errors;
  }, [form.reward_rules, selectedCampaign]);

  const isFormValid = useMemo(() => {
    if (!form.campaign_id || !form.start_date) return false;
    if (form.reward_rules.length === 0) return false;
    if (validationErrors.length > 0) return false;
    for (const rule of form.reward_rules) {
      if (!rule.product_id || !rule.rule_name) return false;
      if (!rule.start_date || !rule.end_date) return false;
      if (rule.start_date > rule.end_date) return false;
      if (!rule.discount_value || rule.discount_value <= 0) return false;
    }
    return true;
  }, [form, validationErrors]);

  /* ── Winning rule detection: among overlapping rules, the one with the latest start_date wins ── */
  const winningRuleIds = useMemo(() => {
    const rules = form.reward_rules.filter(r => r.start_date && r.end_date);
    if (rules.length <= 1) return new Set(rules.map(r => r.id));
    const winners = new Set<string>();

    for (const rule of rules) {
      const rStart = new Date(rule.start_date);
      const rEnd = new Date(rule.end_date);
      // Find all rules that overlap with this one
      const overlapping = rules.filter(other => {
        if (other.id === rule.id) return false;
        const oStart = new Date(other.start_date);
        const oEnd = new Date(other.end_date);
        return rStart <= oEnd && oStart <= rEnd;
      });
      if (overlapping.length === 0) {
        // No overlap — this rule is a winner in its own period
        winners.add(rule.id);
      } else {
        // Among overlapping set + self, find the one with max start_date
        const allInSet = [rule, ...overlapping];
        allInSet.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
        winners.add(allInSet[0].id);
      }
    }
    return winners;
  }, [form.reward_rules]);

  /* ── Reward rule helpers ── */
  function addRewardRule() {
    const newRule: RewardRule = {
      id: generateRuleId(),
      rule_name: "",
      product_id: "",
      product_name: "",
      product_category: "",
      addon_type: null,
      reward_type: "CYCLES",
      reward_value: 1,
      reward_unit: "",
      discount_type: "FLAT",
      discount_value: 0,
      applicable_components: [],
      start_date: form.start_date ? form.start_date.toISOString().slice(0, 10) : "",
      end_date: form.end_date ? form.end_date.toISOString().slice(0, 10) : "",
    };
    setForm(f => ({ ...f, reward_rules: [...f.reward_rules, newRule] }));
  }

  function updateRule(ruleId: string, patch: Partial<RewardRule>) {
    setForm(f => ({
      ...f,
      reward_rules: f.reward_rules.map(r => r.id === ruleId ? { ...r, ...patch } : r),
    }));
  }

  function removeRule(ruleId: string) {
    setForm(f => ({ ...f, reward_rules: f.reward_rules.filter(r => r.id !== ruleId) }));
  }

  function toggleRuleComponent(ruleId: string, compName: string) {
    const rule = form.reward_rules.find(r => r.id === ruleId);
    if (!rule) return;
    const has = rule.applicable_components.includes(compName);
    updateRule(ruleId, {
      applicable_components: has
        ? rule.applicable_components.filter(c => c !== compName)
        : [...rule.applicable_components, compName],
    });
  }

  function onRuleProductChange(ruleId: string, productId: string) {
    if (!products) return;
    const p = products.find(pr => pr.product_id === productId);
    if (!p) return;
    const cycle = isCycleBased(p.product_category, p.addon_type);
    updateRule(ruleId, {
      product_id: productId,
      product_name: p.product_name,
      product_category: p.product_category,
      addon_type: p.addon_type,
      reward_type: cycle ? "CYCLES" : "PURCHASES",
      reward_unit: cycle ? getUnitLabel(p.billing_frequency) : "Purchases",
      applicable_components: [],
      discount_value: 0,
    });
  }

  /* ── Save ── */
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.campaign_id || !form.start_date) throw new Error("Fill all required fields.");
      if (form.reward_rules.length === 0) throw new Error("Add at least one reward rule.");
      for (const rule of form.reward_rules) {
        if (!rule.rule_name || !rule.product_id || !rule.start_date || !rule.end_date)
          throw new Error(`Rule "${rule.rule_name || '(unnamed)'}" is missing required fields.`);
      }
      const payload = {
        campaign_id: form.campaign_id,
        start_date: form.start_date.toISOString(),
        end_date: form.end_date ? form.end_date.toISOString() : null,
        max_referrals_per_customer: form.max_referrals,
        referral_code_prefix: form.referral_code_prefix || null,
        referee_config_matrix: JSON.parse(JSON.stringify(form.reward_rules)),
        referrer_reward_type: form.reward_rules[0]?.reward_type ?? "CYCLES",
        referrer_reward_value: form.reward_rules[0]?.reward_value ?? 1,
        referrer_reward_unit: form.reward_rules[0]?.reward_unit ?? "",
        referrer_product_id: form.reward_rules[0]?.product_id ?? null,
        status: form.status,
      };
      if (editId) {
        const { error } = await supabase.from("referral_programs").update(payload as any).eq("program_id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("referral_programs").insert(payload as any);
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
    const rules: RewardRule[] = Array.isArray(row.referee_config_matrix) ? row.referee_config_matrix : [];
    setEditId(row.program_id);
    setForm({
      campaign_id: row.campaign_id,
      start_date: new Date(row.start_date),
      end_date: row.end_date ? new Date(row.end_date) : undefined,
      max_referrals: row.max_referrals_per_customer,
      referral_code_prefix: row.referral_code_prefix ?? "",
      status: row.status,
      reward_rules: rules.map(r => ({ ...r, id: r.id || generateRuleId() })),
    });
    setDialogOpen(true);
  }

  function isLocked(programId: string) {
    return (redemptionCounts?.[programId] ?? 0) > 0;
  }

  const totalPages = Math.ceil((programsData?.count ?? 0) / PAGE_SIZE);

  /* ── Trigger card helper ── */
  function TriggerCard({ title, items, color }: { title: string; items: any[]; color: string }) {
    if (items.length === 0) return null;
    return (
      <div className="space-y-1">
        <p className={cn("text-[10px] font-semibold uppercase tracking-wider", color)}>{title}</p>
        <div className="flex flex-wrap gap-1">
          {items.map(item => (
            <Badge key={item.product_id} variant="outline" className="text-[10px] font-normal">
              {item.product_name}
              {item.rule_type === "EXCLUSIVE" && <Zap className="ml-1 h-2.5 w-2.5 text-primary" />}
            </Badge>
          ))}
        </div>
      </div>
    );
  }

  /* ── Render a single reward rule card ── */
  function RuleCard({ rule, idx }: { rule: RewardRule; idx: number }) {
    const live = rule.start_date && rule.end_date && isRuleLive(rule);
    const priceData = priceCompMap?.[rule.product_id];
    const components = priceData?.components ?? [];
    const { originalTotal, discountAmount, netPrice } = calcNetPrice(rule, components);

    return (
      <AccordionItem key={rule.id} value={rule.id} className={cn("border rounded-lg px-3", live && "border-primary")}>
        <AccordionTrigger className="text-sm py-2">
          <div className="flex items-center gap-2">
            <span className="font-medium">{rule.rule_name || `Rule ${idx + 1}`}</span>
            {live && <Badge className="text-[9px] h-4 bg-primary">LIVE</Badge>}
            {rule.start_date && rule.end_date && (
              <span className="text-[10px] text-muted-foreground ml-2">
                {rule.start_date} → {rule.end_date}
              </span>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent className="space-y-4 pb-3">
          {/* Row 1: Rule Name & Dates */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px]">Rule Name <span className="text-destructive">*</span></Label>
              <Input className="h-8 text-xs" placeholder="e.g. Standard April Reward"
                value={rule.rule_name} onChange={(e) => updateRule(rule.id, { rule_name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Start Date <span className="text-destructive">*</span></Label>
              <Input type="date" className="h-8 text-xs" value={rule.start_date}
                min={form.start_date ? form.start_date.toISOString().slice(0, 10) : ""}
                max={form.end_date ? form.end_date.toISOString().slice(0, 10) : ""}
                onChange={(e) => updateRule(rule.id, { start_date: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">End Date <span className="text-destructive">*</span></Label>
              <Input type="date" className="h-8 text-xs" value={rule.end_date}
                min={rule.start_date || (form.start_date ? form.start_date.toISOString().slice(0, 10) : "")}
                max={form.end_date ? form.end_date.toISOString().slice(0, 10) : ""}
                onChange={(e) => updateRule(rule.id, { end_date: e.target.value })} />
            </div>
          </div>

          {/* Row 2: Product & Reward config — 2x2 grid for visibility */}
          <div className="grid grid-cols-2 gap-3">
            {/* Product Dropdown */}
            <div className="space-y-1">
              <Label className="text-[10px]">Product <span className="text-destructive">*</span></Label>
              <Select value={rule.product_id} onValueChange={(v) => onRuleProductChange(rule.id, v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select product..." /></SelectTrigger>
                <SelectContent>
                  {products?.map(p => (
                    <SelectItem key={p.product_id} value={p.product_id}>
                      <span className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[8px] h-3.5 px-1">{p.product_category}</Badge>
                        {p.product_name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Original Price (read-only) */}
              {rule.product_id && (
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[10px] text-muted-foreground">Original Price:</span>
                  <span className="text-[10px] font-semibold font-mono">
                    {originalTotal > 0 ? formatBDT(originalTotal) : "—"}
                  </span>
                </div>
              )}
            </div>

            {/* Discount Type & Value */}
            <div className="space-y-1">
              <Label className="text-[10px]">Discount</Label>
              <div className="flex gap-1">
                <Select value={rule.discount_type} onValueChange={(v) => updateRule(rule.id, { discount_type: v as "FLAT" | "PERCENT" })}>
                  <SelectTrigger className="h-8 text-xs w-[72px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FLAT">BDT</SelectItem>
                    <SelectItem value="PERCENT">%</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="number" min={0}
                  max={rule.discount_type === "PERCENT" ? 100 : undefined}
                  className="h-8 text-xs flex-1" value={rule.discount_value}
                  onChange={(e) => updateRule(rule.id, { discount_value: parseFloat(e.target.value) || 0 })} />
              </div>
              {/* Offer Price preview */}
              {rule.product_id && rule.discount_value > 0 && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Offer: <span className="font-mono font-semibold text-primary">{formatBDT(netPrice)}</span>
                  {rule.discount_type === "PERCENT" && rule.discount_value >= 100 && (
                    <span className="ml-1 text-emerald-600 font-semibold">FREE</span>
                  )}
                </p>
              )}
            </div>
          </div>

          {/* Row 3: Cycles & Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px]">{rule.reward_type === "CYCLES" ? "Number of Cycles" : "Number of Purchases"}</Label>
              <Input type="number" min={1} step={1} className="h-8 text-xs" value={rule.reward_value}
                onChange={(e) => { const v = parseInt(e.target.value); if (v > 0) updateRule(rule.id, { reward_value: v }); }}
                onKeyDown={(e) => { if (e.key === '.' || e.key === '-' || e.key === 'e') e.preventDefault(); }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Unit</Label>
              <Input className="h-8 text-xs bg-muted" value={rule.reward_unit} readOnly />
            </div>
          </div>

          {/* Row 3: Component Checkboxes + Net Price Preview */}
          {rule.product_id && (
            <div className="border rounded-md p-3 bg-muted/30 space-y-2">
              <Label className="text-[10px] font-semibold">Applicable Components — Discount applies ONLY to checked items</Label>
              {components.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">
                    {components.map(comp => {
                      const checked = rule.applicable_components.includes(comp.component_name);
                      return (
                        <label key={comp.component_name} className="flex items-center gap-1.5 text-[11px] cursor-pointer">
                          <Checkbox className="h-3.5 w-3.5"
                            checked={checked}
                            onCheckedChange={() => toggleRuleComponent(rule.id, comp.component_name)}
                          />
                          <span className={checked ? "font-medium" : "text-muted-foreground"}>
                            {comp.component_name}
                          </span>
                          <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                            {formatBDT(comp.amount_bdt)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {/* Net Price Summary */}
                  <Separator className="my-1" />
                  <div className="flex items-center justify-between text-xs">
                    <div className="space-x-3">
                      <span className="text-muted-foreground">Original: <span className="font-mono">{formatBDT(originalTotal)}</span></span>
                      <span className="text-destructive">Discount: <span className="font-mono">−{formatBDT(discountAmount)}</span></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">Calculated Net Price:</span>
                      <span className={cn("font-mono font-bold text-sm", netPrice === 0 ? "text-emerald-600" : "text-foreground")}>
                        {netPrice === 0 ? "FREE" : formatBDT(netPrice)}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-[10px] text-muted-foreground">No price components found. Set up pricing for this product first.</p>
              )}
            </div>
          )}

          {/* Remove button */}
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" className="text-destructive text-xs h-7" onClick={() => removeRule(rule.id)}>
              <Trash2 className="h-3 w-3 mr-1" />Remove Rule
            </Button>
          </div>
        </AccordionContent>
      </AccordionItem>
    );
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
              <TableHead className="w-[100px]">Start</TableHead>
              <TableHead className="w-[100px]">End</TableHead>
              <TableHead className="w-[60px]">Max Ref</TableHead>
              <TableHead className="w-[80px]">Rules</TableHead>
              <TableHead className="w-[80px]">Status</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : !programsData?.items?.length ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No referral programs found.</TableCell></TableRow>
            ) : programsData.items.map((row: any) => {
              const locked = isLocked(row.program_id);
              const rules: RewardRule[] = Array.isArray(row.referee_config_matrix) ? row.referee_config_matrix : [];
              const isExpanded = expandedRow === row.program_id;
              return (
                <>
                  <TableRow key={row.program_id} className={locked ? "bg-warning/10" : ""}>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExpandedRow(isExpanded ? null : row.program_id)}>
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </Button>
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      {(row as any).campaign_master?.campaign_name ?? "—"}
                      {locked && <Lock className="inline ml-1.5 h-3.5 w-3.5 text-warning" />}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{format(new Date(row.start_date), "dd MMM yy")}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.end_date ? format(new Date(row.end_date), "dd MMM yy") : "—"}</TableCell>
                    <TableCell className="text-sm font-mono">{row.max_referrals_per_customer}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{rules.length} rule{rules.length !== 1 ? "s" : ""}</Badge></TableCell>
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
                      <TableCell colSpan={8} className="bg-muted/30 p-4">
                        {locked && (
                          <Alert variant="default" className="mb-3 border-warning bg-warning/10">
                            <AlertTriangle className="h-4 w-4 text-warning" />
                            <AlertDescription className="text-foreground text-sm">
                              <strong>Active Contract:</strong> Financial fields locked. Only End Date is editable.
                            </AlertDescription>
                          </Alert>
                        )}
                        <p className="text-xs font-medium mb-2">Referrer Reward Rules Timeline:</p>
                        {rules.length > 0 ? (
                          <div className="space-y-2">
                            {rules.map((rule, idx) => {
                              const live = rule.start_date && rule.end_date && isRuleLive(rule);
                              return (
                                <div key={rule.id || idx} className={cn("border rounded-md p-3 text-xs", live && "border-primary bg-primary/5")}>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-semibold">{rule.rule_name || `Rule ${idx + 1}`}</span>
                                    {live && <Badge className="text-[9px] h-4 bg-primary">LIVE</Badge>}
                                    <span className="text-muted-foreground ml-auto">
                                      {rule.start_date ? format(new Date(rule.start_date), "dd MMM yy") : "?"} – {rule.end_date ? format(new Date(rule.end_date), "dd MMM yy") : "?"}
                                    </span>
                                  </div>
                                  <p className="text-muted-foreground">
                                    Product: <strong>{rule.product_name}</strong> · {rule.reward_value} {rule.reward_unit} · Discount: {rule.discount_type === "FLAT" ? formatBDT(rule.discount_value) : `${rule.discount_value}%`}
                                    {rule.applicable_components?.length > 0 && <> · Components: {rule.applicable_components.join(", ")}</>}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">No reward rules configured.</p>
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

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
                <Label className="text-xs">Program Start Date <span className="text-destructive">*</span></Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.start_date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.start_date ? format(form.start_date, "dd MMM yyyy") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single" selected={form.start_date}
                      onSelect={(d) => setForm(f => ({ ...f, start_date: d }))}
                      disabled={(date) => {
                        if (!selectedCampaign) return false;
                        const cs = new Date(selectedCampaign.start_date); cs.setHours(0,0,0,0);
                        if (date < cs) return true;
                        if (selectedCampaign.end_date) { const ce = new Date(selectedCampaign.end_date); ce.setHours(23,59,59,999); if (date > ce) return true; }
                        return false;
                      }}
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Program End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.end_date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.end_date ? format(form.end_date, "dd MMM yyyy") : "Optional"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single" selected={form.end_date}
                      onSelect={(d) => setForm(f => ({ ...f, end_date: d }))}
                      disabled={(date) => {
                        if (!selectedCampaign) return false;
                        const cs = new Date(selectedCampaign.start_date); cs.setHours(0,0,0,0);
                        if (date < cs) return true;
                        if (selectedCampaign.end_date) { const ce = new Date(selectedCampaign.end_date); ce.setHours(23,59,59,999); if (date > ce) return true; }
                        if (form.start_date && date < form.start_date) return true;
                        return false;
                      }}
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Code Prefix <span className="text-muted-foreground">(Optional)</span></Label>
                <Input
                  value={form.referral_code_prefix} maxLength={7} placeholder="e.g. GP-"
                  onChange={(e) => setForm(f => ({ ...f, referral_code_prefix: e.target.value.toUpperCase().replace(/[^A-Z0-9\-]/g, "") }))}
                />
                <p className="text-[10px] text-muted-foreground">
                  {form.referral_code_prefix
                    ? `Code format: ${form.referral_code_prefix}${"X".repeat(8 - form.referral_code_prefix.length)} (8 chars total)`
                    : "If blank, a random 8-char alphanumeric code will be generated"}
                </p>
              </div>
            </div>

            <Separator />

            {/* ── Two-panel layout ── */}
            <div className="grid grid-cols-[280px_1fr] gap-4">
              {/* LEFT: Referee Trigger List (Read-Only) */}
              <div className="space-y-3">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Referee Trigger List</h4>
                  <p className="text-[10px] text-muted-foreground italic">
                    Read-only. Pulled from parent campaign product rules. These items trigger the referrer reward globally.
                  </p>
                </div>

                {!form.campaign_id ? (
                  <Card className="border-dashed">
                    <CardContent className="py-6 text-center text-xs text-muted-foreground">
                      Select a campaign to view trigger items
                    </CardContent>
                  </Card>
                ) : totalTriggerCount === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="py-6 text-center text-xs text-muted-foreground">
                      No product rules configured for this campaign
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="py-3 px-3 space-y-3">
                      <TriggerCard title="WiFi Plans" items={refereeTriggers.wifi} color="text-primary" />
                      <TriggerCard title="CPE / Hardware" items={refereeTriggers.cpe} color="text-emerald-600" />
                      <TriggerCard title="Addons" items={refereeTriggers.addons} color="text-violet-600" />
                      <Separator />
                      <p className="text-[10px] text-muted-foreground">
                        <strong>{totalTriggerCount}</strong> product{totalTriggerCount !== 1 ? "s" : ""} trigger referrer rewards
                      </p>
                    </CardContent>
                  </Card>
                )}

                <Alert className="border-muted">
                  <AlertDescription className="text-[10px] text-muted-foreground">
                    Any active Referrer Reward Rule below applies globally to all items in this trigger list.
                  </AlertDescription>
                </Alert>
              </div>

              {/* RIGHT: Referrer Reward Timeline (Multi-Rule Builder) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Referrer Reward Timeline</h4>
                    <p className="text-[10px] text-muted-foreground italic">
                      If dates overlap, the rule with the LATEST start date applies.
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={addRewardRule} disabled={!form.campaign_id}>
                    <Plus className="h-3.5 w-3.5 mr-1" />Add New Reward Period
                  </Button>
                </div>

                {form.reward_rules.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="py-8 text-center text-xs text-muted-foreground">
                      <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                      No reward periods defined. Click "Add New Reward Period" to start.
                    </CardContent>
                  </Card>
                ) : (
                  <Accordion type="multiple" defaultValue={form.reward_rules.map(r => r.id)} className="space-y-2">
                    {form.reward_rules.map((rule, idx) => (
                      <RuleCard key={rule.id} rule={rule} idx={idx} />
                    ))}
                  </Accordion>
                )}
              </div>
            </div>

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
