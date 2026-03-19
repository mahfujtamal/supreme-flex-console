import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, AlertTriangle, Info, ShieldCheck } from "lucide-react";
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { formatBDT } from "@/lib/currency";

const RULE_TYPES = ["EXCLUSIVE", "UNAVAILABLE", "DISCOUNT"] as const;
const DISCOUNT_TYPES = ["FLAT", "PERCENT"] as const;

interface DiscountBreakdownRow {
  component_name: string;
  amount: string;
}


export default function ProductRulesTab({ campaignId }: { campaignId: string }) {
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [ruleType, setRuleType] = useState<string>("EXCLUSIVE");
  const [discountType, setDiscountType] = useState<string>("FLAT");
  const [discountValue, setDiscountValue] = useState("");
  const [selectedComponents, setSelectedComponents] = useState<string[]>([]);
  const [flatBreakdown, setFlatBreakdown] = useState<DiscountBreakdownRow[]>([]);
  const { toast } = useToast();
  const qc = useQueryClient();

  /* ── Fetch ALL active products from DB (standard + exclusive, all categories incl. SIM) ── */
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ["products_campaign_lookup"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("product_id, product_name, product_category, is_exclusive, status")
        .eq("status", true)
        .order("product_name");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 0,
  });

  const noExclusiveProducts = ruleType === "EXCLUSIVE" && products && products.filter(p => p.is_exclusive).length === 0;

  const selectedProduct = useMemo(
    () => products?.find(p => p.product_id === productId) ?? null,
    [products, productId],
  );

  /* ── Fetch price components for selected product ── */
  const { data: productComponents } = useQuery({
    queryKey: ["product_price_components", productId],
    enabled: !!productId && ruleType === "DISCOUNT",
    queryFn: async () => {
      const { data: pv } = await supabase
        .from("product_price_versions")
        .select("price_version_id")
        .eq("product_id", productId)
        .eq("status", true)
        .order("start_date", { ascending: false })
        .limit(1)
        .single();
      if (!pv) return [];
      const { data: comps } = await supabase
        .from("price_components")
        .select("component_name, amount_bdt, component_type")
        .eq("price_version_id", pv.price_version_id)
        .order("sort_order");
      return comps ?? [];
    },
  });

  // Reset breakdown when product or discount type changes
  useEffect(() => {
    if (productComponents && discountType === "FLAT") {
      setFlatBreakdown(productComponents.map((c: any) => ({ component_name: c.component_name, amount: "" })));
    }
    if (productComponents && discountType === "PERCENT") {
      setSelectedComponents([]);
    }
  }, [productId, discountType, productComponents]);

  /* ── Existing rules ── */
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

  /* ── Resolved percent discount ── */
  const resolvedPercentDiscount = useMemo(() => {
    if (discountType !== "PERCENT" || !discountValue || !productComponents) return 0;
    const pct = parseFloat(discountValue) / 100;
    return productComponents
      .filter((c: any) => selectedComponents.includes(c.component_name))
      .reduce((s: number, c: any) => s + Number(c.amount_bdt) * pct, 0);
  }, [discountType, discountValue, selectedComponents, productComponents]);

  /* ── Flat breakdown totals & validation ── */
  const flatBreakdownTotal = flatBreakdown.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

  const flatBreakdownValid = useMemo(() => {
    if (discountType !== "FLAT" || !productComponents) return true;
    return flatBreakdown.every(fb => {
      const comp = productComponents.find((c: any) => c.component_name === fb.component_name);
      const amt = parseFloat(fb.amount) || 0;
      return amt >= 0 && (!comp || amt <= Number(comp.amount_bdt));
    });
  }, [flatBreakdown, productComponents, discountType]);

  const flatMatchesTotal = discountType === "FLAT" && discountValue
    ? Math.abs(flatBreakdownTotal - parseFloat(discountValue)) < 0.01
    : true;

  /* ── Mutations ── */
  const addRule = useMutation({
    mutationFn: async () => {
      // DB validation: verify product exclusivity flag
      const { data: product, error: pErr } = await supabase
        .from("products").select("is_exclusive, status").eq("product_id", productId).single();
      if (pErr) throw pErr;
      if (!product.status) throw new Error("Product is inactive.");
      if (ruleType === "EXCLUSIVE" && !product.is_exclusive) throw new Error("Product is not marked Exclusive in the Product Master.");
      if (ruleType !== "EXCLUSIVE" && product.is_exclusive) throw new Error("Exclusive products can only be used with EXCLUSIVE rule type.");

      const payload: any = {
        campaign_id: campaignId,
        product_id: productId,
        rule_type: ruleType as any,
      };
      if (ruleType === "DISCOUNT") {
        payload.discount_type = discountType as any;
        if (discountType === "PERCENT") {
          payload.discount_value = parseFloat(discountValue);
          payload.applicable_components = selectedComponents;
        } else {
          payload.discount_value = parseFloat(discountValue);
          payload.applicable_components = flatBreakdown.filter(f => parseFloat(f.amount) > 0).map(f => f.component_name);
        }
      }
      const { data: rule, error } = await supabase.from("campaign_product_rules").insert(payload).select("rule_id").single();
      if (error) throw error;

      if (ruleType === "DISCOUNT") {
        let mappings: any[] = [];
        if (discountType === "PERCENT" && productComponents) {
          const pct = parseFloat(discountValue) / 100;
          mappings = productComponents
            .filter((c: any) => selectedComponents.includes(c.component_name))
            .map((c: any) => ({
              rule_id: rule.rule_id,
              component_name: c.component_name,
              discount_amount_bdt: Math.round(Number(c.amount_bdt) * pct * 100) / 100,
            }));
        } else {
          mappings = flatBreakdown
            .filter(f => parseFloat(f.amount) > 0)
            .map(f => ({
              rule_id: rule.rule_id,
              component_name: f.component_name,
              discount_amount_bdt: parseFloat(f.amount),
            }));
        }
        if (mappings.length) {
          const { error: mErr } = await supabase.from("campaign_discount_mappings").insert(mappings);
          if (mErr) throw mErr;
        }
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["product_rules", campaignId] }); closeDialog(); toast({ title: "Product rule added" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteRule = useMutation({
    mutationFn: async (ruleId: string) => {
      const { error } = await supabase.from("campaign_product_rules").delete().eq("rule_id", ruleId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["product_rules", campaignId] }); toast({ title: "Rule removed" }); },
  });

  const closeDialog = () => {
    setOpen(false); setProductId(""); setRuleType("EXCLUSIVE"); setDiscountType("FLAT");
    setDiscountValue(""); setSelectedComponents([]); setFlatBreakdown([]);
  };

  const handleRuleTypeChange = (val: string) => { setRuleType(val); setProductId(""); };
  const updateFlatAmount = (idx: number, val: string) => {
    setFlatBreakdown(prev => prev.map((r, i) => i === idx ? { ...r, amount: val } : r));
  };
  const toggleComponent = (name: string) => {
    setSelectedComponents(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  };

  const canSave = productId && ruleType && (
    ruleType !== "DISCOUNT" || (
      discountValue && parseFloat(discountValue) > 0 && (
        discountType === "PERCENT"
          ? selectedComponents.length > 0
          : flatMatchesTotal && flatBreakdownValid
      )
    )
  );

  return (
    <TooltipProvider>
      <div className="space-y-4 pt-2">
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1.5" />Add Product Rule</Button>
        </div>

        {/* ── Rules table ── */}
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
                          <TooltipTrigger asChild>
                            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                          </TooltipTrigger>
                          <TooltipContent>Exclusive product — only available under this campaign</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {r.products?.is_exclusive ? "EXCLUSIVE" : r.products?.product_category}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.rule_type === "DISCOUNT" ? "default" : r.rule_type === "UNAVAILABLE" ? "destructive" : "secondary"} className="text-xs">
                      {r.rule_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.rule_type === "DISCOUNT"
                      ? r.discount_type === "PERCENT"
                        ? `${r.discount_value}%`
                        : formatBDT(r.discount_value)
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

        {/* ── Dialog ── */}
        <Dialog open={open} onOpenChange={(v) => { if (!v) closeDialog(); }}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Add Product Rule</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              {/* Rule type */}
              <div className="space-y-2">
                <Label>Rule Type</Label>
                <Select value={ruleType} onValueChange={handleRuleTypeChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{RULE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {noExclusiveProducts && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>No Exclusive products found. Please mark a product as Exclusive in the Product Master first.</AlertDescription>
                </Alert>
              )}

              {/* Product selection — live from DB with loading state */}
              <div className="space-y-2">
                <Label>Select Product</Label>
                <Select value={productId} onValueChange={setProductId} disabled={!!noExclusiveProducts || productsLoading}>
                  <SelectTrigger>
                    <SelectValue placeholder={productsLoading ? "Loading products..." : noExclusiveProducts ? "No eligible products" : "Select product"} />
                  </SelectTrigger>
                  <SelectContent>
                    {productsLoading ? (
                      <div className="py-4 text-center text-sm text-muted-foreground">Loading...</div>
                    ) : (
                      products?.map(p => (
                        <SelectItem key={p.product_id} value={p.product_id}>
                          {p.product_name} [{p.product_category}]{p.is_exclusive ? " ⭐ Exclusive" : ""}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Exclusive product warning */}
              {selectedProduct?.is_exclusive && (
                <Alert className="border-primary/30 bg-primary/5">
                  <Info className="h-4 w-4 text-primary" />
                  <AlertDescription className="text-sm">
                    This product will only be available for sale under this specific campaign.
                  </AlertDescription>
                </Alert>
              )}

              {/* Discount fields */}
              {ruleType === "DISCOUNT" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Discount Type</Label>
                      <Select value={discountType} onValueChange={setDiscountType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{DISCOUNT_TYPES.map(d => <SelectItem key={d} value={d}>{d === "FLAT" ? "Absolute BDT" : "Percentage %"}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{discountType === "PERCENT" ? "Discount %" : "Total Discount (BDT)"}</Label>
                      <Input type="number" step="0.01" min="0" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder={discountType === "PERCENT" ? "e.g. 10" : "e.g. 500"} />
                    </div>
                  </div>

                  {/* PERCENT: component checkboxes */}
                  {discountType === "PERCENT" && productComponents && productComponents.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Apply to which components?</Label>
                      <div className="space-y-1.5">
                        {productComponents.map((c: any) => (
                          <label key={c.component_name} className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox
                              checked={selectedComponents.includes(c.component_name)}
                              onCheckedChange={() => toggleComponent(c.component_name)}
                            />
                            <span>{c.component_name}</span>
                            <span className="text-muted-foreground ml-auto font-mono text-xs">{formatBDT(Number(c.amount_bdt))}</span>
                          </label>
                        ))}
                      </div>
                      {discountValue && selectedComponents.length > 0 && (
                        <div className="text-sm border-t pt-2 flex justify-between">
                          <span className="text-muted-foreground">Resolved BDT discount:</span>
                          <span className="font-mono font-semibold">{formatBDT(resolvedPercentDiscount)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* FLAT: per-component breakdown with prices */}
                  {discountType === "FLAT" && flatBreakdown.length > 0 && discountValue && (
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                        Breakdown: Where is the {formatBDT(parseFloat(discountValue) || 0)} subtracted from?
                      </Label>
                      <div className="space-y-2">
                        {flatBreakdown.map((fb, idx) => {
                          const comp = productComponents?.find((c: any) => c.component_name === fb.component_name);
                          const max = comp ? Number(comp.amount_bdt) : 0;
                          const amt = parseFloat(fb.amount) || 0;
                          const exceeds = amt > max;
                          return (
                            <div key={fb.component_name} className="space-y-0.5">
                              <div className="flex items-center gap-3">
                                <span className="w-28 text-sm font-medium truncate">{fb.component_name}: {formatBDT(max)}</span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max={max}
                                  placeholder={`Discount on ${fb.component_name}`}
                                  value={fb.amount}
                                  onChange={(e) => updateFlatAmount(idx, e.target.value)}
                                  className={`flex-1 ${exceeds ? "border-destructive" : ""}`}
                                />
                                <span className="text-xs text-muted-foreground w-20 text-right">max {formatBDT(max)}</span>
                              </div>
                              {exceeds && (
                                <p className="text-xs text-destructive ml-28 pl-3">Discount cannot exceed {formatBDT(max)}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex justify-between text-sm border-t pt-2">
                        <span className="text-muted-foreground">Breakdown total:</span>
                        <span className={`font-mono font-semibold ${flatMatchesTotal ? "text-emerald-600" : "text-destructive"}`}>
                          {formatBDT(flatBreakdownTotal)} / {formatBDT(parseFloat(discountValue) || 0)}
                        </span>
                      </div>
                      {!flatMatchesTotal && (
                        <p className="text-xs text-destructive">Component breakdown must equal the total discount.</p>
                      )}
                      {!flatBreakdownValid && (
                        <p className="text-xs text-destructive">A discount cannot exceed its component value (no negative values).</p>
                      )}
                    </div>
                  )}

                  {discountType === "PERCENT" && productId && productComponents && productComponents.length === 0 && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>No price components found for this product. Please set up component-based pricing in the Pricing Engine first.</AlertDescription>
                    </Alert>
                  )}
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button onClick={() => addRule.mutate()} disabled={!canSave || addRule.isPending}>{addRule.isPending ? "Adding..." : "Add Rule"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
