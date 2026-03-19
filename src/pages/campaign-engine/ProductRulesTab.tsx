import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, ShieldCheck, ChevronRight, ChevronLeft, Save, Ban, Unlock, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { formatBDT } from "@/lib/currency";

/* ── Types ── */
interface DiscountRule {
  product_id: string;
  discount_type: "FLAT" | "PERCENT";
  percent_value: number; // only used when PERCENT
  component_mapping: Record<string, number>; // component_name → BDT discount (FLAT: manual input, PERCENT: resolved)
  selected_components: string[]; // for PERCENT: which components to apply
}

interface ProductRow {
  product_id: string;
  product_name: string;
  product_category: string;
  is_exclusive: boolean;
  network_capability: string;
  status: boolean;
}

interface PriceComponent {
  component_name: string;
  amount_bdt: number;
  component_type: string;
}

const PHASE_LABELS = ["Network Filter", "Availability & Exclusivity", "Discount Rules", "Review & Save"];

export default function ProductRulesTab({ campaignId }: { campaignId: string }) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState(0);
  const { toast } = useToast();
  const qc = useQueryClient();

  // Phase 0 state — campaign network type
  const [campaignNetworkType, setCampaignNetworkType] = useState<"4G" | "5G" | "ANY">("ANY");

  // Phase 1 state
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [exclusiveIds, setExclusiveIds] = useState<Set<string>>(new Set());

  // Phase 2 state — each product stores its own independent discount rule
  const [discountRules, setDiscountRules] = useState<Map<string, DiscountRule>>(new Map());

  // Price components cache per product
  const [componentCache, setComponentCache] = useState<Record<string, PriceComponent[]>>({});

  /* ── Fetch campaign targeting rules to determine network type ── */
  const { data: targetingRules } = useQuery({
    queryKey: ["targeting_rules_network", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_targeting_rules")
        .select("network_type")
        .eq("campaign_id", campaignId);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Derive campaign network type from targeting rules
  const derivedNetworkType = useMemo(() => {
    if (!targetingRules?.length) return "ANY";
    const types = new Set(targetingRules.map((r: any) => r.network_type).filter(Boolean));
    if (types.size === 0) return "ANY";
    if (types.has("ANY") || (types.has("4G") && types.has("5G"))) return "ANY";
    if (types.has("5G")) return "5G";
    if (types.has("4G")) return "4G";
    return "ANY";
  }, [targetingRules]);

  useEffect(() => {
    setCampaignNetworkType(derivedNetworkType as "4G" | "5G" | "ANY");
  }, [derivedNetworkType]);

  /* ── Fetch ALL active products (including network_capability) ── */
  const { data: allProducts, isLoading: productsLoading } = useQuery({
    queryKey: ["products_campaign_lookup"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("product_id, product_name, product_category, is_exclusive, network_capability, status")
        .eq("status", true)
        .order("product_category")
        .order("product_name");
      if (error) throw error;
      return (data ?? []) as ProductRow[];
    },
    staleTime: 0,
  });

  /* ── Step 0: Network-filtered products ── */
  const networkFilteredProducts = useMemo(() => {
    if (!allProducts) return [];
    return allProducts.filter(p => {
      if (campaignNetworkType === "ANY") return true;
      // Product with ANY or BOTH capability passes all filters
      if (p.network_capability === "ANY" || p.network_capability === "BOTH") return true;
      // Campaign is 4G → hide 5G-only products
      if (campaignNetworkType === "4G" && p.network_capability === "5G") return false;
      // Campaign is 5G → hide 4G-only products
      if (campaignNetworkType === "5G" && p.network_capability === "4G") return false;
      return true;
    });
  }, [allProducts, campaignNetworkType]);

  /* ── Existing rules (for display table) ── */
  const { data: rules, isLoading } = useQuery({
    queryKey: ["product_rules", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_product_rules")
        .select("*, products(product_name, product_category, is_exclusive), campaign_discount_mappings(*)")
        .eq("campaign_id", campaignId);
      if (error) throw error;
      return data;
    },
  });

  const deleteRule = useMutation({
    mutationFn: async (ruleId: string) => {
      const { error } = await supabase.from("campaign_product_rules").delete().eq("rule_id", ruleId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["product_rules", campaignId] }); toast({ title: "Rule removed" }); },
  });

  /* ── Products available after Phase 1 filtering (not blocked, exclusive unlocked) ── */
  const availableProducts = useMemo(() => {
    return networkFilteredProducts.filter(p => {
      if (blockedIds.has(p.product_id)) return false;
      if (p.is_exclusive && !exclusiveIds.has(p.product_id)) return false;
      return true;
    });
  }, [networkFilteredProducts, blockedIds, exclusiveIds]);

  /* ── Fetch price components for all available products ── */
  const fetchComponentsForProducts = useCallback(async (productIds: string[]) => {
    const missing = productIds.filter(id => !componentCache[id]);
    if (!missing.length) return;

    const newCache: Record<string, PriceComponent[]> = {};
    for (const pid of missing) {
      const { data: pv } = await supabase
        .from("product_price_versions")
        .select("price_version_id")
        .eq("product_id", pid)
        .eq("status", true)
        .order("start_date", { ascending: false })
        .limit(1)
        .single();
      if (pv) {
        const { data: comps } = await supabase
          .from("price_components")
          .select("component_name, amount_bdt, component_type")
          .eq("price_version_id", pv.price_version_id)
          .order("sort_order");
        newCache[pid] = (comps ?? []).map(c => ({ ...c, amount_bdt: Number(c.amount_bdt) }));
      } else {
        newCache[pid] = [];
      }
    }
    setComponentCache(prev => ({ ...prev, ...newCache }));
  }, [componentCache]);

  /* ── Phase navigation ── */
  const goToPhase2 = useCallback(async () => {
    const ids = availableProducts.map(p => p.product_id);
    await fetchComponentsForProducts(ids);
    setPhase(2);
  }, [availableProducts, fetchComponentsForProducts]);

  /* ── Phase 1 toggles ── */
  const toggleBlocked = (pid: string) => {
    setBlockedIds(prev => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid); else next.add(pid);
      return next;
    });
    setExclusiveIds(prev => { const next = new Set(prev); next.delete(pid); return next; });
    setDiscountRules(prev => { const next = new Map(prev); next.delete(pid); return next; });
  };

  const toggleExclusive = (pid: string) => {
    setExclusiveIds(prev => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid); else next.add(pid);
      return next;
    });
  };

  /* ── Phase 2 discount helpers — fully independent per product ── */
  const setDiscountType = (pid: string, type: "FLAT" | "PERCENT") => {
    setDiscountRules(prev => {
      const next = new Map(prev);
      next.set(pid, {
        product_id: pid,
        discount_type: type,
        percent_value: 0,
        component_mapping: {},
        selected_components: [],
      });
      return next;
    });
  };

  const setPercentValue = (pid: string, val: number) => {
    setDiscountRules(prev => {
      const next = new Map(prev);
      const existing = next.get(pid);
      if (existing) next.set(pid, { ...existing, percent_value: val });
      return next;
    });
  };

  const setComponentDiscount = (pid: string, compName: string, val: number) => {
    setDiscountRules(prev => {
      const next = new Map(prev);
      const existing = next.get(pid);
      if (existing) {
        next.set(pid, { ...existing, component_mapping: { ...existing.component_mapping, [compName]: val } });
      }
      return next;
    });
  };

  const togglePercentComponent = (pid: string, compName: string) => {
    setDiscountRules(prev => {
      const next = new Map(prev);
      const existing = next.get(pid);
      if (existing) {
        const sel = existing.selected_components.includes(compName)
          ? existing.selected_components.filter(c => c !== compName)
          : [...existing.selected_components, compName];
        next.set(pid, { ...existing, selected_components: sel });
      }
      return next;
    });
  };

  /* ── Compute totals ── */
  const getFlatTotal = (rule: DiscountRule) =>
    Object.values(rule.component_mapping).reduce((s, v) => s + (v || 0), 0);

  const getPercentBDT = (rule: DiscountRule, comps: PriceComponent[]) => {
    const pct = rule.percent_value / 100;
    return comps
      .filter(c => rule.selected_components.includes(c.component_name))
      .reduce((s, c) => s + c.amount_bdt * pct, 0);
  };

  /* ── Resolve a rule to absolute BDT breakdown (for review & save) ── */
  const resolveToAbsoluteBDT = (rule: DiscountRule, comps: PriceComponent[]) => {
    const breakdown: Record<string, number> = {};
    if (rule.discount_type === "FLAT") {
      Object.entries(rule.component_mapping).forEach(([name, amt]) => {
        if (amt > 0) breakdown[name] = amt;
      });
    } else {
      const pct = rule.percent_value / 100;
      comps.filter(c => rule.selected_components.includes(c.component_name))
        .forEach(c => {
          const amt = Math.round(c.amount_bdt * pct * 100) / 100;
          if (amt > 0) breakdown[c.component_name] = amt;
        });
    }
    return breakdown;
  };

  const hasDiscount = (rule: DiscountRule) => {
    if (rule.discount_type === "FLAT") return getFlatTotal(rule) > 0;
    return rule.percent_value > 0 && rule.selected_components.length > 0;
  };

  /* ── Validation ── */
  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    discountRules.forEach((rule, pid) => {
      const product = allProducts?.find(p => p.product_id === pid);
      const name = product?.product_name ?? pid;
      const comps = componentCache[pid] ?? [];

      if (rule.discount_type === "FLAT") {
        Object.entries(rule.component_mapping).forEach(([comp, amt]) => {
          if (amt < 0) errors.push(`${name} → ${comp}: Negative value.`);
          const orig = comps.find(c => c.component_name === comp);
          if (orig && amt > orig.amount_bdt) errors.push(`${name} → ${comp}: Exceeds ${formatBDT(orig.amount_bdt)}.`);
        });
      }
      if (rule.discount_type === "PERCENT") {
        if (rule.percent_value < 0) errors.push(`${name}: Negative percentage.`);
        if (rule.percent_value > 100) errors.push(`${name}: Percentage cannot exceed 100%.`);
      }
    });
    return errors;
  }, [discountRules, componentCache, allProducts]);

  /* ── Save mutation ── */
  const saveMutation = useMutation({
    mutationFn: async () => {
      // Delete existing rules
      const { error: delErr } = await supabase
        .from("campaign_product_rules")
        .delete()
        .eq("campaign_id", campaignId);
      if (delErr) throw delErr;

      const allRuleInserts: any[] = [];

      // UNAVAILABLE rules
      for (const pid of blockedIds) {
        allRuleInserts.push({ campaign_id: campaignId, product_id: pid, rule_type: "UNAVAILABLE" as const });
      }

      // EXCLUSIVE rules
      for (const pid of exclusiveIds) {
        allRuleInserts.push({ campaign_id: campaignId, product_id: pid, rule_type: "EXCLUSIVE" as const });
      }

      // DISCOUNT rules — each product independent
      for (const [pid, rule] of discountRules.entries()) {
        if (!hasDiscount(rule)) continue;
        const comps = componentCache[pid] ?? [];
        const resolved = resolveToAbsoluteBDT(rule, comps);
        const applicableComponents = Object.keys(resolved);
        const totalDiscount = Object.values(resolved).reduce((s, v) => s + v, 0);

        allRuleInserts.push({
          campaign_id: campaignId,
          product_id: pid,
          rule_type: "DISCOUNT" as const,
          discount_type: rule.discount_type,
          discount_value: rule.discount_type === "PERCENT" ? rule.percent_value : totalDiscount,
          applicable_components: applicableComponents,
        });
      }

      if (allRuleInserts.length > 0) {
        const { data: insertedRules, error: insErr } = await supabase
          .from("campaign_product_rules")
          .insert(allRuleInserts)
          .select("rule_id, product_id, rule_type");
        if (insErr) throw insErr;

        // Insert discount mappings with resolved BDT amounts
        const mappings: any[] = [];
        for (const ir of (insertedRules ?? [])) {
          if (ir.rule_type !== "DISCOUNT") continue;
          const rule = discountRules.get(ir.product_id);
          if (!rule) continue;
          const comps = componentCache[ir.product_id] ?? [];
          const resolved = resolveToAbsoluteBDT(rule, comps);
          Object.entries(resolved).forEach(([name, amt]) => {
            mappings.push({ rule_id: ir.rule_id, component_name: name, discount_amount_bdt: amt });
          });
        }
        if (mappings.length > 0) {
          const { error: mErr } = await supabase.from("campaign_discount_mappings").insert(mappings);
          if (mErr) throw mErr;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product_rules", campaignId] });
      closeDialog();
      toast({ title: "Product rules saved successfully" });
    },
    onError: (e: Error) => toast({ title: "Error saving rules", description: e.message, variant: "destructive" }),
  });

  const closeDialog = () => {
    setOpen(false);
    setPhase(0);
    setBlockedIds(new Set());
    setExclusiveIds(new Set());
    setDiscountRules(new Map());
    setComponentCache({});
  };

  /* ── Pre-populate wizard from existing rules ── */
  const openWizard = useCallback(() => {
    if (rules) {
      const blocked = new Set<string>();
      const exclusive = new Set<string>();
      rules.forEach((r: any) => {
        if (r.rule_type === "UNAVAILABLE") blocked.add(r.product_id);
        if (r.rule_type === "EXCLUSIVE") exclusive.add(r.product_id);
      });
      setBlockedIds(blocked);
      setExclusiveIds(exclusive);

      const dRules = new Map<string, DiscountRule>();
      rules.forEach((r: any) => {
        if (r.rule_type === "DISCOUNT") {
          const mapping: Record<string, number> = {};
          const selComps: string[] = [];
          (r.campaign_discount_mappings ?? []).forEach((m: any) => {
            mapping[m.component_name] = Number(m.discount_amount_bdt);
            selComps.push(m.component_name);
          });
          dRules.set(r.product_id, {
            product_id: r.product_id,
            discount_type: r.discount_type ?? "FLAT",
            percent_value: r.discount_type === "PERCENT" ? Number(r.discount_value ?? 0) : 0,
            component_mapping: mapping,
            selected_components: r.discount_type === "PERCENT" ? selComps : [],
          });
        }
      });
      setDiscountRules(dRules);
    }
    setPhase(0);
    setOpen(true);
  }, [rules]);

  /* ── Category grouping helper (uses network-filtered list) ── */
  const groupedProducts = useMemo(() => {
    const groups: Record<string, ProductRow[]> = {};
    networkFilteredProducts.forEach(p => {
      const cat = p.product_category;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
    });
    return groups;
  }, [networkFilteredProducts]);

  /* ── Review: build unified summary rows ── */
  const reviewRows = useMemo(() => {
    const rows: { product_id: string; product_name: string; category: string; discount_type: string; base_disc_bdt: number; vat_disc_bdt: number; sd_disc_bdt: number; other_disc_bdt: number; total_disc_bdt: number }[] = [];
    discountRules.forEach((rule, pid) => {
      if (!hasDiscount(rule)) return;
      const product = allProducts?.find(p => p.product_id === pid);
      const comps = componentCache[pid] ?? [];
      const resolved = resolveToAbsoluteBDT(rule, comps);
      const base = resolved["BASE"] ?? 0;
      const vat = resolved["VAT"] ?? 0;
      const sd = resolved["SD"] ?? 0;
      const other = Object.entries(resolved).filter(([k]) => !["BASE", "VAT", "SD"].includes(k)).reduce((s, [, v]) => s + v, 0);
      rows.push({
        product_id: pid,
        product_name: product?.product_name ?? pid,
        category: product?.product_category ?? "",
        discount_type: rule.discount_type === "PERCENT" ? `${rule.percent_value}%` : "Absolute",
        base_disc_bdt: base,
        vat_disc_bdt: vat,
        sd_disc_bdt: sd,
        other_disc_bdt: other,
        total_disc_bdt: base + vat + sd + other,
      });
    });
    return rows;
  }, [discountRules, componentCache, allProducts]);

  const networkBadge = (cap: string) => {
    if (cap === "4G") return <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-700">4G</Badge>;
    if (cap === "5G") return <Badge variant="outline" className="text-[10px] border-blue-500 text-blue-700">5G</Badge>;
    return <Badge variant="outline" className="text-[10px]">{cap}</Badge>;
  };

  return (
    <TooltipProvider>
      <div className="space-y-4 pt-2">
        <div className="flex justify-end">
          <Button size="sm" onClick={openWizard}>
            <Plus className="h-4 w-4 mr-1.5" />Manage Product Rules
          </Button>
        </div>

        {/* ── Existing Rules Table ── */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Rule Type</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Component Breakdown</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Loading...</TableCell></TableRow>
              ) : !rules?.length ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No product rules yet.</TableCell></TableRow>
              ) : rules.map((r: any) => (
                <TableRow key={r.rule_id}>
                  <TableCell className="font-medium text-sm">
                    <div className="flex items-center gap-1.5">
                      {r.products?.product_name}
                      {r.products?.is_exclusive && (
                        <Tooltip>
                          <TooltipTrigger asChild><ShieldCheck className="h-3.5 w-3.5 text-primary" /></TooltipTrigger>
                          <TooltipContent>Exclusive product</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{r.products?.product_category}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={r.rule_type === "DISCOUNT" ? "default" : r.rule_type === "UNAVAILABLE" ? "destructive" : "secondary"} className="text-xs">
                      {r.rule_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.rule_type === "DISCOUNT"
                      ? r.discount_type === "PERCENT" ? `${r.discount_value}%` : formatBDT(r.discount_value)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.campaign_discount_mappings?.length > 0
                      ? r.campaign_discount_mappings.map((m: any) => `${m.component_name}: ${formatBDT(Number(m.discount_amount_bdt))}`).join(", ")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteRule.mutate(r.rule_id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* ── 4-Phase Wizard Dialog ── */}
        <Dialog open={open} onOpenChange={() => {}}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto" onPointerDownOutside={e => e.preventDefault()} onEscapeKeyDown={e => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>Product Rules Wizard</DialogTitle>
              <DialogDescription>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {PHASE_LABELS.map((label, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                        i === phase ? "bg-primary text-primary-foreground" : i < phase ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                      }`}>{i}</span>
                      <span className={`text-xs ${i === phase ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{label}</span>
                      {i < 3 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                    </div>
                  ))}
                </div>
              </DialogDescription>
            </DialogHeader>

            <div className="py-2 min-h-[300px]">
              {/* ═══ PHASE 0: Network Filter ═══ */}
              {phase === 0 && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Products are auto-filtered based on the campaign's targeting network type. You can override below.
                  </p>
                  <div className="flex items-center gap-3">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm">Campaign Network Type:</Label>
                    <Select value={campaignNetworkType} onValueChange={(v) => setCampaignNetworkType(v as any)}>
                      <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ANY">All Networks</SelectItem>
                        <SelectItem value="4G">4G Only</SelectItem>
                        <SelectItem value="5G">5G Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Alert>
                    <AlertDescription className="text-xs">
                      {campaignNetworkType === "ANY"
                        ? `Showing all ${networkFilteredProducts.length} active products.`
                        : `Showing ${networkFilteredProducts.length} products compatible with ${campaignNetworkType}. Products tagged exclusively as ${campaignNetworkType === "4G" ? "5G" : "4G"} are hidden.`}
                    </AlertDescription>
                  </Alert>
                  {/* Quick preview */}
                  <div className="border rounded-md max-h-[200px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Network</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {networkFilteredProducts.map(p => (
                          <TableRow key={p.product_id}>
                            <TableCell className="text-xs">{p.product_name}</TableCell>
                            <TableCell><Badge variant="outline" className="text-[10px]">{p.product_category}</Badge></TableCell>
                            <TableCell>{networkBadge(p.network_capability)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* ═══ PHASE 1: Availability & Exclusivity ═══ */}
              {phase === 1 && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Define the hardware portfolio. Block products to hide them, or unlock exclusive products.
                  </p>
                  {productsLoading ? (
                    <p className="text-center text-muted-foreground py-8">Loading products...</p>
                  ) : (
                    Object.entries(groupedProducts).map(([category, prods]) => (
                      <div key={category} className="space-y-1">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 pt-2">{category}</h4>
                        <div className="border rounded-md">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[200px]">Product</TableHead>
                                <TableHead className="w-[80px]">Network</TableHead>
                                <TableHead className="w-[100px] text-center">
                                  <div className="flex items-center justify-center gap-1"><Ban className="h-3.5 w-3.5 text-destructive" /><span>Block</span></div>
                                </TableHead>
                                <TableHead className="w-[120px] text-center">
                                  <div className="flex items-center justify-center gap-1"><Unlock className="h-3.5 w-3.5 text-primary" /><span>Exclusive</span></div>
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {prods.map(p => (
                                <TableRow key={p.product_id}>
                                  <TableCell className="text-sm font-medium">
                                    {p.product_name}
                                    {p.is_exclusive && <Badge variant="secondary" className="ml-2 text-[10px]">Exclusive</Badge>}
                                  </TableCell>
                                  <TableCell>{networkBadge(p.network_capability)}</TableCell>
                                  <TableCell className="text-center">
                                    <Checkbox checked={blockedIds.has(p.product_id)} onCheckedChange={() => toggleBlocked(p.product_id)} />
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {p.is_exclusive ? (
                                      <Checkbox checked={exclusiveIds.has(p.product_id)} onCheckedChange={() => toggleExclusive(p.product_id)} disabled={blockedIds.has(p.product_id)} />
                                    ) : (
                                      <span className="text-muted-foreground text-xs">N/A</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* ═══ PHASE 2: Discount Rules (Independent per product) ═══ */}
              {phase === 2 && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Configure discounts independently for each product. FLAT and PERCENT rules can coexist across products.
                  </p>
                  {availableProducts.length === 0 ? (
                    <Alert><AlertDescription>All products are blocked. Go back to unblock products.</AlertDescription></Alert>
                  ) : (
                    availableProducts.map(p => {
                      const rule = discountRules.get(p.product_id);
                      const comps = componentCache[p.product_id] ?? [];
                      const hasComps = comps.length > 0;

                      return (
                        <div key={p.product_id} className="border rounded-lg p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{p.product_name}</span>
                              <Badge variant="outline" className="text-[10px]">{p.product_category}</Badge>
                              {networkBadge(p.network_capability)}
                              {p.is_exclusive && <Badge variant="secondary" className="text-[10px]">Exclusive</Badge>}
                            </div>
                            {!hasComps && <span className="text-xs text-muted-foreground">No pricing set up</span>}
                          </div>

                          {hasComps && (
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-xs">Discount Type</Label>
                                <Select value={rule?.discount_type ?? ""} onValueChange={(v) => setDiscountType(p.product_id, v as "FLAT" | "PERCENT")}>
                                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select type" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="FLAT">Absolute BDT</SelectItem>
                                    <SelectItem value="PERCENT">Percentage %</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {rule?.discount_type === "PERCENT" && (
                                <div className="space-y-1.5">
                                  <Label className="text-xs">Discount %</Label>
                                  <Input type="number" step="0.01" min="0" max="100" className="h-8 text-xs"
                                    value={rule.percent_value || ""} onChange={e => setPercentValue(p.product_id, parseFloat(e.target.value) || 0)} placeholder="e.g. 10" />
                                </div>
                              )}
                            </div>
                          )}

                          {/* FLAT: component inputs */}
                          {rule?.discount_type === "FLAT" && hasComps && (
                            <div className="space-y-2">
                              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Discount per component (BDT)</Label>
                              <div className="grid grid-cols-2 gap-2">
                                {comps.map(c => {
                                  const val = rule.component_mapping[c.component_name] ?? 0;
                                  const exceeds = val > c.amount_bdt;
                                  return (
                                    <div key={c.component_name} className="space-y-0.5">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium">{c.component_name}</span>
                                        <span className="text-[10px] text-muted-foreground">max {formatBDT(c.amount_bdt)}</span>
                                      </div>
                                      <Input type="number" step="0.01" min="0" max={c.amount_bdt}
                                        className={`h-8 text-xs ${exceeds ? "border-destructive" : ""}`}
                                        value={val || ""} onChange={e => setComponentDiscount(p.product_id, c.component_name, parseFloat(e.target.value) || 0)} placeholder="0" />
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="flex justify-between text-xs border-t pt-1.5">
                                <span className="text-muted-foreground">Total Discount:</span>
                                <span className="font-mono font-semibold">{formatBDT(getFlatTotal(rule))}</span>
                              </div>
                            </div>
                          )}

                          {/* PERCENT: component checkboxes */}
                          {rule?.discount_type === "PERCENT" && rule.percent_value > 0 && hasComps && (
                            <div className="space-y-2">
                              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Apply to which components?</Label>
                              <div className="space-y-1">
                                {comps.map(c => (
                                  <label key={c.component_name} className="flex items-center gap-2 text-xs cursor-pointer">
                                    <Checkbox checked={rule.selected_components.includes(c.component_name)}
                                      onCheckedChange={() => togglePercentComponent(p.product_id, c.component_name)} />
                                    <span>{c.component_name}</span>
                                    <span className="ml-auto text-muted-foreground font-mono">{formatBDT(c.amount_bdt)}</span>
                                  </label>
                                ))}
                              </div>
                              {rule.selected_components.length > 0 && (
                                <div className="flex justify-between text-xs border-t pt-1.5">
                                  <span className="text-muted-foreground">Resolved BDT discount:</span>
                                  <span className="font-mono font-semibold">{formatBDT(getPercentBDT(rule, comps))}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* ═══ PHASE 3: Review & Save ═══ */}
              {phase === 3 && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">Review your configuration. All discounts are shown as resolved BDT amounts.</p>

                  {/* Summary cards */}
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="border rounded-md p-3">
                      <p className="text-2xl font-bold text-destructive">{blockedIds.size}</p>
                      <p className="text-xs text-muted-foreground">Blocked</p>
                    </div>
                    <div className="border rounded-md p-3">
                      <p className="text-2xl font-bold text-primary">{exclusiveIds.size}</p>
                      <p className="text-xs text-muted-foreground">Exclusive</p>
                    </div>
                    <div className="border rounded-md p-3">
                      <p className="text-2xl font-bold">{reviewRows.length}</p>
                      <p className="text-xs text-muted-foreground">Discounted</p>
                    </div>
                  </div>

                  {/* Blocked list */}
                  {blockedIds.size > 0 && (
                    <div className="space-y-1">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Blocked Products</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {Array.from(blockedIds).map(id => {
                          const p = allProducts?.find(x => x.product_id === id);
                          return <Badge key={id} variant="destructive" className="text-xs">{p?.product_name ?? id}</Badge>;
                        })}
                      </div>
                    </div>
                  )}

                  {/* Exclusive list */}
                  {exclusiveIds.size > 0 && (
                    <div className="space-y-1">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Exclusive Unlocked</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {Array.from(exclusiveIds).map(id => {
                          const p = allProducts?.find(x => x.product_id === id);
                          return <Badge key={id} variant="secondary" className="text-xs">{p?.product_name ?? id}</Badge>;
                        })}
                      </div>
                    </div>
                  )}

                  {/* Unified discount table — all resolved to absolute BDT */}
                  {reviewRows.length > 0 && (
                    <div className="space-y-1">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Discount Breakdown (Resolved BDT)</h4>
                      <div className="border rounded-md">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Product</TableHead>
                              <TableHead className="text-center">Type</TableHead>
                              <TableHead className="text-right">Base</TableHead>
                              <TableHead className="text-right">VAT</TableHead>
                              <TableHead className="text-right">SD</TableHead>
                              <TableHead className="text-right">Other</TableHead>
                              <TableHead className="text-right font-semibold">Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {reviewRows.map(row => (
                              <TableRow key={row.product_id}>
                                <TableCell className="text-xs font-medium">{row.product_name}</TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="outline" className="text-[10px]">{row.discount_type}</Badge>
                                </TableCell>
                                <TableCell className="text-right text-xs font-mono">{row.base_disc_bdt > 0 ? formatBDT(row.base_disc_bdt) : "—"}</TableCell>
                                <TableCell className="text-right text-xs font-mono">{row.vat_disc_bdt > 0 ? formatBDT(row.vat_disc_bdt) : "—"}</TableCell>
                                <TableCell className="text-right text-xs font-mono">{row.sd_disc_bdt > 0 ? formatBDT(row.sd_disc_bdt) : "—"}</TableCell>
                                <TableCell className="text-right text-xs font-mono">{row.other_disc_bdt > 0 ? formatBDT(row.other_disc_bdt) : "—"}</TableCell>
                                <TableCell className="text-right text-xs font-mono font-semibold">{formatBDT(row.total_disc_bdt)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {/* Validation errors */}
                  {validationErrors.length > 0 && (
                    <Alert variant="destructive">
                      <AlertDescription>
                        <ul className="list-disc pl-4 text-xs space-y-0.5">
                          {validationErrors.map((e, i) => <li key={i}>{e}</li>)}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="flex justify-between sm:justify-between gap-2">
              <Button variant="outline" onClick={closeDialog}>Cancel</Button>
              <div className="flex gap-2">
                {phase > 0 && (
                  <Button variant="outline" onClick={() => setPhase(p => p - 1)}>
                    <ChevronLeft className="h-4 w-4 mr-1" />Back
                  </Button>
                )}
                {phase < 3 ? (
                  <Button onClick={phase === 1 ? goToPhase2 : () => setPhase(p => p + 1)}>
                    Next<ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || validationErrors.length > 0}>
                    <Save className="h-4 w-4 mr-1" />{saveMutation.isPending ? "Saving..." : "Save Rules"}
                  </Button>
                )}
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
